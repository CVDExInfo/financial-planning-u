/**
 * Annual All-In Budget Handler
 * 
 * GET /budgets/all-in?year=YYYY
 * PUT /budgets/all-in
 * 
 * Manages organization-wide annual all-in budgets
 * Only accessible to SDMT and EXEC_RO roles
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError, noContent, notFound } from "../lib/http";
import { getUserContext, ApiGwEvent } from "../lib/auth";
import { ddb, tableName, PutCommand, GetCommand, ScanCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";

/**
 * Enforce SDMT, EXEC_RO, or ADMIN access for reads
 */
async function ensureHubAccess(event: ApiGwEvent): Promise<void> {
  const userContext = await getUserContext(event);
  
  if (userContext.roles.length === 0) {
    throw { statusCode: 403, body: "forbidden: no role assigned" };
  }
  
  const hasAccess = userContext.isSDMT || userContext.isExecRO || userContext.isAdmin;
  
  if (!hasAccess) {
    throw { statusCode: 403, body: "forbidden: SDMT, EXEC_RO, or ADMIN required for budget access" };
  }
}

/**
 * Enforce SDMT or ADMIN access for writes
 */
async function ensureSDMTAccess(event: ApiGwEvent): Promise<void> {
  const userContext = await getUserContext(event);
  
  if (!userContext.isSDMT && !userContext.isAdmin) {
    throw { statusCode: 403, body: "forbidden: SDMT or ADMIN role required for budget updates" };
  }
}

/**
 * GET /budgets/all-in?year=YYYY
 */
async function getAnnualBudget(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event as any);

    const year = event.queryStringParameters?.year;
    
    if (!year) {
      return bad("Missing required parameter: year");
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return bad("Invalid year parameter. Must be between 2020 and 2100");
    }

    // Query DynamoDB for the budget
    // Note: Budgets are stored in the allocations table with pk="BUDGET#ANNUAL" 
    // for simplicity and to avoid creating a separate table for this small dataset
    const budgetsTable = tableName("allocations"); // Reuse allocations table for simplicity
    const result = await ddb.send(
      new GetCommand({
        TableName: budgetsTable,
        Key: {
          pk: "BUDGET#ANNUAL",
          sk: `YEAR#${yearNum}`,
        },
      })
    );

    if (!result.Item) {
      return notFound(`No budget found for year ${yearNum}`);
    }

    const budget = {
      year: result.Item.year,
      amount: result.Item.amount,
      currency: result.Item.currency || "USD",
      lastUpdated: result.Item.lastUpdated,
      updatedBy: result.Item.updatedBy,
    };

    console.log(`[budgets] GET annual budget for ${yearNum}:`, budget);
    return ok(event, budget);
  } catch (error: any) {
    if (error?.statusCode) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ message: error.body }),
        headers: { "Content-Type": "application/json" },
      };
    }
    logError("Error fetching annual budget", error);
    return serverError(event as any, "Failed to fetch annual budget");
  }
}

/**
 * PUT /budgets/all-in
 */
async function setAnnualBudget(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureSDMTAccess(event as any);

    const body = event.body ? JSON.parse(event.body) : {};
    const { year, amount, currency } = body;

    // Validate input
    if (!year || typeof year !== "number") {
      return bad("Missing or invalid year");
    }

    if (year < 2020 || year > 2100) {
      return bad("Year must be between 2020 and 2100");
    }

    if (typeof amount !== "number" || amount < 0) {
      return bad("Amount must be a non-negative number");
    }

    const budgetCurrency = currency || "USD";
    if (!["USD", "EUR", "MXN"].includes(budgetCurrency)) {
      return bad("Currency must be USD, EUR, or MXN");
    }

    // Get user context for audit
    const userContext = await getUserContext(event as any);
    const updatedBy = userContext.email || userContext.sub || "system";
    const timestamp = new Date().toISOString();

    // Write to DynamoDB
    const budgetsTable = tableName("allocations"); // Reuse allocations table
    const item = {
      pk: "BUDGET#ANNUAL",
      sk: `YEAR#${year}`,
      year,
      amount,
      currency: budgetCurrency,
      lastUpdated: timestamp,
      updatedBy,
    };

    await ddb.send(
      new PutCommand({
        TableName: budgetsTable,
        Item: item,
      })
    );

    console.log(`[budgets] SET annual budget for ${year}:`, item);

    return ok(event, {
      year,
      amount,
      currency: budgetCurrency,
      lastUpdated: timestamp,
      updatedBy,
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ message: error.body }),
        headers: { "Content-Type": "application/json" },
      };
    }
    logError("Error setting annual budget", error);
    return serverError(event as any, "Failed to set annual budget");
  }
}

/**
 * GET /budgets/all-in/overview?year=YYYY
 * Returns annual budget with cross-project totals for KPI calculations
 */
async function getBudgetOverview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    await ensureHubAccess(event as any);

    const year = event.queryStringParameters?.year;
    
    if (!year) {
      return bad("Missing required parameter: year");
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return bad("Invalid year parameter. Must be between 2020 and 2100");
    }

    // Get the annual budget
    const budgetsTable = tableName("allocations");
    const budgetResult = await ddb.send(
      new GetCommand({
        TableName: budgetsTable,
        Key: {
          pk: "BUDGET#ANNUAL",
          sk: `YEAR#${yearNum}`,
        },
      })
    );

    const budgetAllIn = budgetResult.Item
      ? { amount: budgetResult.Item.amount, currency: budgetResult.Item.currency || "USD" }
      : null;

    // Get all allocations for the year to calculate totals
    const allocationsTable = tableName("allocations");
    const allocationsResult = await ddb.send(
      new ScanCommand({
        TableName: allocationsTable,
        FilterExpression: "begins_with(#month, :year)",
        ExpressionAttributeNames: {
          "#month": "month",
        },
        ExpressionAttributeValues: {
          ":year": `${yearNum}-`,
        },
      })
    );

    const allocations = allocationsResult.Items || [];

    // Calculate totals across all projects for the year
    let totalPlanned = 0;
    let totalForecast = 0;
    let totalActual = 0;

    for (const allocation of allocations) {
      totalPlanned += Number(allocation.planned || allocation.monto_planeado || 0);
      totalForecast += Number(allocation.forecast || allocation.monto_proyectado || 0);
      totalActual += Number(allocation.actual || allocation.monto_real || 0);
    }

    // Calculate variances
    const budgetAmount = budgetAllIn?.amount || 0;
    const varianceBudgetVsForecast = budgetAmount - totalForecast;
    const varianceBudgetVsActual = budgetAmount - totalActual;
    const percentBudgetConsumedActual = budgetAmount > 0 ? (totalActual / budgetAmount) * 100 : null;
    const percentBudgetConsumedForecast = budgetAmount > 0 ? (totalForecast / budgetAmount) * 100 : null;

    const overview = {
      year: yearNum,
      budgetAllIn,
      totals: {
        planned: totalPlanned,
        forecast: totalForecast,
        actual: totalActual,
        varianceBudgetVsForecast,
        varianceBudgetVsActual,
        percentBudgetConsumedActual,
        percentBudgetConsumedForecast,
      },
    };

    console.log(`[budgets] GET overview for ${yearNum}:`, overview.totals);
    return ok(event, overview);
  } catch (error: any) {
    if (error?.statusCode) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ message: error.body }),
        headers: { "Content-Type": "application/json" },
      };
    }
    logError("Error fetching budget overview", error);
    return serverError(event as any, "Failed to fetch budget overview");
  }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method?.toUpperCase();
  const path = event.requestContext.http.path || event.rawPath || "";

  if (method === "OPTIONS") {
    return noContent();
  }

  // Check if this is the overview endpoint
  if (method === "GET" && path.includes("/overview")) {
    return await getBudgetOverview(event);
  }

  if (method === "GET") {
    return await getAnnualBudget(event);
  }

  if (method === "PUT") {
    return await setAnnualBudget(event);
  }

  return bad(`Method ${method} not allowed`, 405);
};
