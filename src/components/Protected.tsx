import { ReactNode } from 'react';
import { UserRole } from '@/types/domain';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedProps {
  children: ReactNode;
  /** Required roles to see this content */
  roles?: UserRole[];
  /** Required action permission to see this content */
  action?: string;
  /** Minimum role level required */
  minimumRole?: UserRole;
  /** Hide content instead of showing fallback */
  hideWhenDenied?: boolean;
  /** Custom fallback component when access is denied */
  fallback?: ReactNode;
}

/**
 * Component for conditionally rendering content based on user permissions
 */
export function Protected({
  children,
  roles,
  action,
  minimumRole,
  hideWhenDenied = true,
  fallback = null
}: ProtectedProps) {
  const { hasAnyRole, canPerformAction, hasMinimumRole } = usePermissions();

  let hasAccess = true;

  // Check role-based access
  if (roles && roles.length > 0) {
    hasAccess = hasAccess && hasAnyRole(roles);
  }

  // Check action-based access
  if (action) {
    hasAccess = hasAccess && canPerformAction(action);
  }

  // Check minimum role access
  if (minimumRole) {
    hasAccess = hasAccess && hasMinimumRole(minimumRole);
  }

  if (!hasAccess) {
    if (hideWhenDenied) {
      return null;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default Protected;