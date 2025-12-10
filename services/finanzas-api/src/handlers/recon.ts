import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { bad, ok, serverError } from "../lib/http";
import { queryProjectRubros, generateForecastGrid } from "../lib/baseline-sdmt";
// (Removed unused imports from "../lib/dynamo")

/**
 * Reconciliation handler - GET /recon
 * 
 * SDMT ALIGNMENT FIX:
 * Returns reconciliation data showing:
 * - Rubros from active baseline (P/F columns)
 * - Actual invoices reconciled by SDM (A column)
 * - Estado (Pending / Reconciled)
 * 
 * This ensures the reconciliation grid only shows baseline-derived line items,
 * not phantom or legacy data from old baselines.
 */

// Placeholder handler for reconciliation endpoints
export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanRead(event);

    const method = event.requestContext.http.method;

    if (method === "GET") {
      const qp = event.queryStringParameters || {};
      const projectId = qp.project_id || qp.projectId;
      const months = Math.min(Math.max(parseInt(qp.months || "12", 10), 1), 60);

      if (!projectId) {
        return bad("Missing required parameter: project_id");
      }

      // Get baseline-filtered rubros
      const baselineRubros = await queryProjectRubros(projectId);
      
      // Generate baseline forecast grid (P/F columns)
      const forecastGrid = generateForecastGrid(baselineRubros, months);

      // Query actual invoices/reconciliation data
      // For now, return forecast grid with actuals = 0
      // TODO: Join with invoices table when available
      const reconciliationData = forecastGrid.map((cell) => ({
        ...cell,
        estado: cell.actual > 0 ? "Reconciled" : "Pending",
        rubro_nombre: baselineRubros.find((r) => r.rubroId === cell.line_item_id)?.nombre || "Unknown",
      }));

      return ok({ 
        data: reconciliationData,
        project_id: projectId,
        months,
        total_items: reconciliationData.length,
      });
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    console.error("[recon] Error:", error);
    return serverError("Error interno en reconciliación");
  }
};
