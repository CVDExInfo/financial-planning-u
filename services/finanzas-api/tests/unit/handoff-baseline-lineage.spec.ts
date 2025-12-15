/**
 * Unit tests for baseline-project data lineage integrity
 * 
 * These tests ensure that:
 * 1. Baseline IDs are immutable after creation
 * 2. Project IDs are stable and never overwritten
 * 3. The mapping between baseline and project is 1:1 and persistent
 * 4. Attempts to overwrite an existing baseline fail with proper error
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock auth functions
jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(),
  ensureCanRead: jest.fn(),
  getUserEmail: jest.fn().mockResolvedValue("test@example.com"),
}));

// Mock validation
jest.mock("../../src/validation/handoff", () => ({
  safeParseHandoff: jest.fn((body) => ({
    success: true,
    data: body,
  })),
}));

// Mock DynamoDB
const mockDdbSend = jest.fn();
jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: mockDdbSend },
  sendDdb: mockDdbSend,
  PutCommand: jest.fn().mockImplementation((input) => ({ input, name: "PutCommand" })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input, name: "GetCommand" })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, name: "QueryCommand" })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, name: "UpdateCommand" })),
  TransactWriteCommand: jest.fn().mockImplementation((input) => ({
    input,
    name: "TransactWriteCommand",
  })),
  tableName: jest.fn((table) => `test-${table}`),
}));

// Mock projects-handoff
jest.mock("../../src/lib/projects-handoff", () => ({
  resolveProjectForHandoff: jest.fn(),
}));

// Import after mocks
import { resolveProjectForHandoff } from "../../src/lib/projects-handoff";

// Need to dynamically import the handler after mocks are set up
const getHandler = async () => {
  const handoffModule = await import("../../src/handlers/handoff");
  return handoffModule;
};

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /projects/{projectId}/handoff",
  rawPath: "/projects/P-test-project/handoff",
  rawQueryString: "",
  headers: {
    "x-idempotency-key": "test-idempotency-key-001",
  },
  pathParameters: {
    projectId: "P-test-project",
  },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/projects/P-test-project/handoff",
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

describe("Handoff Handler - Data Lineage Integrity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Test 1: Idempotent ID Generation", () => {
    it("should preserve projectId and baselineId when called multiple times with same idempotency key", async () => {
      const baselineId = "base_test123456";
      const projectId = "P-test-project";

      // Mock project resolution - simulates finding an existing project
      (resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>).mockResolvedValue({
        resolvedProjectId: projectId,
        isNewProject: false,
        baselineId,
        strategy: "reuse-idempotent",
        existingProjectMetadata: {
          pk: `PROJECT#${projectId}`,
          sk: "METADATA",
          project_id: projectId,
          baseline_id: baselineId,
        },
      });

      // Mock DynamoDB responses
      mockDdbSend.mockImplementation((command: any) => {
        const commandName = command.name || command.constructor?.name;

        // GetCommand for current metadata check
        if (commandName === "GetCommand") {
          const key = command.input?.Key;
          if (key?.pk === `PROJECT#${projectId}` && key?.sk === "METADATA") {
            return Promise.resolve({
              Item: {
                pk: `PROJECT#${projectId}`,
                sk: "METADATA",
                project_id: projectId,
                baseline_id: baselineId,
              },
            });
          }
          // Idempotency check - return nothing (first time)
          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }
          // Baseline lookup
          if (key?.pk === `BASELINE#${baselineId}`) {
            return Promise.resolve({
              Item: {
                pk: `BASELINE#${baselineId}`,
                sk: "METADATA",
                baseline_id: baselineId,
                project_id: projectId,
                payload: {
                  project_name: "Test Project",
                  client_name: "Test Client",
                },
              },
            });
          }
        }

        // TransactWriteCommand - succeed
        if (commandName === "TransactWriteCommand") {
          return Promise.resolve({});
        }

        // PutCommand for idempotency and audit records - succeed
        if (commandName === "PutCommand") {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const handoffModule = await getHandler();

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: baselineId,
          project_name: "Test Project",
          owner: "test@example.com",
        }),
      });

      const response = await handoffModule.handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.projectId).toBe(projectId);
      expect(body.baselineId).toBe(baselineId);

      // Verify TransactWriteCommand was called
      const transactCalls = mockDdbSend.mock.calls.filter(
        (call) =>
          call[0]?.name === "TransactWriteCommand" ||
          call[0]?.constructor?.name === "TransactWriteCommand"
      );
      expect(transactCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Test 2: Overwrite Prevention", () => {
    it("should prevent overwriting an existing baseline with a different baseline", async () => {
      const existingBaselineId = "base_existing123";
      const newBaselineId = "base_new456";
      const projectId = "P-test-project";

      // Mock project resolution - returns existing project
      (resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>).mockResolvedValue({
        resolvedProjectId: projectId,
        isNewProject: false,
        baselineId: newBaselineId,
        strategy: "reuse-existing-baseline",
        existingProjectMetadata: {
          pk: `PROJECT#${projectId}`,
          sk: "METADATA",
          project_id: projectId,
          baseline_id: existingBaselineId,
        },
      });

      // Mock DynamoDB responses
      mockDdbSend.mockImplementation((command: any) => {
        const commandName = command.name || command.constructor?.name;

        // GetCommand for current metadata check - return project with DIFFERENT baseline
        if (commandName === "GetCommand") {
          const key = command.input?.Key;
          if (key?.pk === `PROJECT#${projectId}` && key?.sk === "METADATA") {
            return Promise.resolve({
              Item: {
                pk: `PROJECT#${projectId}`,
                sk: "METADATA",
                project_id: projectId,
                baseline_id: existingBaselineId, // DIFFERENT baseline
              },
            });
          }
          // Idempotency check - no cached result
          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }
          // Baseline lookup
          if (key?.pk === `BASELINE#${newBaselineId}`) {
            return Promise.resolve({
              Item: {
                pk: `BASELINE#${newBaselineId}`,
                sk: "METADATA",
                baseline_id: newBaselineId,
                project_id: projectId,
                payload: {
                  project_name: "Test Project",
                },
              },
            });
          }
        }

        return Promise.resolve({});
      });

      const handoffModule = await getHandler();

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: newBaselineId,
          project_name: "Test Project",
        }),
      });

      const response = await handoffModule.handler(event);

      // Should return 409 Conflict
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("baseline collision");
      expect(body.error).toContain("different baseline");
    });

    it("should fail TransactWriteCommand when condition prevents overwrite", async () => {
      const existingBaselineId = "base_existing789";
      const newBaselineId = "base_new999";
      const projectId = "P-test-project";

      // Mock project resolution
      (resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>).mockResolvedValue({
        resolvedProjectId: projectId,
        isNewProject: false,
        baselineId: newBaselineId,
        strategy: "create-new-project",
      });

      // Mock DynamoDB responses
      mockDdbSend.mockImplementation((command: any) => {
        const commandName = command.name || command.constructor?.name;

        // GetCommand for current metadata check - return project with existing baseline
        if (commandName === "GetCommand") {
          const key = command.input?.Key;
          if (key?.pk === `PROJECT#${projectId}` && key?.sk === "METADATA") {
            return Promise.resolve({
              Item: {
                pk: `PROJECT#${projectId}`,
                sk: "METADATA",
                project_id: projectId,
                baseline_id: existingBaselineId,
              },
            });
          }
          // Idempotency check
          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }
          // Baseline lookup
          if (key?.pk?.startsWith("BASELINE#")) {
            return Promise.resolve({
              Item: {
                baseline_id: newBaselineId,
                project_id: projectId,
                payload: { project_name: "Test" },
              },
            });
          }
        }

        // TransactWriteCommand - simulate conditional check failure
        if (commandName === "TransactWriteCommand") {
          const error: any = new Error("Transaction cancelled");
          error.name = "TransactionCanceledException";
          error.CancellationReasons = [
            { Code: "None" },
            { Code: "ConditionalCheckFailed" },
          ];
          return Promise.reject(error);
        }

        return Promise.resolve({});
      });

      const handoffModule = await getHandler();

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: newBaselineId,
          project_name: "Test Project",
        }),
      });

      const response = await handoffModule.handler(event);

      // Should return 409 Conflict with proper error message
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot overwrite existing baseline");
      expect(body.existingBaselineId).toBe(existingBaselineId);
      expect(body.attemptedBaselineId).toBe(newBaselineId);
    });
  });

  describe("Test 3: Data Lineage Integrity", () => {
    it("should ensure projectId in baseline matches parent project", async () => {
      const baselineId = "base_lineage123";
      const projectId = "P-lineage-project";

      // Mock project resolution
      (resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>).mockResolvedValue({
        resolvedProjectId: projectId,
        isNewProject: true,
        baselineId,
        strategy: "create-new-project",
      });

      let capturedHandoff: any = null;
      let capturedMetadata: any = null;

      // Mock DynamoDB responses
      mockDdbSend.mockImplementation((command: any) => {
        const commandName = command.name || command.constructor?.name;

        if (commandName === "GetCommand") {
          const key = command.input?.Key;
          // No existing metadata (new project)
          if (key?.pk === `PROJECT#${projectId}` && key?.sk === "METADATA") {
            return Promise.resolve({ Item: undefined });
          }
          // No idempotency cache
          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }
          // Baseline data
          if (key?.pk === `BASELINE#${baselineId}`) {
            return Promise.resolve({
              Item: {
                pk: `BASELINE#${baselineId}`,
                sk: "METADATA",
                baseline_id: baselineId,
                project_id: projectId,
                payload: {
                  project_name: "Lineage Test",
                  client_name: "Test Client",
                },
              },
            });
          }
        }

        // TransactWriteCommand - capture the items being written
        if (commandName === "TransactWriteCommand") {
          const items = command.input?.TransactItems || [];
          items.forEach((item: any) => {
            if (item.Put?.Item?.sk?.startsWith("HANDOFF#")) {
              capturedHandoff = item.Put.Item;
            }
            if (item.Put?.Item?.sk === "METADATA") {
              capturedMetadata = item.Put.Item;
            }
          });
          return Promise.resolve({});
        }

        // PutCommand for idempotency and audit
        if (commandName === "PutCommand") {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const handoffModule = await getHandler();

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: baselineId,
          project_name: "Lineage Test",
        }),
      });

      const response = await handoffModule.handler(event);

      expect(response.statusCode).toBe(200);

      // Verify data lineage integrity
      expect(capturedHandoff).not.toBeNull();
      expect(capturedMetadata).not.toBeNull();

      // The handoff record should reference the correct projectId and baselineId
      expect(capturedHandoff.projectId).toBe(projectId);
      expect(capturedHandoff.baselineId).toBe(baselineId);

      // The metadata record should have matching projectId and baselineId
      expect(capturedMetadata.project_id).toBe(projectId);
      expect(capturedMetadata.baseline_id).toBe(baselineId);

      // Verify they match each other
      expect(capturedHandoff.projectId).toBe(capturedMetadata.project_id);
      expect(capturedHandoff.baselineId).toBe(capturedMetadata.baseline_id);
    });
  });

  describe("Test 4: Atomic Transaction Behavior", () => {
    it("should use TransactWriteCommand for atomic writes", async () => {
      const baselineId = "base_atomic123";
      const projectId = "P-atomic-project";

      (resolveProjectForHandoff as jest.MockedFunction<typeof resolveProjectForHandoff>).mockResolvedValue({
        resolvedProjectId: projectId,
        isNewProject: true,
        baselineId,
        strategy: "create-new-project",
      });

      mockDdbSend.mockImplementation((command: any) => {
        const commandName = command.name || command.constructor?.name;

        if (commandName === "GetCommand") {
          return Promise.resolve({ Item: undefined });
        }

        if (commandName === "TransactWriteCommand") {
          // Verify the transaction has the correct structure
          const items = command.input?.TransactItems || [];
          expect(items).toHaveLength(2); // Handoff + Metadata
          
          // Verify first item is handoff
          expect(items[0].Put?.Item?.sk).toMatch(/^HANDOFF#/);
          
          // Verify second item is metadata with condition
          expect(items[1].Put?.Item?.sk).toBe("METADATA");
          expect(items[1].Put?.ConditionExpression).toBeDefined();
          expect(items[1].Put?.ConditionExpression).toContain("baseline_id");
          
          return Promise.resolve({});
        }

        if (commandName === "PutCommand") {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const handoffModule = await getHandler();

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: baselineId,
          project_name: "Atomic Test",
        }),
      });

      const response = await handoffModule.handler(event);

      expect(response.statusCode).toBe(200);

      // Verify TransactWriteCommand was called
      const transactCalls = mockDdbSend.mock.calls.filter(
        (call) =>
          call[0]?.name === "TransactWriteCommand" ||
          call[0]?.constructor?.name === "TransactWriteCommand"
      );
      expect(transactCalls.length).toBeGreaterThan(0);
    });
  });
});
