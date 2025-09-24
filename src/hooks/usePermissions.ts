import { useAuth } from '@/components/AuthProvider';
import { UserRole } from '@/types/domain';
import { canAccessRoute, canPerformAction } from '@/lib/auth';

/**
 * Hook for checking permissions and access control
 */
export function usePermissions() {
  const { currentRole } = useAuth();

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(route, currentRole);
  };

  const checkActionPermission = (action: string): boolean => {
    return canPerformAction(action, currentRole);
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.includes(currentRole);
  };

  const hasMinimumRole = (minimumRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'VENDOR': 1,
      'SDMT': 2, 
      'PMO': 3,
      'EXEC_RO': 4,
    };
    
    return (roleHierarchy[currentRole] || 0) >= (roleHierarchy[minimumRole] || 0);
  };

  const isReadOnly = (): boolean => {
    return currentRole === 'EXEC_RO' || !checkActionPermission('update');
  };

  const canCreate = (): boolean => {
    return checkActionPermission('create');
  };

  const canUpdate = (): boolean => {
    return checkActionPermission('update');
  };

  const canDelete = (): boolean => {
    return checkActionPermission('delete');
  };

  const canApprove = (): boolean => {
    return checkActionPermission('approve');
  };

  return {
    currentRole,
    canAccessRoute: checkRouteAccess,
    canPerformAction: checkActionPermission,
    hasAnyRole,
    hasMinimumRole,
    isReadOnly,
    canCreate,
    canUpdate,
    canDelete,
    canApprove,
  };
}

export default usePermissions;