import { z } from 'zod';

/**
 * Payroll Actual Schema
 */
export const PayrollActualSchema = z.object({
  id: z.string().regex(/^payroll_[a-z0-9]{10}$/),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  allocationId: z.string().regex(/^alloc_[a-z0-9]{10}$/).optional(),
  rubroId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
  resourceCount: z.number().int().min(0).optional(),
  source: z.string().optional(),
  uploadedBy: z.string().email().optional(),
  uploadedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type PayrollActual = z.infer<typeof PayrollActualSchema>;

/**
 * Payroll Actual Create Schema
 */
export const PayrollActualCreateSchema = PayrollActualSchema.omit({
  id: true,
  uploadedAt: true,
});

export type PayrollActualCreate = z.infer<typeof PayrollActualCreateSchema>;

/**
 * Payroll Ingest Schema (from OpenAPI)
 */
export const PayrollIngestSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  nomina_total: z.number().min(0),
  desglose: z.object({
    ingenieros: z.number().optional(),
    sdm: z.number().optional(),
  }).optional(),
  source: z.string().optional(),
  uploaded_by: z.string().email().optional(),
});

export type PayrollIngest = z.infer<typeof PayrollIngestSchema>;

/**
 * Parse and validate payroll actual data
 */
export function parsePayrollActual(data: unknown): PayrollActual {
  return PayrollActualSchema.parse(data);
}

/**
 * Parse and validate payroll actual create data
 */
export function parsePayrollActualCreate(data: unknown): PayrollActualCreate {
  return PayrollActualCreateSchema.parse(data);
}

/**
 * Parse and validate payroll ingest data
 */
export function parsePayrollIngest(data: unknown): PayrollIngest {
  return PayrollIngestSchema.parse(data);
}

/**
 * Safe parse payroll actual
 */
export function safeParsePayrollActual(data: unknown) {
  return PayrollActualSchema.safeParse(data);
}
