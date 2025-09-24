import { createContext, useContext, useState, ReactNode } from 'react';
import type { UserRole } from '@/types/domain';

interface RoleContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  hasRole: (role: UserRole) => boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [currentRole, setCurrentRole] = useState<UserRole>('PMO'); // Default for demo

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const hasRole = (role: UserRole) => {
    // For demo purposes, allow role switching
    // In production, this would check against actual user permissions
    return true;
  };

  return (
    <RoleContext.Provider value={{ currentRole, setRole, hasRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}