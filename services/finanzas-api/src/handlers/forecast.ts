/**
 * Forecast handler - GET /plan/forecast
 * Returns forecast data for a project
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";

type ForecastItem = {
  line_item_id: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  variance_reason?: string;
  notes?: string;
  last_updated: string;
  updated_by: string;
};

const parseMonths = (monthsStr?: string | null) => {
  if (!monthsStr) return 12;
  const value = Number.parseInt(monthsStr, 10);
  if (Number.isNaN(value) || value < 1 || value > 60) {
    return null;
  }
  return value;
};

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

    const months = parseMonths(monthsStr);
    if (months === null) {
      return bad("Invalid months parameter. Must be between 1 and 60.");
    }

    console.info("[forecast] params", { projectId, months });

    // Query allocations for this project
    const [allocationsResult, payrollResult] = await Promise.all([
      ddb.send(
        new QueryCommand({
          TableName: tableName("allocations"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      ),
      ddb.send(
        new QueryCommand({
          TableName: tableName("payroll_actuals"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      ),
    ]);

    // Combine data into forecast cells
    const allocations = allocationsResult.Items || [];
    const payrolls = payrollResult.Items || [];

    const forecastData: ForecastItem[] = [];

    // Add allocation data
    for (const allocation of allocations) {
      const month = Number(allocation.month || allocation.mes || 1);
      if (month <= months) {
        forecastData.push({
          line_item_id:
            allocation.rubroId || allocation.line_item_id || "unknown",
          month,
          planned: Number(allocation.planned || allocation.monto_planeado || 0),
          forecast: Number(
            allocation.forecast ||
              allocation.monto_proyectado ||
              allocation.planned ||
              0
          ),
          actual: Number(allocation.actual || allocation.monto_real || 0),
          variance: Number(allocation.actual || 0) - Number(allocation.planned || 0),
          variance_reason: allocation.variance_reason,
          notes: allocation.notes || allocation.notas,
          last_updated:
            allocation.updated_at ||
            allocation.created_at ||
            new Date().toISOString(),
          updated_by: allocation.updated_by || allocation.created_by || "system",
        });
      }
    }

    // Add payroll data
    for (const payroll of payrolls) {
      const month = Number(payroll.month || payroll.mes || 1);
      if (month <= months) {
        forecastData.push({
          line_item_id: `payroll-${payroll.empleado_id || "unknown"}`,
          month,
          planned: Number(payroll.salario_base || 0),
          forecast: Number(payroll.salario_base || 0),
          actual: Number(payroll.salario_real || payroll.salario_base || 0),
          variance:
            Number(payroll.salario_real || 0) - Number(payroll.salario_base || 0),
          variance_reason: payroll.motivo,
          notes: payroll.notas,
          last_updated:
            payroll.fecha_pago || payroll.created_at || new Date().toISOString(),
          updated_by: payroll.created_by || "system",
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
    console.error("[forecast] unexpected error", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return serverError(errorMessage);
  }
};
