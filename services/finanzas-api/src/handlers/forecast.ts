/**
 * Forecast handler - GET /plan/forecast
 * Returns forecast data for a project
 * 
 * SDMT ALIGNMENT FIX:
 * - Now filters rubros by project's active baseline_id
 * - Generates P/F/A grid from baseline-derived rubros only
 * - Prevents phantom line items from old baselines
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad, serverError, fromAuthError, noContent } from "../lib/http";
import { ensureCanRead } from "../lib/auth";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";
import { queryProjectRubros } from "../lib/baseline-sdmt";

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
  const method = event.requestContext.http.method?.toUpperCase?.();

  if (method === "OPTIONS") {
    return noContent();
  }

  let projectId: string | undefined;
  let months: number | null = null;
  let allocationsCount: number | undefined;
  let payrollCount: number | undefined;
  let rubrosCount: number | undefined;

  try {
    // ---- Auth guard --------------------------------------------------------
    try {
      await ensureCanRead(event as never);
    } catch (authError) {
      const authResponse = fromAuthError(authError);
      if (authResponse) {
        return authResponse;
      }
      throw authError;
    }

    // ---- Parse & validate query params ------------------------------------
    const queryParams = event.queryStringParameters || {};
    projectId = queryParams.projectId || queryParams.project_id;
    const monthsStr = queryParams.months;

    if (!projectId) {
      return bad("Missing required parameter: projectId");
    }

    months = parseMonths(monthsStr);
    if (months === null) {
      return bad("Invalid months parameter. Must be between 1 and 60.");
    }

    console.info("[forecast] params", { projectId, months });

    // ---- Query baseline-filtered rubros ------------------------------------
    // SDMT ALIGNMENT FIX: Use baseline-filtered rubros to prevent mixing
    // data from multiple baselines
    let baselineRubros;
    try {
      baselineRubros = await queryProjectRubros(projectId);
      rubrosCount = baselineRubros.length;
      
      // Log baseline information for debugging
      if (rubrosCount === 0) {
        console.warn("[forecast] No rubros found for project", {
          projectId,
          months,
          note: "Project may not have an active baseline or rubros may not be seeded yet"
        });
      } else {
        console.info("[forecast] Rubros loaded", {
          projectId,
          rubrosCount,
          months
        });
      }
    } catch (queryError) {
      logError("[forecast] failed to query baseline rubros", {
        projectId,
        months,
        error: queryError,
      });
      return serverError("Error interno en Finanzas");
    }

    // ---- Query DynamoDB: allocations, payroll ------------------------------
    let allocationsResult;
    let payrollResult;

    try {
      [allocationsResult, payrollResult] = await Promise.all([
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
    } catch (queryError) {
      logError("[forecast] failed to query data", {
        projectId,
        months,
        error: queryError,
      });
      return serverError("Error interno en Finanzas");
    }

    // ---- Combine data into forecast cells ---------------------------------
    const allocations = allocationsResult?.Items || [];
    const payrolls = payrollResult?.Items || [];
    const rubroAttachments = baselineRubros; // Use filtered rubros

    allocationsCount = allocations.length;
    payrollCount = payrolls.length;

    const forecastData: ForecastItem[] = [];

    // Preferred path: allocations (plan/forecast/actual per line item/month)
    if (allocations.length > 0) {
      for (const allocation of allocations) {
        // Handle both numeric month and month_index fields
        // Materialized allocations use month_index, manual allocations may use month
        const monthIndex = Number(allocation.month_index || allocation.month || allocation.mes || 1);
        
        if (monthIndex <= (months as number)) {
          // If allocation is from baseline materializer, use amount as forecast
          const isMaterialized = allocation.source === "baseline_materializer";
          
          const planned = isMaterialized 
            ? Number(allocation.amount || 0)
            : Number(allocation.planned || allocation.monto_planeado || 0);
          
          // Use forecast if explicitly set, otherwise use amount for materialized or planned for manual
          const forecastValue = allocation.forecast ?? allocation.monto_proyectado;
          const forecast = forecastValue !== undefined 
            ? Number(forecastValue) 
            : (isMaterialized ? Number(allocation.amount || 0) : planned);
          
          const actual = Number(
            allocation.actual || allocation.monto_real || 0
          );

          forecastData.push({
            line_item_id:
              allocation.line_item_id || allocation.rubroId || allocation.rubro_id || "unknown",
            month: monthIndex,
            planned,
            forecast,
            actual,
            variance: actual - planned,
            variance_reason: allocation.variance_reason,
            notes: allocation.notes || allocation.notas,
            last_updated:
              allocation.updated_at ||
              allocation.createdAt ||
              allocation.created_at ||
              new Date().toISOString(),
            updated_by: allocation.updated_by || allocation.created_by || "system",
          });
        }
      }
      
      // Log allocation integration for debugging
      const materializedCount = allocations.filter(a => a.source === "baseline_materializer").length;
      if (materializedCount > 0) {
        console.info("computeForecastFromAllocations: merged allocations", {
          projectId,
          baselineId: allocations[0]?.baselineId,
          allocationsCells: forecastData.length,
          materializedCells: materializedCount,
        });
      }
    } else {
      // Fallback: derive monthly plan from rubro attachments when allocations are empty
      for (const attachment of rubroAttachments) {
        const rubroId =
          (attachment.rubroId as string) ||
          (attachment.sk as string) ||
          "unknown";

        const qty = Number(attachment.qty ?? 1) || 1;
        const unitCost =
          Number(attachment.unit_cost ?? attachment.total_cost ?? 0) || 0;

        const startMonth = Math.min(
          Math.max(Number(attachment.start_month ?? 1) || 1, 1),
          months as number
        );
        const endMonth = Math.min(
          Math.max(
            Number(attachment.end_month ?? startMonth) || startMonth,
            startMonth
          ),
          months as number
        );

        const recurring = Boolean(attachment.recurring && !attachment.one_time);
        const baseCost = qty * unitCost;
        const monthsToMaterialize = recurring
          ? Math.max(endMonth - startMonth + 1, 1)
          : 1;

        for (let idx = 0; idx < monthsToMaterialize; idx += 1) {
          const month = startMonth + idx;
          if (month > (months as number)) break;

          const actual = Number(attachment.actual || 0);

          forecastData.push({
            line_item_id: rubroId.replace(/^RUBRO#/, ""),
            month,
            planned: baseCost,
            forecast: baseCost,
            actual,
            variance: actual - baseCost,
            variance_reason: attachment.variance_reason as string | undefined,
            notes: (attachment.description as string) || undefined,
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

    // Add payroll data as separate “line items”
    for (const payroll of payrolls) {
      const month = Number(payroll.month || payroll.mes || 1);
      if (month <= (months as number)) {
        const planned = Number(payroll.salario_base || 0);
        const actual = Number(
          payroll.salario_real || payroll.salario_base || 0
        );
        forecastData.push({
          line_item_id: `payroll-${payroll.empleado_id || "unknown"}`,
          month,
          planned,
          forecast: planned,
          actual,
          variance: actual - planned,
          variance_reason: payroll.motivo as string | undefined,
          notes: payroll.notas as string | undefined,
          last_updated:
            (payroll.fecha_pago as string) ||
            (payroll.created_at as string) ||
            new Date().toISOString(),
          updated_by: (payroll.created_by as string) || "system",
        });
      }
    }

    console.info("[forecast] response stats", {
      projectId,
      months,
      allocationsCount,
      payrollCount,
      rubrosCount,
      forecastCount: forecastData.length,
    });

    return ok({
      data: forecastData,
      projectId,
      months,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    logError("[forecast] unexpected error building forecast", {
      projectId,
      months,
      allocationsCount,
      payrollCount,
      rubrosCount,
      error,
    });
    return serverError("Error interno en Finanzas");
  }
};
