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
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(() => {
    return localStorage.getItem('campusnotes_maintenance_mode') === 'true';
  });

  useEffect(() => {
    const unsub = subscribeToMaintenanceMode((isMaint) => {
      setMaintenanceMode(isMaint);
    });
    return () => unsub();
  }, []);

  const isAdminRoute = location.pathname.startsWith('/admin');

  // If maintenance mode is ON and visitor is not an authenticated administrator,
  // block all public routes and show only the maintenance notice.
  if (maintenanceMode && !isAuthenticated && !isAdminRoute) {
    return <MaintenanceNotice />;
  }

  return <>{children}</>;
};
