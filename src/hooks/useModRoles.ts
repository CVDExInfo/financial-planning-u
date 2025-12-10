/**
 * Hook for accessing MOD (Mano de Obra Directa) roles from Rubros taxonomy
 * 
 * This hook provides the canonical list of MOD roles approved by the client
 * for Service Delivery. These roles are used throughout the application for:
 * - Labor cost estimation in the PMO Estimator
 * - Baseline handoff between PMO and SDMT
 * - Payroll and cost tracking in SDMT modules
 */

import { useMemo } from "react";
import { MOD_ROLES, type MODRole } from "@/modules/modRoles";

export interface UseModRolesResult {
  /** Array of MOD role names from the Rubros taxonomy */
  roles: string[];
  /** Typed MOD roles */
  modRoles: readonly MODRole[];
  /** Whether roles are being loaded (always false for static roles) */
  loading: boolean;
  /** Any error that occurred (always null for static roles) */
  error: Error | null;
}

/**
 * Hook to get MOD roles from the Rubros taxonomy
 * 
 * Currently returns static roles from modRoles.ts. This can be extended
 * in the future to fetch roles dynamically from the API if needed.
 * 
 * @returns Object containing roles array, loading state, and error state
 * 
 * @example
 * ```tsx
 * function LaborStep() {
 *   const { roles, loading } = useModRoles();
 *   
 *   return (
 *     <Select disabled={loading}>
 *       {roles.map(role => (
 *         <SelectItem key={role} value={role}>{role}</SelectItem>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 */
export function useModRoles(): UseModRolesResult {
  // For now, MOD_ROLES is a compile-time constant from modRoles.ts
  // This provides type safety and ensures consistency with backend
  const roles = useMemo(() => [...MOD_ROLES], []);

  return {
    roles,
    modRoles: MOD_ROLES,
    loading: false,
    error: null,
  };
}

/**
 * Alternative hook that could fetch MOD roles from API in the future
 * 
 * This is left as a placeholder for when we need dynamic role loading
 * from the Rubros catalog API.
 */
export function useModRolesFromApi(): UseModRolesResult {
  // TODO: Implement API fetching when needed
  // For now, just return static roles
  return useModRoles();
}
