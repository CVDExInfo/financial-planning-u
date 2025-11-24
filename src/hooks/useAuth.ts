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
 * - Authentication state (user, isAuthenticated, isLoading)
 * - Cognito-derived groups and roles
 * - Authentication actions (login, logout)
 * 
 * @example
 *   const { user, isAuthenticated, login, logout } = useAuth();
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
import { useContext } from "react";
import { AuthContext } from "@/components/AuthProvider";

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
