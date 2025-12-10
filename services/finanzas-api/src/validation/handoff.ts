import { z } from 'zod';
import { MOD_ROLES, type MODRole } from '../constants/mod-roles';

/**
 * MOD Roles Breakdown Schema
 * Percentage allocation for each of the 6 approved MOD roles
 * Dynamically generated from MOD_ROLES constant to ensure consistency
 */
export const MODRolesSchema = z.object(
  Object.fromEntries(
    MOD_ROLES.map(role => [role, z.number().min(0).max(100).optional()])
  ) as Record<MODRole, z.ZodOptional<z.ZodNumber>>
);

export type MODRoles = z.infer<typeof MODRolesSchema>;

/**
 * Handoff Schema
 * Validates handoff data when a project is transferred to Service Delivery Team
 * 
 * Supports both new (mod_roles) and legacy (pct_ingenieros/pct_sdm) formats for backward compatibility
 */
export const HandoffSchema = z.object({
  mod_total: z.number().min(0, 'mod_total must be non-negative'),
  
  // NEW: Role-specific breakdown (preferred)
  mod_roles: MODRolesSchema.optional(),
  
  // LEGACY: Backward compatibility with old percentage fields (deprecated)
  pct_ingenieros: z.number().min(0).max(100, 'pct_ingenieros must be between 0 and 100').optional(),
  pct_sdm: z.number().min(0).max(100, 'pct_sdm must be between 0 and 100').optional(),
  
  aceptado_por: z.string().email('aceptado_por must be a valid email').optional(),
  fecha_handoff: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_handoff must be in YYYY-MM-DD format')
    .optional(),
  notas: z.string().max(2000, 'notas cannot exceed 2000 characters').optional(),
});

export type Handoff = z.infer<typeof HandoffSchema>;

/**
 * Parse and validate handoff data
 * @param data - Raw data to validate
 * @returns Validated Handoff
 * @throws ZodError if validation fails
 */
export function parseHandoff(data: unknown): Handoff {
  return HandoffSchema.parse(data);
}

/**
 * Safe parse handoff data (doesn't throw)
 * @param data - Raw data to validate
 * @returns Result object with success boolean and data/error
 */
export function safeParseHandoff(data: unknown) {
  return HandoffSchema.safeParse(data);
}
