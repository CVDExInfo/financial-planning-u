import {
  APIGatewayProxyEventV2,
} from "aws-lambda";

// Mock auth functions
jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockReturnValue("sdmt@example.com"),
}));

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => {
  const sendDdb = jest.fn();
  return {
    ddb: { send: sendDdb },
    sendDdb,
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
    tableName: jest.fn((table) => `test-${table}`),
  };
});

import { handler as rejectBaselineHandler } from "../../src/handlers/rejectBaseline";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  GetCommand: jest.Mock;
  UpdateCommand: jest.Mock;
  tableName: jest.Mock;
};

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "PATCH /projects/{projectId}/reject-baseline",
  rawPath: "/projects/P-test123/reject-baseline",
  rawQueryString: "",
  headers: {},
  pathParameters: {
    projectId: "P-test123",
  },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "PATCH",
      path: "/projects/P-test123/reject-baseline",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "PATCH /projects/{projectId}/reject-baseline",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("RejectBaseline Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Baseline Rejection", () => {
    it("should reject a baseline and update project metadata", async () => {
      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        // GetCommand for project - return existing project with baseline
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              name: 'Test Project',
              baseline_id: 'base_test123',
              baseline_status: 'handed_off',
            },
          });
        }
        
        // UpdateCommand - return updated attributes
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              name: 'Test Project',
              code: 'P-test123',
              client: 'Test Client',
              baseline_id: 'base_test123',
              baseline_status: 'rejected',
              rejected_by: 'sdmt@example.com',
              baseline_rejected_at: '2025-01-01T00:00:00.000Z',
              rejection_comment: 'Budget too high',
              status: 'active',
              currency: 'USD',
              mod_total: 100000,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
            },
          });
        }
        
        // PutCommand for audit log - just succeed
        if (input?.TableName?.includes('audit')) {
          return Promise.resolve({});
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
          rejected_by: "sdmt@example.com",
          comment: "Budget too high",
        }),
      });

      const response = await rejectBaselineHandler(event);

      // Verify status code
      expect(response.statusCode).toBe(200);

      // Parse response body
      const body = JSON.parse(response.body);

      // Verify rejection fields are set
      expect(body).toHaveProperty("baseline_status", "rejected");
      expect(body).toHaveProperty("rejected_by", "sdmt@example.com");
      expect(body).toHaveProperty("baseline_rejected_at");
      expect(body).toHaveProperty("rejection_comment", "Budget too high");
      expect(typeof body.baseline_rejected_at).toBe("string");
      
      // Verify project fields are included
      expect(body).toHaveProperty("projectId", "P-test123");
      expect(body).toHaveProperty("baselineId", "base_test123");
    });

    it("should accept rejection without comment", async () => {
      // Mock DynamoDB responses
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              baseline_id: 'base_test123',
              baseline_status: 'handed_off',
            },
          });
        }
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              id: 'P-test123',
              baseline_id: 'base_test123',
              baseline_status: 'rejected',
              rejected_by: 'sdmt@example.com',
              baseline_rejected_at: '2025-01-01T00:00:00.000Z',
              rejection_comment: '',
            },
          });
        }
        
        if (input?.TableName?.includes('audit')) {
          return Promise.resolve({});
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
        }),
      });

      const response = await rejectBaselineHandler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("baseline_status", "rejected");
      expect(body).toHaveProperty("rejection_comment", "");
    });

    it("should return 404 if project does not exist", async () => {
      // Mock DynamoDB to return no project
      dynamo.ddb.send.mockImplementation((command: any) => {
        const commandName = command.constructor.name || command.input?.constructor?.name;
        
        if (commandName === 'GetCommand') {
          return Promise.resolve({ Item: undefined });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
          comment: "Budget too high",
        }),
      });

      const response = await rejectBaselineHandler(event);

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
    });

    it("should return 400 if baseline_id does not match project", async () => {
      // Mock DynamoDB to return project with different baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'base_different',
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
          comment: "Budget too high",
        }),
      });

      const response = await rejectBaselineHandler(event);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("baseline_id mismatch");
    });

    it("should require baseline_id in request body", async () => {
      const event = baseEvent({
        body: JSON.stringify({
          comment: "Budget too high",
        }),
      });

      const response = await rejectBaselineHandler(event);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("baseline_id is required");
    });
  });
});
