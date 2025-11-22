/**
 * useAuth - Primary hook for accessing authentication state and actions
 * 
 * This hook provides access to the AuthProvider context and is the ONLY
 * way components should access authentication state.
 * 
 * USAGE:
 *   const { user, isAuthenticated, currentRole, loginWithCognito, signOut } = useAuth();
 * 
 * ERROR HANDLING:
 *   Throws an error if used outside of AuthProvider to catch wiring mistakes early.
 * 
 * @see docs/finanzas-auth-notes.md for usage examples and patterns
 * @throws {Error} If used outside of AuthProvider
 */
import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Convenience hook: Returns just the user object
 */
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

/**
 * Convenience hook: Returns role management functions
 */
export function useCurrentRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  return { currentRole, setRole, availableRoles };
}

/**
 * Convenience hook: Returns permission checking functions
 */
export function usePermissions() {
  const { canAccessRoute, canPerformAction } = useAuth();
  return { canAccessRoute, canPerformAction };
}
