import React, { createContext, useContext, useEffect, useState } from 'react';
import { AdminUser } from '../types';
import { subscribeToAdminAuth, loginAdmin, logoutAdmin } from '../services/authService';

interface AuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((adminUser, isLoading) => {
      setAdmin(adminUser);
      setLoading(isLoading);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    const user = await loginAdmin(email, pass);
    setAdmin(user);
    return user;
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        login: handleLogin,
        logout: handleLogout,
        isAuthenticated: Boolean(admin?.isAuthorizedAdmin),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
