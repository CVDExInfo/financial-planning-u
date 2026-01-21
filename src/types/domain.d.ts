// Core domain types for Financial Planning & Management UI

// Currency type - ISO codes for supported currencies
export type Currency = "USD" | "EUR" | "MXN" | "COP";
export type FXPair = "USD/COP";
export type AmortizationType = "none" | "straight_line" | "custom";
export type IndexationPolicy = "none" | "CPI" | "min_wage";
export type VarianceReason =
  | "logística"
  | "FX"
  | "indexation"
  | "capex"
  | "vendor_delay"
  | "scope"
  | "other";
export type UserRole = "PM" | "PMO" | "SDMT" | "SDM_FIN" | "VENDOR" | "EXEC_RO";
export type ModuleType = "PMO" | "SDMT";
export type InvoiceStatus = "Pending" | "Matched" | "Disputed" | "PendingDeletionApproval" | "PendingCorrectionApproval";
export type ApprovalDecision = "approve" | "reject";

// Line Item represents individual cost components
export type LineItem = {
  id: string;
  category: string;
  subtype?: string;
  vendor?: string;
  description: string;
  one_time: boolean;
  recurring: boolean;
  qty: number;
  unit_cost: number;
  currency: Currency;
  fx_pair?: FXPair;
  fx_rate_at_booking?: number;
  start_month: number;
  end_month: number;
  amortization: AmortizationType;
  capex_flag: boolean;
  cost_center?: string;
  gl_code?: string;
  tax_pct?: number;
  indexation_policy: IndexationPolicy;
  attachments?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  total_cost?: number;
  // Service tier specific fields
  service_tier?: string;
  service_type?: string;
  sla_uptime?: string;
  support_model?: string;
  deliverable?: string;
  max_participants?: number;
  duration_days?: number;
};

// Monthly totals for budget planning
export type MonthTotal = {
  month: number;
  amount_planned: number;
  amount_forecast?: number;
  amount_actual?: number;
};

// Baseline Budget represents PMO handoff to SDMT
export type BaselineBudget = {
  baseline_id: string;
  project_id: string;
  project_name: string;
  created_by: string;
  accepted_by?: string;
  accepted_ts?: string;
  signature_hash: string;
  line_items: LineItem[];
  monthly_totals: MonthTotal[];
  assumptions?: string[];
  fx_meta?: FXMetadata[];
  indexation_meta?: IndexationMetadata[];
  total_amount: number;
  currency: Currency;
  created_at: string;
  status: "draft" | "signed" | "accepted" | "rejected";
};

// FX and Indexation metadata
export type FXMetadata = {
  pair: FXPair;
  rate_at_baseline: number;
  rate_source: string;
  hedging_strategy?: string;
};

export type IndexationMetadata = {
  policy: IndexationPolicy;
  base_rate: number;
  adjustment_frequency: "monthly" | "quarterly" | "annually";
  last_adjustment_date?: string;
};

// Forecast grid cell data
export type ForecastCell = {
  line_item_id: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  variance_reason?: VarianceReason;
  notes?: string;
  last_updated: string;
  updated_by: string;
  // Extended fields for robust ID matching and month handling
  matchingIds?: string[]; // Alternative IDs for invoice matching (canonical, synthetic, aliases)
  monthLabel?: string; // YYYY-MM format for calendar month alignment
  rubroId?: string; // Explicit rubro ID for canonical taxonomy lookup
};

// Invoice/Evidence documents
export type InvoiceDoc = {
  id: string;
  line_item_id: string;
  month: number;
  amount: number;
  currency: Currency;
  file_url?: string;
  file_name?: string;
  documentKey?: string;
  originalName?: string;
  contentType?: string;
  status: InvoiceStatus;
  comments?: string[];
  uploaded_by: string;
  uploaded_at: string;
  matched_at?: string;
  matched_by?: string;
  reconciled_by?: string; // User who reconciled/matched the invoice
  deletion_requested_by?: string; // User who requested deletion
  deletion_requested_at?: string; // When deletion was requested
};

// Scenario modeling
export type Scenario = {
  id: string;
  name: string;
  description?: string;
  baseline_id: string;
  deltas: ScenarioDelta[];
  created_by: string;
  created_at: string;
  total_impact: number;
  currency: Currency;
};

export type ScenarioDelta = {
  line_item_id?: string;
  category?: string;
  delta_type: "percentage" | "absolute" | "multiplier";
  delta_value: number;
  start_month?: number;
  end_month?: number;
  reason: string;
};

// Change management and approvals
export type ChangeRequest = {
  id: string;
  baseline_id: string;
  title: string;
  description: string;
  impact_amount: number;
  currency: Currency;
  affected_line_items: string[];
  justification: string;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  approvals: Approval[];
  // Time distribution fields for baseline-aware changes
  start_month_index?: number; // 1-based month index within project period
  duration_months?: number; // Number of months to apply the impact
  allocation_mode?: "one_time" | "spread_evenly"; // How to distribute the impact
  // New line item request for unexpected expenses
  new_line_item_request?: {
    name: string; // Name of the new rubro
    type: string; // OPEX, CAPEX, etc.
    description: string; // Operational description
  };
};

export type Approval = {
  id: string;
  change_id: string;
  approver_role: UserRole;
  approver_id: string;
  decision: ApprovalDecision;
  comment?: string;
  approved_at: string;
};

// Project context and metadata
export type Project = {
  id: string;
  name: string;
  description?: string;
  client?: string | null;
  sdm_manager_name?: string | null;
  sdm_manager_email?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  baseline_id?: string;
  baseline_status?: "pending" | "handed_off" | "accepted" | "rejected" | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string;
  rejected_by?: string | null;
  baseline_rejected_at?: string;
  rejection_comment?: string;
  rubros_count?: number;
  labor_cost?: number;
  non_labor_cost?: number;
  next_billing_periods: BillingPeriod[];
  status: "active" | "completed" | "on_hold";
  created_at: string;
};

export type BillingPeriod = {
  month: number;
  amount: number;
  currency: Currency;
  status: "planned" | "invoiced" | "collected";
};

// User context
export type UserInfo = {
  id: string | null;
  login: string | null;
  email: string | null;
  avatarUrl: string | null;
  roles: UserRole[];
  current_role: UserRole | null;
  isOwner: boolean;
  name?: string | null;
};

// API response types
export type APIResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
};

export type PaginatedResponse<T> = APIResponse<{
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}>;

// Chart data types
export type ChartDataPoint = {
  month: number;
  label: string;
  [key: string]: number | string;
};

export type WaterfallDataPoint = {
  category: string;
  value: number;
  cumulative?: number;
  type: "positive" | "negative" | "total";
};

// Import/Export types
export type ImportMapping = {
  source_column: string;
  target_field: string;
  transformation?: "date" | "currency" | "percentage" | "boolean";
  default_value?: any;
};

export type ImportResult = {
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
};

export type ImportError = {
  row: number;
  column: string;
  value: any;
  message: string;
};

export type ImportWarning = {
  row: number;
  column: string;
  value: any;
  message: string;
  suggestion?: string;
};

// Form validation types for SDM Cost Estimator
export type DealInputs = {
  project_name: string;
  project_description?: string;
  currency: Currency;
  start_date: string;
  duration_months: number;
  contract_value?: number;
  client_name?: string;
  sdm_manager_name: string;
  sdm_manager_email: string;
  assumptions: string[];
};

export type LaborEstimate = {
  /** Canonical rubro ID from taxonomy (e.g., "MOD-ING", "MOD-LEAD") */
  rubroId: string;
  /** Display label for the role (for backward compatibility) */
  role: string;
  country: string;
  level: "junior" | "mid" | "senior" | "lead";
  fte_count: number;
  hourly_rate: number;
  hours_per_month: number;
  on_cost_percentage: number;
  start_month: number;
  end_month: number;
};

export type NonLaborEstimate = {
  /** Canonical rubro ID from taxonomy (e.g., "GSV-REU", "SOI-AWS") - Required for proper lineage */
  rubroId: string;
  /** Category for grouping (for backward compatibility) */
  category: string;
  description: string;
  amount: number;
  currency: Currency;
  one_time: boolean;
  start_month?: number;
  end_month?: number;
  vendor?: string;
  capex_flag: boolean;
};

export type BaselineCreateRequest = {
  project_name: string;
  project_description?: string;
  client_name?: string;
  currency?: Currency;
  start_date?: string;
  duration_months?: number;
  contract_value?: number;
  sdm_manager_name?: string;
  sdm_manager_email?: string;
  assumptions?: string[];
  created_by: string;
  labor_estimates: LaborEstimate[];
  non_labor_estimates: NonLaborEstimate[];
  fx_indexation?: Record<string, unknown>;
};

export type BaselineCreateResponse = {
  baseline_id: string;
  project_id: string;
  signature_hash: string;
  total_amount: number;
  created_at: string;
};
