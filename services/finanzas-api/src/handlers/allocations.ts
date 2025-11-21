import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { bad, ok } from "../lib/http";

// TODO: Implement bulk allocations update
// R1 requirement: PUT /projects/{id}/allocations:bulk
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  const method = event.requestContext.http.method;

  if (method === "GET") {
    // Endpoint not implemented yet. Return a CORS-safe placeholder so contract
    // tests see the expected 501 instead of API Gateway's default 404.
    return ok({ message: "GET /allocations - not implemented yet" }, 501);
  }

  if (method === "PUT") {
    const projectId = event.pathParameters?.id;

    if (!projectId) {
      return bad("Missing project id");
    }

    // TODO: Parse bulk allocation data and update DynamoDB allocations table
    return ok(
      {
        message: "PUT /projects/{id}/allocations:bulk - not implemented yet",
      },
      501
    );
  }

  return bad(`Method ${method} not allowed`, 405);
};
