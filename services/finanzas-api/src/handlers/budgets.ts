/**
 * Budgets handler - Annual All-In Budget management
 * 
 * Endpoints:
 * - GET /budgets/all-in?year=YYYY - Get annual all-in budget
 * - PUT /budgets/all-in?year=YYYY - Upsert annual all-in budget (PMO/ADMIN only)
 * - GET /budgets/all-in/overview?year=YYYY - Get budget overview with cross-project totals
 * 
 * Storage:
 * - Uses finz_projects table with key pattern:
 *   pk: ORG#FINANZAS
 *   sk: BUDGET#ALLIN#YEAR#{year}
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError, noContent } from "../lib/http";
import { getUserContext } from "../lib/auth";
import { ddb, tableName, GetCommand, PutCommand, QueryCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";
import { parseAnnualBudgetUpsert } from "../validation/budgets";

/**
 * GET /budgets/all-in?year=YYYY
 * Returns the annual all-in budget for the specified year
 */
async function getAllInBudget(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const year = event.queryStringParameters?.year;
    if (!year || isNaN(Number(year))) {
      return bad(event, "Missing or invalid year parameter");
    }

    const projectsTable = tableName("projects");
    const pk = "ORG#FINANZAS";
    const sk = `BUDGET#ALLIN#YEAR#${year}`;

    const result = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk, sk },
      })
    );

    if (!result.Item) {
      // No budget set for this year
      return ok(event, {
        year: Number(year),
        amount: null,
        currency: "USD",
      });
    }

    return ok(event, {
      year: Number(year),
      amount: result.Item.amount || null,
      currency: result.Item.currency || "USD",
      updated_at: result.Item.updated_at,
      updated_by: result.Item.updated_by,
    });
  } catch (error) {
    logError("Error fetching all-in budget", error);
    return serverError(event, "Failed to fetch budget");
  }
}

/**
 * PUT /budgets/all-in?year=YYYY
 * Upserts the annual all-in budget (PMO/ADMIN only)
 */
async function putAllInBudget(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Get user context and check permissions
    const userContext = await getUserContext(event as any);
    if (!userContext.isPMO && !userContext.isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "PMO or ADMIN role required to update budget" }),
      };
    }

    const year = event.queryStringParameters?.year;
    if (!year || isNaN(Number(year))) {
      return bad(event, "Missing or invalid year parameter");
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const validation = parseAnnualBudgetUpsert({
      year: Number(year),
      amount: body.amount,
      currency: body.currency || "USD",
    });

    const projectsTable = tableName("projects");
    const pk = "ORG#FINANZAS";
    const sk = `BUDGET#ALLIN#YEAR#${validation.year}`;
    const timestamp = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: projectsTable,
        Item: {
          pk,
          sk,
          year: validation.year,
          amount: validation.amount,
          currency: validation.currency,
          updated_at: timestamp,
          updated_by: userContext.email,
        },
      })
    );

    console.log(`[budgets] Set all-in budget for ${validation.year}: ${validation.amount} ${validation.currency}`);

    return ok(event, {
      year: validation.year,
      amount: validation.amount,
      currency: validation.currency,
      updated_at: timestamp,
      updated_by: userContext.email,
    });
  } catch (error) {
    if ((error as any).statusCode === 403) {
      return { statusCode: 403, body: JSON.stringify({ error: (error as any).body }) };
    }
    logError("Error updating all-in budget", error);
    return serverError(event, "Failed to update budget");
  }
}

/**
 * GET /budgets/all-in/overview?year=YYYY
 * Returns budget overview with cross-project totals
 */
async function getAllInBudgetOverview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const year = event.queryStringParameters?.year;
    if (!year || isNaN(Number(year))) {
      return bad(event, "Missing or invalid year parameter");
    }

    const yearNum = Number(year);
    const projectsTable = tableName("projects");
    const allocationsTable = tableName("allocations");
    const payrollTable = tableName("payroll_actuals");

    // 1. Get the budget
    const budgetPk = "ORG#FINANZAS";
    const budgetSk = `BUDGET#ALLIN#YEAR#${year}`;
    const budgetResult = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: budgetPk, sk: budgetSk },
      })
    );

    const budget = budgetResult.Item
      ? {
          amount: budgetResult.Item.amount || 0,
          currency: budgetResult.Item.currency || "USD",
        }
      : null;

    // 2. Get all projects (META items)
    const projectsResult = await ddb.send(
      new QueryCommand({
        TableName: projectsTable,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": "ORG#FINANZAS",
          ":sk": "META#PROJECT#",
        },
      })
    );

    const projects = projectsResult.Items || [];
    console.log(`[budgets] Found ${projects.length} projects for year ${year} overview`);

    // 3. Query allocations and payroll for each project
    const projectTotals = await Promise.all(
      projects.map(async (project) => {
        const projectId = (project.sk as string).replace("META#PROJECT#", "");
        const projectCode = project.code || project.projectCode || projectId;

        try {
          // Get allocations for this year
          const allocationsResult = await ddb.send(
            new QueryCommand({
              TableName: allocationsTable,
              KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
              ExpressionAttributeValues: {
                ":pk": `PROJECT#${projectId}`,
                ":sk": `MONTH#${year}-`,
              },
            })
          );

          const allocations = allocationsResult.Items || [];
          let planned = 0;
          let forecast = 0;

          for (const alloc of allocations) {
            planned += Number(alloc.planned || alloc.monto_planeado || 0);
            forecast += Number(alloc.forecast || alloc.monto_proyectado || alloc.planned || 0);
          }

          // Get payroll actuals for this year
          const payrollResult = await ddb.send(
            new QueryCommand({
              TableName: payrollTable,
              KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
              ExpressionAttributeValues: {
                ":pk": `PROJECT#${projectId}`,
                ":sk": `MONTH#${year}-`,
              },
            })
          );

          const payrolls = payrollResult.Items || [];
          let actual = 0;

          for (const payroll of payrolls) {
            actual += Number(payroll.amount || payroll.monto || 0);
          }

          return {
            projectId,
            projectCode,
            planned,
            forecast,
            actual,
          };
        } catch (error) {
          logError(`Error fetching data for project ${projectId}`, error);
          return {
            projectId,
            projectCode,
            planned: 0,
            forecast: 0,
            actual: 0,
          };
        }
      })
    );

    // 4. Sum up totals
    const totals = projectTotals.reduce(
      (acc, proj) => ({
        planned: acc.planned + proj.planned,
        forecast: acc.forecast + proj.forecast,
        actual: acc.actual + proj.actual,
      }),
      { planned: 0, forecast: 0, actual: 0 }
    );

    // 5. Calculate variances
    const budgetAmount = budget?.amount || 0;
    const varianceBudgetVsForecast = totals.forecast - budgetAmount;
    const varianceBudgetVsActual = totals.actual - budgetAmount;
    const percentBudgetConsumedActual = budgetAmount > 0 ? (totals.actual / budgetAmount) * 100 : null;
    const percentBudgetConsumedForecast = budgetAmount > 0 ? (totals.forecast / budgetAmount) * 100 : null;

    console.log(`[budgets] Overview for ${year}: budget=${budgetAmount}, forecast=${totals.forecast}, actual=${totals.actual}`);

    return ok(event, {
      year: yearNum,
      budgetAllIn: budget,
      totals: {
        planned: totals.planned,
        forecast: totals.forecast,
        actual: totals.actual,
        varianceBudgetVsForecast,
        varianceBudgetVsActual,
        percentBudgetConsumedActual,
        percentBudgetConsumedForecast,
      },
      byProject: projectTotals,
    });
  } catch (error) {
    logError("Error fetching budget overview", error);
    return serverError(event, "Failed to fetch budget overview");
  }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  if (method === "OPTIONS") {
    return noContent(event);
  }

  // Route to overview endpoint
  if (path.includes("/overview")) {
    if (method === "GET") {
      return await getAllInBudgetOverview(event);
    }
    return bad(event, `Method ${method} not allowed for /overview`, 405);
  }

  // Route to main budget endpoints
  if (method === "GET") {
    return await getAllInBudget(event);
  }

  if (method === "PUT") {
    return await putAllInBudget(event);
  }

  return bad(event, `Method ${method} not allowed`, 405);
};
