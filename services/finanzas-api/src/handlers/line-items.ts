import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError } from "../lib/http";
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

    if (method === "GET") {
      ensureCanRead(event as unknown as Parameters<typeof ensureCanRead>[0]);
      
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
      }));

      return ok({
        data: lineItems,
        total: lineItems.length,
        project_id: projectId,
      });
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    console.error("Error in line-items handler:", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
