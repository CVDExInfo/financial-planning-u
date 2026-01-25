#!/usr/bin/env node
/**
 * Finanzas SD API smoke test
 * - Grabs a Cognito JWT via AWS CLI (USER_PASSWORD_AUTH)
 * - Exercises the key API Gateway routes the frontend relies on
 * - Prints HTTP status, body snippet, and a quick interpretation per call
 */

import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const API_BASE =
  process.env.FINANZAS_API_BASE ||
  "https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev";
const REGION = process.env.FINANZAS_COGNITO_REGION || "us-east-2";
const CLIENT_ID =
  process.env.FINANZAS_COGNITO_CLIENT_ID || "dshos5iou44tuach7ta3ici5m";
const USERNAME =
  process.env.FINANZAS_COGNITO_USERNAME || process.env.COGNITO_USERNAME;
const PASSWORD =
  process.env.FINANZAS_COGNITO_PASSWORD || process.env.COGNITO_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error(
    "❌ Set FINANZAS_COGNITO_USERNAME and FINANZAS_COGNITO_PASSWORD env vars before running this script."
  );
  process.exit(1);
}

async function getJwt() {
  const args = [
    "cognito-idp",
    "initiate-auth",
    "--region",
    REGION,
    "--client-id",
    CLIENT_ID,
    "--auth-flow",
    "USER_PASSWORD_AUTH",
    "--auth-parameters",
    `USERNAME=${USERNAME},PASSWORD=${PASSWORD}`,
    "--output",
    "json",
  ];

  const { stdout } = await execFileAsync("aws", args, { encoding: "utf8" });
  const payload = JSON.parse(stdout);
  const token = payload?.AuthenticationResult?.IdToken;
  if (!token) {
    throw new Error("Cognito response did not include an IdToken");
  }
  return token;
}

function interpret(status) {
  if (status >= 200 && status < 300) return "✅ Success";
  if (status === 401) return "⚠️ Unauthorized (token missing/expired)";
  if (status === 403) return "❌ Forbidden (likely Cedar/role mismatch)";
  if (status === 404) return "⚠️ Not Found (route mismatch)";
  if (status === 405) return "⚠️ Method Not Allowed";
  if (status === 500) return "❌ Lambda error";
  if (status === 501) return "ℹ️ Not implemented server-side yet";
  return "⚠️ Needs investigation";
}

function prettyBody(body) {
  if (body == null) return "null";
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

function extractIds(project) {
  if (!project || typeof project !== "object") return {};
  return {
    projectId: project.project_id || project.projectId || project.id,
    baselineId: project.baseline_id || project.baselineId,
  };
}

const ctx = {
  projectId: process.env.FINANZAS_PROJECT_ID,
  baselineId: process.env.FINANZAS_BASELINE_ID,
};

const tests = [
  {
    name: "Projects list",
    method: "GET",
    path: () => "/projects",
    capture: (data) => {
      if (Array.isArray(data) && data.length) {
        const ids = extractIds(data[0]);
        if (ids.projectId) ctx.projectId = ids.projectId;
        if (ids.baselineId) ctx.baselineId = ids.baselineId;
      }
    },
  },
  {
    name: "Project plan",
    method: "GET",
    requires: ["projectId"],
    path: (c) => `/projects/${c.projectId}/plan`,
  },
  {
    name: "Project billing plan",
    method: "GET",
    requires: ["projectId"],
    path: (c) => `/projects/${c.projectId}/billing`,
  },
  {
    name: "Alerts feed",
    method: "GET",
    path: () => "/alerts",
  },
  {
    name: "Forecast summary",
    method: "GET",
    path: () => "/plan/forecast",
  },
  {
    name: "Baseline lookup",
    method: "GET",
    requires: ["baselineId"],
    path: (c) => `/baseline/${c.baselineId}`,
  },
  {
    name: "Baseline create",
    method: "POST",
    path: () => "/baseline",
    body: () => ({
      project_name: `Smoke Project ${new Date().toISOString()}`,
      client_name: "Smoke Client",
      currency: "USD",
      duration_months: 1,
      labor_estimates: [
        {
          role: "Engineer",
          country: "MX",
          level: "mid",
          fte_count: 1,
          hourly_rate: 10,
          hours_per_month: 10,
          on_cost_percentage: 10,
          start_month: 1,
          end_month: 1,
        },
      ],
      non_labor_estimates: [],
      assumptions: ["smoke-test"],
    }),
  },
  {
    name: "Prefacturas list",
    method: "GET",
    requires: ["projectId"],
    path: (c) => `/prefacturas?projectId=${encodeURIComponent(c.projectId)}`,
  },
  {
    name: "Prefactura upload",
    method: "POST",
    requires: ["projectId"],
    path: () => "/prefacturas",
    body: (c) => ({
      projectId: c.projectId,
      lineItemId: c.lineItemId || "LINE-SMOKE",
      invoiceNumber: `INV-${Date.now()}`,
      amount: 1234,
      month: new Date().getMonth() + 1,
      vendor: "Smoke Vendor",
      description: "Smoke test prefactura",
      documentKey: `smoke/${Date.now()}.pdf`,
    }),
  },
  {
    name: "Allocations bulk update",
    method: "PUT",
    requires: ["projectId"],
    path: (c) => `/projects/${c.projectId}/allocations:bulk`,
    body: () => ({
      allocations: [
        { rubro_id: "RUBRO-SMOKE", mes: "2025-01", monto_planeado: 1000 },
      ],
    }),
  },
  {
    name: "Allocations GET",
    method: "GET",
    requires: ["projectId"],
    path: (c) => {
      // Include baseline if available for more specific query
      if (c.baselineId) {
        return `/allocations?projectId=${encodeURIComponent(c.projectId)}&baseline=${encodeURIComponent(c.baselineId)}`;
      }
      return `/allocations?projectId=${encodeURIComponent(c.projectId)}`;
    },
    validate: (data) => {
      // Validate response structure
      if (!data || typeof data !== "object") {
        throw new Error("Response should be an object");
      }
      if (!Array.isArray(data.data)) {
        throw new Error("Response should have data array");
      }
      // If we have allocations, validate first item structure
      if (data.data.length > 0) {
        const item = data.data[0];
        if (!item.rubroId && !item.rubro_id) {
          console.warn("⚠️ Allocation item missing rubroId/rubro_id");
        }
        if (typeof item.amount !== "number" && item.amount !== null && item.amount !== undefined) {
          console.warn("⚠️ Allocation amount is not numeric:", item.amount);
        }
      }
    },
  },
];

async function hit(test, token) {
  const hasAll = (test.requires || []).every((key) => Boolean(ctx[key]));
  if (!hasAll) {
    console.log(
      `↷ Skipping ${test.name} (missing context: ${test.requires?.join(", ")})`
    );
    return { name: test.name, skipped: true };
  }

  const path = typeof test.path === "function" ? test.path(ctx) : test.path;
  const body = typeof test.body === "function" ? test.body(ctx) : test.body;

  console.log(`\n=== ${test.name} ===`);
  console.log(`${test.method} ${API_BASE}${path}`);

  const res = await fetch(`${API_BASE}${path}`, {
    method: test.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((error) => ({ networkError: error }));

  if (res.networkError) {
    console.error("Request failed:", res.networkError.message);
    return {
      name: test.name,
      status: 0,
      ok: false,
      message: res.networkError.message,
    };
  }

  const text = await res.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }

  console.log(`Status: ${res.status}`);
  console.log(`Body: ${prettyBody(parsed)}`);
  console.log(`Interpretation: ${interpret(res.status)}`);

  if (
    typeof test.capture === "function" &&
    res.status >= 200 &&
    res.status < 300
  ) {
    try {
      test.capture(parsed, ctx);
    } catch (error) {
      console.warn("Capture callback failed:", error);
    }
  }

  if (
    typeof test.validate === "function" &&
    res.status >= 200 &&
    res.status < 300
  ) {
    try {
      test.validate(parsed, ctx);
    } catch (error) {
      console.warn("Validation failed:", error.message);
    }
  }

  return {
    name: test.name,
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
  };
}

(async () => {
  try {
    console.log("Authenticating against Cognito...");
    const token = await getJwt();
    console.log("Token acquired. Running smoke tests.");

    const results = [];
    for (const test of tests) {
      const outcome = await hit(test, token);
      results.push(outcome);
    }

    const executed = results.filter((r) => !r.skipped);
    const passed = executed.filter((r) => r.ok).length;
    const failed = executed.filter((r) => r.ok === false).length;
    const skipped = results.filter((r) => r.skipped).length;

    console.log("\n=== Summary ===");
    console.log(`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error("Smoke test failed to run:", error.message);
    process.exit(1);
  }
})();
