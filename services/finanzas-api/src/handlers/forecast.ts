/**
 * Forecast handler - GET /plan/forecast
 * Returns forecast data for a project
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import { ensureCanRead } from "../lib/auth";
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
    try {
      await ensureCanRead(event as never);
    } catch (authError) {
      const authResponse = fromAuthError(authError);
      if (authResponse) {
        return authResponse;
      }
      throw authError;
    }

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

    // Query allocations and payroll for this project. Rubro attachments are only
    // fetched when allocations are absent to avoid masking payroll data when
    // mocks provide additional responses.
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

    const allocations = allocationsResult.Items || [];
    const payrolls = payrollResult.Items || [];
    const rubroAttachments =
      allocations.length > 0
        ? []
        : (
            await ddb.send(
              new QueryCommand({
                TableName: tableName("rubros"),
                KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
                ExpressionAttributeValues: {
                  ":pk": `PROJECT#${projectId}`,
                  ":sk": "RUBRO#",
                },
              })
            )
          ).Items || [];

    const forecastData: ForecastItem[] = [];

    // Add allocation data (preferred path when present)
    if (allocations.length > 0) {
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
    } else {
      // Fallback: derive monthly plan from rubro attachments when allocations table is empty
      for (const attachment of rubroAttachments) {
        const rubroId = (attachment.rubroId as string) || (attachment.sk as string) || "unknown";
        const qty = Number(attachment.qty ?? 1) || 1;
        const unitCost = Number(attachment.unit_cost ?? attachment.total_cost ?? 0) || 0;
        const startMonth = Math.min(
          Math.max(Number(attachment.start_month ?? 1) || 1, 1),
          months,
        );
        const endMonth = Math.min(
          Math.max(Number(attachment.end_month ?? startMonth) || startMonth, startMonth),
          months,
        );
        const recurring = Boolean(attachment.recurring && !attachment.one_time);
        const baseCost = qty * unitCost;
        const monthsToMaterialize = recurring
          ? Math.max(endMonth - startMonth + 1, 1)
          : 1;

        for (let idx = 0; idx < monthsToMaterialize; idx += 1) {
          const month = startMonth + idx;
          if (month > months) break;

          forecastData.push({
            line_item_id: rubroId.replace(/^RUBRO#/, ""),
            month,
            planned: baseCost,
            forecast: baseCost,
            actual: Number(attachment.actual || 0),
            variance: Number(attachment.actual || 0) - baseCost,
            variance_reason: attachment.variance_reason,
            notes: attachment.description,
            last_updated:
              (attachment.updated_at as string) ||
              (attachment.createdAt as string) ||
              (attachment.created_at as string) ||
              new Date().toISOString(),
            updated_by:
              (attachment.updated_by as string) ||
              (attachment.createdBy as string) ||
              (attachment.created_by as string) ||
              "system",
          });
        }
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
