import type { AllocationRule } from "./allocation-rules.model";

export const ALLOCATION_RULES_SAMPLE: AllocationRule[] = [
  {
    rule_id: "AR-MOD-ING-001",
    linea_codigo: "MOD-ING",
    driver: "percent",
    split: [
      { to: { project_id: "PRJ-HEALTHCARE-MODERNIZATION" }, pct: 60 },
      { to: { project_id: "PRJ-FINTECH-PLATFORM" }, pct: 25 },
      { to: { project_id: "PRJ-RETAIL-ANALYTICS" }, pct: 15 },
    ],
    filters: {
      date_range: { from: "2025-01-01" },
      opex_capex: "OPEX",
    },
    rounding: "nearest",
    priority: 10,
    active: true,
    version: 1,
  },
  {
    rule_id: "AR-TEC-LAB-001",
    linea_codigo: "TEC-LAB",
    driver: "fixed",
    fixed_amount: 15000,
    split: [{ to: { cost_center: "LAB-MTY" }, pct: 100 }],
    filters: {
      country: "MX",
    },
    rounding: "floor",
    priority: 20,
    active: true,
    version: 1,
  },
  {
    rule_id: "AR-SUPPORT-TKT-001",
    linea_codigo: "SOPORTE-N1",
    driver: "tickets",
    rate_per_ticket: 35,
    split: [{ to: { project_id: "PRJ-FINTECH-PLATFORM" }, pct: 100 }],
    filters: {
      date_range: { from: "2025-02-01" },
      opex_capex: "OPEX",
    },
    rounding: "ceil",
    priority: 30,
    active: false,
    version: 1,
  },
];
