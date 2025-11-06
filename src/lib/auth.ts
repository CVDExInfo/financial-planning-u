import { UserRole, UserInfo, ModuleType } from '@/types/domain';

/**
 * Authentication and authorization utilities
 */

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'VENDOR': 1,
  'SDMT': 2, 
  'PMO': 3,
  'EXEC_RO': 4,
};

// Role permissions mapping
const ROLE_PERMISSIONS = {
  PMO: {
    routes: ['/pmo/**', '/sdmt/**', '/finanzas/**'],
    actions: ['create', 'read', 'update', 'delete', 'approve'],
    description: 'Full access to PMO estimator and SDMT cost management'
  },
  SDMT: {
    routes: ['/sdmt/**', '/finanzas/**'],
    actions: ['create', 'read', 'update', 'delete'],
    description: 'Full access to SDMT cost management modules'
  },
  VENDOR: {
    routes: ['/sdmt/cost/catalog', '/sdmt/cost/reconciliation'],
    actions: ['read', 'update'],
    description: 'Limited access to cost catalog and reconciliation uploads'
  },
  EXEC_RO: {
    routes: ['/pmo/**', '/sdmt/**', '/finanzas/**'],
    actions: ['read'],
    description: 'Read-only access to all modules for executive reporting'
  }
};

/**
 * Default role assignments based on user attributes
 * In a real system, this would come from a user management API
 */
export function getDefaultUserRole(user: UserInfo): UserRole {
  const email = user.email.toLowerCase();
  const login = user.login.toLowerCase();
  
  // Owner gets PMO access by default
  if (user.isOwner) {
    return 'PMO';
  }
  
  // Role detection based on email domain or username patterns
  if (email.includes('pmo') || login.includes('pmo')) {
    return 'PMO';
  }
  
  if (email.includes('sdmt') || login.includes('sdmt') || email.includes('delivery')) {
    return 'SDMT';
  }
  
  if (email.includes('vendor') || email.includes('contractor') || email.includes('external')) {
    return 'VENDOR';
  }
  
  if (email.includes('exec') || email.includes('director') || email.includes('manager')) {
    return 'EXEC_RO';
  }
  
  // Default to SDMT for most users
  return 'SDMT';
}

/**
 * Get all available roles for a user
 * In a real system, this would be based on user's assigned permissions
 */
export function getAvailableRoles(user: UserInfo): UserRole[] {
  // Owners and PMO users can switch to any role for demonstration
  if (user.isOwner || user.email.toLowerCase().includes('pmo')) {
    return ['PMO', 'SDMT', 'VENDOR', 'EXEC_RO'];
  }
  
  // Other users get their default role + read-only access
  const defaultRole = getDefaultUserRole(user);
  const roles: UserRole[] = [defaultRole];
  
  // Add executive read-only as an option for most users
  if (defaultRole !== 'EXEC_RO') {
    roles.push('EXEC_RO');
  }
  
  return roles;
}

/**
 * Check if a user can access a specific route with their current role
 */
export function canAccessRoute(route: string, role: UserRole): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  
  return permissions.routes.some(pattern => {
    // Convert glob pattern to regex
    const regex = new RegExp(
      pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
    );
    return regex.test(route);
  });
}

/**
 * Check if a user can perform a specific action
 */
export function canPerformAction(action: string, role: UserRole): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.actions.includes(action);
}

/**
 * Get role hierarchy level for comparison
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if one role has higher or equal permissions than another
 */
export function hasRolePermission(currentRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(requiredRole);
}

/**
 * Get role display information
 */
export function getRoleInfo(role: UserRole) {
  const permissions = ROLE_PERMISSIONS[role];
  return {
    role,
    label: role.replace('_', ' '),
    description: permissions.description,
    level: getRoleLevel(role)
  };
}

/**
 * Generate appropriate redirect path based on role
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'PMO':
      return '/pmo/prefactura/estimator';
    case 'SDMT':
      return '/sdmt/cost/catalog';
    case 'VENDOR':
      return '/sdmt/cost/catalog';
    case 'EXEC_RO':
      return '/sdmt/cost/cashflow'; // Executives likely want to see cash flow first
    default:
      return '/';
  }
}

/**
 * Mock user database for demonstration
 * In a real system, this would be replaced with actual user management
 */
export const DEMO_USERS: Record<string, Partial<UserInfo>> = {
  'demo-user': {
    roles: ['PMO', 'SDMT', 'EXEC_RO'],
    current_role: 'PMO'
  },
  'pmo-user': {
    roles: ['PMO', 'EXEC_RO'],
    current_role: 'PMO'
  },
  'sdmt-user': {
    roles: ['SDMT', 'EXEC_RO'],
    current_role: 'SDMT'
  },
  'vendor-user': {
    roles: ['VENDOR'],
    current_role: 'VENDOR'
  },
  'exec-user': {
    roles: ['EXEC_RO'],
    current_role: 'EXEC_RO'
  }
};

/**
 * Get the current module context for display
 * Determines whether to show PMO or SDMT module badge based on user role and route
 */
export function getCurrentModuleContext(currentPath: string, userRole: UserRole): ModuleType {
  // If user is on a PMO route, always show PMO
  if (currentPath.startsWith('/pmo/')) {
    return 'PMO';
  }
  
  // For SDMT routes, show the module based on the user's primary role
  if (currentPath.startsWith('/sdmt/')) {
    // PMO users accessing SDMT routes are still working in their PMO capacity
    if (userRole === 'PMO') {
      return 'PMO';
    }
    // SDMT and vendor users show SDMT
    return 'SDMT';
  }
  
  // Default fallback
  return userRole === 'PMO' ? 'PMO' : 'SDMT';
}