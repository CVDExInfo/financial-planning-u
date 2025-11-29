import { handler as changesHandler } from "../../src/handlers/changes";

const baseHeaders = { authorization: "Bearer test" };

describe("changes handler", () => {
  it("returns seeded changes for FIN read-only role", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin@example.com" },
    };

    const response = await changesHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("allows SDT to create a new change request and returns it", async () => {
    const body = {
      project_id: "proj_test_123",
      title: "Scope change for API work",
      impact: 5000,
      description: "Add additional endpoints for reporting",
    };

    const createResponse = await changesHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(body),
      __verifiedClaims: { "cognito:groups": ["SDT"], email: "sdt@example.com" },
    } as any);

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.project_id).toBe(body.project_id);
    expect(created.title).toBe(body.title);
    expect(created.id).toContain("chg_");
  });
});
