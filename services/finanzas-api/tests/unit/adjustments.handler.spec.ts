import { handler as adjustmentsHandler } from "../../src/handlers/adjustments";

const baseHeaders = { authorization: "Bearer test" };

describe("adjustments handler", () => {
  it("returns seeded adjustments for FIN read-only role", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin@example.com" },
    };

    const response = await adjustmentsHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("allows SDT to create a new adjustment and returns it", async () => {
    const body = {
      project_id: "proj_test_123",
      tipo: "exceso",
      monto: 5000,
      fecha_inicio: "2025-01",
      metodo_distribucion: "pro_rata_forward",
      solicitado_por: "sdt@example.com",
    };

    const createResponse = await adjustmentsHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(body),
      __verifiedClaims: { "cognito:groups": ["SDT"], email: "sdt@example.com" },
    } as any);

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.project_id).toBe(body.project_id);
    expect(created.id).toContain("adj_");
  });
});
