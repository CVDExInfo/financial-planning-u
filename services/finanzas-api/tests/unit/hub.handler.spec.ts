/**
 * Unit tests for Hub handler - validates DynamoDB query format and empty dataset handling
 */

import { handler } from '../../src/handlers/hub';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as dynamo from '../../src/lib/dynamo';
import { QueryCommand, ScanCommand } from '../../src/lib/dynamo';

// Mock auth
jest.mock('../../src/lib/auth', () => ({
  getUserContext: jest.fn().mockResolvedValue({
    email: 'test@example.com',
    roles: ['SDMT'],
    isSDMT: true,
    isExecRO: false,
    isPMO: false,
    isMOD: false,
  }),
}));

// Mock DynamoDB operations
jest.mock('../../src/lib/dynamo', () => {
  const actual = jest.requireActual('../../src/lib/dynamo');
  return {
    ...actual,
    ddb: {
      send: jest.fn(),
    },
  };
});

// Helper to create test event
function createEvent(
  method: string,
  path: string,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: {},
    queryStringParameters: queryStringParameters || null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-2.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: {
        jwt: {
          claims: {
            email: 'test@example.com',
          },
        },
      },
    } as any,
    body: null,
    isBase64Encoded: false,
  };
}

// Helper to create event with missing path properties
function createEventWithMissingPath(
  method: string,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEventV2 {
  const event = createEvent(method, '', queryStringParameters);
  // Remove path properties to simulate edge case
  delete (event as any).rawPath;
  delete (event as any).requestContext.http.path;
  return event;
}

describe('Hub Handler Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hub Summary Endpoint', () => {
    it('should return 200 with empty arrays when no data exists', async () => {
      // Mock DynamoDB to return empty results
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'ALL' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should return valid structure with zero values
      expect(body).toHaveProperty('scope', 'ALL');
      expect(body).toHaveProperty('kpis');
      expect(body.kpis).toHaveProperty('baselineMOD');
      expect(body.projectsCount).toBe(0);
    });

    it('should use correct DynamoDB query format (plain values, not {S: ...})', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'P-TEST-001' });
      await handler(event);

      // Verify QueryCommand was called with plain ExpressionAttributeValues
      const queryCalls = (dynamo.ddb.send as jest.Mock).mock.calls.filter(
        (call) => call[0] instanceof QueryCommand
      );

      expect(queryCalls.length).toBeGreaterThan(0);
      
      queryCalls.forEach((call) => {
        const command = call[0];
        const values = command.input.ExpressionAttributeValues;
        
        if (values) {
          // Ensure values are plain strings/numbers, not {S: ...} or {N: ...} maps
          Object.values(values).forEach((value) => {
            expect(typeof value).not.toBe('object');
          });
        }
      });
    });
  });

  describe('Hub MOD Performance Endpoint', () => {
    it('should return 200 with empty data when no allocations exist', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/mod-performance', { scope: 'ALL' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('scope', 'ALL');
      expect(body).toHaveProperty('months');
      expect(Array.isArray(body.months)).toBe(true);
      expect(body.months.length).toBe(12);
    });
  });

  describe('Hub Cashflow Endpoint', () => {
    it('should return 200 with empty data when no payroll exists', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/cashflow', { scope: 'ALL' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('scope', 'ALL');
      expect(body).toHaveProperty('months');
      expect(Array.isArray(body.months)).toBe(true);
    });
  });

  describe('Hub Rubros Breakdown Endpoint', () => {
    it('should return 200 with empty breakdown when no allocations exist', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/rubros-breakdown', { scope: 'ALL' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('scope', 'ALL');
      expect(body).toHaveProperty('byCategory');
      expect(body).toHaveProperty('byRubro');
      expect(Array.isArray(body.byCategory)).toBe(true);
      expect(Array.isArray(body.byRubro)).toBe(true);
    });
  });

  describe('Hub Export Endpoint', () => {
    it('should return 200 and initiate export', async () => {
      const event = createEvent('POST', '/finanzas/hub/export');
      event.body = JSON.stringify({
        scope: 'ALL',
        dateRange: '12months',
        sections: ['summary', 'mod-performance'],
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('status', 'initiated');
      expect(body).toHaveProperty('scope', 'ALL');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing path gracefully', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      // Create event with missing path properties using helper
      const event = createEventWithMissingPath('GET', { scope: 'ALL' });

      const response = await handler(event);

      // Should still handle the request (default to empty string path)
      // Since path is empty, it won't match any route and should return 404
      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for unknown paths', async () => {
      const event = createEvent('GET', '/finanzas/hub/unknown', { scope: 'ALL' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle invalid year parameter', async () => {
      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'ALL', year: 'invalid' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('year');
    });

    it('should handle year out of range', async () => {
      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'ALL', year: '1999' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('2020');
    });

    it('should reject invalid scope parameter with special characters', async () => {
      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'PROJECT#123; DROP TABLE' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('scope');
    });

    it('should accept valid project code scopes', async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const event = createEvent('GET', '/finanzas/hub/summary', { scope: 'P-TEST-001' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
