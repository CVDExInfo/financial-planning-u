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
   * Check if a specific role is available to the user
   * This checks if the role exists in the user's available roles list,
   * not if it's the currently active role.
   * 
   * @param role - The role to check for availability
   * @returns true if the user has access to this role
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
