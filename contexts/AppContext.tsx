import React, { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';

// Re-export provider causing a composed tree
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </AuthProvider>
  );
};

// Facade Hook
export const useApp = () => {
  const auth = useAuth();
  const data = useData();

  const refreshUserData = () => {
    auth.refreshIdentity();
    data.refreshUserData();
  };

  return {
    ...auth,
    ...data,
    refreshUserData // Override to call both
  };
};