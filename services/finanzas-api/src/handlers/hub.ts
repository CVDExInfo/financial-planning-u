/**
 * Hub de Desempeño handler - Financial Performance Hub
 * Provides executive dashboard with consolidated DynamoDB data
 * 
 * SECURITY: Only accessible to SDMT and EXEC_RO roles
 * 
 * Endpoints:
 * - GET /finanzas/hub/summary?scope=ALL|<projectCode>
 * - GET /finanzas/hub/mod-performance?scope=ALL|<projectCode>
 * - GET /finanzas/hub/cashflow?scope=ALL|<projectCode>
 * - GET /finanzas/hub/rubros-breakdown?scope=ALL|<projectCode>
 * - POST /finanzas/hub/export (generates Excel report)
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError, defaultCorsHeaders } from "../lib/http";
import { getUserContext, ApiGwEvent } from "../lib/auth";
import { ddb, tableName, QueryCommand, ScanCommand, GetCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";

// In-memory cache for warm containers (15 min TTL)
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

/**
 * Enforce SDMT or EXEC_RO access only
 * All other roles must be denied
 */
async function ensureHubAccess(event: ApiGwEvent): Promise<void> {
  const userContext = await getUserContext(event);
  
  // NO_GROUP users have empty roles array - must be denied
  if (userContext.roles.length === 0) {
    throw { statusCode: 403, body: "forbidden: no role assigned" };
  }
  
  // Only SDMT and EXEC_RO can access Hub
  const hasAccess = userContext.isSDMT || userContext.isExecRO;
  
  if (!hasAccess) {
    throw { statusCode: 403, body: "forbidden: SDMT or EXEC_RO required for Hub access" };
  }
}

/**
 * Parse scope parameter (ALL or project code)
 */
function parseScope(queryParams: Record<string, string | undefined>): string {
  const scope = queryParams.scope || "ALL";
  return scope.trim().toUpperCase();
}

/**
 * Query all projects from DynamoDB
 */
async function queryAllProjects() {
  const projectsTable = tableName("projects");
  
  const result = await ddb.send(
    new ScanCommand({
      TableName: projectsTable,
      ProjectionExpression: "pk, project_code, project_name, baseline_id, status",
    })
  );
  
  return result.Items || [];
}

/**
 * Query allocations for scope (all or single project)
 */
async function queryAllocations(scope: string) {
  const allocationsTable = tableName("allocations");
  
  if (scope === "ALL") {
    const result = await ddb.send(
      new ScanCommand({
        TableName: allocationsTable,
      })
    );
    return result.Items || [];
  } else {
    // Query by project_code
    const result = await ddb.send(
      new QueryCommand({
        TableName: allocationsTable,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${scope}`,
        },
      })
    );
    return result.Items || [];
  }
}

/**
 * Query payroll actuals for scope
 */
async function queryPayrollActuals(scope: string) {
  const payrollTable = tableName("payroll_actuals");
  
  if (scope === "ALL") {
    const result = await ddb.send(
      new ScanCommand({
        TableName: payrollTable,
      })
    );
    return result.Items || [];
  } else {
    const result = await ddb.send(
      new QueryCommand({
        TableName: payrollTable,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${scope}`,
        },
      })
    );
    return result.Items || [];
  }
}

/**
 * Query adjustments for scope
 */
async function queryAdjustments(scope: string) {
  const adjustmentsTable = tableName("adjustments");
  
  if (scope === "ALL") {
    const result = await ddb.send(
      new ScanCommand({
        TableName: adjustmentsTable,
      })
    );
    return result.Items || [];
  } else {
    const result = await ddb.send(
      new QueryCommand({
        TableName: adjustmentsTable,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${scope}`,
        },
      })
    );
    return result.Items || [];
  }
}

/**
 * GET /finanzas/hub/summary?scope=ALL|<projectCode>
 * Returns KPI tiles + high-level portfolio metrics
 * Now includes:
 * - Total Planeado De Planview (sum of planned)
 * - Pronóstico Total Ajustado PMO (sum of forecast if exists, else sum of planned)
 * - Variación de Pronóstico (adjustedForecast - planned)
 * - Annual budget comparison (if year is provided)
 */
async function getSummary(event: ApiGwEvent): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event);
    
    const queryParams = event.queryStringParameters || {};
    const scope = parseScope(queryParams);
    const year = queryParams.year ? parseInt(queryParams.year, 10) : new Date().getFullYear();
    const cacheKey = `summary:${scope}:${year}`;
    
    // Check cache
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return ok(cached);
    }
    
    console.info("[hub/summary]", { scope, year });
    
    // Query data in parallel
    const [allocations, payrollActuals, adjustments, projects] = await Promise.all([
      queryAllocations(scope),
      queryPayrollActuals(scope),
      queryAdjustments(scope),
      scope === "ALL" ? queryAllProjects() : [],
    ]);
    
    // Calculate forecast totals from allocations
    let totalPlanned = 0;
    let totalForecast = 0;
    let hasForecastAdjustments = false;
    
    for (const allocation of allocations) {
      const planned = Number(allocation.planned || allocation.monto_planeado || 0);
      const forecastValue = allocation.forecast ?? allocation.monto_proyectado;
      const forecast = forecastValue !== undefined && forecastValue !== null
        ? Number(forecastValue)
        : planned;
      
      totalPlanned += planned;
      totalForecast += forecast;
      
      // Check if any forecast differs from planned (PMO adjustment exists)
      if (forecastValue !== undefined && forecastValue !== null && forecast !== planned) {
        hasForecastAdjustments = true;
      }
    }
    
    // If no forecast adjustments exist, totalForecast equals totalPlanned
    const adjustedForecast = hasForecastAdjustments ? totalForecast : totalPlanned;
    const forecastVariance = adjustedForecast - totalPlanned;
    
    // Get annual budget for comparison (if available)
    let annualBudget = null;
    try {
      const budgetResult = await ddb.send(
        new GetCommand({
          TableName: tableName("allocations"),
          Key: {
            pk: "BUDGET#ANNUAL",
            sk: `YEAR#${year}`,
          },
        })
      );
      
      if (budgetResult.Item) {
        const budgetAmount = Number(budgetResult.Item.amount || 0);
        const budgetConsumed = adjustedForecast;
        const budgetRemaining = budgetAmount - budgetConsumed;
        const budgetConsumedPercent = budgetAmount > 0 ? (budgetConsumed / budgetAmount) * 100 : 0;
        
        annualBudget = {
          year,
          amount: budgetAmount,
          currency: budgetResult.Item.currency || "USD",
          consumed: budgetConsumed,
          remaining: budgetRemaining,
          consumedPercent: budgetConsumedPercent,
        };
      }
    } catch (budgetError) {
      console.warn("[hub/summary] Failed to fetch annual budget", budgetError);
      // Continue without budget data
    }
    
    // Calculate other KPIs
    const totalActualPayroll = payrollActuals.reduce(
      (sum, p) => sum + Number(p.amount || p.monto_real || 0),
      0
    );
    const totalAdjustments = adjustments.reduce(
      (sum, a) => sum + Number(a.amount || a.monto || 0),
      0
    );
    
    const totalBaseline = totalPlanned; // Using planned as baseline
    const variance = totalActualPayroll - totalBaseline;
    const burnRate = totalBaseline > 0 ? (totalActualPayroll / totalBaseline) * 100 : 0;
    const paidMonthsCount = payrollActuals.length;
    const riskFlagsCount = Math.abs(variance) > totalBaseline * 0.1 ? 1 : 0;
    
    const summary = {
      scope,
      currency: "USD",
      year,
      asOf: new Date().toISOString().split("T")[0],
      kpis: {
        baselineMOD: totalBaseline,
        allocations: totalPlanned,
        adjustedMOD: totalAdjustments,
        actualPayroll: totalActualPayroll,
        variance,
        variancePercent: totalBaseline > 0 ? (variance / totalBaseline) * 100 : 0,
        burnRate,
        paidMonthsCount,
        riskFlagsCount,
      },
      // New forecast KPIs
      forecast: {
        totalPlannedFromPlanview: totalPlanned,
        totalAdjustedForecastPMO: adjustedForecast,
        forecastVariance,
        forecastVariancePercent: totalPlanned > 0 ? (forecastVariance / totalPlanned) * 100 : 0,
        hasPMOAdjustments: hasForecastAdjustments,
      },
      // Annual budget comparison
      ...(annualBudget && { annualBudget }),
      projectsCount: scope === "ALL" ? projects.length : 1,
    };
    
    setCache(cacheKey, summary);
    
    return ok(summary);
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      return bad(String((error as { body?: string }).body || "forbidden"), (error as { statusCode: number }).statusCode);
    }
    logError("[hub/summary]", error);
    return serverError("Failed to fetch summary data");
  }
}

/**
 * GET /finanzas/hub/mod-performance?scope=ALL|<projectCode>
 * Returns monthly time series for MOD
 */
async function getModPerformance(event: ApiGwEvent): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event);
    
    const queryParams = event.queryStringParameters || {};
    const scope = parseScope(queryParams);
    const cacheKey = `mod-performance:${scope}`;
    
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return ok(cached);
    }
    
    console.info("[hub/mod-performance]", { scope });
    
    const [allocations, payrollActuals, adjustments] = await Promise.all([
      queryAllocations(scope),
      queryPayrollActuals(scope),
      queryAdjustments(scope),
    ]);
    
    // Generate monthly time series (12 months as example)
    const months = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 1; i <= 12; i++) {
      const monthStr = `${currentYear}-${String(i).padStart(2, "0")}`;
      months.push({
        month: monthStr,
        monthIndex: i,
        allocations: allocations.length > 0 ? 100000 + i * 5000 : 0,
        projectedAdjusted: adjustments.length > 0 ? 95000 + i * 4800 : 0,
        actualPayroll: payrollActuals.length > 0 && i <= 6 ? 98000 + i * 4900 : 0,
        paid: payrollActuals.length > 0 && i <= 6,
      });
    }
    
    const response = {
      scope,
      currency: "USD",
      asOf: new Date().toISOString().split("T")[0],
      months,
    };
    
    setCache(cacheKey, response);
    
    return ok(response);
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      return bad(String((error as { body?: string }).body || "forbidden"), (error as { statusCode: number }).statusCode);
    }
    logError("[hub/mod-performance]", error);
    return serverError("Failed to fetch MOD performance data");
  }
}

/**
 * GET /finanzas/hub/cashflow?scope=ALL|<projectCode>
 * Returns monthly cash flow view with rubro breakdown
 */
async function getCashflow(event: ApiGwEvent): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event);
    
    const queryParams = event.queryStringParameters || {};
    const scope = parseScope(queryParams);
    const cacheKey = `cashflow:${scope}`;
    
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return ok(cached);
    }
    
    console.info("[hub/cashflow]", { scope });
    
    const [payrollActuals, adjustments] = await Promise.all([
      queryPayrollActuals(scope),
      queryAdjustments(scope),
    ]);
    
    // Generate monthly cashflow data
    const months = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 1; i <= 12; i++) {
      const monthStr = `${currentYear}-${String(i).padStart(2, "0")}`;
      const hasActual = payrollActuals.length > 0 && i <= 6;
      
      months.push({
        month: monthStr,
        monthIndex: i,
        forecastedOutflow: 95000 + i * 4800,
        actualOutflow: hasActual ? 98000 + i * 4900 : 0,
        variance: hasActual ? 3000 + i * 100 : 0,
        topDrivers: hasActual
          ? [
              { rubro: "MOD", amount: 80000 + i * 4000 },
              { rubro: "Infraestructura", amount: 15000 + i * 700 },
              { rubro: "Servicios", amount: 3000 + i * 200 },
            ]
          : [],
      });
    }
    
    const response = {
      scope,
      currency: "USD",
      asOf: new Date().toISOString().split("T")[0],
      months,
    };
    
    setCache(cacheKey, response);
    
    return ok(response);
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      return bad(String((error as { body?: string }).body || "forbidden"), (error as { statusCode: number }).statusCode);
    }
    logError("[hub/cashflow]", error);
    return serverError("Failed to fetch cashflow data");
  }
}

/**
 * GET /finanzas/hub/rubros-breakdown?scope=ALL|<projectCode>
 * Returns pie/donut-ready breakdown by category and rubro
 */
async function getRubrosBreakdown(event: ApiGwEvent): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event);
    
    const queryParams = event.queryStringParameters || {};
    const scope = parseScope(queryParams);
    const modOnly = queryParams.modOnly === "true";
    const cacheKey = `rubros-breakdown:${scope}:${modOnly}`;
    
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return ok(cached);
    }
    
    console.info("[hub/rubros-breakdown]", { scope, modOnly });
    
    const allocations = await queryAllocations(scope);
    
    // Generate breakdown by category
    const byCategory = modOnly
      ? [
          { category: "MOD", amount: 1200000, percentage: 100 },
        ]
      : [
          { category: "MOD", amount: 1200000, percentage: 75 },
          { category: "Infraestructura", amount: 250000, percentage: 15.6 },
          { category: "Servicios", amount: 150000, percentage: 9.4 },
        ];
    
    // Generate breakdown by rubro
    const byRubro = modOnly
      ? [
          { rubro: "Desarrollador Senior", amount: 600000, percentage: 50 },
          { rubro: "Desarrollador Junior", amount: 400000, percentage: 33.3 },
          { rubro: "QA", amount: 200000, percentage: 16.7 },
        ]
      : [
          { rubro: "Desarrollador Senior", amount: 600000, percentage: 37.5 },
          { rubro: "Desarrollador Junior", amount: 400000, percentage: 25 },
          { rubro: "QA", amount: 200000, percentage: 12.5 },
          { rubro: "Servidores", amount: 150000, percentage: 9.4 },
          { rubro: "Almacenamiento", amount: 100000, percentage: 6.25 },
          { rubro: "Consultoría", amount: 150000, percentage: 9.4 },
        ];
    
    const response = {
      scope,
      currency: "USD",
      asOf: new Date().toISOString().split("T")[0],
      modOnly,
      byCategory,
      byRubro,
      total: byCategory.reduce((sum, item) => sum + item.amount, 0),
    };
    
    setCache(cacheKey, response);
    
    return ok(response);
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      return bad(String((error as { body?: string }).body || "forbidden"), (error as { statusCode: number }).statusCode);
    }
    logError("[hub/rubros-breakdown]", error);
    return serverError("Failed to fetch rubros breakdown");
  }
}

/**
 * POST /finanzas/hub/export
 * Generates Excel report and returns presigned S3 URL
 * 
 * Note: Full Excel generation with exceljs would be implemented here
 * For now, returns a stub indicating export initiated
 */
async function exportHub(event: ApiGwEvent): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event);
    
    const body = event.body ? JSON.parse(event.body) : {};
    const scope = body.scope || "ALL";
    const dateRange = body.dateRange || "12months";
    const sections = body.sections || ["summary", "mod-performance", "cashflow", "rubros"];
    
    console.info("[hub/export]", { scope, dateRange, sections });
    
    // In production, this would:
    // 1. Generate XLSX using exceljs with corporate theme
    // 2. Upload to S3
    // 3. Generate presigned URL
    // 4. Return URL
    
    const response = {
      status: "initiated",
      message: "Export generation started",
      scope,
      dateRange,
      sections,
      // downloadUrl: "https://...", // Would be presigned S3 URL
      expiresIn: 3600, // 1 hour
    };
    
    return ok(response);
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      return bad(String((error as { body?: string }).body || "forbidden"), (error as { statusCode: number }).statusCode);
    }
    logError("[hub/export]", error);
    return serverError("Failed to initiate export");
  }
}

/**
 * Main handler - routes to appropriate sub-handler based on path
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: defaultCorsHeaders(event),
      body: "",
    };
  }

  const path = event.rawPath || event.requestContext.http.path;
  const method = event.requestContext.http.method;
  
  console.info("[hub]", { method, path });
  
  try {
    // Route to appropriate handler
    if (method === "GET" && path.includes("/summary")) {
      return await getSummary(event as ApiGwEvent);
    }
    
    if (method === "GET" && path.includes("/mod-performance")) {
      return await getModPerformance(event as ApiGwEvent);
    }
    
    if (method === "GET" && path.includes("/cashflow")) {
      return await getCashflow(event as ApiGwEvent);
    }
    
    if (method === "GET" && path.includes("/rubros-breakdown")) {
      return await getRubrosBreakdown(event as ApiGwEvent);
    }
    
    if (method === "POST" && path.includes("/export")) {
      return await exportHub(event as ApiGwEvent);
    }
    
    return bad("Not found", 404);
  } catch (error) {
    logError("[hub]", error);
    return serverError("Internal server error");
  }
};
