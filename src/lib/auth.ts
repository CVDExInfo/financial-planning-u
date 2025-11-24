import { UserRole, UserInfo, ModuleType } from "@/types/domain";

/**
 * Authentication and authorization utilities
 */

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  VENDOR: 1,
  SDMT: 2,
  PMO: 3,
  EXEC_RO: 4,
};

const IS_FINZ_BUILD =
  import.meta.env.VITE_FINZ_ENABLED === "true" ||
  (typeof window !== "undefined" && window.location.pathname.startsWith("/finanzas"));

// Role permissions mapping
const ROLE_PERMISSIONS = {
  PMO: {
    // Allow PMO to access PMO and SDMT modules, plus Finanzas (feature) routes
    routes: [
      "/",
      "/pmo/**",
      "/sdmt/**",
      "/projects/**",
      "/catalog/**",
      "/rules",
      "/adjustments/**",
      "/providers/**",
    ],
    actions: ["create", "read", "update", "delete", "approve"],
    description: "Full access to PMO estimator and SDMT cost management",
  },
  SDMT: {
    // SDMT module plus Finanzas (feature) routes
    routes: [
      "/",
      "/sdmt/**",
      "/projects/**",
      "/catalog/**",
      "/rules",
      "/adjustments/**",
      "/providers/**",
    ],
    actions: ["create", "read", "update", "delete"],
    description: "Full access to SDMT cost management modules",
  },
  VENDOR: {
    // Limited SDMT access and read to Finanzas catalog
    routes: ["/sdmt/cost/catalog", "/sdmt/cost/reconciliation", "/catalog/**"],
    actions: ["read", "update"],
    description: "Limited access to cost catalog and reconciliation uploads",
  },
  EXEC_RO: {
    // Read-only across PMO/SDMT and Finanzas routes
    routes: ["/pmo/**", "/sdmt/**", "/catalog/**", "/rules"],
    actions: ["read"],
    description: "Read-only access to all modules for executive reporting",
  },
};

export function getRolePermissionKeys(): UserRole[] {
  return Object.keys(ROLE_PERMISSIONS) as UserRole[];
}

export function getRoutesForRole(role: UserRole) {
  const config = ROLE_PERMISSIONS[role];
  if (!config || !Array.isArray(config.routes)) {
    console.error("[Router] No routes configured for role", {
      role,
      availableRoles: getRolePermissionKeys(),
      config,
    });
    return { routes: [], hasConfig: false } as const;
  }
  return { routes: config.routes, hasConfig: true } as const;
}

export function getActionsForRole(role: UserRole) {
  const config = ROLE_PERMISSIONS[role];
  if (!config || !Array.isArray(config.actions)) {
    console.error("[Auth] No actions configured for role", {
      role,
      availableRoles: getRolePermissionKeys(),
      config,
    });
    return { actions: [], hasConfig: false } as const;
  }
  return { actions: config.actions, hasConfig: true } as const;
}

/**
 * Default role assignments based on user attributes
 * In a real system, this would come from a user management API
 */
export function getDefaultUserRole(user: UserInfo): UserRole {
  const email = user.email.toLowerCase();
  const login = user.login.toLowerCase();

  // Owner gets PMO access by default
  if (user.isOwner) {
    return "PMO";
  }

  // Role detection based on email domain or username patterns
  if (email.includes("pmo") || login.includes("pmo")) {
    return "PMO";
  }

  if (
    email.includes("sdmt") ||
    login.includes("sdmt") ||
    email.includes("delivery")
  ) {
    return "SDMT";
  }

  if (
    email.includes("vendor") ||
    email.includes("contractor") ||
    email.includes("external")
  ) {
    return "VENDOR";
  }

  if (
    email.includes("exec") ||
    email.includes("director") ||
    email.includes("manager")
  ) {
    return "EXEC_RO";
  }

  // Default to SDMT for most users
  return "SDMT";
}

/**
 * Get all available roles for a user
 * Priority: 1) Use JWT roles if available, 2) Infer from user attributes
 */
export function getAvailableRoles(user: UserInfo): UserRole[] {
  // If user has JWT-provided roles (from Cognito groups), use them
  if (user.roles && user.roles.length > 0) {
    // User has explicit roles from JWT/Cognito groups
    // Add EXEC_RO as option if not already present (for reporting)
    const roles = [...user.roles];
    if (!roles.includes("EXEC_RO")) {
      roles.push("EXEC_RO");
    }
    return roles;
  }

  // Fallback: Owners and PMO users can switch to any role for demonstration
  if (user.isOwner || user.email.toLowerCase().includes("pmo")) {
    return ["PMO", "SDMT", "VENDOR", "EXEC_RO"];
  }

  // Other users get their default role + read-only access
  const defaultRole = getDefaultUserRole(user);
  const roles: UserRole[] = [defaultRole];

  // Add executive read-only as an option for most users
  if (defaultRole !== "EXEC_RO") {
    roles.push("EXEC_RO");
  }

  return roles;
}

/**
 * Check if a user can access a specific route with their current role
 */
export function canAccessRoute(route: string, role: UserRole): boolean {
  const { routes } = getRoutesForRole(role);

  return routes.some((pattern) => {
    // Convert glob pattern to regex
    const regex = new RegExp(
      pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
    );
    return regex.test(route);
  });
}

/**
 * Check if a user can perform a specific action
 */
export function canPerformAction(action: string, role: UserRole): boolean {
  const { actions } = getActionsForRole(role);
  return actions.includes(action);
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
export function hasRolePermission(
  currentRole: UserRole,
  requiredRole: UserRole
): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(requiredRole);
}

/**
 * Get role display information
 */
export function getRoleInfo(role: UserRole) {
  const permissions = ROLE_PERMISSIONS[role];
  return {
    role,
    label: role.replace("_", " "),
    description: permissions?.description || "",
    level: getRoleLevel(role),
  };
}

/**
 * Generate appropriate redirect path based on role
 */
export function getDefaultRouteForRole(role: UserRole): string {
  if (IS_FINZ_BUILD) {
    // In Finanzas-only deployments, always land on the Finanzas shell
    return "/";
  }

  switch (role) {
    case "PMO":
      return "/pmo/prefactura/estimator";
    case "SDMT":
      return "/sdmt/cost/catalog";
    case "VENDOR":
      return "/sdmt/cost/catalog";
    case "EXEC_RO":
      return "/sdmt/cost/cashflow"; // Executives likely want to see cash flow first
    default:
      return "/";
  }
}

/**
 * Mock user database for demonstration
 * In a real system, this would be replaced with actual user management
 */
export const DEMO_USERS: Record<string, Partial<UserInfo>> = {
  "demo-user": {
    roles: ["PMO", "SDMT", "EXEC_RO"],
    current_role: "PMO",
  },
  "pmo-user": {
    roles: ["PMO", "EXEC_RO"],
    current_role: "PMO",
  },
  "sdmt-user": {
    roles: ["SDMT", "EXEC_RO"],
    current_role: "SDMT",
  },
  "vendor-user": {
    roles: ["VENDOR"],
    current_role: "VENDOR",
  },
  "exec-user": {
    roles: ["EXEC_RO"],
    current_role: "EXEC_RO",
  },
};

/**
 * Get the current module context for display
 * Determines whether to show PMO or SDMT module badge based on user role and route
 */
export function getCurrentModuleContext(
  currentPath: string,
  userRole: UserRole
): ModuleType {
  // If user is on a PMO route, always show PMO
  if (currentPath.startsWith("/pmo/")) {
    return "PMO";
  }

  // For SDMT routes, show the module based on the user's primary role
  if (currentPath.startsWith("/sdmt/")) {
    // PMO users accessing SDMT routes are still working in their PMO capacity
    if (userRole === "PMO") {
      return "PMO";
    }
    // SDMT and vendor users show SDMT
    return "SDMT";
  }

  // Default fallback
  return userRole === "PMO" ? "PMO" : "SDMT";
}

/**
 * Check if user should have access to the Finanzas (SDT) module
 * Based on Cognito groups: SDT, FIN, AUD
 * 
 * @param userRoles User's mapped roles from Cognito groups
 * @returns true if user has access to Finanzas module
 */
export function canAccessFinanzasModule(userRoles: UserRole[]): boolean {
  // Users with SDMT role (mapped from SDT, FIN, AUD groups) have access
  return userRoles.includes("SDMT");
}

/**
 * Check if user should have access to the PMO module
 * Based on Cognito groups: PMO, EXEC_RO, VENDOR
 * 
 * @param userRoles User's mapped roles from Cognito groups
 * @returns true if user has access to PMO module
 */
export function canAccessPMOModule(userRoles: UserRole[]): boolean {
  // Users with PMO, EXEC_RO, or VENDOR roles have access
  return userRoles.some(role => ["PMO", "EXEC_RO", "VENDOR"].includes(role));
}
