/**
 * useRole Hook - Thin wrapper over useAuth for role management
 * 
 * This hook provides role-specific functionality by delegating to AuthProvider.
 * It does NOT maintain its own state or context.
 * 
 * @deprecated RoleProvider is deprecated. Use AuthProvider as the single source of truth.
 * 
 * Usage:
 *   const { currentRole, setRole, hasRole, availableRoles } = useRole();
 */
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

export function useRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  
  const hasRole = (role: UserRole): boolean => {
    return availableRoles.includes(role);
  };
  
  return {
    currentRole,
    setRole,
    hasRole,
    availableRoles,
  };
}
