import {
  APIGatewayProxyEventV2,
} from "aws-lambda";

// Mock auth functions
jest.mock("../../src/lib/auth", () => ({
  ensureSDMT: jest.fn(),
  getUserEmail: jest.fn().mockReturnValue("test@example.com"),
}));

// Mock queue functions
jest.mock("../../src/lib/queue", () => ({
  enqueueMaterialization: jest.fn(),
}));

// Mock dataHealth functions
jest.mock("../../src/lib/dataHealth", () => ({
  logDataHealth: jest.fn(),
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

import { handler as acceptBaselineHandler } from "../../src/handlers/acceptBaseline";

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
  routeKey: "PATCH /projects/{projectId}/accept-baseline",
  rawPath: "/projects/P-test123/accept-baseline",
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
      path: "/projects/P-test123/accept-baseline",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "PATCH /projects/{projectId}/accept-baseline",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("AcceptBaseline Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Baseline Acceptance", () => {
    it("should accept a baseline and update project metadata", async () => {
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
              baseline_status: 'accepted',
              accepted_by: 'test@example.com',
              baseline_accepted_at: '2025-01-01T00:00:00.000Z',
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
          accepted_by: "test@example.com",
        }),
      });

      const response = await acceptBaselineHandler(event);

      // Verify status code
      expect(response.statusCode).toBe(200);

      // Parse response body
      const body = JSON.parse(response.body);

      // Verify acceptance fields are set
      expect(body).toHaveProperty("baseline_status", "accepted");
      expect(body).toHaveProperty("accepted_by", "test@example.com");
      expect(body).toHaveProperty("baseline_accepted_at");
      expect(typeof body.baseline_accepted_at).toBe("string");
      
      // Verify project fields are included
      expect(body).toHaveProperty("projectId", "P-test123");
      expect(body).toHaveProperty("baselineId", "base_test123");
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
        }),
      });

      const response = await acceptBaselineHandler(event);

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
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("baseline_id mismatch");
    });

    it("should use project baseline_id as fallback when not in request body", async () => {
      // Mock DynamoDB to return project with baseline
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
        
        if (input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              baseline_id: 'base_test123',
              baseline_status: 'accepted',
              accepted_by: 'test@example.com',
              baseline_accepted_at: '2025-01-01T00:00:00.000Z',
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({}), // Empty body - should use project baseline_id
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("baseline_status", "accepted");
      expect(body).toHaveProperty("baselineId", "base_test123");
    });

    it("should require baseline_id when not in request body and not in project", async () => {
      // Mock DynamoDB to return project without baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              // No baseline_id in project
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({}),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("baseline_id is required");
    });

    it("should allow acceptance with request baseline_id when project has no baseline_id", async () => {
      // Edge case: project has no baseline_id set, but request provides one
      // This should be allowed (e.g., first-time acceptance scenario)
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              baseline_status: 'handed_off',
              // No baseline_id in project yet
            },
          });
        }
        
        if (input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              id: 'P-test123',
              baseline_id: 'base_new123',
              baseline_status: 'accepted',
              accepted_by: 'test@example.com',
              baseline_accepted_at: '2025-01-01T00:00:00.000Z',
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: 'base_new123', // Providing baseline_id for project without one
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("baseline_status", "accepted");
      expect(body).toHaveProperty("baselineId", "base_new123");
    });

    it("should materialize allocations and rubros during baseline acceptance", async () => {
      // Mock DynamoDB responses for project and baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              baseline_status: 'pending',
            },
          });
        }

        if (input?.Key?.pk === 'BASELINE#BL-test456' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'BASELINE#BL-test456',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              project_id: 'P-test123',
              start_date: '2025-01-01',
              duration_months: 12,
              currency: 'USD',
              labor_estimates: [
                {
                  rubroId: 'MOD-DEV-SR',
                  name: 'Developer Senior',
                  qty: 2,
                  unit_cost: 5000,
                  periodic: 'recurring',
                },
              ],
            },
          });
        }

        if (input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              baseline_status: 'accepted',
            },
          });
        }

        // Mock BatchWriteCommand for materialization
        if (input?.RequestItems) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: 'BL-test456',
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.baseline_status).toBe('accepted');
      expect(body).toHaveProperty('materialization');
      
      // Verify materialization was attempted (BatchWriteCommand called)
      const batchWriteCalls = dynamo.ddb.send.mock.calls.filter(
        (call) => call[0]?.input?.RequestItems
      );
      // Should have calls for allocations and rubros batches
      expect(batchWriteCalls.length).toBeGreaterThan(0);
    });

    it("should persist rubros_count and allocations_count after materialization", async () => {
      // Track UpdateCommand calls to verify counts are persisted
      const updateCalls: any[] = [];
      
      // Mock DynamoDB responses for project and baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        // Track all UpdateCommand calls for later assertion
        if (input?.UpdateExpression) {
          updateCalls.push(input);
        }
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              baseline_status: 'pending',
            },
          });
        }

        if (input?.Key?.pk === 'BASELINE#BL-test456' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'BASELINE#BL-test456',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              project_id: 'P-test123',
              start_date: '2025-01-01',
              duration_months: 12,
              currency: 'USD',
              labor_estimates: [
                {
                  rubroId: 'MOD-DEV-SR',
                  name: 'Developer Senior',
                  qty: 2,
                  unit_cost: 5000,
                  periodic: 'recurring',
                },
              ],
            },
          });
        }

        // Return response for UpdateCommand
        if (input?.UpdateExpression) {
          return Promise.resolve({
            Attributes: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'BL-test456',
              baseline_status: 'accepted',
            },
          });
        }

        // Mock BatchWriteCommand for materialization
        if (input?.RequestItems) {
          return Promise.resolve({});
        }

        // Mock BatchGetCommand for checking existing rubros
        if (input?.RequestKeys) {
          return Promise.resolve({ Responses: {} });
        }

        // Mock PutCommand for audit log
        if (input?.TableName?.includes('audit')) {
          return Promise.resolve({});
        }

        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: 'BL-test456',
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(200);
      
      // Verify that UpdateCommand was called to persist materialization counts
      const persistCountsUpdate = updateCalls.find((call) => 
        call.UpdateExpression?.includes('rubros_count') && 
        call.UpdateExpression?.includes('allocations_count')
      );
      
      expect(persistCountsUpdate).toBeDefined();
      expect(persistCountsUpdate?.ExpressionAttributeValues).toHaveProperty(':rubros_count');
      expect(persistCountsUpdate?.ExpressionAttributeValues).toHaveProperty(':allocations_count');
      expect(persistCountsUpdate?.ExpressionAttributeValues).toHaveProperty(':materialized_at');
      expect(persistCountsUpdate?.ExpressionAttributeValues).toHaveProperty(':updated_at');
      
      // Verify counts are numbers
      expect(typeof persistCountsUpdate?.ExpressionAttributeValues?.[':rubros_count']).toBe('number');
      expect(typeof persistCountsUpdate?.ExpressionAttributeValues?.[':allocations_count']).toBe('number');
    });

    it("should prevent re-acceptance of already accepted baseline", async () => {
      // Mock DynamoDB to return project with already accepted baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'base_test123',
              baseline_status: 'accepted', // Already accepted
              accepted_by: 'previous@example.com',
              baseline_accepted_at: '2025-01-01T00:00:00.000Z',
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(409); // Conflict
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("already accepted");
    });

    it("should only accept from handed_off or pending status", async () => {
      // Mock DynamoDB to return project with rejected baseline
      dynamo.ddb.send.mockImplementation((command: any) => {
        const input = command.input;
        
        if (input?.Key?.pk === 'PROJECT#P-test123' && input?.Key?.sk === 'METADATA') {
          return Promise.resolve({
            Item: {
              pk: 'PROJECT#P-test123',
              sk: 'METADATA',
              baseline_id: 'base_test123',
              baseline_status: 'rejected', // Cannot accept a rejected baseline
              rejected_by: 'someone@example.com',
              baseline_rejected_at: '2025-01-01T00:00:00.000Z',
            },
          });
        }
        
        return Promise.resolve({});
      });

      const event = baseEvent({
        body: JSON.stringify({
          baseline_id: "base_test123",
        }),
      });

      const response = await acceptBaselineHandler(event);

      expect(response.statusCode).toBe(409); // Conflict
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain('Cannot accept baseline with status "rejected"');
    });
  });
});
