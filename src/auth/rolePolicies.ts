/**
 * Centralized role-based access control policies
 * 
 * This module defines role groups and page-level role requirements
 * to ensure consistent access control across the application.
 */

import type { UserRole } from "@/types/domain";

/**
 * Role groups for organizing access control
 */
export const ROLE_GROUPS = {
  /** SDMT has full access to all SDMT cost management features */
  sdmtFullAccess: ["SDMT"] as UserRole[],
  
  /** PM and PMO have access to estimator and limited views */
  pmEstimatorAccess: ["PM", "PMO"] as UserRole[],
  
  /** Executive read-only access for reporting */
  execReadOnly: ["EXEC_RO"] as UserRole[],
  
  /** Vendor has minimal access for uploads and reconciliation */
  vendorMinimal: ["VENDOR"] as UserRole[],
} as const;

/**
 * Page-level role requirements
 * Maps specific pages/features to their allowed roles
 * 
 * When a page doesn't specify required roles (undefined/empty array),
 * the route-based access control from lib/auth.ts takes precedence.
 */
export const PAGE_ROLE_REQUIREMENTS = {
  // SDMT Cost Management Pages - Full SDMT access required
  sdmtCostCatalog: ROLE_GROUPS.sdmtFullAccess,
  sdmtCostForecast: ROLE_GROUPS.sdmtFullAccess,
  sdmtCostChanges: ROLE_GROUPS.sdmtFullAccess,
  sdmtCostReconciliation: ROLE_GROUPS.sdmtFullAccess,
  sdmtCostCashflow: ROLE_GROUPS.sdmtFullAccess,
  sdmtCostScenarios: ROLE_GROUPS.sdmtFullAccess,

  // PMO Estimator - PM, PMO, and SDMT can access (SDMT for oversight)
  pmoEstimatorWizard: [
    ...ROLE_GROUPS.sdmtFullAccess,
    ...ROLE_GROUPS.pmEstimatorAccess,
  ] as UserRole[],

  // Read-only dashboards - SDMT and EXEC_RO
  execDashboards: [
    ...ROLE_GROUPS.sdmtFullAccess,
    ...ROLE_GROUPS.execReadOnly,
  ] as UserRole[],

  // Catalog views - PM can view for baseline creation, SDMT for management
  catalogRubros: [
    ...ROLE_GROUPS.sdmtFullAccess,
    ...ROLE_GROUPS.pmEstimatorAccess,
    ...ROLE_GROUPS.vendorMinimal,
  ] as UserRole[],
} as const;

/**
 * Check if a user has any of the required roles
 * 
 * @param userRoles - Array of roles the user has
 * @param allowedRoles - Array of roles that are allowed
 * @returns true if user has at least one allowed role, or if no roles are required
 */
export function userHasAnyRole(
  userRoles: UserRole[] | undefined,
  allowedRoles: UserRole[] | undefined
): boolean {
  // If no roles are required, access is determined by other means (route-based)
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // If roles are required but user has none, deny access
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  // Check if user has at least one of the allowed roles
  return userRoles.some((role) => allowedRoles.includes(role));
}

/**
 * Get a human-readable description of required roles
 * 
 * @param requiredRoles - Array of roles that are required
 * @returns Formatted string of required roles
 */
export function formatRequiredRoles(requiredRoles?: UserRole[]): string {
  if (!requiredRoles || requiredRoles.length === 0) {
    return "Access is determined by your assigned role";
  }
  return requiredRoles.join(", ");
}
