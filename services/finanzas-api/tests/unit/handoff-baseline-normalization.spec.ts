/**
 * Tests for baseline normalization and taxonomy mapping
 * 
 * Tests the enhanced normalizeBaseline function that:
 * 1. Handles camelCase fields from Estimator
 * 2. Maps roles to canonical rubroIds using taxonomy
 * 3. Validates empty estimates scenarios
 * 4. Prevents double seeding of same baseline
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
  rawPath: "/projects/P-test123/handoff",
  rawQueryString: "",
  headers: {
    "x-idempotency-key": "test-key-normalize-123",
  },
  pathParameters: {
    projectId: "P-test123",
  },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/projects/P-test123/handoff",
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

describe("Baseline Normalization & Taxonomy Mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolver.mockReset();
  });

  describe("Realistic baseline payload with camelCase fields", () => {
    it("should normalize camelCase fields from Estimator and map roles to canonical rubroIds", async () => {
      const projectId = "P-test123";
      const baselineId = "base_abc123def456";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId,
        isNewProject: true,
      });

      const writtenRubros: any[] = [];

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

        // Mock baseline METADATA GetCommand with camelCase fields from Estimator
        if (hasKey && pk?.startsWith("BASELINE#") && sk === "METADATA") {
          return Promise.resolve({
            Item: {
              pk: `BASELINE#${baselineId}`,
              sk: "METADATA",
              project_id: projectId,
              baseline_id: baselineId,
              payload: {
                projectName: "Estimator Project",
                clientName: "Test Client Inc",
                startDate: "2025-01-01",
                durationMonths: 12,
                currency: "USD",
                // Labor estimates with camelCase fields (as Estimator sends them)
                laborEstimates: [
                  {
                    role: "Project Manager",
                    level: "Senior",
                    hoursPerMonth: 160,
                    fteCount: 1,
                    hourlyRate: 100,
                    onCostPercentage: 30,
                    startMonth: 1,
                    endMonth: 12,
                    // No rubroId - should be derived from role
                  },
                  {
                    role: "Ingeniero Delivery",
                    level: "Senior",
                    hoursPerMonth: 160,
                    fteCount: 2,
                    hourlyRate: 80,
                    onCostPercentage: 25,
                    startMonth: 1,
                    endMonth: 12,
                    // No rubroId - should be derived from role
                  },
                  {
                    role: "Service Delivery Manager",
                    level: "Senior",
                    hours: 80, // Alternative field name
                    fteCount: 0.5,
                    rate: 120, // Alternative field name
                    onCostPercentage: 35,
                    startMonth: 1,
                    endMonth: 12,
                  },
                ],
                // Non-labor estimates with camelCase fields
                nonLaborEstimates: [
                  {
                    category: "Gestión del Servicio",
                    description: "Reuniones mensuales",
                    amount: 1000,
                    oneTime: false,
                    startMonth: 1,
                    endMonth: 12,
                    // No rubroId - should be derived from description
                  },
                  {
                    category: "Cloud Services",
                    description: "AWS Infrastructure",
                    amount: 5000,
                    vendor: "Amazon Web Services",
                    oneTime: false,
                    startMonth: 1,
                    endMonth: 12,
                  },
                ],
              },
            },
          });
        }

        // Mock QueryCommand for checking existing rubros
        if (command.input?.KeyConditionExpression && tableName?.includes("rubros")) {
          return Promise.resolve({ Items: [] });
        }

        // Mock PutCommand for rubros
        if (command.input?.Item && tableName?.includes("rubros")) {
          writtenRubros.push(command.input.Item);
          return Promise.resolve({});
        }

        // Mock TransactWriteCommand
        if (command.input?.TransactItems) {
          return Promise.resolve({});
        }

        // Default: PutCommand for idempotency and audit
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          projectId,
          baseline_id: baselineId,
          owner: "test@example.com",
          fields: {
            mod_total: 150000,
          },
        }),
      });

      const response = await handoffHandler(event);

      // Verify handoff succeeded
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.seededRubros).toBeGreaterThan(0);

      // Verify rubros were seeded
      expect(writtenRubros.length).toBe(5); // 3 labor + 2 non-labor

      // Verify labor rubros have canonical IDs derived from roles
      // Note: Project Manager now maps to MOD-LEAD (changed from MOD-PM per canonical taxonomy)
      const pmRubro = writtenRubros.find((r) => r.metadata?.role === "Project Manager");
      expect(pmRubro).toBeDefined();
      expect(pmRubro.nombre).toBe("Project Manager");
      expect(pmRubro.metadata.role).toBe("Project Manager");
      expect(pmRubro.metadata.linea_codigo).toBe("MOD-LEAD"); // Changed from MOD-PM to MOD-LEAD

      const leadRubro = writtenRubros.find((r) => r.metadata?.role === "Ingeniero Delivery");
      expect(leadRubro).toBeDefined();
      expect(leadRubro.nombre).toBe("Ingeniero Delivery");
      expect(leadRubro.metadata.linea_codigo).toBe("MOD-LEAD");

      const sdmRubro = writtenRubros.find((r) => r.metadata?.role === "Service Delivery Manager");
      expect(sdmRubro).toBeDefined();
      expect(sdmRubro.nombre).toBe("Service Delivery Manager");
      expect(sdmRubro.metadata.linea_codigo).toBe("MOD-SDM");

      // Verify non-labor rubros have canonical IDs (with fallback to default)
      const nonLaborRubros = writtenRubros.filter((r) => r.category !== "Labor");
      expect(nonLaborRubros.length).toBe(2);
      
      // Check that metadata.linea_codigo is present for all rubros
      writtenRubros.forEach((rubro) => {
        expect(rubro.metadata.linea_codigo).toBeDefined();
        expect(rubro.metadata.baseline_id).toBe(baselineId);
        expect(rubro.metadata.project_id).toBe(projectId);
      });
    });
  });

  describe("No estimates scenario", () => {
    it("should return error when baseline has no labor or non-labor estimates", async () => {
      const projectId = "P-empty123";
      const baselineId = "base_empty456";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId,
        isNewProject: true,
      });

      const writtenRubros: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        const hasKey = command.input?.Key;
        const pk = command.input?.Key?.pk;
        const sk = command.input?.Key?.sk;
        const tableName = command.input?.TableName;

        if (hasKey && pk?.startsWith("PROJECT#") && sk === "METADATA") {
          return Promise.resolve({ Item: undefined });
        }

        if (hasKey && pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        // Mock baseline with NO estimates
        if (hasKey && pk?.startsWith("BASELINE#") && sk === "METADATA") {
          return Promise.resolve({
            Item: {
              pk: `BASELINE#${baselineId}`,
              sk: "METADATA",
              project_id: projectId,
              baseline_id: baselineId,
              payload: {
                projectName: "Empty Project",
                clientName: "Test Client",
                // NO labor_estimates or non_labor_estimates
              },
            },
          });
        }

        if (command.input?.KeyConditionExpression && tableName?.includes("rubros")) {
          return Promise.resolve({ Items: [] });
        }

        if (command.input?.Item && tableName?.includes("rubros")) {
          writtenRubros.push(command.input.Item);
          return Promise.resolve({});
        }

        if (command.input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        headers: {
          "x-idempotency-key": "test-key-empty-123",
        },
        pathParameters: {
          projectId,
        },
        body: JSON.stringify({
          projectId,
          baseline_id: baselineId,
          owner: "test@example.com",
        }),
      });

      const response = await handoffHandler(event);

      // Handoff should still succeed (metadata created)
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      
      // But no rubros should be seeded
      expect(body.seededRubros).toBe(0);
      expect(writtenRubros.length).toBe(0);
    });
  });

  describe("Double handoff for same baseline", () => {
    it("should skip seeding if baseline already seeded", async () => {
      const projectId = "P-double123";
      const baselineId = "base_double456";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId,
        isNewProject: false,
      });

      const writtenRubros: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        const hasKey = command.input?.Key;
        const pk = command.input?.Key?.pk;
        const sk = command.input?.Key?.sk;
        const tableName = command.input?.TableName;

        if (hasKey && pk?.startsWith("PROJECT#") && sk === "METADATA") {
          return Promise.resolve({
            Item: {
              pk: `PROJECT#${projectId}`,
              sk: "METADATA",
              project_id: projectId,
              baseline_id: baselineId,
            },
          });
        }

        if (hasKey && pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        if (hasKey && pk?.startsWith("BASELINE#") && sk === "METADATA") {
          return Promise.resolve({
            Item: {
              pk: `BASELINE#${baselineId}`,
              sk: "METADATA",
              project_id: projectId,
              baseline_id: baselineId,
              payload: {
                labor_estimates: [
                  {
                    role: "Project Manager",
                    hours_per_month: 160,
                    fte_count: 1,
                    hourly_rate: 100,
                    on_cost_percentage: 30,
                  },
                ],
                non_labor_estimates: [],
              },
            },
          });
        }

        // Mock QueryCommand for rubros - return existing rubros for this baseline
        if (command.input?.KeyConditionExpression && tableName?.includes("rubros")) {
          return Promise.resolve({
            Items: [
              {
                pk: `PROJECT#${projectId}`,
                sk: `RUBRO#MOD-PM#${baselineId}#1`,
                metadata: {
                  baseline_id: baselineId,
                },
              },
            ],
          });
        }

        if (command.input?.Item && tableName?.includes("rubros")) {
          writtenRubros.push(command.input.Item);
          return Promise.resolve({});
        }

        if (command.input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        headers: {
          "x-idempotency-key": "test-key-double-456",
        },
        pathParameters: {
          projectId,
        },
        body: JSON.stringify({
          projectId,
          baseline_id: baselineId,
          owner: "test@example.com",
        }),
      });

      const response = await handoffHandler(event);

      // Handoff should succeed
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      
      // But rubros should NOT be seeded again (skipped due to existing baseline)
      expect(body.seededRubros).toBe(0);
      expect(writtenRubros.length).toBe(0);
    });
  });

  describe("Role-based canonical mapping", () => {
    it("should map various engineer roles to correct canonical IDs", async () => {
      const projectId = "P-roles123";
      const baselineId = "base_roles456";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId,
        isNewProject: true,
      });

      const writtenRubros: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        const hasKey = command.input?.Key;
        const pk = command.input?.Key?.pk;
        const sk = command.input?.Key?.sk;
        const tableName = command.input?.TableName;

        if (hasKey && pk?.startsWith("PROJECT#") && sk === "METADATA") {
          return Promise.resolve({ Item: undefined });
        }

        if (hasKey && pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        if (hasKey && pk?.startsWith("BASELINE#") && sk === "METADATA") {
          return Promise.resolve({
            Item: {
              pk: `BASELINE#${baselineId}`,
              sk: "METADATA",
              payload: {
                labor_estimates: [
                  {
                    role: "Ingeniero Soporte N1",
                    hours_per_month: 160,
                    fte_count: 1,
                    hourly_rate: 50,
                    // Should map to MOD-ING
                  },
                  {
                    role: "Ingeniero Soporte N2",
                    hours_per_month: 160,
                    fte_count: 1,
                    hourly_rate: 60,
                    // Should also map to MOD-ING
                  },
                  {
                    role: "Ingeniero Soporte N3",
                    hours_per_month: 160,
                    fte_count: 1,
                    hourly_rate: 70,
                    // Should also map to MOD-ING
                  },
                ],
              },
            },
          });
        }

        if (command.input?.KeyConditionExpression && tableName?.includes("rubros")) {
          return Promise.resolve({ Items: [] });
        }

        if (command.input?.Item && tableName?.includes("rubros")) {
          writtenRubros.push(command.input.Item);
          return Promise.resolve({});
        }

        if (command.input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        headers: {
          "x-idempotency-key": "test-key-roles-789",
        },
        pathParameters: {
          projectId,
        },
        body: JSON.stringify({
          projectId,
          baseline_id: baselineId,
        }),
      });

      const response = await handoffHandler(event);

      expect(response.statusCode).toBe(201);
      
      // All three engineer roles should map to MOD-ING
      const ingRubros = writtenRubros.filter((r) => r.metadata?.linea_codigo === "MOD-ING");
      expect(ingRubros.length).toBe(3);
      
      ingRubros.forEach((rubro, index) => {
        expect(rubro.metadata.linea_codigo).toBe("MOD-ING");
        expect(rubro.metadata.role).toContain("Ingeniero Soporte");
      });
    });
  });
});
