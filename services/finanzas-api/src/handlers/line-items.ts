import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError, noContent } from "../lib/http";
import { ddb, QueryCommand, tableName } from "../lib/dynamo";

/**
 * GET /line-items?project_id=xxx
 * Returns line items (rubros) for a project
 * This is an alias endpoint to /projects/{id}/rubros for frontend compatibility
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;

    if (method === "OPTIONS") {
      // Respond quickly to CORS preflight with the standard headers used across
      // the API. The validate-api-config script accepts both 200 and 204.
      return noContent();
    }

    if (method === "GET") {
      await ensureCanRead(event as unknown as Parameters<typeof ensureCanRead>[0]);
      
      const projectId = event.queryStringParameters?.project_id?.trim();
      if (!projectId) {
        return bad("Missing required parameter: project_id");
      }

      // Query all rubros/line-items attached to this project
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("rubros"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
            ":sk": "RUBRO#",
          },
        })
      );

      const lineItems = (result.Items || []).map((item) => ({
        id: item.rubroId,
        projectId: item.projectId,
        rubroId: item.rubroId,
        tier: item.tier,
        category: item.category,
        metadata: item.metadata,
        createdAt: item.createdAt,
        createdBy: item.createdBy,
        qty: item.qty,
        unit_cost: item.unit_cost,
        currency: item.currency,
        recurring: item.recurring,
        one_time: item.one_time,
        start_month: item.start_month,
        end_month: item.end_month,
        total_cost: item.total_cost,
        description: item.description,
      }));

      return ok({
        data: lineItems,
        total: lineItems.length,
        project_id: projectId,
      });
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    // Handle DynamoDB-specific errors with appropriate status codes
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("DynamoDB table not found", {
        error,
        table: tableName("rubros"),
        operation: event.requestContext?.http?.method,
        path: event.rawPath,
        projectId: event.queryStringParameters?.project_id,
      });
      return bad(`Required table not found: ${tableName("rubros")}. Check infrastructure deployment.`, 503);
    }

    if (error && (error as { name?: string }).name === "AccessDeniedException") {
      console.error("DynamoDB access denied", {
        error,
        table: tableName("rubros"),
        operation: event.requestContext?.http?.method,
      });
      return bad("Database access denied - check IAM permissions", 503);
    }

    console.error("Error in line-items handler:", {
      error,
      stack: error instanceof Error ? (error as Error).stack : undefined,
      method: event.requestContext?.http?.method,
      path: event.rawPath,
      projectId: event.queryStringParameters?.project_id,
    });
    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
