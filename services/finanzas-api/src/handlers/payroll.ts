// DISCOVERY COMMENTS - MOD Payroll Projections Implementation
// =================================================================
// 
// CURRENT STATE (before this implementation):
// - payroll.ts: Placeholder with TODOs, no real implementation
// - Endpoints: GET and POST return 501 "not implemented"
// - Table: payroll_actuals exists with schema:
//   * pk: PROJECT#${projectId}#MONTH#${period}
//   * sk: PAYROLL#${id}
//   * Fields: id, projectId, allocationId, rubroId, month, amount, resourceCount, source, uploadedBy
// - Used by: plan.ts queries payroll_actuals for aggregation
//           forecast.ts queries payroll_actuals for forecast cells
// - No support for plan/forecast distinction - all data is "actual"
//
// REQUIREMENTS:
// 1. Support 3 kinds of payroll data: plan, forecast, actual
// 2. Ingest MOD plan (from caso de negocio) and forecast (from SD/Finanzas projections)
// 3. Maintain backwards compatibility with existing actual payroll records
// 4. Provide per-project time series with plan/forecast/actual breakdown
// 5. Support dashboard aggregations by start month
// 6. Calculate labor vs indirect cost metrics
//
// NEW DATA MODEL:
// - PayrollEntry interface with 'kind' field (plan | forecast | actual)
// - New sk format: PAYROLL#${kind}#${id} for easy filtering
// - Legacy records (sk: PAYROLL#${id}) treated as kind="actual"
// - All validation schemas support the new structure
// - Backwards compatible: existing queries still work
//
// ENDPOINTS IMPLEMENTED:
// - POST /payroll - Ingest payroll (plan/forecast/actual) with kind parameter
// - GET /payroll?projectId={id} - Get all payroll for a project (time series)
// - GET /payroll?projectId={id}&period={YYYY-MM} - Get payroll for specific period
// - GET /payroll/summary?projectId={id} - Get time series with metrics (plan vs forecast vs actual)
// - GET /payroll/dashboard - Get aggregated MOD by start month (for projects dashboard)
//
// =================================================================

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { bad, ok } from "../lib/http";
import {
  parsePayrollEntryCreate,
  safeParsePayrollEntryCreate,
  PayrollKind,
} from "../validation/payroll";
import {
  putPayrollEntry,
  queryPayrollByProject,
  queryPayrollByPeriod,
  ddb,
  QueryCommand,
  ScanCommand,
  tableName,
} from "../lib/dynamo";
import { PayrollEntry, PayrollTimeSeries, MODProjectionByMonth } from "../lib/types";
import { calculateLaborVsIndirect } from "../lib/metrics";

/**
 * POST /payroll
 * Ingest payroll data (plan, forecast, or actual)
 * 
 * Request body:
 * {
 *   projectId: string;        // proj_xxx or P-XXX format
 *   period: string;           // YYYY-MM
 *   kind: "plan" | "forecast" | "actual";
 *   amount: number;           // >= 0
 *   currency: string;         // USD, COP, EUR, etc.
 *   source?: string;          // Optional: "excel", "hr_system", etc.
 *   rubroId?: string;         // Optional: link to rubro
 *   allocationId?: string;    // Optional: link to allocation
 *   resourceCount?: number;   // Optional: FTE count
 *   notes?: string;           // Optional: additional context
 * }
 * 
 * Response: 200 with created PayrollEntry
 */
async function handlePost(event: APIGatewayProxyEventV2) {
  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return bad("Invalid JSON in request body");
  }

  const validation = safeParsePayrollEntryCreate(body);
  if (!validation.success) {
    return bad(`Validation failed: ${validation.error.message}`, 400);
  }

  const data = validation.data;
  const userId = (event.requestContext as any).authorizer?.jwt?.claims?.email as string | undefined;

  try {
    // Validated data has all required fields for putPayrollEntry
    const entry = await putPayrollEntry({
      projectId: data.projectId,
      period: data.period,
      kind: data.kind,
      amount: data.amount,
      currency: data.currency,
      allocationId: data.allocationId,
      rubroId: data.rubroId,
      resourceCount: data.resourceCount,
      source: data.source,
      uploadedBy: data.uploadedBy,
      notes: data.notes,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    }, userId);
    return ok(entry, 201);
  } catch (error) {
    console.error("Error creating payroll entry:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d7t9x3j66yd8k.cloudfront.net',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
}

/**
 * GET /payroll?projectId={id}&period={YYYY-MM}
 * Get payroll entries for a project, optionally filtered by period
 * 
 * Query params:
 * - projectId: required
 * - period: optional YYYY-MM filter
 * - kind: optional filter (plan/forecast/actual)
 * 
 * Response: Array of PayrollEntry
 */
async function handleGet(event: APIGatewayProxyEventV2) {
  const projectId = event.queryStringParameters?.projectId;
  const period = event.queryStringParameters?.period;
  const kind = event.queryStringParameters?.kind as PayrollKind | undefined;

  if (!projectId) {
    return bad("Missing required query parameter: projectId", 400);
  }

  // Validate kind if provided
  if (kind && !['plan', 'forecast', 'actual'].includes(kind)) {
    return bad("Invalid kind parameter. Must be one of: plan, forecast, actual", 400);
  }

  // Validate period format if provided
  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return bad("Invalid period format. Must be YYYY-MM", 400);
  }

  try {
    let entries: PayrollEntry[];

    if (period) {
      entries = await queryPayrollByPeriod(projectId, period, kind);
    } else {
      entries = await queryPayrollByProject(projectId, kind);
    }

    return ok(entries);
  } catch (error) {
    console.error("Error querying payroll:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d7t9x3j66yd8k.cloudfront.net',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
}

/**
 * GET /payroll/summary?projectId={id}
 * Get time series summary for a project with plan/forecast/actual breakdown and metrics
 * 
 * Returns array of PayrollTimeSeries objects, one per period, with:
 * - planMOD, forecastMOD, actualMOD
 * - indirectCostsPlan, indirectCostsActual (from allocations/providers)
 * - laborSharePlan, laborShareForecast, laborShareActual
 * - totalPlan, totalForecast, totalActual
 * 
 * Response: Array of PayrollTimeSeries
 */
async function handleGetSummary(event: APIGatewayProxyEventV2) {
  const projectId = event.queryStringParameters?.projectId;

  if (!projectId) {
    return bad("Missing required query parameter: projectId", 400);
  }

  try {
    // Get all payroll entries for the project
    const payrollEntries = await queryPayrollByProject(projectId);

    // Get allocations for indirect costs
    const allocationsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('allocations'),
        KeyConditionExpression: 'begins_with(pk, :pk)',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}#MONTH#`,
        },
      })
    );
    const allocations = allocationsResult.Items || [];

    // Group payroll by period
    const periodMap = new Map<string, { plan?: number; forecast?: number; actual?: number }>();
    
    for (const entry of payrollEntries) {
      const existing = periodMap.get(entry.period) || {};
      
      if (entry.kind === 'plan') {
        existing.plan = (existing.plan || 0) + entry.amount;
      } else if (entry.kind === 'forecast') {
        existing.forecast = (existing.forecast || 0) + entry.amount;
      } else if (entry.kind === 'actual') {
        existing.actual = (existing.actual || 0) + entry.amount;
      }
      
      periodMap.set(entry.period, existing);
    }

    // Group allocations by period for indirect costs
    const allocationMap = new Map<string, { plan?: number; actual?: number }>();
    
    interface AllocationItem {
      month?: string;
      planned?: number;
      monto_planeado?: number;
      actual?: number;
      monto_real?: number;
    }
    
    for (const alloc of allocations) {
      const allocation = alloc as AllocationItem;
      const month = allocation.month;
      if (!month) continue;
      
      const existing = allocationMap.get(month) || {};
      existing.plan = (existing.plan || 0) + (allocation.planned || allocation.monto_planeado || 0);
      existing.actual = (existing.actual || 0) + (allocation.actual || allocation.monto_real || 0);
      
      allocationMap.set(month, existing);
    }

    // Build time series with all periods
    const allPeriods = new Set([...periodMap.keys(), ...allocationMap.keys()]);
    const timeSeries: PayrollTimeSeries[] = [];

    for (const period of Array.from(allPeriods).sort()) {
      const payroll = periodMap.get(period) || {};
      const indirect = allocationMap.get(period) || {};

      const metrics = calculateLaborVsIndirect({
        planMOD: payroll.plan,
        forecastMOD: payroll.forecast,
        actualMOD: payroll.actual,
        planIndirect: indirect.plan,
        actualIndirect: indirect.actual,
      });

      timeSeries.push({
        period,
        planMOD: payroll.plan,
        forecastMOD: payroll.forecast,
        actualMOD: payroll.actual,
        indirectCostsPlan: indirect.plan,
        indirectCostsActual: indirect.actual,
        laborSharePlan: metrics.laborSharePlan,
        laborShareForecast: metrics.laborShareForecast,
        laborShareActual: metrics.laborShareActual,
        totalPlan: metrics.totalPlan,
        totalForecast: metrics.totalForecast,
        totalActual: metrics.totalActual,
      });
    }

    return ok(timeSeries);
  } catch (error) {
    console.error("Error generating payroll summary:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d7t9x3j66yd8k.cloudfront.net',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
}

/**
 * GET /payroll/dashboard
 * Get aggregated MOD projections by project start month for the portfolio dashboard
 * 
 * Returns array of MODProjectionByMonth with:
 * - month: project start month (YYYY-MM or YYYY-MM-DD)
 * - totalPlanMOD, totalForecastMOD, totalActualMOD
 * - projectCount
 * 
 * Response: Array of MODProjectionByMonth
 */
async function handleGetDashboard(_event: APIGatewayProxyEventV2) {
  try {
    // Get all projects with their start dates
    // Note: This uses begins_with with sk filter to scan projects
    const projectsResult = await ddb.send(
      new ScanCommand({
        TableName: tableName('projects'),
        FilterExpression: 'begins_with(pk, :pk) AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': 'PROJECT#',
          ':sk': 'META',
        },
      })
    );
    const projects = projectsResult.Items || [];

    // Get all payroll entries
    // Note: This scans the table - consider a GSI on projectId for better performance
    const payrollResult = await ddb.send(
      new ScanCommand({
        TableName: tableName('payroll_actuals'),
        FilterExpression: 'begins_with(pk, :pk) AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'PROJECT#',
          ':sk': 'PAYROLL#',
        },
      })
    );
    const allPayroll = (payrollResult.Items || []) as PayrollEntry[];

    // Group by project start month
    const monthMap = new Map<string, {
      plan: number;
      forecast: number;
      actual: number;
      projects: Set<string>;
    }>();

    for (const project of projects) {
      const startDate = (project as any).start_date || (project as any).fecha_inicio || (project as any).startMonth;
      if (!startDate) continue;

      const startMonth = startDate.substring(0, 7); // Extract YYYY-MM
      const projectId = (project as any).projectId || (project as any).project_id;

      if (!monthMap.has(startMonth)) {
        monthMap.set(startMonth, {
          plan: 0,
          forecast: 0,
          actual: 0,
          projects: new Set(),
        });
      }

      const monthData = monthMap.get(startMonth)!;
      monthData.projects.add(projectId);

      // Sum up payroll for this project
      const projectPayroll = allPayroll.filter(p => p.projectId === projectId);
      
      for (const entry of projectPayroll) {
        if (entry.kind === 'plan') {
          monthData.plan += entry.amount;
        } else if (entry.kind === 'forecast') {
          monthData.forecast += entry.amount;
        } else if (entry.kind === 'actual') {
          monthData.actual += entry.amount;
        }
      }
    }

    // Build response
    const dashboard: MODProjectionByMonth[] = [];
    
    for (const [month, data] of Array.from(monthMap.entries()).sort()) {
      dashboard.push({
        month,
        totalPlanMOD: data.plan,
        totalForecastMOD: data.forecast,
        totalActualMOD: data.actual,
        projectCount: data.projects.size,
      });
    }

    return ok(dashboard);
  } catch (error) {
    console.error("Error generating dashboard data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d7t9x3j66yd8k.cloudfront.net',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
}

// Main handler - route to appropriate sub-handler
export const handler = async (event: APIGatewayProxyEventV2) => {
  await ensureSDT(event);

  const method = event.requestContext.http.method;
  const rawPath = event.rawPath || event.requestContext.http.path || "";

  // Route based on path and method
  if (rawPath.includes("/payroll/summary")) {
    if (method === "GET") {
      return handleGetSummary(event);
    }
    return bad(`Method ${method} not allowed for /payroll/summary`, 405);
  }

  if (rawPath.includes("/payroll/dashboard")) {
    if (method === "GET") {
      return handleGetDashboard(event);
    }
    return bad(`Method ${method} not allowed for /payroll/dashboard`, 405);
  }

  if (method === "GET") {
    return handleGet(event);
  }

  if (method === "POST") {
    return handlePost(event);
  }

  return bad(`Method ${method} not allowed`, 405);
};
