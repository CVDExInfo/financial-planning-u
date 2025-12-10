/**
 * MOD (Mano de Obra Directa) Role Types
 * 
 * Client-approved roles for Service Delivery.
 * This is the single source of truth for MOD roles in the frontend.
 * 
 * Note: This is intentionally duplicated from the backend constants
 * but centralized on the UI side as compile-time config.
 */
export const MOD_ROLES = [
  'Ingeniero Delivery',
  'Ingeniero Soporte N1',
  'Ingeniero Soporte N2',
  'Ingeniero Soporte N3',
  'Service Delivery Manager',
  'Project Manager',
] as const;

export type MODRole = typeof MOD_ROLES[number];
