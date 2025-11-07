import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth.js";

// TODO: Implement adjustments management
// R1 requirement: POST/GET /adjustments
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const method = event.requestContext.http.method;

  if (method === "POST") {
    // TODO: Create adjustment entry
    return {
      statusCode: 501,
      body: JSON.stringify({
        message: "POST /adjustments - not implemented yet",
      }),
    };
  }

  // GET - list adjustments
  // TODO: Query adjustments table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: "GET /adjustments - not implemented yet" }),
  };
};
