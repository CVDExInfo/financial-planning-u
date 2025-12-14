import { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  tableName: jest.fn((name: string) => `${name}-table`),
  ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { handler as projectsHandler } from "../../src/handlers/projects";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
};

const baseEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "GET /projects",
  rawPath: "/projects",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: { method: "GET", path: "/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
    requestId: "id",
    routeKey: "GET /projects",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("projects handler RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows SDMT/FIN users to list projects", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROJECT#P-1",
          sk: "METADATA",
          project_id: "P-1",
          nombre: "Proyecto Uno",
          cliente: "Cliente",
          fecha_inicio: "2024-01-01",
          fecha_fin: "2024-12-31",
          moneda: "USD",
          presupuesto_total: 100,
          estado: "active",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
    });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin.user@example.com" } } as any),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(Array.isArray(payload.data)).toBe(true);
    // Canonical DTO now returns projectId, not id
    expect(payload.data[0].projectId).toBe("P-1");
    // Should have canonical fields
    expect(payload.data[0].name).toBe("Proyecto Uno");
    expect(payload.data[0].client).toBe("Cliente");
    expect(payload.data[0].currency).toBe("USD");
  });

  it("returns SDM-visible projects when accepted or created by the SDM", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROJECT#P-1",
          sk: "METADATA",
          project_id: "P-1",
          nombre: "Proyecto Uno",
          cliente: "Cliente",
          fecha_inicio: "2024-01-01",
          fecha_fin: "2024-12-31",
          moneda: "USD",
          presupuesto_total: 100,
          accepted_by: "sdm.user@example.com",
        },
        {
          pk: "PROJECT#P-2",
          sk: "METADATA",
          project_id: "P-2",
          nombre: "Proyecto Dos",
          cliente: "Cliente",
          fecha_inicio: "2024-01-01",
          fecha_fin: "2024-12-31",
          moneda: "USD",
          presupuesto_total: 100,
          created_by: "sdm.user@example.com",
        },
      ],
    });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["SDM"], email: "sdm.user@example.com" } } as any),
    );

    const filterExpression = dynamo.ddb.send.mock.calls[0]?.[0]?.input?.FilterExpression;
    expect(filterExpression).toMatch(/#createdBy/);

    const payload = JSON.parse(response.body as string);
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((p: any) => p.projectId)).toEqual(["P-1", "P-2"]);
  });

  it("scans for unassigned projects when SDM sees none", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-99",
            sk: "METADATA",
            project_id: "P-99",
            nombre: "Sin SDM",
          },
        ],
      });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["SDM"], email: "sdm.user@example.com" } } as any),
    );

    expect(response.statusCode).toBe(200);
    expect(dynamo.ddb.send).toHaveBeenCalledTimes(2);
    const secondCallFilter = dynamo.ddb.send.mock.calls[1]?.[0]?.input?.FilterExpression;
    expect(secondCallFilter).toMatch(/attribute_not_exists/);
  });

  it("paginates through all project pages and preserves totals", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({
        Items: Array.from({ length: 100 }).map((_, idx) => ({
          pk: `PROJECT#P-${idx + 1}`,
          sk: "METADATA",
          project_id: `P-${idx + 1}`,
          nombre: `Proyecto ${idx + 1}`,
          cliente: "Cliente",
          moneda: "USD",
        })),
        LastEvaluatedKey: { pk: "PROJECT#P-100", sk: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-101",
            sk: "METADATA",
            project_id: "P-101",
            nombre: "Proyecto 101",
            cliente: "Cliente",
            moneda: "USD",
          },
        ],
      });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin.user@example.com" } } as any),
    );

    expect(dynamo.ddb.send).toHaveBeenCalledTimes(2);
    expect(dynamo.ddb.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      pk: "PROJECT#P-100",
      sk: "METADATA",
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(payload.total).toBe(101);
    expect(payload.data).toHaveLength(101);
    expect(payload.data[100].projectId).toBe("P-101");
  });

  it("rejects requests without valid groups", async () => {
    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["guest"] } } as any),
    );

    expect(response.statusCode).toBe(403);
    const payload = JSON.parse(response.body as string);
    expect(payload.error).toBe("forbidden: valid group required");
  });

  describe("SDM user RBAC filtering (regression tests)", () => {
    const sdmUserEmail = "sdm.manager@example.com";

    it("SDM sees projects where sdm_manager_email matches their email", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-SDM-ASSIGNED",
            sk: "METADATA",
            project_id: "P-SDM-ASSIGNED",
            nombre: "SDM Assigned Project",
            cliente: "Cliente A",
            sdm_manager_email: sdmUserEmail,
            fecha_inicio: "2024-01-01",
            fecha_fin: "2024-12-31",
            moneda: "USD",
            presupuesto_total: 100000,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const response = await projectsHandler(
        baseEvent({
          __verifiedClaims: { "cognito:groups": ["SDM"], email: sdmUserEmail },
        } as any)
      );

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.body as string);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].projectId).toBe("P-SDM-ASSIGNED");
    });

    it("SDM sees projects where accepted_by matches their email", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-ACCEPTED",
            sk: "METADATA",
            project_id: "P-ACCEPTED",
            nombre: "Accepted Project",
            cliente: "Cliente B",
            accepted_by: sdmUserEmail,
            fecha_inicio: "2024-01-01",
            fecha_fin: "2024-12-31",
            moneda: "USD",
            presupuesto_total: 50000,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const response = await projectsHandler(
        baseEvent({
          __verifiedClaims: { "cognito:groups": ["SDM"], email: sdmUserEmail },
        } as any)
      );

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.body as string);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].projectId).toBe("P-ACCEPTED");
    });

    it("SDM sees projects they created (created_by fallback)", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-CREATED",
            sk: "METADATA",
            project_id: "P-CREATED",
            nombre: "Created Project",
            cliente: "Cliente C",
            created_by: sdmUserEmail,
            fecha_inicio: "2024-01-01",
            fecha_fin: "2024-12-31",
            moneda: "USD",
            presupuesto_total: 75000,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const response = await projectsHandler(
        baseEvent({
          __verifiedClaims: { "cognito:groups": ["SDM"], email: sdmUserEmail },
        } as any)
      );

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.body as string);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].projectId).toBe("P-CREATED");
    });

    it("SDM does not see projects without any matching field", async () => {
      // Mock empty result for SDM filtered query
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [],
      });
      
      // Mock the diagnostic scan for unassigned projects
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-ORPHAN",
            sk: "METADATA",
            project_id: "P-ORPHAN",
            nombre: "Orphaned Project",
            created_by: "other.user@example.com",
            // No sdm_manager_email, accepted_by, or aceptado_por
          },
        ],
      });

      const response = await projectsHandler(
        baseEvent({
          __verifiedClaims: { "cognito:groups": ["SDM"], email: sdmUserEmail },
        } as any)
      );

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.body as string);
      expect(payload.data).toHaveLength(0);
      
      // Verify the filter expression includes all matching field placeholders
      const scanCall = dynamo.ddb.send.mock.calls[0];
      expect(scanCall[0].input.FilterExpression).toContain("#sdmEmail");
      expect(scanCall[0].input.FilterExpression).toContain("#acceptedBy");
      expect(scanCall[0].input.FilterExpression).toContain("#aceptadoPor");
      expect(scanCall[0].input.FilterExpression).toContain("#createdBy");
      
      // Verify the attribute names are mapped correctly
      expect(scanCall[0].input.ExpressionAttributeNames["#sdmEmail"]).toBe("sdm_manager_email");
      expect(scanCall[0].input.ExpressionAttributeNames["#createdBy"]).toBe("created_by");
    });

    it("ADMIN sees all projects including orphaned ones", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-ORPHAN",
            sk: "METADATA",
            project_id: "P-ORPHAN",
            nombre: "Orphaned Project",
            cliente: "Cliente D",
            created_by: "other.user@example.com",
            fecha_inicio: "2024-01-01",
            fecha_fin: "2024-12-31",
            moneda: "USD",
            presupuesto_total: 60000,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          {
            pk: "PROJECT#P-ASSIGNED",
            sk: "METADATA",
            project_id: "P-ASSIGNED",
            nombre: "Assigned Project",
            cliente: "Cliente A",
            sdm_manager_email: "sdm.other@example.com",
            fecha_inicio: "2024-01-01",
            fecha_fin: "2024-12-31",
            moneda: "USD",
            presupuesto_total: 100000,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const response = await projectsHandler(
        baseEvent({
          __verifiedClaims: { "cognito:groups": ["ADMIN"], email: "admin@example.com" },
        } as any)
      );

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.body as string);
      expect(payload.data).toHaveLength(2);
    });
  });

  describe("POST /projects SDM assignment requirement", () => {
    it("SDM user creating project gets auto-assigned as sdm_manager_email", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({}); // PutCommand for project
      dynamo.ddb.send.mockResolvedValueOnce({}); // PutCommand for audit

      const response = await projectsHandler(
        baseEvent({
          requestContext: {
            accountId: "123",
            apiId: "api",
            domainName: "example.com",
            domainPrefix: "example",
            http: { method: "POST", path: "/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
            requestId: "id",
            routeKey: "POST /projects",
            stage: "$default",
            time: "",
            timeEpoch: 0,
          },
          body: JSON.stringify({
            name: "New SDM Project",
            code: "PROJ-2024-001",
            client: "Test Client",
            start_date: "2024-01-01",
            end_date: "2024-12-31",
            currency: "USD",
            mod_total: 100000,
          }),
          __verifiedClaims: { "cognito:groups": ["SDM"], email: "sdm.creator@example.com" },
        } as any)
      );

      expect(response.statusCode).toBe(201);
      expect(dynamo.ddb.send).toHaveBeenCalled();
      const putCalls = dynamo.ddb.send.mock.calls.filter(call => 
        call[0]?.input?.TableName?.includes("projects") && call[0]?.input?.Item
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const projectPutCall = putCalls[0];
      expect(projectPutCall[0].input.Item.sdm_manager_email).toBe("sdm.creator@example.com");
    });

    it("PMO/SDMT user can specify sdm_manager_email in payload", async () => {
      dynamo.ddb.send.mockResolvedValueOnce({}); // PutCommand for project
      dynamo.ddb.send.mockResolvedValueOnce({}); // PutCommand for audit

      const response = await projectsHandler(
        baseEvent({
          requestContext: {
            accountId: "123",
            apiId: "api",
            domainName: "example.com",
            domainPrefix: "example",
            http: { method: "POST", path: "/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
            requestId: "id",
            routeKey: "POST /projects",
            stage: "$default",
            time: "",
            timeEpoch: 0,
          },
          body: JSON.stringify({
            name: "New PMO Project",
            code: "PROJ-2024-002",
            client: "Test Client",
            start_date: "2024-01-01",
            end_date: "2024-12-31",
            currency: "USD",
            mod_total: 100000,
            sdm_manager_email: "assigned.sdm@example.com",
          }),
          __verifiedClaims: { "cognito:groups": ["PMO"], email: "pmo.user@example.com" },
        } as any)
      );

      expect(response.statusCode).toBe(201);
      expect(dynamo.ddb.send).toHaveBeenCalled();
      const putCalls = dynamo.ddb.send.mock.calls.filter(call => 
        call[0]?.input?.TableName?.includes("projects") && call[0]?.input?.Item
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const projectPutCall = putCalls[0];
      expect(projectPutCall[0].input.Item.sdm_manager_email).toBe("assigned.sdm@example.com");
    });

    it("PMO/SDMT user must provide sdm_manager_email", async () => {
      const response = await projectsHandler(
        baseEvent({
          requestContext: {
            accountId: "123",
            apiId: "api",
            domainName: "example.com",
            domainPrefix: "example",
            http: { method: "POST", path: "/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
            requestId: "id",
            routeKey: "POST /projects",
            stage: "$default",
            time: "",
            timeEpoch: 0,
          },
          body: JSON.stringify({
            name: "New PMO Project Without SDM",
            code: "PROJ-2024-003",
            client: "Test Client",
            start_date: "2024-01-01",
            end_date: "2024-12-31",
            currency: "USD",
            mod_total: 100000,
            // Missing sdm_manager_email
          }),
          __verifiedClaims: { "cognito:groups": ["PMO"], email: "pmo.user@example.com" },
        } as any)
      );

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.body as string);
      expect(payload.error).toContain("sdm_manager_email is required");
    });
  });
});
