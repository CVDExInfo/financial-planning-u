import { handler } from "../../src/handlers/allocations";
import { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/lib/auth", () => ({
  ensureSDT: jest.fn().mockResolvedValue(undefined),
}));

describe("allocations handler", () => {
  it("returns 200 for unimplemented PUT /projects/{id}/allocations:bulk with stubbed response", async () => {
    const event = {
      requestContext: {
        http: {
          method: "PUT",
        },
      },
      pathParameters: {
        id: "P-123",
      },
      headers: {},
    } as unknown as APIGatewayProxyEventV2;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toHaveProperty("Access-Control-Allow-Origin");
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.message).toBe("PUT /projects/{id}/allocations:bulk - not implemented yet");
  });

  it("returns 400 for PUT without project id", async () => {
    const event = {
      requestContext: {
        http: {
          method: "PUT",
        },
      },
      pathParameters: {},
      headers: {},
    } as unknown as APIGatewayProxyEventV2;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Missing project id",
    });
  });

  it("returns 204 for OPTIONS (preflight)", async () => {
    const event = {
      requestContext: {
        http: {
          method: "OPTIONS",
        },
      },
      headers: {},
    } as unknown as APIGatewayProxyEventV2;

    const response = await handler(event);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toHaveProperty("Access-Control-Allow-Origin");
  });

  it("returns 200 for GET (not implemented but returns empty data)", async () => {
    const event = {
      requestContext: {
        http: {
          method: "GET",
        },
      },
      headers: {},
    } as unknown as APIGatewayProxyEventV2;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toHaveProperty("Access-Control-Allow-Origin");
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });
});
