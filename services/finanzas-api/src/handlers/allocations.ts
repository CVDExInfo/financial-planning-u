import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, getUserContext } from "../lib/auth";
import { bad, ok, noContent, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand, ScanCommand, PutCommand, GetCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";
import { parseForecastBulkUpdate } from "../validation/allocations";

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
  try {
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return bad(event, "Missing project id");
    }

    // Get allocation type from query parameter (default to 'planned')
    const allocationType = event.queryStringParameters?.type || "planned";
    
    if (allocationType !== "planned" && allocationType !== "forecast") {
      return bad(event, "Invalid type parameter. Must be 'planned' or 'forecast'");
    }

    // Authorization check based on type
    if (allocationType === "forecast") {
      // Forecast updates require SDMT or ADMIN role
      const userContext = await getUserContext(event as any);
      const hasAccess = userContext.isSDMT || userContext.isAdmin;
      
      if (!hasAccess) {
        return {
          statusCode: 403,
          body: JSON.stringify({ message: "Forbidden: SDMT or ADMIN role required for forecast updates" }),
          headers: { "Content-Type": "application/json" },
        };
      }
    } else {
      // Planned allocations require standard write access
      await ensureCanWrite(event as any);
    }

    // Parse request body - support both old "allocations" and new "items" formats
    const body = event.body ? JSON.parse(event.body) : {};
    const allocations = body.allocations || body.items;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return bad(event, "Missing or invalid allocations/items array");
    }

    // Normalize allocation items to handle both formats
    const normalizedAllocations = allocations.map((item: any) => {
      // Support both formats: {rubro_id, mes, monto_*} and {rubroId, month, forecast}
      const rubroId = item.rubro_id || item.rubroId;
      const month = item.mes || item.month;
      
      if (!rubroId || !month) {
        throw new Error("Each allocation must have rubro_id/rubroId and mes/month");
      }
      
      // Get amount based on type and format
      let amount: number;
      if (allocationType === "forecast") {
        amount = item.monto_proyectado ?? item.forecast;
      } else {
        amount = item.monto_planeado ?? item.planned;
      }
      
      if (typeof amount !== "number" || amount < 0) {
        throw new Error(`Each allocation must have a valid amount >= 0`);
      }
      
      return {
        rubro_id: rubroId,
        mes: month,
        amount,
      };
    });

    // Get user context for audit
    const userContext = await getUserContext(event as any);
    const updatedBy = userContext.email || userContext.sub || "system";
    const timestamp = new Date().toISOString();

    // Get project baseline_id
    const projectsTable = tableName("projects");
    const projectResult = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: `PROJECT#${projectId}` },
      })
    );

    const baselineId = projectResult.Item?.baseline_id || projectResult.Item?.baselineId || "default";

    // Process each allocation (idempotent writes)
    const allocationsTable = tableName("allocations");
    const results = [];

    for (const allocation of normalizedAllocations) {
      const { rubro_id, mes, amount } = allocation;

      // Create composite sort key: ALLOCATION#{baselineId}#{month}#{rubroId}
      const sk = `ALLOCATION#${baselineId}#${mes}#${rubro_id}`;
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
        month: mes,
        mes,
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
        mes,
        amount,
        status: existing.pk ? "updated" : "created",
      });

      console.log(`[allocations] ${allocationType} ${existing.pk ? "updated" : "created"}: ${projectId} / ${rubro_id} / ${mes} = ${amount}`);
    }

    return ok(event, {
      updated_count: results.length,
      type: allocationType,
      allocations: results,
    });
  } catch (error: any) {
    // Handle authorization errors specifically
    if (error?.statusCode === 403) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: error.body || "Forbidden" }),
        headers: { "Content-Type": "application/json" },
      };
    }
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
