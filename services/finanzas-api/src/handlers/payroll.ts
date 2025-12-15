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
import { ApiGwEvent, ensureCanWrite, ensureSDT } from "../lib/auth";
import { bad, ok } from "../lib/http";
import {
  safeParsePayrollEntryCreate,
  PayrollKind,
  PayrollActualSchema,
} from "../validation/payroll";
import {
  putPayrollEntry,
  queryPayrollByProject,
  queryPayrollByPeriod,
  ddb,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  tableName,
  BatchWriteCommand,
  generatePayrollActualId,
  projectExists,
  getRubroTaxonomy,
} from "../lib/dynamo";
import { PayrollEntry, PayrollTimeSeries, MODProjectionByMonth } from "../lib/types";
import { calculateLaborVsIndirect } from "../lib/metrics";
import * as XLSX from "xlsx";
import { normalizeRubroId } from "../lib/canonical-taxonomy";

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
    return bad(event as any, "Invalid JSON in request body");
  }

  const validation = safeParsePayrollEntryCreate(body);
  if (!validation.success) {
    return bad(event as any, `Validation failed: ${validation.error.message}`, 400);
  }

  const data = validation.data;
  const userId = (event.requestContext as any).authorizer?.jwt?.claims?.email as string | undefined;

  try {
    // Validate that project exists in DynamoDB
    const projExists = await projectExists(data.projectId);
    if (!projExists) {
      return bad(event as any, `Project ${data.projectId} does not exist in DynamoDB`, 400);
    }

    // If rubroId provided, validate it exists and fetch taxonomy data
    let taxonomyData = null;
    if (data.rubroId) {
      taxonomyData = await getRubroTaxonomy(data.rubroId);
      if (!taxonomyData) {
        return bad(event as any, `Rubro ${data.rubroId} does not exist in taxonomy`, 400);
      }
    }

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
    
    // Include taxonomy data in response if available
    const response = taxonomyData
      ? { ...entry, taxonomy: taxonomyData }
      : entry;
    
    return ok(event as any, response, 201);
  } catch (error) {
    console.error("Error creating payroll entry:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return bad(event as any, { error: 'Internal server error', message: errorMessage }, 500);
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
    return bad(event as any, "Missing required query parameter: projectId", 400);
  }

  // Validate kind if provided
  if (kind && !['plan', 'forecast', 'actual'].includes(kind)) {
    return bad(event as any, "Invalid kind parameter. Must be one of: plan, forecast, actual", 400);
  }

  // Validate period format if provided
  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return bad(event as any, "Invalid period format. Must be YYYY-MM", 400);
  }

  try {
    let entries: PayrollEntry[];

    if (period) {
      entries = await queryPayrollByPeriod(projectId, period, kind);
    } else {
      entries = await queryPayrollByProject(projectId, kind);
    }

    return ok(event as any, entries);
  } catch (error) {
    console.error("Error querying payroll:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return bad(event as any, { error: 'Internal server error', message: errorMessage }, 500);
  }
}

/**
 * GET /payroll/actuals?projectId={id}&month={YYYY-MM}
 * Get payroll actuals for a project and month (API contract endpoint)
 * 
 * Query params:
 * - projectId: required
 * - month: required YYYY-MM filter
 * 
 * Response: { projectId, month, data: [...] }
 */
async function handleGetActuals(event: APIGatewayProxyEventV2) {
  const projectId = event.queryStringParameters?.projectId;
  const month = event.queryStringParameters?.month;

  if (!projectId) {
    return bad(event as any, "Missing required query parameter: projectId", 400);
  }

  if (!month) {
    return bad(event as any, "Missing required query parameter: month", 400);
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return bad(event as any, "Invalid month format. Must be YYYY-MM", 400);
  }

  try {
    // Query payroll actuals for the specified project and month
    const entries = await queryPayrollByPeriod(projectId, month, 'actual');

    return ok(event as any, {
      projectId,
      month,
      data: entries,
    });
  } catch (error) {
    console.error("Error querying payroll actuals:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return bad(event as any, { error: 'Internal server error', message: errorMessage }, 500);
  }
}

async function getProjectMetadata(projectId: string) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName("projects"),
      Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
    })
  );

  if (!result.Item) {
    throw new Error(`Proyecto ${projectId} no existe`);
  }

  return result.Item as Record<string, unknown>;
}

async function getRubroTaxonomy(rubroId: string) {
  const normalized = normalizeRubroId(rubroId);

  if (!normalized.isValid) {
    throw new Error(`Rubro ${rubroId} no existe en taxonomía`);
  }

  const canonicalId = normalized.canonicalId;

  const rubroMetadata = await ddb.send(
    new GetCommand({
      TableName: tableName("rubros"),
      Key: { pk: `RUBRO#${canonicalId}`, sk: "METADATA" },
    })
  );

  if (!rubroMetadata.Item && !normalized.isValid) {
    throw new Error(`Rubro ${canonicalId} no existe`);
  }

  const taxonomyQuery = await ddb.send(
    new QueryCommand({
      TableName: tableName("rubros_taxonomia"),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `LINEA#${canonicalId}`,
      },
      Limit: 1,
    })
  );

  let taxonomy = (taxonomyQuery.Items?.[0] as Record<string, unknown> | undefined) || undefined;

  if (!taxonomy) {
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName("rubros_taxonomia"),
        ProjectionExpression:
          "linea_codigo, categoria, categoria_codigo, linea_gasto, tipo_costo, tipo_ejecucion, descripcion",
      })
    );

    taxonomy = ((scan.Items || []) as Record<string, unknown>[]).find(
      (entry) => entry.linea_codigo === canonicalId,
    );
  }

  if (!taxonomy && !rubroMetadata.Item) {
    throw new Error(`Rubro ${canonicalId} no existe en taxonomía`);
  }

  const lineaCodigo = (rubroMetadata.Item as any)?.linea_codigo || canonicalId;

  return {
    canonicalId,
    metadata: rubroMetadata.Item,
    taxonomy,
    lineaCodigo,
  };
}

async function buildPayrollActualItem(
  data: Record<string, unknown>,
  event: APIGatewayProxyEventV2,
) {
  const projectId = data.projectId as string | undefined;
  const month = data.month as string | undefined;
  const id = (data.id as string | undefined) || generatePayrollActualId();
  const amount = data.amount !== undefined ? Number(data.amount) : undefined;
  const resourceCount = data.resourceCount !== undefined ? Number(data.resourceCount) : undefined;
  const userEmail = (event.requestContext as any).authorizer?.jwt?.claims?.email as string | undefined;

  if (!projectId || !month) {
    throw new Error("projectId and month are required");
  }

  if (!data.rubroId) {
    throw new Error("rubroId is required");
  }

  const projectMetadata = await getProjectMetadata(projectId);
  const rubro = await getRubroTaxonomy((data.rubroId as string) || "");

  const currency =
    typeof data.currency === "string" && data.currency.trim()
      ? (data.currency as string)
      : ((projectMetadata as any)?.currency as string | undefined) || "USD";

  const now = new Date().toISOString();

  const item = {
    ...data,
    id,
    projectId,
    month,
    period: month,
    amount,
    resourceCount,
    kind: (data as any).kind || 'actual',
    pk: `PROJECT#${projectId}`,
    sk: `PAYROLL#${month}#${id}`,
    uploadedAt: now,
    uploadedBy: (data as any).uploadedBy || userEmail,
    currency,
    linea_codigo: rubro.lineaCodigo,
    linea_gasto: (rubro.taxonomy as any)?.linea_gasto,
    categoria: (rubro.taxonomy as any)?.categoria,
    categoria_codigo: (rubro.taxonomy as any)?.categoria_codigo,
    descripcion: (rubro.taxonomy as any)?.descripcion,
    createdAt: now,
    createdBy: userEmail,
    updatedAt: now,
    updatedBy: userEmail,
    rubroId: rubro.canonicalId,
  };

  const validation = PayrollActualSchema.safeParse(item);
  if (!validation.success) {
    throw new Error(validation.error.message);
  }

  return {
    ...validation.data,
    pk: `PROJECT#${projectId}`,
    sk: `PAYROLL#${month}#${id}`,
    period: month,
    kind: 'actual',
  };
}

function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx]?.trim();
    });
    return row;
  });
}

function parseMultipart(event: APIGatewayProxyEventV2): Buffer | null {
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"];
  if (!contentType || !contentType.includes("multipart/form-data")) return null;

  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1];
  const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  const parts = bodyBuffer.toString("binary").split(`--${boundary}`);

  for (const part of parts) {
    const [rawHeaders, rawBody] = part.split("\r\n\r\n");
    if (!rawHeaders || !rawBody) continue;
    if (/filename=/i.test(rawHeaders)) {
      const cleaned = rawBody.replace(/\r\n--$/, "");
      return Buffer.from(cleaned, "binary");
    }
  }

  return null;
}

function parseBulkPayload(event: APIGatewayProxyEventV2): Record<string, unknown>[] {
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(bodyBuffer.toString("utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Error parsing JSON bulk payload", err);
      return [];
    }
  }

  if (contentType.includes("multipart/form-data")) {
    const fileBuffer = parseMultipart(event);
    if (!fileBuffer) return [];
    const workbookTypes = ["xlsx", "spreadsheet", "excel"];
    if (workbookTypes.some((t) => contentType.includes(t))) {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    }
    return parseCsv(fileBuffer.toString("utf8"));
  }

  if (contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
    const workbook = XLSX.read(bodyBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  }

  return parseCsv(bodyBuffer.toString("utf8"));
}

async function handlePostActual(event: APIGatewayProxyEventV2) {
  let payload: any;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return bad(event, "Invalid JSON in request body", 400);
  }

  try {
    const item = await buildPayrollActualItem(payload, event);
    await ddb.send(
      new PutCommand({
        TableName: tableName('payroll_actuals'),
        Item: item,
      })
    );
    return ok(event, item, 201);
  } catch (error) {
    console.error("Error creating payroll actual entry:", error);
    const message = error instanceof Error ? error.message : String(error);
    return bad(event, { error: "Validation failed", message }, 400);
  }
}

async function handlePostActualsBulk(event: APIGatewayProxyEventV2) {
  const rows = parseBulkPayload(event);
  const validItems: any[] = [];
  const errors: { index: number; message: string }[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const item = await buildPayrollActualItem(
        {
          ...row,
          id: (row as any).id || generatePayrollActualId(),
          projectId: (row as any).projectId || (row as any).project_id,
          allocationId: (row as any).allocationId || (row as any).allocation_id,
          rubroId: (row as any).rubroId || (row as any).rubro_id,
          month: (row as any).month || (row as any).period,
          amount:
            (row as any).amount !== undefined
              ? Number((row as any).amount)
              : (row as any).monto !== undefined
                ? Number((row as any).monto)
                : undefined,
          resourceCount: (row as any).resourceCount || (row as any).resource_count,
          uploadedBy: (row as any).uploadedBy || (row as any).uploaded_by,
        },
        event,
      );
      validItems.push(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ index, message });
    }
  }

  let insertedCount = 0;

  if (validItems.length > 0) {
    for (let i = 0; i < validItems.length; i += 25) {
      const chunk = validItems.slice(i, i + 25);
      const requestItems = chunk.map((Item) => ({ PutRequest: { Item } }));
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName('payroll_actuals')]: requestItems,
          },
        })
      );
      insertedCount += chunk.length;
    }
  }

  return ok(event, {
    insertedCount,
    errors,
  });
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
    return bad(event as any, "Missing required query parameter: projectId", 400);
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
      } else {
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

    return ok(event as any, timeSeries);
  } catch (error) {
    console.error("Error generating payroll summary:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return bad(event as any, { error: 'Internal server error', message: errorMessage }, 500);
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
async function handleGetDashboard(event: APIGatewayProxyEventV2) {
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
      // Calculate HR payroll target as 110% of plan MOD if plan exists
      // This is a reasonable default until actual HR targets are available
      const payrollTarget = data.plan > 0 ? data.plan * 1.1 : undefined;
      
      dashboard.push({
        month,
        totalPlanMOD: data.plan,
        totalForecastMOD: data.forecast,
        totalActualMOD: data.actual,
        payrollTarget,
        projectCount: data.projects.size,
      });
    }

    return ok(event as any, dashboard);
  } catch (error) {
    console.error("Error generating dashboard data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return bad(event as any, { error: 'Internal server error', message: errorMessage }, 500);
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
    return bad(event as any, `Method ${method} not allowed for /payroll/summary`, 405);
  }

  if (rawPath.includes("/payroll/dashboard")) {
    if (method === "GET") {
      return handleGetDashboard(event);
    }
    return bad(event as any, `Method ${method} not allowed for /payroll/dashboard`, 405);
  }

  if (rawPath.includes("/payroll/actuals/bulk")) {
    if (method === "POST") {
      await ensureCanWrite(event as ApiGwEvent);
      return handlePostActualsBulk(event);
    }
    return bad(event as any, `Method ${method} not allowed for /payroll/actuals/bulk`, 405);
  }

  if (rawPath.includes("/payroll/actuals")) {
    if (method === "GET") {
      return handleGetActuals(event);
    }
    if (method === "POST") {
      await ensureCanWrite(event as ApiGwEvent);
      return handlePostActual(event);
    }
    return bad(event as any, `Method ${method} not allowed for /payroll/actuals`, 405);
  }

  if (method === "GET") {
    return handleGet(event);
  }

  if (method === "POST") {
    return handlePost(event);
  }

  return bad(event as any, `Method ${method} not allowed`, 405);
};
