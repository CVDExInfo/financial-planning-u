import { useState, ReactNode } from 'react';
import type { UserRole } from '@/types/domain';
import { RoleContext } from '@/hooks/useRole';

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [currentRole, setCurrentRole] = useState<UserRole>('PMO'); // Default for demo

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const hasRole = () => {
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