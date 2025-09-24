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
  currency: 'USD' | 'COP';
  fx_pair?: 'USD/COP';
  fx_rate_at_booking?: number;
  start_month: number;
  end_month: number;
  amortization: 'none' | 'straight_line' | 'custom';
  capex_flag: boolean;
  cost_center?: string;
  gl_code?: string;
  tax_pct?: number;
  indexation_policy: 'none' | 'CPI' | 'min_wage';
  attachments?: string[];
  notes?: string;
};

export type MonthTotal = {
  month: number;
  amount_planned: number;
};

export type BaselineBudget = {
  baseline_id: string;
  project_id: string;
  created_by: string;
  accepted_by: string;
  accepted_ts: string;
  signature_hash: string;
  line_items: LineItem[];
  monthly_totals: MonthTotal[];
  assumptions?: string[];
  fx_meta?: any[];
  indexation_meta?: any[];
};

export type ForecastCell = {
  line_item_id: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  variance_reason?: 'logística' | 'FX' | 'indexation' | 'capex' | 'vendor_delay' | 'scope' | 'other';
  notes?: string;
};

export type InvoiceDoc = {
  id: string;
  line_item_id: string;
  month: number;
  file_url: string;
  status: 'Pending' | 'Matched' | 'Disputed';
  comments?: string[];
};

export type Scenario = {
  id: string;
  name: string;
  baseline_id: string;
  deltas: any[];
};

export type Approval = {
  id: string;
  change_id: string;
  approver_role: string;
  decision: 'approve' | 'reject';
  comment?: string;
  ts: string;
};

export type Project = {
  id: string;
  name: string;
  baseline_id?: string;
  baseline_accepted_ts?: string;
  next_billing_periods?: { month: number; amount: number }[];
};

export type UserRole = 'PMO' | 'SDMT' | 'VENDOR' | 'EXEC_RO';

export type User = {
  id: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
};

export type BillingPlan = {
  project_id: string;
  monthly_inflows: { month: number; amount: number }[];
};

export type DealInputs = {
  project_name: string;
  duration_months: number;
  currency: 'USD' | 'COP';
  fx_rate?: number;
  indexation_enabled: boolean;
  indexation_rate?: number;
};

export type LaborRate = {
  country: string;
  role: string;
  rate_per_month: number;
  currency: 'USD' | 'COP';
  on_cost_pct: number;
};

export type ModuleType = 'PMO' | 'SDMT';