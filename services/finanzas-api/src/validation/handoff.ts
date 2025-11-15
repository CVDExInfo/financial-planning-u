import { z } from 'zod';

/**
 * Handoff Schema
 * Validates handoff data when a project is transferred to Service Delivery Team
 */
export const HandoffSchema = z.object({
  mod_total: z.number().min(0, 'mod_total must be non-negative'),
  pct_ingenieros: z.number().min(0).max(100, 'pct_ingenieros must be between 0 and 100'),
  pct_sdm: z.number().min(0).max(100, 'pct_sdm must be between 0 and 100'),
  aceptado_por: z.string().email('aceptado_por must be a valid email'),
  fecha_handoff: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_handoff must be in YYYY-MM-DD format'),
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
