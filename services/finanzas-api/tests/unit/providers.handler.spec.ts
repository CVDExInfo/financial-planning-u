import { handler as providersHandler } from "../../src/handlers/providers";

const baseHeaders = { authorization: "Bearer test" };

describe("providers handler", () => {
  it("returns seeded providers for FIN read-only role", async () => {
    const response = await providersHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin@example.com" },
    } as any);

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("allows SDT to create providers", async () => {
    const body = {
      nombre: "Proveedor Test",
      tax_id: "RFC-12345",
      tipo: "servicios",
      contacto_email: "proveedor@example.com",
    };

    const createResponse = await providersHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(body),
      __verifiedClaims: { "cognito:groups": ["SDT"], email: "sdt@example.com" },
    } as any);

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.nombre).toBe(body.nombre);
    expect(created.id).toContain("prov_");
  });
});
