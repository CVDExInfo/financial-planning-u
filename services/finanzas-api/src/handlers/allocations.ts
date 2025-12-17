import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT, ensureCanRead, ensurePMO, getUserContext } from "../lib/auth";
import { bad, ok, noContent, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand, ScanCommand, UpdateCommand, GetCommand } from "../lib/dynamo";
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
 * PUT /projects/{id}/allocations:bulk?type=forecast
 * Bulk update forecast values for allocations (PMO only)
 */
async function bulkUpdateForecast(event: APIGatewayProxyEventV2) {
  try {
    // PMO-only access for forecast updates
    await ensurePMO(event);
    
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return bad(event, "Missing project id");
    }
    
    // Parse and validate request body
    const body = event.body ? JSON.parse(event.body) : {};
    const validation = parseForecastBulkUpdate({
      ...body,
      projectId,
    });
    
    const userContext = await getUserContext(event as any);
    const updatedBy = userContext.email || "system";
    const allocationsTable = tableName("allocations");
    const timestamp = new Date().toISOString();
    
    const results = {
      updated: 0,
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    // Process each forecast item
    for (const item of validation.items) {
      try {
        const sk = `MONTH#${item.month}#RUBRO#${item.rubroId}`;
        const pk = `PROJECT#${projectId}`;
        
        // Check if allocation exists
        const getResult = await ddb.send(
          new GetCommand({
            TableName: allocationsTable,
            Key: { pk, sk },
          })
        );
        
        if (getResult.Item) {
          // Update existing allocation's forecast value
          await ddb.send(
            new UpdateCommand({
              TableName: allocationsTable,
              Key: { pk, sk },
              UpdateExpression: "SET forecast = :forecast, updated_at = :updated_at, updated_by = :updated_by",
              ExpressionAttributeValues: {
                ":forecast": item.forecast,
                ":updated_at": timestamp,
                ":updated_by": updatedBy,
              },
            })
          );
          results.updated++;
        } else {
          // Allocation doesn't exist - skip (don't create new allocations)
          results.skipped++;
          console.warn(`[allocations] Skipping forecast update for non-existent allocation: ${pk} ${sk}`);
        }
      } catch (itemError) {
        logError(`Error updating forecast for ${item.rubroId}/${item.month}`, itemError);
        results.errors.push(`${item.rubroId}/${item.month}: ${itemError}`);
      }
    }
    
    console.log(`[allocations] Bulk forecast update completed:`, results);
    
    return ok(event, {
      success: true,
      updated: results.updated,
      created: results.created,
      skipped: results.skipped,
      total: validation.items.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    if ((error as any).statusCode === 403) {
      return { statusCode: 403, body: JSON.stringify({ error: "PMO role required for forecast updates" }) };
    }
    logError("Error in bulk forecast update", error);
    return serverError(event as any, "Failed to update forecast values");
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
    const projectId = event.pathParameters?.id;
    const updateType = event.queryStringParameters?.type;

    if (!projectId) {
      return bad(event, "Missing project id");
    }

    // Route to forecast bulk update if type=forecast
    if (updateType === "forecast") {
      return await bulkUpdateForecast(event);
    }

    // Default bulk allocations update (requires SDMT)
    await ensureSDT(event);
    return ok(event, {
      data: [],
      total: 0,
      message: "PUT /projects/{id}/allocations:bulk - not implemented yet (use ?type=forecast for forecast updates)",
    });
  }

  return bad(event, `Method ${method} not allowed`, 405);
};
