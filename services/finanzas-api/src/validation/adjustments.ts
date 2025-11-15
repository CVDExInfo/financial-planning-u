import { z } from 'zod';

/**
 * Adjustment Create Schema
 */
export const AdjustmentCreateSchema = z.object({
  project_id: z.string().regex(/^proj_[a-z0-9]{10}$/),
  tipo: z.enum(['exceso', 'reduccion', 'reasignacion']),
  monto: z.number().min(0),
  origen_rubro_id: z.string().optional(),
  destino_rubro_id: z.string().optional(),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}$/),
  metodo_distribucion: z.enum(['pro_rata_forward', 'pro_rata_all', 'single_month']).optional(),
  justificacion: z.string().max(2000).optional(),
  solicitado_por: z.string().email(),
});

export type AdjustmentCreate = z.infer<typeof AdjustmentCreateSchema>;

/**
 * Adjustment Schema (full record with generated fields)
 */
export const AdjustmentSchema = AdjustmentCreateSchema.extend({
  id: z.string().regex(/^adj_[a-z0-9]{10}$/),
  estado: z.enum(['pending_approval', 'approved', 'rejected']),
  meses_impactados: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  distribucion: z.array(z.object({
    mes: z.string(),
    monto: z.number(),
  })).optional(),
  aprobado_por: z.string().email().optional(),
  aprobado_en: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type Adjustment = z.infer<typeof AdjustmentSchema>;

/**
 * Parse and validate adjustment data
 */
export function parseAdjustment(data: unknown): Adjustment {
  return AdjustmentSchema.parse(data);
}

/**
 * Parse and validate adjustment create data
 */
export function parseAdjustmentCreate(data: unknown): AdjustmentCreate {
  return AdjustmentCreateSchema.parse(data);
}

/**
 * Safe parse adjustment
 */
export function safeParseAdjustment(data: unknown) {
  return AdjustmentSchema.safeParse(data);
}
