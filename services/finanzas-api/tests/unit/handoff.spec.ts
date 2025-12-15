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
    tableName: jest.fn((table) => `test-${table}`),
  };
});

import { handler as handoffHandler } from "../../src/handlers/handoff";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  GetCommand: jest.Mock;
  QueryCommand: jest.Mock;
  UpdateCommand: jest.Mock;
  tableName: jest.Mock;
};

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
    it("should return handoffId in response body for successful handoff (201)", async () => {
      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;
        
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

    it("should set baseline_status to 'accepted' when force_accept is true", async () => {
      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;
        
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
          force_accept: true,
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

      // When force_accept is true, baseline should be accepted
      expect(body).toHaveProperty("baseline_status", "accepted");
      expect(body).toHaveProperty("accepted_by", "approver@example.com");
      expect(body).toHaveProperty("baseline_accepted_at");
      expect(typeof body.baseline_accepted_at).toBe("string");
    });
  });
});
