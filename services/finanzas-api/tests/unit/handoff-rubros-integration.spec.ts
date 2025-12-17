/**
 * Integration test for handoff → rubros materialization
 * 
 * Tests the end-to-end flow from handoff creation to rubros seeding
 * with realistic baseline data including labor and non-labor estimates.
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "12345678-1234-1234-1234-123456789abc"),
}));

// Mock auth functions
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockReturnValue("test@example.com"),
}));

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => {
  const sendDdb = jest.fn();
  return {
    ddb: { send: sendDdb },
    sendDdb,
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
    TransactWriteCommand: jest.fn().mockImplementation((input) => ({ input })),
    tableName: jest.fn((table) => `test-${table}`),
  };
});

jest.mock("../../src/lib/projects-handoff", () => ({
  resolveProjectForHandoff: jest.fn(),
}));

import { handler as handoffHandler } from "../../src/handlers/handoff";
import { resolveProjectForHandoff } from "../../src/lib/projects-handoff";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  GetCommand: jest.Mock;
  QueryCommand: jest.Mock;
  UpdateCommand: jest.Mock;
  TransactWriteCommand: jest.Mock;
  tableName: jest.Mock;
};

const mockedResolver = resolveProjectForHandoff as jest.MockedFunction<
  typeof resolveProjectForHandoff
>;

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /projects/{projectId}/handoff",
  rawPath: "/projects/P-3367eb69-1ca8-458d-82d8-cab306fb9f81/handoff",
  rawQueryString: "",
  headers: {
    "x-idempotency-key": "test-key-12345",
  },
  pathParameters: {
    projectId: "P-3367eb69-1ca8-458d-82d8-cab306fb9f81",
  },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/projects/P-3367eb69-1ca8-458d-82d8-cab306fb9f81/handoff",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "POST /projects/{projectId}/handoff",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("Handoff → Rubros Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolver.mockReset();
  });

  it("should materialize labor and non-labor rubros from baseline estimates", async () => {
    const projectId = "P-3367eb69-1ca8-458d-82d8-cab306fb9f81";
    const baselineId = "base_c8e6829c5b91";

    mockedResolver.mockResolvedValue({
      resolvedProjectId: projectId,
      baselineId,
      isNewProject: true,
    });

    // Track the rubros that were written
    const writtenRubros: any[] = [];

    // Mock DynamoDB responses
    dynamo.ddb.send.mockImplementation((command: any) => {
      const hasKey = command.input?.Key;
      const pk = command.input?.Key?.pk;
      const sk = command.input?.Key?.sk;
      const tableName = command.input?.TableName;

      // Mock PROJECT METADATA GetCommand
      if (hasKey && pk?.startsWith("PROJECT#") && sk === "METADATA") {
        return Promise.resolve({ Item: undefined });
      }

      // Mock idempotency check
      if (hasKey && pk === "IDEMPOTENCY#HANDOFF") {
        return Promise.resolve({ Item: undefined });
      }

      // Mock baseline METADATA GetCommand - return realistic baseline with estimates
      if (hasKey && pk?.startsWith("BASELINE#") && sk === "METADATA") {
        return Promise.resolve({
          Item: {
            pk: `BASELINE#${baselineId}`,
            sk: "METADATA",
            project_id: projectId,
            baseline_id: baselineId,
            project_name: "Test Project with Estimates",
            client_name: "Test Client",
            currency: "USD",
            start_date: "2025-01-01",
            duration_months: 12,
            total_amount: 150000,
            payload: {
              project_id: projectId,
              project_name: "Test Project with Estimates",
              client_name: "Test Client",
              currency: "USD",
              start_date: "2025-01-01",
              duration_months: 12,
              labor_estimates: [
                {
                  rubroId: "MOD-PM",
                  role: "Project Manager",
                  country: "USA",
                  level: "senior",
                  fte_count: 1,
                  hourly_rate: 12000,
                  hours_per_month: 160,
                  on_cost_percentage: 35,
                  start_month: 1,
                  end_month: 12,
                },
                {
                  rubroId: "MOD-LEAD",
                  role: "Ingeniero Delivery",
                  country: "Colombia",
                  level: "senior",
                  fte_count: 1,
                  hourly_rate: 6000,
                  hours_per_month: 160,
                  on_cost_percentage: 25,
                  start_month: 1,
                  end_month: 12,
                },
              ],
              non_labor_estimates: [
                {
                  rubroId: "GSV-REU",
                  category: "Gestión del Servicio",
                  description: "Reuniones de seguimiento",
                  amount: 1000,
                  one_time: false,
                  start_month: 1,
                  end_month: 12,
                },
              ],
            },
          },
        });
      }

      // Mock QueryCommand for checking existing rubros
      if (command.input?.KeyConditionExpression && tableName?.includes("rubros")) {
        return Promise.resolve({ Items: [] }); // No existing rubros
      }

      // Mock PutCommand for rubros - capture the written rubros
      if (command.input?.Item && tableName?.includes("rubros")) {
        writtenRubros.push(command.input.Item);
        return Promise.resolve({});
      }

      // Mock TransactWriteCommand for handoff and metadata
      if (command.input?.TransactItems) {
        return Promise.resolve({});
      }

      // Mock PutCommand for idempotency and audit (default)
      return Promise.resolve({});
    });

    const event = baseEvent({
      body: JSON.stringify({
        projectId,
        baseline_id: baselineId,
        owner: "test@example.com",
        project_name: "Test Project with Estimates",
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        fields: {
          mod_total: 150000,
          pct_ingenieros: 70,
          pct_sdm: 30,
        },
      }),
    });

    const response = await handoffHandler(event);

    // Verify handoff succeeded
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("handoffId");
    expect(body).toHaveProperty("seededRubros");

    // Verify rubros were seeded
    expect(body.seededRubros).toBeGreaterThan(0);
    expect(writtenRubros.length).toBe(3); // 2 labor + 1 non-labor

    // Verify labor rubros structure
    const projectManagerRubro = writtenRubros.find((r) =>
      r.rubroId?.includes("MOD-PM")
    );
    expect(projectManagerRubro).toBeDefined();
    expect(projectManagerRubro.pk).toBe(`PROJECT#${projectId}`);
    expect(projectManagerRubro.sk).toContain(`RUBRO#MOD-PM#${baselineId}`);
    expect(projectManagerRubro.nombre).toBe("Project Manager");
    expect(projectManagerRubro.category).toBe("Labor");
    expect(projectManagerRubro.recurring).toBe(true);
    expect(projectManagerRubro.one_time).toBe(false);
    expect(projectManagerRubro.metadata).toBeDefined();
    expect(projectManagerRubro.metadata.source).toBe("baseline");
    expect(projectManagerRubro.metadata.baseline_id).toBe(baselineId);
    expect(projectManagerRubro.metadata.project_id).toBe(projectId);
    expect(projectManagerRubro.metadata.linea_codigo).toBe("MOD-PM");
    expect(projectManagerRubro.metadata.role).toBe("Project Manager");

    const deliveryEngineerRubro = writtenRubros.find((r) =>
      r.rubroId?.includes("MOD-LEAD")
    );
    expect(deliveryEngineerRubro).toBeDefined();
    expect(deliveryEngineerRubro.metadata.linea_codigo).toBe("MOD-LEAD");
    expect(deliveryEngineerRubro.metadata.role).toBe("Ingeniero Delivery");

    // Verify non-labor rubro structure
    const nonLaborRubro = writtenRubros.find((r) =>
      r.rubroId?.includes("GSV-REU")
    );
    expect(nonLaborRubro).toBeDefined();
    expect(nonLaborRubro.pk).toBe(`PROJECT#${projectId}`);
    expect(nonLaborRubro.sk).toContain(`RUBRO#GSV-REU#${baselineId}`);
    expect(nonLaborRubro.nombre).toBe("Reuniones de seguimiento");
    expect(nonLaborRubro.category).toBe("Gestión del Servicio");
    expect(nonLaborRubro.recurring).toBe(true);
    expect(nonLaborRubro.one_time).toBe(false);
    expect(nonLaborRubro.metadata).toBeDefined();
    expect(nonLaborRubro.metadata.source).toBe("baseline");
    expect(nonLaborRubro.metadata.baseline_id).toBe(baselineId);
    expect(nonLaborRubro.metadata.project_id).toBe(projectId);
    expect(nonLaborRubro.metadata.linea_codigo).toBe("GSV-REU");
  });

  it("should handle baseline with no estimates gracefully", async () => {
    const projectId = "P-test-no-estimates";
    const baselineId = "base_test_no_estimates";

    mockedResolver.mockResolvedValue({
      resolvedProjectId: projectId,
      baselineId,
      isNewProject: true,
    });

    // Track the rubros that were written
    const writtenRubros: any[] = [];

    dynamo.ddb.send.mockImplementation((command: any) => {
      const commandName =
        command.constructor.name || command.input?.constructor?.name;

      if (
        commandName === "GetCommand" &&
        command.input?.Key?.sk === "METADATA"
      ) {
        return Promise.resolve({ Item: undefined });
      }

      if (
        commandName === "GetCommand" &&
        command.input?.Key?.pk === "IDEMPOTENCY#HANDOFF"
      ) {
        return Promise.resolve({ Item: undefined });
      }

      if (
        commandName === "GetCommand" &&
        command.input?.Key?.pk?.startsWith("BASELINE#")
      ) {
        return Promise.resolve({
          Item: {
            pk: `BASELINE#${baselineId}`,
            sk: "METADATA",
            payload: {
              project_name: "Empty Baseline",
              client_name: "Test Client",
              currency: "USD",
              labor_estimates: [],
              non_labor_estimates: [],
            },
          },
        });
      }

      if (
        commandName === "QueryCommand" &&
        command.input?.TableName?.includes("rubros")
      ) {
        return Promise.resolve({ Items: [] });
      }

      if (
        commandName === "PutCommand" &&
        command.input?.TableName?.includes("rubros")
      ) {
        writtenRubros.push(command.input.Item);
        return Promise.resolve({});
      }

      if (commandName === "TransactWriteCommand") {
        return Promise.resolve({});
      }

      if (commandName === "PutCommand") {
        return Promise.resolve({});
      }

      return Promise.resolve({});
    });

    const event = baseEvent({
      pathParameters: {
        projectId,
      },
      body: JSON.stringify({
        baseline_id: baselineId,
        owner: "test@example.com",
      }),
    });

    const response = await handoffHandler(event);

    // Should still succeed but with 0 rubros seeded
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.seededRubros).toBe(0);
    expect(writtenRubros.length).toBe(0);
  });
});
