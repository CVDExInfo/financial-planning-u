/**
 * Validation schemas and parsers for Finanzas SD API
 * 
 * This module provides zod-based validation schemas that mirror the OpenAPI 3.1
 * component schemas. Use these validators to ensure data integrity at runtime.
 */

// Health
export {
  HealthResponseSchema,
  parseHealthResponse,
  safeParseHealthResponse,
  type HealthResponse,
} from './health';

// Handoff
export {
  HandoffSchema,
  parseHandoff,
  safeParseHandoff,
  type Handoff,
} from './handoff';

// Rubros
export {
  RubroSchema,
  ProjectRubroAttachmentSchema,
  RubroCreateSchema,
  parseRubro,
  parseProjectRubroAttachment,
  parseRubroCreate,
  type Rubro,
  type ProjectRubroAttachment,
  type RubroCreate,
} from './rubros';

// Estimator
export {
  EstimatorItemSchema,
  EstimatorItemCreateSchema,
  parseEstimatorItem,
  parseEstimatorItemCreate,
  safeParseEstimatorItem,
  type EstimatorItem,
  type EstimatorItemCreate,
} from './estimator';

// Allocations
export {
  AllocationSchema,
  AllocationCreateSchema,
  AllocationBulkItemSchema,
  AllocationBulkSchema,
  parseAllocation,
  parseAllocationCreate,
  parseAllocationBulk,
  safeParseAllocation,
  type Allocation,
  type AllocationCreate,
  type AllocationBulk,
} from './allocations';

// Payroll
export {
  PayrollActualSchema,
  PayrollActualCreateSchema,
  PayrollIngestSchema,
  parsePayrollActual,
  parsePayrollActualCreate,
  parsePayrollIngest,
  safeParsePayrollActual,
  type PayrollActual,
  type PayrollActualCreate,
  type PayrollIngest,
} from './payroll';

// Adjustments
export {
  AdjustmentSchema,
  AdjustmentCreateSchema,
  parseAdjustment,
  parseAdjustmentCreate,
  safeParseAdjustment,
  type Adjustment,
  type AdjustmentCreate,
} from './adjustments';

// Reconciliation
export {
  ReconSummarySchema,
  parseReconSummary,
  safeParseReconSummary,
  type ReconSummary,
} from './recon';
