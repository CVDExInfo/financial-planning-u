export type AllocationRule = {
  rule_id: string;
  linea_codigo: string;
  driver: "percent" | "hours" | "tickets" | "fixed";
  split?: { to: { project_id?: string; cost_center?: string }; pct: number }[];
  rate_per_hour?: number;
  rate_per_ticket?: number;
  fixed_amount?: number;
  filters?: {
    date_range?: { from: string; to?: string };
    opex_capex?: "OPEX" | "CAPEX";
    vendor_id?: string;
    country?: string;
  };
  rounding?: "floor" | "ceil" | "nearest";
  priority?: number;
  active: boolean;
  version?: number;
};
