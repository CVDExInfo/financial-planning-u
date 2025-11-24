import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { bad, ok } from "../lib/http";

// Placeholder handler for reconciliation endpoints
export const handler = async (event: APIGatewayProxyEventV2) => {
  await ensureSDT(event);

  const method = event.requestContext.http.method;

  if (method === "GET") {
    return ok({ message: "GET /recon - not implemented yet" }, 501);
  }

  return bad(`Method ${method} not allowed`, 405);
};
