import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";

const SAMPLE = [
  {
    rule_id: "AR-MOD-ING-001",
    linea_codigo: "MOD-ING",
    driver: "percent",
    split: [
      { to: { project_id: "PRJ-HEALTHCARE-MODERNIZATION" }, pct: 60 },
      { to: { project_id: "PRJ-FINTECH-PLATFORM" }, pct: 25 },
      { to: { project_id: "PRJ-RETAIL-ANALYTICS" }, pct: 15 },
    ],
    filters: { date_range: { from: "2025-01-01" }, opex_capex: "OPEX" },
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
    filters: { country: "MX" },
    rounding: "floor",
    priority: 20,
    active: true,
    version: 1,
  },
];

// Returns sample allocation rules for MVP; secured via default Cognito authorizer
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: SAMPLE }),
  };
};
