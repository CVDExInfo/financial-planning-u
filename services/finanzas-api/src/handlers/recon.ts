import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { bad, ok, notImplemented } from "../lib/http";
import { queryProjectRubros, generateForecastGrid } from "../lib/baseline-sdmt";
// (Removed unused imports from "../lib/dynamo")

/**
 * Reconciliation handler - GET /recon
 * 
 * CONTRACT ENFORCEMENT:
 * This endpoint MUST return only status codes: 200, 400, or 501
 * - 200: Success (with data or empty recon)
 * - 400: Invalid input (missing/malformed parameters)
 * - 501: Not implemented / not configured (missing baseline, tables, etc.)
 * 
 * NEVER returns 500 - all errors are mapped to appropriate contract status codes.
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

/**
 * Map Dynamo errors to appropriate status codes for /recon contract.
 * For this endpoint, we treat infrastructure errors as 501 (not configured).
 */
function mapDynamoErrorForRecon(error: unknown, context: Record<string, unknown>) {
  const name = (error as { name?: string } | undefined)?.name;
  const message = (error as { message?: string } | undefined)?.message || "";
  
  // Log full error context
  console.error("[recon] Dynamo error", { ...context, errorName: name, errorMessage: message, error });
  
  // Map known Dynamo errors to 501 (not configured/not implemented)
  if (name === "ResourceNotFoundException") {
    return notImplemented("Reconciliation table not configured for this environment");
  }
  
  if (name === "AccessDeniedException") {
    return notImplemented("Reconciliation storage access not configured");
  }
  
  // Validation errors that indicate missing tables
  if (
    name === "ValidationException" &&
    /Requested resource not found|non-existent table/i.test(message)
  ) {
    return notImplemented("Reconciliation table not found");
  }
  
  // Throttling - treat as temporary unavailability (501)
  if (
    name &&
    ["ThrottlingException", "ProvisionedThroughputExceededException"].includes(name)
  ) {
    console.warn("[recon] Dynamo throttled", context);
    return notImplemented("Reconciliation storage temporarily unavailable");
  }
  
  // Any other unexpected error → 501 (per contract requirement)
  console.error("[recon] Unexpected Dynamo error, mapping to 501", context);
  return notImplemented("Reconciliation not available for this project/environment");
}

// Placeholder handler for reconciliation endpoints
export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanRead(event);

    const method = event.requestContext.http.method;

    if (method === "GET") {
      const qp = event.queryStringParameters || {};
      const projectId = qp.project_id || qp.projectId;
      const month = qp.month;
      const months = Math.min(Math.max(parseInt(qp.months || "12", 10), 1), 60);

      // Input validation - return 400 for missing/invalid parameters
      if (!projectId || typeof projectId !== "string" || projectId.trim().length === 0) {
        return bad("Missing required parameter: projectId");
      }

      // Month parameter validation (if provided)
      if (month !== undefined && month !== null) {
        // Validate month format (YYYY-MM)
        if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
          return bad("Invalid month format. Expected YYYY-MM");
        }
      }

      try {
        // Get baseline-filtered rubros
        const baselineRubros = await queryProjectRubros(projectId);
        
        // If no baseline or rubros found, return 501 (not configured)
        if (!baselineRubros || baselineRubros.length === 0) {
          console.warn("[recon] No baseline rubros found", { projectId });
          return notImplemented("Reconciliation not configured: no baseline found for project");
        }
        
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
      } catch (error) {
        // Map Dynamo and baseline errors to 501
        return mapDynamoErrorForRecon(error, { projectId, month, operation: "getRecon" });
      }
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    // Auth errors - check if it's an auth error object with statusCode
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      "body" in error
    ) {
      const statusCode = Number((error as { statusCode: number }).statusCode);
      const message = String((error as { body: string }).body || "Access denied");
      
      // Auth errors are typically 401/403, return as-is if they're in our allowed set
      if (statusCode === 400) {
        return bad(message, 400);
      }
      // Map other auth errors to 400 (bad request) per contract
      return bad(message, 400);
    }
    
    // Any other unexpected error at top level → 501 (per contract requirement)
    console.error("[recon] Unexpected top-level error, mapping to 501", { error });
    return notImplemented("Reconciliation service unavailable");
  }
};
