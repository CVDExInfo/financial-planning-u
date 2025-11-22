import { useContext, createContext } from 'react';
import type { UserRole } from '@/types/domain';

interface RoleContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  hasRole: (role: UserRole) => boolean;
}

export const RoleContext = createContext<RoleContextType | null>(null);

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
