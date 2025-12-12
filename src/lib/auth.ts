import { UserRole, UserInfo, ModuleType } from "@/types/domain";

/**
 * Authentication and authorization utilities
 */

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  VENDOR: 1,
  PM: 2,
  SDMT: 3,
  PMO: 4,
  EXEC_RO: 5,
};

const envSource =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) || {};

const IS_FINZ_BUILD =
  envSource.VITE_FINZ_ENABLED === "true" ||
  (typeof window !== "undefined" && window.location.pathname.startsWith("/finanzas"));

// Role permissions mapping
const ROLE_PERMISSIONS = {
  PM: {
    // Project Manager: limited to PMO estimator only
    routes: [
      "/",
      "/profile",
      "/pmo/**",
      "/pmo/prefactura/**",
    ],
    actions: ["read"],
    description: "Acceso limitado solo al estimador PMO",
  },
  PMO: {
    // PMO users are isolated to the PMO workspace
    routes: ["/", "/profile", "/pmo/**", "/pmo/prefactura/**"],
    actions: ["create", "read", "update", "delete", "approve"],
    description: "Full access to PMO estimator and reporting",
  },
  SDMT: {
    // SDMT module plus Finanzas (feature) routes
    // Note: We need both `/projects` and `/projects/**` because:
    // - `/projects/**` matches `/projects/123` but NOT `/projects` (exact)
    // - Glob pattern `/**` requires at least one path segment after the prefix
    // - Same applies to `/adjustments`, `/providers`, etc.
    routes: [
      "/",
      "/profile",
      "/sdmt/**",
      "/projects",
      "/projects/**",
      "/catalog/**",
      "/rules",
      "/adjustments",
      "/adjustments/**",
      "/providers",
      "/providers/**",
      "/cashflow",
      "/scenarios",
    ],
    actions: ["create", "read", "update", "delete"],
    description: "Full access to SDMT cost management modules",
  },
  VENDOR: {
    // Limited SDMT access and read to Finanzas catalog
    routes: [
      "/",
      "/profile",
      "/sdmt/cost/catalog",
      "/sdmt/cost/reconciliation",
      "/catalog/rubros",
    ],
    actions: ["read", "update"],
    description: "Limited access to cost catalog and reconciliation uploads",
  },
  EXEC_RO: {
    // Read-only across PMO/SDMT and Finanzas routes
    routes: ["/", "/profile", "/pmo/**", "/sdmt/**", "/catalog/**", "/rules"],
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
export function getDefaultUserRole(user?: Partial<UserInfo> | null): UserRole {
  const email = (user?.email ?? "").toLowerCase();
  const login = (user?.login ?? "").toLowerCase();
  const isOwner = user?.isOwner ?? false;

  // Owner gets PMO access by default
  if (isOwner) {
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
 * 
 * SECURITY: Users with no recognized Cognito groups get empty array.
 * EXEC_RO is NOT automatically added as a fallback.
 */
export function getAvailableRoles(user?: Partial<UserInfo> | null): UserRole[] {
  // If user has JWT-provided roles (from Cognito groups), use them EXACTLY as-is
  if (user?.roles && user.roles.length > 0) {
    // User has explicit roles from JWT/Cognito groups
    // SECURITY: Do NOT add EXEC_RO automatically - user must have it in Cognito groups
    return [...user.roles];
  }

  // SECURITY: Users without any JWT roles should receive no roles
  // The UI must show "no access" message for empty roles array
  return [];
}

/**
 * Check if a user can access a specific route with their current role
 */
export function normalizeAppPath(route: string): string {
  if (!route) return "/";

  if (route.startsWith("/finanzas")) {
    const normalized = route.replace(/^\/finanzas/, "");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  return route;
}

// Placeholder constant for glob pattern replacement to avoid conflicts
const GLOB_DOUBLE_STAR_PLACEHOLDER = "___DOUBLESTAR___";

export function canAccessRoute(route: string, role: UserRole): boolean {
  const normalizedRoute = normalizeAppPath(route);
  const { routes } = getRoutesForRole(role);

  return routes.some((pattern) => {
    // Convert glob pattern to regex
    // IMPORTANT: Replace ** first with placeholder to avoid conflict with single * replacement
    const regexPattern = pattern
      .replace(/\*\*/g, GLOB_DOUBLE_STAR_PLACEHOLDER)  // Placeholder for **
      .replace(/\*/g, "[^/]*")                         // Single * matches anything except /
      .replace(new RegExp(GLOB_DOUBLE_STAR_PLACEHOLDER, "g"), ".*");  // ** matches anything including /
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedRoute);
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
  switch (role) {
    case "PM":
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

export function getRoleForPath(
  currentPath: string,
  availableRoles: UserRole[],
  fallback: UserRole
): UserRole {
  const normalizedPath = normalizeAppPath(currentPath);

  if (normalizedPath.startsWith("/pmo") && availableRoles.includes("PMO")) {
    return "PMO";
  }

  if (normalizedPath.startsWith("/sdmt/") && availableRoles.includes("SDMT")) {
    return "SDMT";
  }

  if (availableRoles.includes(fallback)) {
    return fallback;
  }

  return availableRoles[0] ?? fallback;
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
 * Based on Cognito groups: PMO, EXEC_RO
 * 
 * @param userRoles User's mapped roles from Cognito groups
 * @returns true if user has access to PMO module
 */
export function canAccessPMOModule(userRoles: UserRole[]): boolean {
  return userRoles.some((role) => ["PM", "PMO", "EXEC_RO"].includes(role));
}
