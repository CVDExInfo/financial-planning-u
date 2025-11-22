/**
 * @deprecated This component is deprecated and should not be used.
 * 
 * Role management is now handled by AuthProvider.
 * Use `useRole()` hook which derives state from AuthProvider instead.
 * 
 * This file is kept for reference only and will be removed in a future cleanup.
 */

import { ReactNode } from 'react';

interface RoleProviderProps {
  children: ReactNode;
}

/**
 * @deprecated Use AuthProvider instead. Role state is managed in AuthProvider.
 */
export function RoleProvider({ children }: RoleProviderProps) {
  console.warn(
    'RoleProvider is deprecated. Role management is handled by AuthProvider. ' +
    'This component should not be used and will be removed in a future update.'
  );
  
  // This is a no-op component now - just renders children
  return <>{children}</>;
}