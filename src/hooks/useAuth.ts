import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Convenience hooks for common use cases
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useCurrentRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  return { currentRole, setRole, availableRoles };
}

export function usePermissions() {
  const { canAccessRoute, canPerformAction } = useAuth();
  return { canAccessRoute, canPerformAction };
}
