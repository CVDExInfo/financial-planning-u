import { z } from 'zod';

/**
 * Estimator Item Schema
 */
export const EstimatorItemSchema = z.object({
  id: z.string().regex(/^est_[a-z0-9]{10}$/),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  baselineId: z.string().optional(),
  rubroId: z.string(),
  nombre: z.string(),
  tier: z.enum(['Go', 'Gold', 'Premium', 'Platinum', 'Star']).optional(),
  quantity: z.number().min(0),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  period: z.number().int().positive().optional(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  committed: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type EstimatorItem = z.infer<typeof EstimatorItemSchema>;

/**
 * Estimator Item Create Schema
 */
export const EstimatorItemCreateSchema = EstimatorItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EstimatorItemCreate = z.infer<typeof EstimatorItemCreateSchema>;

/**
 * Parse and validate estimator item data
 */
export function parseEstimatorItem(data: unknown): EstimatorItem {
  return EstimatorItemSchema.parse(data);
}

/**
 * Parse and validate estimator item create data
 */
export function parseEstimatorItemCreate(data: unknown): EstimatorItemCreate {
  return EstimatorItemCreateSchema.parse(data);
}

/**
 * Safe parse estimator item
 */
export function safeParseEstimatorItem(data: unknown) {
  return EstimatorItemSchema.safeParse(data);
}
