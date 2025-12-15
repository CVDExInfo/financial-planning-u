jest.mock("../../src/lib/dynamo", () => {
  const sendDdb = jest.fn();
  return {
    ddb: { send: sendDdb },
    sendDdb,
    ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    tableName: jest.fn(() => "providers-table"),
  };
});

import { handler as providersHandler } from "../../src/handlers/providers";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  ScanCommand: jest.Mock;
  PutCommand: jest.Mock;
  tableName: jest.Mock;
};

const baseHeaders = { authorization: "Bearer test" };

describe("providers handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.ddb.send.mockResolvedValue({ Items: [] });
  });

  it("returns providers from DynamoDB for FIN read-only role", async () => {
    const createdAt = new Date().toISOString();
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROVIDER#prov_123",
          sk: "METADATA",
          id: "prov_123",
          nombre: "Proveedor Semilla",
          tax_id: "RFC-123",
          tipo: "servicios",
          estado: "active",
          created_at: createdAt,
        },
      ],
    });

    const response = await providersHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin@example.com" },
    } as any);

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(1);
    expect(dynamo.ScanCommand).toHaveBeenCalledWith({
      TableName: "providers-table",
      Limit: 50,
    });
  });

  it("rejects requests without a valid group", async () => {
    const response = await providersHandler({
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
      __verifiedClaims: { "cognito:groups": ["guest"] },
    } as any);

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(403);
    expect(payload.error).toBe("forbidden: valid group required");
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("writes providers to the same Dynamo table used for reads", async () => {
    const body = {
      nombre: "Proveedor Test",
      tax_id: "RFC-12345",
      tipo: "servicios",
      contacto_email: "proveedor@example.com",
    };

    dynamo.ddb.send.mockResolvedValueOnce({});

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

    expect(dynamo.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "providers-table" })
    );
  });
});
