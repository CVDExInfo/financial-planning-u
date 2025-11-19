/**
 * Forecast handler - GET /plan/forecast
 * Returns forecast data for a project
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad } from "../lib/http";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const projectId = event.queryStringParameters?.projectId;
    const monthsStr = event.queryStringParameters?.months;

    // Validate required parameters
    if (!projectId) {
      return bad("Missing required parameter: projectId");
    }

    const months = monthsStr ? parseInt(monthsStr, 10) : 12;

    if (isNaN(months) || months < 1 || months > 60) {
      return bad("Invalid months parameter. Must be between 1 and 60.");
    }

    // Query allocations for this project
    const allocationsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('allocations'),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
        },
      })
    );

    // Query payroll actuals for this project
    const payrollResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('payroll_actuals'),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
        },
      })
    );

    // Combine data into forecast cells
    const allocations = allocationsResult.Items || [];
    const payrolls = payrollResult.Items || [];

    const forecastData = [];

    // Add allocation data
    for (const allocation of allocations) {
      if ((allocation.month || 1) <= months) {
        forecastData.push({
          line_item_id: allocation.rubroId || allocation.line_item_id || 'unknown',
          month: allocation.month || 1,
          planned: allocation.planned || allocation.monto_planeado || 0,
          forecast: allocation.forecast || allocation.monto_proyectado || allocation.planned || 0,
          actual: allocation.actual || allocation.monto_real || 0,
          variance: (allocation.actual || 0) - (allocation.planned || 0),
          variance_reason: allocation.variance_reason,
          notes: allocation.notes || allocation.notas,
          last_updated: allocation.updated_at || allocation.created_at || new Date().toISOString(),
          updated_by: allocation.updated_by || allocation.created_by || 'system',
        });
      }
    }

    // Add payroll data
    for (const payroll of payrolls) {
      if ((payroll.month || 1) <= months) {
        forecastData.push({
          line_item_id: `payroll-${payroll.empleado_id || 'unknown'}`,
          month: payroll.month || 1,
          planned: payroll.salario_base || 0,
          forecast: payroll.salario_base || 0,
          actual: payroll.salario_real || payroll.salario_base || 0,
          variance: (payroll.salario_real || 0) - (payroll.salario_base || 0),
          variance_reason: payroll.motivo,
          notes: payroll.notas,
          last_updated: payroll.fecha_pago || payroll.created_at || new Date().toISOString(),
          updated_by: payroll.created_by || 'system',
        });
      }
    }

    return ok({
      data: forecastData,
      projectId,
      months,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in forecast handler:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin":
          process.env.ALLOWED_ORIGIN || "https://d7t9x3j66yd8k.cloudfront.net",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Amz-Date, X-Amz-Security-Token, X-Requested-With",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: errorMessage,
      }),
    };
  }
};
