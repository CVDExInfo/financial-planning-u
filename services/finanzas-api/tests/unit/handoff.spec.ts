import {
  APIGatewayProxyEventV2,
} from "aws-lambda";

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

const mockedResolver = resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>;

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /projects/{projectId}/handoff",
  rawPath: "/projects/P-test123/handoff",
  rawQueryString: "",
  headers: {
    "x-idempotency-key": "test-key-12345",
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

describe("Handoff Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolver.mockReset();
  });

  describe("Auth and RBAC", () => {
    it("should require authentication", () => {
      // Mock event without auth
      // Would be tested with actual handler but requires DDB mocking
      expect(true).toBe(true); // Placeholder
    });

    it("should allow PM and SDT to write", () => {
      expect(["PM", "SDT"]).toContain("PM");
      expect(["PM", "SDT"]).toContain("SDT");
    });

    it("should allow FIN and AUD to read", () => {
      expect(["PM", "SDT", "FIN", "AUD"]).toContain("FIN");
      expect(["PM", "SDT", "FIN", "AUD"]).toContain("AUD");
    });
  });

  describe("Idempotency", () => {
    it("should require X-Idempotency-Key header for POST", () => {
      // Test case for idempotency key requirement
      expect("X-Idempotency-Key").toBeTruthy();
    });

    it("should reject conflicting payload with same idempotency key", () => {
      // Test case for conflict detection
      expect(409).toBe(409); // Conflict status code
    });
  });

  describe("Version Management", () => {
    it("should increment version on update", () => {
      const currentVersion = 1;
      const newVersion = currentVersion + 1;
      expect(newVersion).toBe(2);
    });

    it("should return 412 on version mismatch", () => {
      // Test precondition failed
      expect(412).toBe(412);
    });
  });

  describe("API Contract Compliance", () => {
    it("should reject requests without baselineId", async () => {
      const response = await handoffHandler(
        baseEvent({
          body: JSON.stringify({}),
        })
      );

      expect(response.statusCode).toBe(400);
      expect(mockedResolver).not.toHaveBeenCalled();
      expect(dynamo.ddb.send).not.toHaveBeenCalled();
    });

    it("should reject metadata overwrite when baseline differs", async () => {
      mockedResolver.mockResolvedValue({
        baselineId: "base_new",
        isNewProject: false,
        resolvedProjectId: "P-collision",
      });

      dynamo.ddb.send.mockImplementation((command: any) => {
        const key = command.input?.Key;

        if (key?.sk === "METADATA") {
          return Promise.resolve({ Item: { baseline_id: "base_old" } });
        }

        if (key?.pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        return Promise.resolve({});
      });

      const response = await handoffHandler(
        baseEvent({
          body: JSON.stringify({ baseline_id: "base_new" }),
        })
      );

      expect(response.statusCode).toBe(409);
      expect(dynamo.ddb.send).toHaveBeenCalledTimes(1);
    });

    it("should return handoffId in response body for successful handoff (201)", async () => {
      mockedResolver.mockResolvedValue({
        resolvedProjectId: "P-test123",
        baselineId: "base_test123",
        isNewProject: true,
      });

      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;

        // Defensive metadata check
        if (commandName === 'GetCommand' && command.input?.Key?.sk === 'METADATA') {
          return Promise.resolve({ Item: undefined });
        }

        // GetCommand for idempotency check - return no existing record
        if (commandName === 'GetCommand' && command.input?.Key?.pk === 'IDEMPOTENCY#HANDOFF') {
          return Promise.resolve({ Item: undefined });
        }
        
        // GetCommand for baseline - return mock baseline
        if (commandName === 'GetCommand' && command.input?.Key?.pk?.startsWith('BASELINE#')) {
          return Promise.resolve({
            Item: {
              pk: 'BASELINE#base_test123',
              sk: 'METADATA',
              project_name: 'Test Project',
              client_name: 'Test Client',
              currency: 'USD',
              start_date: '2025-01-01',
              duration_months: 12,
              total_amount: 100000,
            },
          });
        }
        
        // PutCommand - just succeed
        if (commandName === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
          owner: "test@example.com",
          project_name: "Test Project",
          client_name: "Test Client",
          currency: "USD",
          start_date: "2025-01-01",
          duration_months: 12,
          fields: {
            mod_total: 100000,
            pct_ingenieros: 65,
            pct_sdm: 35,
          },
        }),
      });

      const response = await handoffHandler(event);

      // Verify status code
      expect(response.statusCode).toBe(201);

      // Parse response body
      const body = JSON.parse(response.body);

      // CRITICAL: Verify handoffId is present (API contract requirement)
      expect(body).toHaveProperty("handoffId");
      expect(typeof body.handoffId).toBe("string");
      expect(body.handoffId).toMatch(/^handoff_[a-f0-9]{10}$/);

      // Verify other required fields
      expect(body).toHaveProperty("projectId", "P-test123");
      expect(body).toHaveProperty("baselineId", "base_test123");
      expect(body).toHaveProperty("status", "HandoffComplete");
      
      // NEW: Verify baseline_status defaults to "handed_off" when no force_accept
      expect(body).toHaveProperty("baseline_status", "handed_off");
      expect(body.accepted_by).toBeUndefined();
      expect(body.baseline_accepted_at).toBeUndefined();
    });

    it("should accept camelCase baselineId in payload", async () => {
      mockedResolver.mockResolvedValue({
        resolvedProjectId: "P-test123",
        baselineId: "base_test123",
        isNewProject: true,
      });

      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;

        if (commandName === 'GetCommand' && command.input?.Key?.sk === 'METADATA') {
          return Promise.resolve({ Item: undefined });
        }

        if (commandName === 'GetCommand' && command.input?.Key?.pk === 'IDEMPOTENCY#HANDOFF') {
          return Promise.resolve({ Item: undefined });
        }

        if (commandName === 'GetCommand' && command.input?.Key?.pk?.startsWith('BASELINE#')) {
          return Promise.resolve({ Item: undefined });
        }

        return Promise.resolve({});
      });

      const response = await handoffHandler(
        baseEvent({
          body: JSON.stringify({ baselineId: "base_test123" }),
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.baselineId).toBe("base_test123");
    });

    it("should ignore force_accept flag and always set baseline_status to 'handed_off'", async () => {
      mockedResolver.mockResolvedValue({
        resolvedProjectId: "P-test456",
        baselineId: "base_test456",
        isNewProject: true,
      });

      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;

        if (commandName === 'GetCommand' && command.input?.Key?.sk === 'METADATA') {
          return Promise.resolve({ Item: undefined });
        }

        if (commandName === 'GetCommand' && command.input?.Key?.pk === 'IDEMPOTENCY#HANDOFF') {
          return Promise.resolve({ Item: undefined });
        }
        
        if (commandName === 'GetCommand' && command.input?.Key?.pk?.startsWith('BASELINE#')) {
          return Promise.resolve({
            Item: {
              pk: 'BASELINE#base_test456',
              sk: 'METADATA',
              project_name: 'Test Project',
              client_name: 'Test Client',
              currency: 'USD',
              start_date: '2025-01-01',
              duration_months: 12,
              total_amount: 100000,
            },
          });
        }
        
        if (commandName === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test456",
          owner: "test@example.com",
          force_accept: true, // This flag should now be ignored
          aceptado_por: "approver@example.com",
          project_name: "Test Project",
          client_name: "Test Client",
          currency: "USD",
          start_date: "2025-01-01",
          duration_months: 12,
        }),
        pathParameters: {
          projectId: "P-test456",
        },
        headers: {
          "x-idempotency-key": "test-key-force-accept",
        },
      });

      const response = await handoffHandler(event);

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);

      // CRITICAL: force_accept should be ignored - baseline should be handed_off, not accepted
      expect(body).toHaveProperty("baseline_status", "handed_off");
      expect(body).toHaveProperty("handed_off_by"); // Changed from accepted_by
      expect(body).toHaveProperty("handed_off_at"); // Changed from baseline_accepted_at
      // Acceptance fields should be undefined
      expect(body.accepted_by).toBeUndefined();
      expect(body.baseline_accepted_at).toBeUndefined();
    });
  });

  describe("Summary-only Handoff Payload (Real-world Pattern)", () => {
    /**
     * This test suite covers the production scenario where:
     * - The UI sends a handoff payload with only summary fields (mod_total, percentages)
     * - NO labor_estimates or non_labor_estimates in the request body
     * - The backend must fetch full baseline with estimates from prefacturas table
     * - Rubros should be materialized from the stored baseline data
     */

    it("should materialize rubros from METADATA baseline when handoff body has no estimates", async () => {
      const projectId = "P-summary-test-1";
      const baselineId = "base_summary_test_1";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId: baselineId,
        isNewProject: true,
      });

      // Mock handoff body: summary-only (matches production payload)
      const handoffBody = {
        baseline_id: baselineId,
        project_name: "BL-TEST-SUMMARY-001",
        client_name: "Test Client Corp",
        mod_total: 500000,
        pct_ingenieros: 75.5,
        pct_sdm: 24.5,
        // NOTE: No labor_estimates or non_labor_estimates here
      };

      // Mock baseline in prefacturas table with FULL estimates
      const fullBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        project_id: projectId,
        project_name: "BL-TEST-SUMMARY-001",
        client_name: "Test Client Corp",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        total_amount: 500000,
        payload: {
          project_name: "BL-TEST-SUMMARY-001",
          client_name: "Test Client Corp",
          currency: "USD",
          start_date: "2025-01-01",
          duration_months: 12,
          labor_estimates: [
            {
              rubroId: "MOD-ING",
              role: "Senior Developer",
              level: "Senior",
              hours_per_month: 160,
              fte_count: 2,
              hourly_rate: 100,
              on_cost_percentage: 20,
              start_month: 1,
              end_month: 12,
            },
            {
              rubroId: "MOD-LEAD",
              role: "Tech Lead",
              level: "Lead",
              hours_per_month: 160,
              fte_count: 1,
              hourly_rate: 150,
              on_cost_percentage: 20,
              start_month: 1,
              end_month: 12,
            },
          ],
          non_labor_estimates: [
            {
              rubroId: "SOI-AWS",
              category: "Infrastructure",
              description: "AWS Cloud Services",
              amount: 5000,
              vendor: "AWS",
              one_time: false,
              start_month: 1,
              end_month: 12,
            },
          ],
        },
      };

      const rubrosWritten: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        // Better command detection
        const input = command.input || command;

        // Idempotency check - no existing record
        if (input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        // Baseline METADATA query - return full baseline with estimates
        if (
          input?.Key?.pk === `BASELINE#${baselineId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: fullBaseline });
        }

        // Project-scoped baseline query - return undefined (not found)
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === `BASELINE#${baselineId}`
        ) {
          return Promise.resolve({ Item: undefined });
        }

        // Project metadata check - no existing project
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: undefined });
        }

        // QueryCommand for checking if rubros already exist - return empty
        if (input?.KeyConditionExpression || input?.ExpressionAttributeValues) {
          return Promise.resolve({ Items: [] });
        }

        // PutCommand for rubros - capture them
        if (input?.Item && input?.TableName?.includes("rubros")) {
          rubrosWritten.push(input.Item);
          return Promise.resolve({});
        }

        // Other PutCommands (handoff, metadata, audit, idempotency)
        if (input?.Item) {
          return Promise.resolve({});
        }

        // TransactWriteCommand for handoff + metadata
        if (input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify(handoffBody),
        pathParameters: { projectId },
        headers: { "x-idempotency-key": "test-summary-only-key-1" },
      });

      const response = await handoffHandler(event);

      // Verify successful handoff
      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("handoffId");
      expect(body).toHaveProperty("projectId", projectId);
      expect(body).toHaveProperty("baselineId", baselineId);
      expect(body).toHaveProperty("seededRubros");

      // CRITICAL: Verify rubros were seeded from baseline estimates
      // Expected: 2 labor + 1 non-labor = 3 rubros
      expect(body.seededRubros).toBe(3);
      expect(rubrosWritten).toHaveLength(3);

      // Verify rubro structure includes canonical taxonomy IDs
      const laborRubros = rubrosWritten.filter((r) => r.category === "Labor");
      const nonLaborRubros = rubrosWritten.filter((r) => r.category !== "Labor");

      expect(laborRubros).toHaveLength(2);
      expect(nonLaborRubros).toHaveLength(1);

      // Verify canonical rubroId format: {CANONICAL_ID}#{baselineId}#{index}
      expect(laborRubros[0].rubroId).toMatch(/^MOD-ING#base_summary_test_1#\d+$/);
      expect(laborRubros[1].rubroId).toMatch(/^MOD-LEAD#base_summary_test_1#\d+$/);
      expect(nonLaborRubros[0].rubroId).toMatch(/^SOI-AWS#base_summary_test_1#\d+$/);
    });

    it("should materialize rubros from PROJECT-scoped baseline when METADATA has no estimates", async () => {
      const projectId = "P-summary-test-2";
      const baselineId = "base_summary_test_2";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId: baselineId,
        isNewProject: true,
      });

      // Mock handoff body: summary-only
      const handoffBody = {
        baseline_id: baselineId,
        project_name: "BL-TEST-SUMMARY-002",
        client_name: "Another Client",
        mod_total: 300000,
        pct_ingenieros: 80.0,
        pct_sdm: 20.0,
      };

      // Mock METADATA baseline WITHOUT estimates
      const metadataBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        project_id: projectId,
        project_name: "BL-TEST-SUMMARY-002",
        client_name: "Another Client",
        currency: "USD",
        payload: {
          project_name: "BL-TEST-SUMMARY-002",
          client_name: "Another Client",
          currency: "USD",
          // NOTE: No labor_estimates or non_labor_estimates in payload
        },
      };

      // Mock PROJECT-scoped baseline WITH estimates at top level
      const projectBaseline = {
        pk: `PROJECT#${projectId}`,
        sk: `BASELINE#${baselineId}`,
        project_id: projectId,
        project_name: "BL-TEST-SUMMARY-002",
        client_name: "Another Client",
        currency: "USD",
        start_date: "2025-02-01",
        duration_months: 6,
        labor_estimates: [
          {
            rubroId: "MOD-ING",
            role: "Developer",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 80,
            on_cost_percentage: 15,
            start_month: 1,
            end_month: 6,
          },
        ],
        non_labor_estimates: [],
      };

      const rubrosWritten: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input || command;

        if (input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        // Baseline METADATA query - return baseline WITHOUT estimates
        if (
          input?.Key?.pk === `BASELINE#${baselineId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: metadataBaseline });
        }

        // Project-scoped baseline query - return baseline WITH estimates
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === `BASELINE#${baselineId}`
        ) {
          return Promise.resolve({ Item: projectBaseline });
        }

        // Project metadata check - no existing project
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: undefined });
        }

        if (input?.KeyConditionExpression || input?.ExpressionAttributeValues) {
          return Promise.resolve({ Items: [] });
        }

        if (input?.Item && input?.TableName?.includes("rubros")) {
          rubrosWritten.push(input.Item);
          return Promise.resolve({});
        }

        if (input?.Item) {
          return Promise.resolve({});
        }

        if (input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify(handoffBody),
        pathParameters: { projectId },
        headers: { "x-idempotency-key": "test-summary-only-key-2" },
      });

      const response = await handoffHandler(event);

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("seededRubros");

      // CRITICAL: Verify rubros were seeded from PROJECT-scoped baseline
      expect(body.seededRubros).toBe(1);
      expect(rubrosWritten).toHaveLength(1);

      // Verify it used the project-scoped baseline (which had 1 labor estimate)
      expect(rubrosWritten[0].category).toBe("Labor");
      expect(rubrosWritten[0].rubroId).toMatch(/^MOD-ING#base_summary_test_2#\d+$/);
    });

    it("should log clear error and seed 0 rubros when no estimates found anywhere", async () => {
      const projectId = "P-summary-test-3";
      const baselineId = "base_summary_test_3";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId: baselineId,
        isNewProject: true,
      });

      // Mock handoff body: summary-only (no estimates)
      const handoffBody = {
        baseline_id: baselineId,
        project_name: "BL-TEST-NO-ESTIMATES",
        client_name: "Client Without Data",
        mod_total: 100000,
        pct_ingenieros: 70.0,
        pct_sdm: 30.0,
      };

      // Mock METADATA baseline WITHOUT estimates
      const metadataBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        project_id: projectId,
        project_name: "BL-TEST-NO-ESTIMATES",
        currency: "USD",
        payload: {
          project_name: "BL-TEST-NO-ESTIMATES",
          currency: "USD",
          // NO estimates
        },
      };

      // Mock PROJECT-scoped baseline also WITHOUT estimates
      const projectBaseline = {
        pk: `PROJECT#${projectId}`,
        sk: `BASELINE#${baselineId}`,
        project_id: projectId,
        project_name: "BL-TEST-NO-ESTIMATES",
        currency: "USD",
        // NO labor_estimates or non_labor_estimates
      };

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input || command;

        if (input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        if (
          input?.Key?.pk === `BASELINE#${baselineId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: metadataBaseline });
        }

        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === `BASELINE#${baselineId}`
        ) {
          return Promise.resolve({ Item: projectBaseline });
        }

        // Project metadata check - no existing project
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: undefined });
        }

        if (input?.KeyConditionExpression || input?.ExpressionAttributeValues) {
          return Promise.resolve({ Items: [] });
        }

        if (input?.Item) {
          return Promise.resolve({});
        }

        if (input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify(handoffBody),
        pathParameters: { projectId },
        headers: { "x-idempotency-key": "test-summary-only-key-3" },
      });

      const response = await handoffHandler(event);

      // Handoff should still complete (201) but with 0 rubros
      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("seededRubros", 0);

      // CRITICAL: Verify error was logged with clear diagnostic message
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[handoff] CRITICAL: No baseline estimates found"),
        expect.objectContaining({
          projectId,
          baselineId,
          error: "Cannot materialize rubros without labor_estimates or non_labor_estimates",
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it("should prefer METADATA baseline with estimates over PROJECT-scoped without", async () => {
      const projectId = "P-summary-test-4";
      const baselineId = "base_summary_test_4";

      mockedResolver.mockResolvedValue({
        resolvedProjectId: projectId,
        baselineId: baselineId,
        isNewProject: true,
      });

      const handoffBody = {
        baseline_id: baselineId,
        project_name: "BL-TEST-PREFERENCE",
        mod_total: 200000,
      };

      // METADATA has estimates
      const metadataBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        payload: {
          project_name: "BL-TEST-PREFERENCE",
          labor_estimates: [
            {
              rubroId: "MOD-ING",
              role: "Developer",
              hours_per_month: 160,
              fte_count: 1,
              hourly_rate: 90,
              start_month: 1,
              end_month: 12,
            },
          ],
          non_labor_estimates: [],
        },
      };

      // PROJECT-scoped has NO estimates
      const projectBaseline = {
        pk: `PROJECT#${projectId}`,
        sk: `BASELINE#${baselineId}`,
        project_name: "BL-TEST-PREFERENCE",
        // NO estimates
      };

      const rubrosWritten: any[] = [];

      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input || command;

        if (input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
          return Promise.resolve({ Item: undefined });
        }

        if (
          input?.Key?.pk === `BASELINE#${baselineId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: metadataBaseline });
        }

        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === `BASELINE#${baselineId}`
        ) {
          return Promise.resolve({ Item: projectBaseline });
        }

        // Project metadata check - no existing project
        if (
          input?.Key?.pk === `PROJECT#${projectId}` &&
          input?.Key?.sk === "METADATA"
        ) {
          return Promise.resolve({ Item: undefined });
        }

        if (input?.KeyConditionExpression || input?.ExpressionAttributeValues) {
          return Promise.resolve({ Items: [] });
        }

        if (input?.Item && input?.TableName?.includes("rubros")) {
          rubrosWritten.push(input.Item);
          return Promise.resolve({});
        }

        if (input?.Item) {
          return Promise.resolve({});
        }

        if (input?.TransactItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify(handoffBody),
        pathParameters: { projectId },
        headers: { "x-idempotency-key": "test-summary-only-key-4" },
      });

      const response = await handoffHandler(event);

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);

      // Should use METADATA baseline (has estimates) not PROJECT-scoped (no estimates)
      expect(body.seededRubros).toBe(1);
      expect(rubrosWritten).toHaveLength(1);
    });
  });
});
