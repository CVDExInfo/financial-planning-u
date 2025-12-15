import { z } from 'zod';

/**
 * PayrollKind - discriminator for plan/forecast/actual
 */
export const PayrollKindSchema = z.enum(['plan', 'forecast', 'actual']);
export type PayrollKind = z.infer<typeof PayrollKindSchema>;

/**
 * Period validation - YYYY-MM format with valid month range (01-12)
 */
const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Payroll Entry Schema - unified schema supporting plan/forecast/actual
 * 
 * This extends the original PayrollActual schema to support MOD projections:
 * - plan: MOD from caso de negocio / initial budget
 * - forecast: Projected payroll (SD/Finanzas estimates)
 * - actual: Real payroll executed (from HR systems)
 */
export const PayrollEntrySchema = z.object({
  id: z.string().regex(/^payroll_(plan|forecast|actual)_[a-z0-9]{10}$/),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  period: z.string().regex(periodRegex, 'period must be in YYYY-MM format with valid month (01-12)'),
  kind: PayrollKindSchema,
  amount: z.number().min(0, 'amount must be non-negative'),
  currency: z.enum(['USD', 'COP', 'EUR', 'MXN'], {
    errorMap: () => ({ message: 'currency must be one of USD, COP, EUR, MXN' })
  }),
  
  // Optional fields
  allocationId: z.string().regex(/^alloc_[a-z0-9]{10}$/).optional(),
  rubroId: z.string().optional(),
  resourceCount: z.number().int().min(0).optional(),
  source: z.string().max(100).optional(),
  uploadedBy: z.string().email().optional(),
  uploadedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  
  // DynamoDB keys (computed)
  pk: z.string().optional(),
  sk: z.string().optional(),
  
  // Audit fields
  createdAt: z.string().datetime().optional(),
  createdBy: z.string().email().optional(),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.string().email().optional(),
});

export type PayrollEntry = z.infer<typeof PayrollEntrySchema>;

/**
 * Payroll Entry Create Schema - for ingestion endpoint
 */
export const PayrollEntryCreateSchema = PayrollEntrySchema.omit({
  id: true,
  pk: true,
  sk: true,
  uploadedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type PayrollEntryCreate = z.infer<typeof PayrollEntryCreateSchema>;

/**
 * Payroll Actual Schema (legacy - maintained for backwards compatibility)
 * 
 * This schema represents the original payroll_actuals structure.
 * New code should use PayrollEntrySchema with kind="actual"
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

import { MOD_ROLES, type MODRole } from '../constants/mod-roles';

/**
 * Payroll Ingest Schema (from OpenAPI)
 * Supports both new role-specific breakdown and legacy format
 */
export const PayrollIngestSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  nomina_total: z.number().min(0),
  
  // NEW: Role-specific breakdown (preferred)
  // Dynamically generated from MOD_ROLES constant to ensure consistency
  desglose_roles: z.object(
    Object.fromEntries(
      MOD_ROLES.map(role => [role, z.number().min(0).optional()])
    ) as Record<MODRole, z.ZodOptional<z.ZodNumber>>
  ).optional(),
  
  // LEGACY: Backward compatibility (deprecated)
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

/**
 * Parse and validate payroll entry (with kind discriminator)
 */
export function parsePayrollEntry(data: unknown): PayrollEntry {
  return PayrollEntrySchema.parse(data);
}

/**
 * Parse and validate payroll entry create data (for POST requests)
 */
export function parsePayrollEntryCreate(data: unknown): PayrollEntryCreate {
  return PayrollEntryCreateSchema.parse(data);
}

/**
 * Safe parse payroll entry
 */
export function safeParsePayrollEntry(data: unknown) {
  return PayrollEntrySchema.safeParse(data);
}

/**
 * Safe parse payroll entry create
 */
export function safeParsePayrollEntryCreate(data: unknown) {
  return PayrollEntryCreateSchema.safeParse(data);
}
