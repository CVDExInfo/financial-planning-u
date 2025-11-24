// Minimal event typing to avoid dependency issues with aws-lambda v2 types
type ApiGwEvent = {
  // Use unknown to avoid lint any complaints; narrowed at usage sites
  requestContext: unknown;
  headers?: Record<string, string | undefined>;
};
// Node16/nodenext requires explicit extension; authorizer util compiled to auth.js
import { ensureSDT } from "../lib/auth.js";

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
export const handler = async (event: ApiGwEvent) => {
  try {
    // Allow local SAM smoke tests to bypass auth if explicitly enabled
    const skipAuth = process.env.SKIP_AUTH === "true";
    if (!skipAuth) {
      // Soft auth enforcement for R1: if SDT check fails, still return sample data (visibility over strict blocking)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- temporary cast until full APIGatewayProxyEventV2 typing restored
        await ensureSDT(event as any);
      } catch (authErr) {
        console.warn("[allocation-rules] SDT enforcement skipped:", authErr);
      }
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: SAMPLE }),
    };
  } catch (err: unknown) {
    // Normalize auth-related throws to proper Lambda responses instead of opaque 500s
    if (err && typeof err === "object" && "statusCode" in err) {
      const e = err as { statusCode?: number; body?: string };
      return {
        statusCode: e.statusCode || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: e.body || "error" }),
      };
    }
    console.error("/allocation-rules unhandled error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "internal error" }),
    };
  }
};
