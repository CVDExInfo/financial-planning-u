/**
 * Integration test for /projects/:id/rubros endpoint
 * 
 * Validates that the endpoint works correctly with taxonomy loaded
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock DynamoDB and Auth for integration test
jest.mock('../src/lib/dynamo', () => ({
  ddb: {
    send: jest.fn().mockResolvedValue({
      Items: [],
      Count: 0,
    }),
  },
  tableName: jest.fn((name) => `test_${name}`),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  BatchGetCommand: jest.fn(),
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  DeleteCommand: jest.fn(),
}));

jest.mock('../src/lib/auth', () => ({
  ensureCanRead: jest.fn().mockResolvedValue(undefined),
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
  getUserEmail: jest.fn().mockResolvedValue('test@example.com'),
}));

jest.mock('../src/lib/baseline-sdmt', () => ({
  queryProjectRubros: jest.fn().mockResolvedValue([]),
}));

describe('Integration: /projects/:id/rubros endpoint', () => {
  let handler: any;

  beforeAll(async () => {
    // Import handler after mocks are set up
    const module = await import('../src/handlers/rubros');
    handler = module.handler;
  });

  it('should return 200 and data array for GET /projects/:id/rubros', async () => {
    const event: Partial<APIGatewayProxyEventV2> = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/projects/P-TEST-123/rubros',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        authorizer: {
          jwt: {
            claims: {
              email: 'test@example.com',
              'cognito:groups': '["FIN"]',
            },
            scopes: [],
          },
        },
      } as any,
      pathParameters: {
        projectId: 'P-TEST-123',
      },
      queryStringParameters: null,
      body: null,
    };

    const response = await handler(event as APIGatewayProxyEventV2);

    expect(response).toBeDefined();
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('project_id');
    expect(body.project_id).toBe('P-TEST-123');
  });

  it('should return 400 for GET without projectId', async () => {
    const event: Partial<APIGatewayProxyEventV2> = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/projects/rubros',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        authorizer: {
          jwt: {
            claims: {
              email: 'test@example.com',
              'cognito:groups': '["FIN"]',
            },
            scopes: [],
          },
        },
      } as any,
      pathParameters: null,
      queryStringParameters: null,
      body: null,
    };

    const response = await handler(event as APIGatewayProxyEventV2);

    expect(response).toBeDefined();
    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('missing project id');
  });

  it('should not throw 500 even if taxonomy is empty', async () => {
    // This tests the graceful degradation behavior
    const event: Partial<APIGatewayProxyEventV2> = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/projects/P-TEST-456/rubros',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        authorizer: {
          jwt: {
            claims: {
              email: 'test@example.com',
              'cognito:groups': '["FIN"]',
            },
            scopes: [],
          },
        },
      } as any,
      pathParameters: {
        projectId: 'P-TEST-456',
      },
      queryStringParameters: null,
      body: null,
    };

    const response = await handler(event as APIGatewayProxyEventV2);

    // Should return 200 (or auth error), not 500
    expect(response).toBeDefined();
    expect(response.statusCode).not.toBe(500);
  });
});
