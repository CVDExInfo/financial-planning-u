import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserContext } from "../lib/auth";
import { bad, ok, noContent, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand, ScanCommand, PutCommand, GetCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";
import { parseForecastBulkUpdate } from "../validation/allocations";

/**
 * Normalize month input to monthIndex (1-12) and compute calendarMonthKey (YYYY-MM)
 * Accepts:
 * - number 1-12 (monthIndex) - treated as contract month offset
 * - "YYYY-MM" string (calendar month key) - preserved as-is for backward compatibility
 * - "M1", "M2", etc. (M-notation) - treated as contract month offset
 * 
 * For numeric monthIndex and M-notation:
 *   - Computes calendarMonthKey by adding (monthIndex - 1) months to project start date
 *   - Example: project starts May 2025, monthIndex=1 → 2025-05, monthIndex=2 → 2025-06
 * 
 * For YYYY-MM format:
 *   - Preserved for backward compatibility with existing data
 *   - Extracts month number as monthIndex for internal consistency
 */
function normalizeMonth(
  monthInput: string | number,
  projectStartDate: string | undefined
): { monthIndex: number; calendarMonthKey: string } {
  let monthIndex: number;
  let isExplicitCalendarMonth = false;

  if (typeof monthInput === "number") {
    // Already a number, use as monthIndex (contract month)
    monthIndex = monthInput;
  } else if (typeof monthInput === "string") {
    // Check if it's in YYYY-MM format (explicit calendar month)
    if (/^\d{4}-\d{2}$/.test(monthInput)) {
      // For backward compatibility: preserve the calendar month as-is
      // Extract the month number to use as monthIndex
      const month = parseInt(monthInput.substring(5, 7), 10);
      isExplicitCalendarMonth = true;
      return {
        monthIndex: month,
        calendarMonthKey: monthInput,
      };
    }
    
    // Check if it's in "M1", "M2", etc. format
    const mMatch = monthInput.match(/^M(\d+)$/i);
    if (mMatch) {
      monthIndex = parseInt(mMatch[1], 10);
    } else {
      // Try to parse as number
      const parsed = parseInt(monthInput, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid month format: ${monthInput}`);
      }
      monthIndex = parsed;
    }
  } else {
    throw new Error(`Invalid month type: ${typeof monthInput}`);
  }

  // Validate monthIndex is in valid range
  if (monthIndex < 1 || monthIndex > 12) {
    throw new Error(`Month index must be between 1 and 12, got: ${monthIndex}`);
  }

  // Compute calendarMonthKey from projectStartDate + (monthIndex - 1) months
  let calendarMonthKey: string;
  if (projectStartDate && /^\d{4}-\d{2}-\d{2}$/.test(projectStartDate)) {
    const startDate = new Date(projectStartDate);
    startDate.setUTCMonth(startDate.getUTCMonth() + (monthIndex - 1));
    const year = startDate.getUTCFullYear();
    const month = String(startDate.getUTCMonth() + 1).padStart(2, "0");
    calendarMonthKey = `${year}-${month}`;
  } else {
    // If no valid project start date, this is an error condition
    // Log warning and use monthIndex as fallback for development
    console.warn(
      `[allocations] Missing or invalid project start date: ${projectStartDate}. Using monthIndex ${monthIndex} without calendar computation.`
    );
    // Use current year as emergency fallback - this should be rare in production
    const currentYear = new Date().getUTCFullYear();
    calendarMonthKey = `${currentYear}-${String(monthIndex).padStart(2, "0")}`;
  }

  return { monthIndex, calendarMonthKey };
}

/**
 * GET /allocations
 * Returns allocations from DynamoDB, optionally filtered by projectId
 * Always returns an array (never {data: []}) for frontend compatibility
 */
async function getAllocations(event: APIGatewayProxyEventV2) {
  try {
    await ensureCanRead(event as any);
    
    const projectId = 
      event.queryStringParameters?.projectId || 
      event.queryStringParameters?.project_id;
    
    const allocationsTable = tableName("allocations");
    
    // If projectId is provided, query for that project's allocations
    if (projectId) {
      const queryResult = await ddb.send(
        new QueryCommand({
          TableName: allocationsTable,
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: {
            "#pk": "pk",
          },
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      );
      
      const items = queryResult.Items || [];
      console.log(`[allocations] GET query for project ${projectId}: ${items.length} items`);
      
      // Return bare array for frontend compatibility
      return ok(event, items);
    }
    
    // No projectId - return all allocations with pagination limit
    const limit = 1000; // Reasonable limit to avoid timeouts
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: allocationsTable,
        Limit: limit,
      })
    );
    
    const items = scanResult.Items || [];
    console.log(`[allocations] GET scan (all projects): ${items.length} items (limit: ${limit})`);
    
    // Return bare array for frontend compatibility
    return ok(event, items);
  } catch (error) {
    logError("Error fetching allocations", error);
    return serverError(event as any, "Failed to fetch allocations");
  }
}

/**
 * PUT /projects/{id}/allocations:bulk?type=planned|forecast
 * Bulk update allocations for a project
 * Supports both planned and forecast allocations via type query parameter
 * 
 * Authorization:
 * - planned: Requires write access (PMO, SDMT, SDM)
 * - forecast: Requires SDMT or ADMIN role
 */
async function bulkUpdateAllocations(event: APIGatewayProxyEventV2) {
  const requestId = event.requestContext?.requestId || 'unknown';
  
  try {
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return bad(event, "Missing project id");
    }

    // Get allocation type from query parameter (default to 'planned')
    const allocationType = event.queryStringParameters?.type || "planned";
    
    console.log(`[allocations] ${requestId} - ${allocationType} bulk update for project ${projectId}`);
    
    if (allocationType !== "planned" && allocationType !== "forecast") {
      return bad(event, "Invalid type parameter. Must be 'planned' or 'forecast'");
    }

    // Authorization check based on type
    if (allocationType === "forecast") {
      // Forecast updates require SDMT, EXEC_RO, or ADMIN role
      const userContext = await getUserContext(event as any);
      const hasAccess = userContext.isSDMT || userContext.isExecRO || userContext.isAdmin;
      
      if (!hasAccess) {
        return {
          statusCode: 403,
          body: JSON.stringify({ message: "Forbidden: SDMT, EXEC_RO, or ADMIN role required for forecast updates" }),
          headers: { "Content-Type": "application/json" },
        };
      }
    } else {
      // Planned allocations require standard write access
      await ensureCanWrite(event as any);
    }

    // Parse request body - support both old "allocations" and new "items" formats
    // Old format: {allocations: [{rubro_id, mes, monto_planeado/monto_proyectado}]}
    // New format: {items: [{rubroId, month, forecast/planned}]}
    const body = event.body ? JSON.parse(event.body) : {};
    const allocations = body.allocations || body.items;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return bad(event, "Missing or invalid allocations/items array");
    }

    // Get user context for audit
    const userContext = await getUserContext(event as any);
    const updatedBy = userContext.email || userContext.sub || "system";
    const timestamp = new Date().toISOString();

    // Get project metadata (baseline_id and start_date)
    // Use composite key with sk: 'METADATA' for proper data access
    const projectsTable = tableName("projects");
    let projectResult = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
      })
    );

    // Fallback to legacy sk: 'META' for backward compatibility
    if (!projectResult.Item) {
      console.warn(`[allocations] Project ${projectId} not found with sk=METADATA, trying legacy sk=META`);
      projectResult = await ddb.send(
        new GetCommand({
          TableName: projectsTable,
          Key: { pk: `PROJECT#${projectId}`, sk: "META" },
        })
      );
    }

    // Return 400 (Bad Request) instead of generic error if project not found
    if (!projectResult.Item) {
      console.error(`[allocations] Project ${projectId} metadata not found in projects table`);
      return bad(event, `Project metadata not found for project ${projectId}. Ensure the project exists and has been properly initialized.`);
    }

    const project = projectResult.Item;
    const baselineId = project.baseline_id || project.baselineId || "default";
    const projectStartDate = 
      project.start_date || 
      project.fecha_inicio || 
      project.startDate;

    console.log(
      `[allocations] ${requestId} - Project metadata: baselineId=${baselineId}, startDate=${projectStartDate}`
    );

    // Normalize allocation items to handle both formats and compute calendar months
    let normalizedAllocations: Array<{ 
      rubro_id: string; 
      monthIndex: number;
      calendarMonthKey: string;
      amount: number;
    }>;
    try {
      normalizedAllocations = allocations.map((item: any, index: number) => {
        // Support both formats:
        // - Legacy: {rubro_id, mes, monto_planeado/monto_proyectado}
        // - New: {rubroId, month, forecast/planned}
        const rubroId = item.rubro_id || item.rubroId;
        const monthInput = item.mes || item.month;
        
        if (!rubroId) {
          throw new Error(`Allocation at index ${index}: missing rubro_id/rubroId`);
        }
        
        if (monthInput === undefined || monthInput === null) {
          throw new Error(`Allocation at index ${index}: missing mes/month`);
        }
        
        // Get amount based on type and format
        let amount: number;
        if (allocationType === "forecast") {
          amount = item.monto_proyectado ?? item.forecast;
        } else {
          amount = item.monto_planeado ?? item.planned;
        }
        
        if (typeof amount !== "number" || amount < 0) {
          throw new Error(`Allocation at index ${index}: invalid amount (must be >= 0)`);
        }

        // Normalize month to monthIndex and compute calendarMonthKey
        const { monthIndex, calendarMonthKey } = normalizeMonth(monthInput, projectStartDate);
        
        return {
          rubro_id: rubroId,
          monthIndex,
          calendarMonthKey,
          amount,
        };
      });
    } catch (error: any) {
      console.error(`[allocations] ${requestId} - Validation error:`, error.message);
      return bad(event, error.message || "Invalid allocation format");
    }

    // Process each allocation (idempotent writes)
    const allocationsTable = tableName("allocations");
    const results = [];

    for (const allocation of normalizedAllocations) {
      const { rubro_id, monthIndex, calendarMonthKey, amount } = allocation;

      // Create composite sort key: ALLOCATION#{baselineId}#{calendarMonthKey}#{rubroId}
      // Using calendarMonthKey (YYYY-MM) in the key ensures proper ordering and grouping
      const sk = `ALLOCATION#${baselineId}#${calendarMonthKey}#${rubro_id}`;
      const pk = `PROJECT#${projectId}`;

      // Check if allocation exists
      const existingResult = await ddb.send(
        new GetCommand({
          TableName: allocationsTable,
          Key: { pk, sk },
        })
      );

      const existing = existingResult.Item || {};

      // Merge with existing data to preserve other fields
      const item = {
        ...existing,
        pk,
        sk,
        projectId,
        baselineId,
        rubroId: rubro_id,
        monthIndex, // Store numeric month index (1-12)
        month: calendarMonthKey, // Store calendar month key (YYYY-MM)
        mes: calendarMonthKey, // Legacy field compatibility
        calendarMonthKey, // Explicit field for clarity
        // Update the appropriate field based on type
        ...(allocationType === "planned" 
          ? { 
              monto_planeado: amount,
              planned: amount, // Also set the English field for compatibility
            }
          : { 
              monto_proyectado: amount,
              forecast: amount, // Also set the English field for compatibility
            }
        ),
        lastUpdated: timestamp,
        updatedBy,
        // Preserve other fields if they exist
        actual: existing.actual,
        monto_real: existing.monto_real,
      };

      // Write to DynamoDB (idempotent)
      await ddb.send(
        new PutCommand({
          TableName: allocationsTable,
          Item: item,
        })
      );

      results.push({
        rubro_id,
        monthIndex,
        calendarMonthKey,
        mes: calendarMonthKey, // For backward compatibility
        // Include both the amount and the specific field for backward compatibility
        ...(allocationType === "forecast" 
          ? { monto_proyectado: amount, forecast: amount }
          : { monto_planeado: amount, planned: amount }
        ),
        status: existing.pk ? "updated" : "created",
      });

      console.log(
        `[allocations] ${allocationType} ${existing.pk ? "updated" : "created"}: ${projectId} / ${rubro_id} / M${monthIndex} (${calendarMonthKey}) = ${amount}`
      );
    }

    console.log(`[allocations] ${requestId} - Successfully processed ${results.length} ${allocationType} allocations for project ${projectId}`);

    return ok(event, {
      updated_count: results.length,
      type: allocationType,
      allocations: results,
    });
  } catch (error: any) {
    // Handle authorization errors specifically
    if (error?.statusCode === 403) {
      console.log(`[allocations] 403 Forbidden - ${allocationType} update rejected for user`);
      return {
        statusCode: 403,
        body: JSON.stringify({ message: error.body || "Forbidden" }),
        headers: { "Content-Type": "application/json" },
      };
    }
    
    // Handle validation errors (should already be caught above, but be defensive)
    if (error?.statusCode === 400 || error.message?.includes("invalid") || error.message?.includes("Invalid")) {
      console.log(`[allocations] 400 Bad Request - ${error.message || "Invalid payload"}`);
      return bad(event, error.message || "Invalid allocation data");
    }
    
    // Log unexpected errors with context
    console.error(`[allocations] Unexpected error during ${allocationType} bulk update for project ${event.pathParameters?.id}:`, error);
    logError("Error bulk updating allocations", error);
    return serverError(event as any, "Failed to update allocations");
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return noContent(event);
  }

  if (method === "GET") {
    return await getAllocations(event);
  }

  if (method === "PUT") {
    return await bulkUpdateAllocations(event);
  }

  return bad(event, `Method ${method} not allowed`, 405);
};
