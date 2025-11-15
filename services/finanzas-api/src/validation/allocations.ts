import { z } from 'zod';

/**
 * Allocation Schema
 */
export const AllocationSchema = z.object({
  id: z.string().regex(/^alloc_[a-z0-9]{10}$/),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  rubroId: z.string(),
  estimatorItemId: z.string().regex(/^est_[a-z0-9]{10}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
  source: z.enum(['estimator', 'manual', 'adjustment']),
  status: z.enum(['planned', 'committed', 'spent']).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Allocation = z.infer<typeof AllocationSchema>;

/**
 * Allocation Create Schema
 */
export const AllocationCreateSchema = AllocationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AllocationCreate = z.infer<typeof AllocationCreateSchema>;

/**
 * Allocation Bulk Item Schema (for bulk operations)
 */
export const AllocationBulkItemSchema = z.object({
  rubro_id: z.string().regex(/^rubro_[a-z0-9]{10}$/),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  monto_planeado: z.number().min(0),
});

/**
 * Allocation Bulk Schema
 */
export const AllocationBulkSchema = z.object({
  allocations: z.array(AllocationBulkItemSchema).min(1),
});

export type AllocationBulk = z.infer<typeof AllocationBulkSchema>;

/**
 * Parse and validate allocation data
 */
export function parseAllocation(data: unknown): Allocation {
  return AllocationSchema.parse(data);
}

/**
 * Parse and validate allocation create data
 */
export function parseAllocationCreate(data: unknown): AllocationCreate {
  return AllocationCreateSchema.parse(data);
}

/**
 * Parse and validate bulk allocation data
 */
export function parseAllocationBulk(data: unknown): AllocationBulk {
  return AllocationBulkSchema.parse(data);
}

/**
 * Safe parse allocation
 */
export function safeParseAllocation(data: unknown) {
  return AllocationSchema.safeParse(data);
}
