/**
 * API Response Validation Schemas
 * Zod schemas for runtime validation of all API responses
 * Ensures data integrity before passing to components
 */

import { z } from "zod";

/**
 * Base schema for paginated responses
 */
export const PaginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Project schema - validates project response structure
 */
export const ProjectSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Project name is required"),
  description: z.string().default(""),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  baseline_id: z.string().default(""),
  baseline_accepted_at: z.string().datetime().optional(),
  next_billing_periods: z.array(z.unknown()).default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectListSchema = z.array(ProjectSchema);

/**
 * Line Item schema - validates cost line items
 */
export const LineItemSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  subtype: z.string().optional(),
  vendor: z.string().default(""),
  description: z.string().min(1),
  one_time: z.boolean().default(true),
  recurring: z.boolean().default(false),
  qty: z.number().min(0),
  unit_cost: z.number().min(0),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]).default("USD"),
  fx_pair: z.string().optional(),
  fx_rate_at_booking: z.number().optional(),
  start_month: z.number().min(1).max(12),
  end_month: z.number().min(1).max(12),
  amortization: z.enum(["none", "straight_line", "custom"]).default("none"),
  capex_flag: z.boolean().default(false),
  cost_center: z.string().optional(),
  gl_code: z.string().optional(),
  tax_pct: z.number().min(0).max(100).optional(),
  indexation_policy: z.enum(["none", "CPI", "min_wage"]).default("none"),
  attachments: z.array(z.string()).default([]),
  notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string(),
  service_tier: z.string().optional(),
  service_type: z.string().optional(),
  sla_uptime: z.string().optional(),
  support_model: z.string().optional(),
  deliverable: z.string().optional(),
  max_participants: z.number().optional(),
  duration_days: z.number().optional(),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export const LineItemListSchema = z.array(LineItemSchema);

/**
 * Forecast Cell schema - validates forecast grid cells
 */
export const ForecastCellSchema = z.object({
  line_item_id: z.string().min(1),
  month: z.number().min(1).max(12),
  planned: z.number().min(0),
  forecast: z.number().min(0),
  actual: z.number().min(0),
  variance: z.number(),
  variance_reason: z
    .enum([
      "logística",
      "FX",
      "indexation",
      "capex",
      "vendor_delay",
      "scope",
      "other",
    ])
    .optional(),
  notes: z.string().optional(),
  last_updated: z.string().datetime(),
  updated_by: z.string(),
});

export type ForecastCell = z.infer<typeof ForecastCellSchema>;

export const ForecastCellListSchema = z.array(ForecastCellSchema);

/**
 * Invoice schema - validates invoice/evidence documents
 */
export const InvoiceDocSchema = z.object({
  id: z.string().min(1),
  line_item_id: z.string().min(1),
  month: z.number().min(1).max(12),
  amount: z.number().min(0),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]).default("USD"),
  file_url: z.string().url(),
  file_name: z.string().min(1),
  status: z.enum(["Pending", "Matched", "Disputed"]).default("Pending"),
  comments: z.array(z.string()).default([]),
  uploaded_by: z.string(),
  uploaded_at: z.string().datetime(),
  matched_at: z.string().datetime().optional(),
  matched_by: z.string().optional(),
});

export type InvoiceDoc = z.infer<typeof InvoiceDocSchema>;

export const InvoiceDocListSchema = z.array(InvoiceDocSchema);

/**
 * Change Request schema
 */
export const ChangeRequestSchema = z.object({
  id: z.string().min(1),
  baseline_id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  impact_amount: z.number(),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]).default("USD"),
  affected_line_items: z.array(z.string()),
  justification: z.string(),
  requested_by: z.string(),
  requested_at: z.string().datetime(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  approvals: z.array(z.unknown()).default([]),
});

export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;

export const ChangeRequestListSchema = z.array(ChangeRequestSchema);

/**
 * Baseline Budget schema
 */
export const BaselineBudgetSchema = z.object({
  baseline_id: z.string().min(1),
  project_id: z.string().min(1),
  project_name: z.string(),
  created_by: z.string(),
  accepted_by: z.string().optional(),
  accepted_ts: z.string().datetime().optional(),
  signature_hash: z.string(),
  line_items: z.array(LineItemSchema),
  monthly_totals: z.array(
    z.object({
      month: z.number(),
      amount_planned: z.number(),
      amount_forecast: z.number().optional(),
      amount_actual: z.number().optional(),
    })
  ),
  assumptions: z.array(z.string()).optional(),
  fx_meta: z.array(z.unknown()).optional(),
  indexation_meta: z.array(z.unknown()).optional(),
  total_amount: z.number().min(0),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]),
  created_at: z.string().datetime(),
  status: z.enum(["draft", "signed", "accepted", "rejected"]),
});

export type BaselineBudget = z.infer<typeof BaselineBudgetSchema>;

/**
 * Billing Period schema
 */
export const BillingPeriodSchema = z.object({
  period_number: z.number().min(1),
  month: z.number().min(1).max(12),
  amount: z.number().min(0),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]),
  status: z.enum(["planned", "invoiced", "paid"]).default("planned"),
});

export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

/**
 * Scenario schema
 */
export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  baseline_id: z.string(),
  deltas: z.array(z.unknown()),
  created_by: z.string(),
  created_at: z.string().datetime(),
  total_impact: z.number(),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

/**
 * API Error Response schema
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: z.string().datetime().optional(),
  traceId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Safe parse wrapper that logs validation errors
 */
export function safeParseResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  try {
    const result = schema.parse(data);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      console.error(`Validation error in ${context}: ${issues}`);
      console.error("Data received:", data);
    } else {
      console.error(`Parse error in ${context}:`, error);
    }
    return null;
  }
}

/**
 * Export all schemas for convenience
 */
export const ApiSchemas = {
  Project: ProjectSchema,
  ProjectList: ProjectListSchema,
  LineItem: LineItemSchema,
  LineItemList: LineItemListSchema,
  ForecastCell: ForecastCellSchema,
  ForecastCellList: ForecastCellListSchema,
  InvoiceDoc: InvoiceDocSchema,
  InvoiceDocList: InvoiceDocListSchema,
  ChangeRequest: ChangeRequestSchema,
  ChangeRequestList: ChangeRequestListSchema,
  BaselineBudget: BaselineBudgetSchema,
  BillingPeriod: BillingPeriodSchema,
  Scenario: ScenarioSchema,
  ApiError: ApiErrorSchema,
};
