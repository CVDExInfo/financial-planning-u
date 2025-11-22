/**
 * @deprecated RoleProvider is deprecated as of PR-221.
 * 
 * AuthProvider now manages both authentication and role state as the single source of truth.
 * This component is kept only for backward compatibility and will be removed in a future release.
 * 
 * DO NOT USE THIS COMPONENT. Use <AuthProvider> instead.
 * 
 * Migration:
 *   Before: <RoleProvider><AuthProvider>...</AuthProvider></RoleProvider>
 *   After:  <AuthProvider>...</AuthProvider>
 */
import { ReactNode, useEffect } from 'react';

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  useEffect(() => {
    console.warn(
      '[RoleProvider] DEPRECATED: RoleProvider is no longer needed. ' +
      'AuthProvider now manages role state. Please remove RoleProvider from your component tree.'
    );
  }, []);

  // Pass-through children without any context
  return <>{children}</>;
}