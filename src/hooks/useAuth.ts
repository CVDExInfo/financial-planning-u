/**
 * useAuth Hook - Primary hook for accessing authentication and role state
 * 
 * This hook provides access to the AuthContext created by AuthProvider.
 * It is the ONLY way to access authentication state and methods.
 * 
 * IMPORTANT: This hook must be used within an <AuthProvider> component tree.
 * Using it outside of AuthProvider will throw an error.
 * 
 * Returns the full AuthContext including:
 * - Authentication state (user, isAuthenticated, isLoading, error)
 * - Role management (currentRole, availableRoles, setRole)
 * - Permission checking (canAccessRoute, canPerformAction)
 * - Authentication actions (signIn, signOut, loginWithCognito)
 * 
 * @example
 *   const { user, isAuthenticated, loginWithCognito, signOut } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <Login />;
 *   }
 *   
 *   return <div>Welcome, {user?.login}</div>;
 * 
 * @throws {Error} If used outside of AuthProvider
 * @see AuthProvider for the context provider
 */
import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
      "Make sure your component tree is wrapped with <AuthProvider>."
    );
  }
  return context;
}

/**
 * useCurrentUser - Convenience hook for accessing just the user object
 * 
 * @returns UserInfo | null
 */
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

/**
 * useCurrentRole - Convenience hook for accessing role management
 * 
 * @returns Object with currentRole, setRole, and availableRoles
 */
export function useCurrentRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  return { currentRole, setRole, availableRoles };
}

/**
 * usePermissions - Convenience hook for accessing permission checks
 * 
 * @returns Object with canAccessRoute and canPerformAction functions
 */
export function usePermissions() {
  const { canAccessRoute, canPerformAction } = useAuth();
  return { canAccessRoute, canPerformAction };
}
