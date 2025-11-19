import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError } from "../lib/http";
import { ddb, QueryCommand, tableName } from "../lib/dynamo";

/**
 * GET /invoices?project_id=xxx
 * Returns invoices/prefacturas for a project
 * This is an alias endpoint to /prefacturas for frontend compatibility
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;

    if (method === "GET") {
      ensureCanRead(event as unknown as Parameters<typeof ensureCanRead>[0]);
      
      const projectId = event.queryStringParameters?.project_id?.trim();
      if (!projectId) {
        return bad("Missing required parameter: project_id");
      }

      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("prefacturas"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      );

      return ok({
        data: result.Items ?? [],
        projectId,
        total: result.Count ?? 0,
      });
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    console.error("Error in invoices handler:", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
