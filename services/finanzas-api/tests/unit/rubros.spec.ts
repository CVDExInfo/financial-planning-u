import { APIGatewayProxyEventV2 } from "aws-lambda";
import { CANONICAL_PROJECT_IDS, CANONICAL_BASELINE_IDS, CANONICAL_RUBROS } from "../fixtures/canonical-projects";

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn(),
}));

jest.mock("../../src/lib/dynamo", () => {
  const sendDdb = jest.fn();
  return {
    ddb: { send: sendDdb },
    sendDdb,
    QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
    BatchGetCommand: jest.fn().mockImplementation((input) => ({ input })),
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    tableName: jest.fn((name: string) => `${name}-table`),
  };
});

jest.mock("../../src/lib/baseline-sdmt", () => ({
  queryProjectRubros: jest.fn(() => Promise.resolve([])),
}));

import { handler as rubrosHandler } from "../../src/handlers/rubros.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  BatchGetCommand: jest.Mock;
  tableName: jest.Mock;
};
const auth = jest.requireMock("../../src/lib/auth") as {
  getUserEmail: jest.Mock;
};
const baselineSDMT = jest.requireMock("../../src/lib/baseline-sdmt") as {
  queryProjectRubros: jest.Mock;
};

// Use canonical project for consistent testing
const TEST_PROJECT_ID = CANONICAL_PROJECT_IDS.NOC_CLARO;
const TEST_BASELINE_ID = CANONICAL_BASELINE_IDS.NOC_CLARO;

const baseEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}) => ({
  version: "2.0",
  routeKey: "GET /projects/{projectId}/rubros",
  rawPath: `/projects/${TEST_PROJECT_ID}/rubros`,
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "GET",
      path: `/projects/${TEST_PROJECT_ID}/rubros`,
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "GET /projects/{projectId}/rubros",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  pathParameters: { projectId: TEST_PROJECT_ID },
  isBase64Encoded: false,
  ...overrides,
});

describe("rubros handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset ddb.send to return a default empty response
    dynamo.ddb.send.mockResolvedValue({});
    // Mock queryProjectRubros to return empty array by default
    baselineSDMT.queryProjectRubros.mockResolvedValue([]);
  });

  it("returns attached project rubros with catalog metadata (baseline-first flow)", async () => {
    // Use canonical rubros from the baseline
    const testRubroId = CANONICAL_RUBROS.MOD_ENGINEERS; // Legacy: RB0001
    const canonicalId = "MOD-ING"; // Expected canonical ID
    
    // Mock queryProjectRubros to return baseline-filtered rubros
    baselineSDMT.queryProjectRubros.mockResolvedValueOnce([
      {
        projectId: TEST_PROJECT_ID,
        rubroId: testRubroId,
        sk: `RUBRO#${testRubroId}`,
        tier: "Gold",
        category: "MOD",
        metadata: {
          baseline_id: TEST_BASELINE_ID,
          project_id: TEST_PROJECT_ID,
        },
      },
    ]);
    
    // Mock BatchGet for rubro definitions from catalog
    dynamo.ddb.send.mockResolvedValueOnce({
      Responses: {
        "rubros-table": [
          {
            codigo: testRubroId,
            nombre: "Costo mensual de ingenieros asignados al servicio según % de asignación",
            tipo_costo: "Recurrente",
            categoria: "MOD",
            tier: "Gold",
          },
        ],
      },
    });

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.project_id).toBe(TEST_PROJECT_ID);
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: canonicalId, // Should return canonical ID
        rubro_id: canonicalId, // Should return canonical ID
        nombre: expect.stringContaining("ingenieros"),
        tipo_costo: "Recurrente",
        categoria: "MOD",
      }),
    ]);

    expect(baselineSDMT.queryProjectRubros).toHaveBeenCalledWith(TEST_PROJECT_ID);
    expect(dynamo.BatchGetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        RequestItems: expect.objectContaining({
          "rubros-table": expect.objectContaining({ Keys: [{ pk: `RUBRO#${testRubroId}`, sk: "METADATA" }] }),
        }),
      }),
    );
  });

  it("validates project id", async () => {
    const response = await rubrosHandler(baseEvent({ pathParameters: {} }));
    expect(response.statusCode).toBe(400);
  });

  it("persists cost metadata and allocations when attaching a rubro (from baseline)", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const testRubroId = CANONICAL_RUBROS.MOD_TECH_LEAD; // Legacy ID: RB0002
    const canonicalId = "MOD-LEAD"; // Expected canonical ID after normalization
    
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: TEST_PROJECT_ID },
      body: JSON.stringify({
        baselineId: TEST_BASELINE_ID, // Must specify baseline
        rubroIds: [
          {
            rubroId: testRubroId,
            qty: 2,
            unitCost: 110000,
            duration: "M1-M60",
          },
        ],
      }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const calls = dynamo.ddb.send.mock.calls.map((call) => call[0].input);
    const rubroPut = calls.find((call) => call?.TableName === "rubros-table");
    const allocationPuts = calls.filter(
      (call) => call?.TableName === "allocations-table",
    );

    // Expect canonical ID in storage, with legacy ID preserved
    expect(rubroPut?.Item).toEqual(
      expect.objectContaining({
        rubroId: canonicalId,
        rubro_id: canonicalId,
        sk: `RUBRO#${canonicalId}`,
        _legacy_id: testRubroId, // Legacy ID preserved for audit
        projectId: TEST_PROJECT_ID,
        qty: 2,
        unit_cost: 110000,
        start_month: 1,
        end_month: 60,
        total_cost: 220000, // 2 * 110000
      }),
    );

    expect(allocationPuts).toHaveLength(1);
    expect(allocationPuts[0]?.Item).toEqual(
      expect.objectContaining({
        pk: `PROJECT#${TEST_PROJECT_ID}`,
        month: 1,
        planned: 220000,
        forecast: 220000,
      }),
    );
  });

  it("upserts an existing rubro when the same rubroId is provided", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const legacyId = CANONICAL_RUBROS.MOD_SDM; // Legacy ID: RB0003
    const canonicalId = "MOD-SDM"; // Expected canonical ID after normalization
    
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: TEST_PROJECT_ID },
      body: JSON.stringify({
        baselineId: TEST_BASELINE_ID,
        rubroIds: [
          {
            rubroId: legacyId,
            qty: 1,
            unitCost: 95000,
            duration: "M1-M60",
            currency: "USD",
            description: "Service Delivery Manager",
            type: "recurring",
          },
        ],
      }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const calls = dynamo.ddb.send.mock.calls.map((call) => call[0].input);
    const rubroPut = calls.find((call) => call?.TableName === "rubros-table");
    
    // Expect canonical ID in storage, with legacy ID preserved
    expect(rubroPut?.Item).toEqual(
      expect.objectContaining({
        pk: `PROJECT#${TEST_PROJECT_ID}`,
        sk: `RUBRO#${canonicalId}`,
        rubroId: canonicalId,
        rubro_id: canonicalId,
        _legacy_id: legacyId, // Legacy ID preserved for audit
        qty: 1,
        unit_cost: 95000,
        start_month: 1,
        end_month: 60,
        total_cost: 5700000, // Total over duration: 1 qty * 95000 unit_cost * 60 months
        description: "Service Delivery Manager",
      }),
    );
  });

  it("preserves shared payload fields when rubroIds is an array of strings", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({
        rubroIds: ["R-300"],
        qty: 3,
        unitCost: 1000,
        duration: "M2-M3",
        type: "one-time",
        currency: "MXN",
        description: "Consulting",
      }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const calls = dynamo.ddb.send.mock.calls.map((call) => call[0].input);
    const rubroPut = calls.find((call) => call?.TableName === "rubros-table");
    const allocationPuts = calls.filter((call) => call?.TableName === "allocations-table");

    expect(rubroPut?.Item).toEqual(
      expect.objectContaining({
        rubroId: "R-300",
        qty: 3,
        unit_cost: 1000,
        start_month: 2,
        end_month: 3,
        total_cost: 3000,
        description: "Consulting",
        currency: "MXN",
      }),
    );

    expect(allocationPuts).toHaveLength(1);
    expect(allocationPuts[0]?.Item).toEqual(
      expect.objectContaining({
        pk: "PROJECT#PROJ-1",
        sk: "ALLOC#R-300#M2",
        planned: 3000,
        forecast: 3000,
        created_by: "user@example.com",
      }),
    );
  });

  it("returns warnings when allocation mirroring fails but still attaches rubro", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({
        rubroIds: [
          {
            rubroId: "R-500",
            qty: 1,
            unitCost: 200,
            duration: "M1",
          },
        ],
      }),
    });

    dynamo.ddb.send
      .mockResolvedValueOnce({}) // rubro Put
      .mockRejectedValueOnce(new Error("allocations table missing")) // allocation mirror
      .mockResolvedValueOnce({}); // audit log

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.attached).toEqual(["R-500"]);
    expect(payload.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Allocation mirror failed for rubro R-500"),
      ]),
    );
  });

  it("returns 400 when no rubro identifiers are provided", async () => {
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({ qty: 1, unitCost: 50 }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string).error).toContain("rubroIds");
  });

  it("filters attachments without a rubro id", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [{ projectId: "PROJ-1", sk: "RUBRO#" }] })
      .mockResolvedValueOnce({ Responses: { "rubros-table": [] } });

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(payload.data).toEqual([]);
  });

  it("paginates the rubro attachment query", async () => {
    dynamo.ddb.send.mockReset();

    // Mock queryProjectRubros to return paginated data
    baselineSDMT.queryProjectRubros.mockResolvedValueOnce([
      { projectId: "PROJ-1", rubroId: "R-1", sk: "RUBRO#R-1" },
      { projectId: "PROJ-1", rubroId: "R-2", sk: "RUBRO#R-2" },
      { projectId: "PROJ-1", rubroId: "R-3", sk: "RUBRO#R-3" },
    ]);

    dynamo.ddb.send.mockResolvedValueOnce({
      Responses: {
        "rubros-table": [
          { codigo: "R-1", nombre: "Rubro 1" },
          { codigo: "R-2", nombre: "Rubro 2" },
          { codigo: "R-3", nombre: "Rubro 3" },
        ],
      },
    });

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.data).toHaveLength(3);
    expect(payload.total).toBe(3);
  });

  it("chunks BatchGetCommand when more than 100 rubros attached", async () => {
    // Reset mocks specifically for this test
    dynamo.ddb.send.mockReset();
    dynamo.BatchGetCommand.mockReset();
    
    // Create 101 test rubros (just over the 100 limit)
    const attachments = Array.from({ length: 101 }, (_, i) => ({
      projectId: "PROJ-1",
      rubroId: `R-${i}`,
      sk: `RUBRO#R-${i}`,
      tier: "gold",
      category: "Ops",
    }));

    // Mock queryProjectRubros to return 101 rubros
    baselineSDMT.queryProjectRubros.mockResolvedValueOnce(attachments);

    // Mock responses for BatchGetCommands
    const firstBatch = Array.from({ length: 100 }, (_, i) => ({
      codigo: `R-${i}`,
      nombre: `Rubro ${i}`,
      tipo_costo: "RECURRENT",
    }));
    const secondBatch = [{
      codigo: `R-100`,
      nombre: `Rubro 100`,
      tipo_costo: "RECURRENT",
    }];

    // Set up mock to handle multiple calls
    dynamo.ddb.send.mockImplementation(async (command) => {
      const tableKey = dynamo.tableName('rubros');
      if (command.input && command.input.RequestItems) {
        const keys = command.input.RequestItems[tableKey].Keys;
        if (keys.length === 100) {
          return { Responses: { [tableKey]: firstBatch } };
        } else {
          return { Responses: { [tableKey]: secondBatch } };
        }
      }
      return {};
    });
    
    dynamo.BatchGetCommand.mockImplementation((input) => ({ input }));

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.data).toHaveLength(101);
    expect(payload.total).toBe(101);

    // Verify BatchGetCommand was called twice with correct chunk sizes
    expect(dynamo.BatchGetCommand).toHaveBeenCalledTimes(2);
    const firstCall = dynamo.BatchGetCommand.mock.calls[0][0];
    const secondCall = dynamo.BatchGetCommand.mock.calls[1][0];

    expect(firstCall.RequestItems["rubros-table"].Keys).toHaveLength(100);
    expect(secondCall.RequestItems["rubros-table"].Keys).toHaveLength(1);
  });
});

