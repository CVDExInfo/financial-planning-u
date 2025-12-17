import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT, ensureCanRead, getUserContext } from "../lib/auth";
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

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const allocations = body.allocations;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return bad(event, "Missing or invalid allocations array");
    }

    // Validate allocation items
    for (const allocation of allocations) {
      if (!allocation.rubro_id || !allocation.mes) {
        return bad(event, "Each allocation must have rubro_id and mes");
      }
      
      // Check for the appropriate amount field based on type
      const amountField = allocationType === "planned" ? "monto_planeado" : "monto_proyectado";
      if (typeof allocation[amountField] !== "number" || allocation[amountField] < 0) {
        return bad(event, `Each allocation must have a valid ${amountField} >= 0`);
      }
    }

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

    for (const allocation of allocations) {
      const { rubro_id, mes } = allocation;
      const amountField = allocationType === "planned" ? "monto_planeado" : "monto_proyectado";
      const amount = allocation[amountField];

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
        [amountField]: amount,
        status: existing.pk ? "updated" : "created",
      });

      console.log(`[allocations] ${allocationType} ${existing.pk ? "updated" : "created"}: ${projectId} / ${rubro_id} / ${mes} = ${amount}`);
    }

    return ok(event, {
      updated_count: results.length,
      type: allocationType,
      allocations: results,
    });
  } catch (error) {
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
