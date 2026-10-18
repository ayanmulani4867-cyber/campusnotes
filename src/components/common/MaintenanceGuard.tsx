import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToMaintenanceMode } from '../../services/firebaseService';
import { MaintenanceNotice } from './MaintenanceNotice';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export const MaintenanceGuard: React.FC<MaintenanceGuardProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Always default to false - public site should never be locked out by stale local cache
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);

  useEffect(() => {
    // Clear any stale local storage flags that might have erroneously persisted
    try {
      localStorage.removeItem('campusnotes_maintenance_mode');
    } catch {
      // Ignore
    }

    const unsub = subscribeToMaintenanceMode((isMaint) => {
      setMaintenanceMode(isMaint);
    });
    return () => unsub();
  }, []);

  const isAdminRoute = location.pathname.startsWith('/admin');

  // Only lock down if maintenance mode is confirmed active by the database
  // and visitor is not an authenticated administrator
  if (maintenanceMode && !isAuthenticated && !isAdminRoute) {
    return <MaintenanceNotice />;
  }

  return <>{children}</>;
};
