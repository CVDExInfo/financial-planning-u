import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT, ensureCanRead } from "../lib/auth";
import { bad, ok, noContent, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand, ScanCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";

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

// TODO: Implement bulk allocations update
// R1 requirement: PUT /projects/{id}/allocations:bulk
export const handler = async (event: APIGatewayProxyEventV2) => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return noContent(event);
  }

  if (method === "GET") {
    return await getAllocations(event);
  }

  await ensureSDT(event);

  if (method === "PUT") {
    const projectId = event.pathParameters?.id;

    if (!projectId) {
      return bad(event, "Missing project id");
    }

    // TODO: Parse bulk allocation data and update DynamoDB allocations table
    return ok(event, {
      data: [],
      total: 0,
      message: "PUT /projects/{id}/allocations:bulk - not implemented yet",
    });
  }

  return bad(event, `Method ${method} not allowed`, 405);
};
