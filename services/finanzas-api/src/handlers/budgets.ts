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
import { ddb, tableName, PutCommand, GetCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";

/**
 * Enforce SDMT or EXEC_RO access only
 */
async function ensureHubAccess(event: ApiGwEvent): Promise<void> {
  const userContext = await getUserContext(event);
  
  if (userContext.roles.length === 0) {
    throw { statusCode: 403, body: "forbidden: no role assigned" };
  }
  
  const hasAccess = userContext.isSDMT || userContext.isExecRO;
  
  if (!hasAccess) {
    throw { statusCode: 403, body: "forbidden: SDMT or EXEC_RO required for budget access" };
  }
}

/**
 * Enforce SDMT access only for writes
 */
async function ensureSDMTAccess(event: ApiGwEvent): Promise<void> {
  const userContext = await getUserContext(event);
  
  if (!userContext.isSDMT) {
    throw { statusCode: 403, body: "forbidden: SDMT role required for budget updates" };
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
    // We'll create a simple table with pk = "BUDGET#ANNUAL" and sk = "YEAR#{year}"
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

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method?.toUpperCase();

  if (method === "OPTIONS") {
    return noContent();
  }

  if (method === "GET") {
    return await getAnnualBudget(event);
  }

  if (method === "PUT") {
    return await setAnnualBudget(event);
  }

  return bad(`Method ${method} not allowed`, 405);
};
