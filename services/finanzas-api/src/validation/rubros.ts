import { z } from 'zod';

/**
 * Rubro (Catalog Item) Schema
 */
export const RubroSchema = z.object({
  id: z.string().regex(/^(rubro|proj_rubro)_[a-z0-9]{10}$/).optional(),
  project_id: z.string().optional(),
  rubro_id: z.string(),
  code: z.string().optional(),
  nombre: z.string(),
  categoria: z.string().optional(),
  monto_total: z.number().min(0).optional(),
  tipo_ejecucion: z.enum(['mensual', 'puntual', 'por_hito']).optional(),
  meses_programados: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  monto_mensual: z.number().min(0).optional(),
  descripcion: z.string().optional(),
  created_at: z.string().datetime().optional(),
});

export type Rubro = z.infer<typeof RubroSchema>;

/**
 * Project Rubro Attachment Schema
 */
export const ProjectRubroAttachmentSchema = z.object({
  id: z.string().regex(/^proj_rubro_[a-z0-9]{10}$/).optional(),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  rubroId: z.string(),
  attachedAt: z.string().datetime(),
  attachedBy: z.string().email().optional(),
  notes: z.string().max(500).optional(),
});

export type ProjectRubroAttachment = z.infer<typeof ProjectRubroAttachmentSchema>;

/**
 * Rubro Create Schema
 */
export const RubroCreateSchema = z.object({
  rubro_id: z.string().regex(/^rubro_[a-z0-9]{10}$/),
  monto_total: z.number().min(0),
  tipo_ejecucion: z.enum(['mensual', 'puntual', 'por_hito']),
  meses_programados: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  notas: z.string().max(1000).optional(),
});

export type RubroCreate = z.infer<typeof RubroCreateSchema>;

/**
 * Parse and validate rubro data
 */
export function parseRubro(data: unknown): Rubro {
  return RubroSchema.parse(data);
}

/**
 * Parse and validate project rubro attachment
 */
export function parseProjectRubroAttachment(data: unknown): ProjectRubroAttachment {
  return ProjectRubroAttachmentSchema.parse(data);
}

/**
 * Parse and validate rubro create data
 */
export function parseRubroCreate(data: unknown): RubroCreate {
  return RubroCreateSchema.parse(data);
}
