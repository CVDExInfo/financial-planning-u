import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { ok, bad } from "../lib/http";

/**
 * Prefacturas (Pre-invoices) handler
 * GET /prefacturas?projectId={id} - Get pre-invoices for a project
 * POST /prefacturas/webhook - Webhook for external integrations
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    ensureSDT(event);
    const method = event.requestContext.http.method;

    if (method === "GET") {
      // GET - retrieve pre-invoices for a project
      const projectId = event.queryStringParameters?.projectId;

      if (!projectId) {
        return bad("Missing required parameter: projectId");
      }

      // TODO: Query prefacturas from DynamoDB
      // For now, return empty array with proper structure
      const prefacturas = [];

      return ok({
        data: prefacturas,
        projectId,
        total: prefacturas.length,
      });
    }

    if (method === "POST") {
      // POST - Process incoming webhook for pre-invoice
      // TODO: Implement webhook processing
      return {
        statusCode: 501,
        headers: {
          "Access-Control-Allow-Origin":
            process.env.ALLOWED_ORIGIN ||
            "https://d7t9x3j66yd8k.cloudfront.net",
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          message: "POST /prefacturas/webhook - not implemented yet",
        }),
      };
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    console.error("Error in prefacturas handler:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin":
          process.env.ALLOWED_ORIGIN || "https://d7t9x3j66yd8k.cloudfront.net",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
