import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

/**
 * Hook for accessing role management functionality
 * 
 * This hook derives all role state from the AuthProvider context,
 * ensuring a single source of truth for authentication and authorization.
 * 
 * @returns Role management functions and current role state
 */
export function useRole() {
  const { currentRole, setRole, availableRoles } = useAuth();

  /**
   * Check if user has a specific role
   */
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
