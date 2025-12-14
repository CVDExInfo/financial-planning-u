import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { bad, ok, noContent, notImplemented } from "../lib/http";

// TODO: Implement bulk allocations update
// R1 requirement: PUT /projects/{id}/allocations:bulk
export const handler = async (event: APIGatewayProxyEventV2) => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return noContent();
  }

  await ensureSDT(event);

  if (method === "GET") {
    // Endpoint not implemented yet. Return an empty dataset to avoid noisy UI errors.
    return ok({ data: [], total: 0, message: "GET /allocations - not implemented yet" });
  }

  if (method === "PUT") {
    const projectId = event.pathParameters?.id;

    if (!projectId) {
      return bad("Missing project id");
    }

    // TODO: Parse bulk allocation data and update DynamoDB allocations table
    return notImplemented("PUT /projects/{id}/allocations:bulk - not implemented yet");
  }

  return bad(`Method ${method} not allowed`, 405);
};
