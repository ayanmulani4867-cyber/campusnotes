import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToMaintenanceMode } from '../../services/firebaseService';
import { MaintenanceNotice } from './MaintenanceNotice';

export const MAINTENANCE_STORAGE_KEY = 'campusnotes_maintenance_mode';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

/**
 * Safe, neutral loading placeholder displayed while maintenance status is being resolved.
 * Strictly prevents any protected page content, subjects, materials, or navbar from rendering.
 */
export const MaintenanceCheckingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600 tracking-wide">Loading CampusNotes...</p>
      </div>
    </div>
  );
};

export const MaintenanceGuard: React.FC<MaintenanceGuardProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // 1. Synchronously initialize from local storage cache to guarantee 0ms flash on refresh
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MAINTENANCE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // 2. If already confirmed true from local storage, we can render the notice immediately.
  // Otherwise, we must check Firebase before rendering protected content.
  const [isChecking, setIsChecking] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MAINTENANCE_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let isMounted = true;

    // Safety fallback: if Firebase RTDB does not resolve within 5 seconds, release checking lock
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setIsChecking(false);
      }
    }, 5000);

    const unsub = subscribeToMaintenanceMode((isMaint) => {
      if (!isMounted) return;
      clearTimeout(timeoutId);
      try {
        localStorage.setItem(MAINTENANCE_STORAGE_KEY, isMaint ? 'true' : 'false');
      } catch {
        // Ignore storage access errors
      }
      setMaintenanceMode(isMaint);
      setIsChecking(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPrivateShareRoute =
    location.pathname.startsWith('/private-assignment') ||
    location.pathname.startsWith('/private-share');

  // Guard 1: Authorized administrator routes and direct private share links are always accessible
  if (isAdminRoute || isPrivateShareRoute) {
    return <>{children}</>;
  }

  // Guard 2: Maintenance mode is active (cached or confirmed by database)
  if (maintenanceMode) {
    // If visitor is confirmed to be an authorized admin, allow full access
    if (isAuthenticated) {
      return <>{children}</>;
    }
    // For all visitors, render only the maintenance notice (zero protected content)
    return <MaintenanceNotice />;
  }

  // Guard 3: While maintenance status is still being checked from Firebase,
  // prevent protected content (HomePage, Materials, Subjects) from rendering
  if (isChecking) {
    return <MaintenanceCheckingScreen />;
  }

  // Guard 4: Maintenance mode confirmed disabled: normal public access restored
  return <>{children}</>;
};
