/**
 * Unit tests for baseline collision defensive check in projects.ts handoff handler
 * 
 * These tests verify that the handler properly refuses to overwrite METADATA
 * when an existing baseline differs from the incoming baseline.
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "../../src/handlers/projects";

// Mock modules
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserContext: jest.fn(() => Promise.resolve({ email: "test@example.com", roles: ["SDM"] })),
}));

jest.mock("../../src/lib/dynamo", () => {
  const mockSend = jest.fn();
  return {
    ddb: { send: mockSend },
    sendDdb: mockSend,
    tableName: jest.fn((name: string) => `test-${name}`),
    PutCommand: jest.fn((params) => ({ type: "PutCommand", ...params })),
    GetCommand: jest.fn((params) => ({ type: "GetCommand", ...params })),
    QueryCommand: jest.fn((params) => ({ type: "QueryCommand", ...params })),
    ScanCommand: jest.fn((params) => ({ type: "ScanCommand", ...params })),
  };
});

jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
}));

jest.mock("../../src/lib/projects-handoff", () => ({
  resolveProjectForHandoff: jest.fn(),
  IdempotencyConflictError: class IdempotencyConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "IdempotencyConflictError";
    }
  },
}));

const mockSendDdb = jest.requireMock("../../src/lib/dynamo").sendDdb;
const mockResolveProjectForHandoff = jest.requireMock("../../src/lib/projects-handoff").resolveProjectForHandoff;
const { IdempotencyConflictError } = jest.requireMock("../../src/lib/projects-handoff");

describe("Projects handoff baseline collision defensive check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (
    projectId: string,
    body: Record<string, unknown>,
    idempotencyKey: string
  ): APIGatewayProxyEventV2 => {
    return {
      version: "2.0",
      routeKey: "PUT /projects/{projectId}/handoff",
      rawPath: `/projects/${projectId}/handoff`,
      rawQueryString: "",
      headers: {
        "x-idempotency-key": idempotencyKey,
      },
      requestContext: {
        accountId: "123456789012",
        apiId: "test-api",
        domainName: "test.execute-api.us-east-1.amazonaws.com",
        domainPrefix: "test",
        http: {
          method: "PUT",
          path: `/projects/${projectId}/handoff`,
          protocol: "HTTP/1.1",
          sourceIp: "1.2.3.4",
          userAgent: "test-agent",
        },
        requestId: "test-request-id",
        routeKey: "PUT /projects/{projectId}/handoff",
        stage: "$default",
        time: "01/Jan/2025:00:00:00 +0000",
        timeEpoch: 1704067200000,
        authorizer: {
          jwt: {
            claims: {
              email: "test@example.com",
            },
            scopes: [],
          },
        },
      },
      pathParameters: {
        projectId,
      },
      body: JSON.stringify(body),
      isBase64Encoded: false,
    } as any;
  };

  it("should return 409 when attempting to overwrite METADATA with different baseline", async () => {
    const existingBaseline = "base_old123";
    const newBaseline = "base_new456";
    const projectId = "P-EXISTING";

    // Mock resolveProjectForHandoff to return the existing project
    mockResolveProjectForHandoff.mockResolvedValue({
      resolvedProjectId: projectId,
      existingProjectMetadata: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
        baseline_id: existingBaseline,
        name: "Existing Project",
      },
      isNewProject: false,
      baselineId: newBaseline,
    });

    // Mock sendDdb for various operations
    mockSendDdb.mockImplementation((command: any) => {
      // Existing project check
      if (command.type === "GetCommand" && command.input?.Key?.sk === "METADATA") {
        // Return existing metadata with old baseline
        return Promise.resolve({
          Item: {
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
            baseline_id: existingBaseline,
            name: "Existing Project",
          },
        });
      }

      // Idempotency check
      if (command.type === "GetCommand" && command.input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
        return Promise.resolve({ Item: undefined });
      }

      return Promise.resolve({ Item: undefined });
    });

    const event = createMockEvent(
      projectId,
      {
        baseline: {
          baselineId: newBaseline,
          project_name: "New Baseline Project",
        },
      },
      "test-idempotency-key-1"
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("baseline collision detected");
    expect(body.existingBaselineId).toBe(existingBaseline);
    expect(body.newBaselineId).toBe(newBaseline);
  });

  it("should succeed when baseline matches existing METADATA", async () => {
    const baseline = "base_abc123";
    const projectId = "P-EXISTING";

    mockResolveProjectForHandoff.mockResolvedValue({
      resolvedProjectId: projectId,
      existingProjectMetadata: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
        baseline_id: baseline,
        name: "Existing Project",
      },
      isNewProject: false,
      baselineId: baseline,
    });

    // Mock sendDdb for various operations
    mockSendDdb.mockImplementation((command: any) => {
      // Existing project check - return same baseline
      if (command.type === "GetCommand" && command.input?.Key?.sk === "METADATA") {
        return Promise.resolve({
          Item: {
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
            baseline_id: baseline,
            name: "Existing Project",
          },
        });
      }

      // Idempotency check
      if (command.type === "GetCommand" && command.input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
        return Promise.resolve({ Item: undefined });
      }

      // Other operations
      return Promise.resolve({ Items: [] });
    });

    const event = createMockEvent(
      projectId,
      {
        baseline: {
          baselineId: baseline,
          project_name: "Same Baseline Project",
        },
      },
      "test-idempotency-key-2"
    );

    const response = await handler(event);

    // Should succeed (not 409)
    expect(response.statusCode).not.toBe(409);
    expect(response.statusCode).toBe(201);
  });

  it("should succeed when no existing METADATA exists", async () => {
    const baseline = "base_new789";
    const projectId = "P-NEW";

    mockResolveProjectForHandoff.mockResolvedValue({
      resolvedProjectId: projectId,
      existingProjectMetadata: undefined,
      isNewProject: true,
      baselineId: baseline,
    });

    // Mock sendDdb for various operations
    mockSendDdb.mockImplementation((command: any) => {
      // No existing project - return empty
      if (command.type === "GetCommand" && command.input?.Key?.sk === "METADATA") {
        return Promise.resolve({ Item: undefined });
      }

      // Idempotency check
      if (command.type === "GetCommand" && command.input?.Key?.pk === "IDEMPOTENCY#HANDOFF") {
        return Promise.resolve({ Item: undefined });
      }

      return Promise.resolve({ Items: [] });
    });

    const event = createMockEvent(
      projectId,
      {
        baseline: {
          baselineId: baseline,
          project_name: "New Project",
        },
      },
      "test-idempotency-key-3"
    );

    const response = await handler(event);

    // Should succeed
    expect(response.statusCode).toBe(201);
  });

  it("should return 409 when IdempotencyConflictError is thrown", async () => {
    const projectId = "P-TEST";

    mockResolveProjectForHandoff.mockRejectedValue(
      new IdempotencyConflictError("Idempotency key was previously used with a different baseline")
    );

    const event = createMockEvent(
      projectId,
      {
        baseline: {
          baselineId: "base_conflict",
          project_name: "Conflict Project",
        },
      },
      "test-idempotency-key-conflict"
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("idempotency conflict");
    expect(body.message).toContain("Idempotency key");
  });
});
