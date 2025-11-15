import { z } from 'zod';

/**
 * Recon Summary Schema
 * Represents the reconciliation summary for a project in a given month
 */
export const ReconSummarySchema = z.object({
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalAllocated: z.number().optional(),
  totalActual: z.number().optional(),
  variance: z.number().optional(),
  variancePercent: z.number().optional(),
  matched: z.number().optional(),
  matchedCount: z.number().int().min(0).optional(),
  pending: z.number().optional(),
  pendingCount: z.number().int().min(0).optional(),
  disputed: z.number().optional(),
  disputedCount: z.number().int().min(0).optional(),
  adjustments: z.number().optional(),
  adjustmentsCount: z.number().int().min(0).optional(),
  lastUpdated: z.string().datetime().optional(),
});

export type ReconSummary = z.infer<typeof ReconSummarySchema>;

/**
 * Parse and validate recon summary data
 */
export function parseReconSummary(data: unknown): ReconSummary {
  return ReconSummarySchema.parse(data);
}

/**
 * Safe parse recon summary
 */
export function safeParseReconSummary(data: unknown) {
  return ReconSummarySchema.safeParse(data);
}
