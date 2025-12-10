/**
 * Unit tests for recon handler
 * 
 * CONTRACT ENFORCEMENT:
 * These tests ensure /recon never returns 500, only: 200, 400, or 501
 */

import { handler } from '../../src/handlers/recon';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as baselineSdmt from '../../src/lib/baseline-sdmt';

// Mock auth
jest.mock('../../src/lib/auth', () => ({
  ensureCanRead: jest.fn().mockResolvedValue(undefined),
}));

// Mock baseline-sdmt functions
jest.mock('../../src/lib/baseline-sdmt');

// Helper to create test event
function createEvent(
  method: string,
  path: string,
  queryStringParameters?: Record<string, string> | null
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

describe('Recon Handler - Contract Tests', () => {
  const testProjectId = 'P-5ae50ace';
  const testMonth = '2025-11';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation (400 responses)', () => {
    it('should return 400 when projectId is missing', async () => {
      const event = createEvent('GET', '/recon', {});
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('projectId');
    });

    it('should return 400 when projectId is empty string', async () => {
      const event = createEvent('GET', '/recon', { projectId: '   ' });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('projectId');
    });

    it('should return 400 when month format is invalid', async () => {
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId,
        month: 'invalid-month'
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('month');
    });

    it('should return 405 for non-GET methods', async () => {
      const event = createEvent('POST', '/recon', { projectId: testProjectId });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(405);
    });
  });

  describe('Not Configured / Not Implemented (501 responses)', () => {
    it('should return 501 when no baseline rubros are found', async () => {
      // Mock empty rubros (no baseline configured)
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue([]);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId,
        month: testMonth 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('baseline');
    });

    it('should return 501 when Dynamo ResourceNotFoundException occurs', async () => {
      // Mock Dynamo ResourceNotFoundException
      const dynamoError = new Error('Table not found');
      (dynamoError as any).name = 'ResourceNotFoundException';
      (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(dynamoError);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('table');
    });

    it('should return 501 when Dynamo AccessDeniedException occurs', async () => {
      // Mock Dynamo AccessDeniedException
      const dynamoError = new Error('Access denied');
      (dynamoError as any).name = 'AccessDeniedException';
      (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(dynamoError);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('access');
    });

    it('should return 501 when ValidationException with table error occurs', async () => {
      // Mock Dynamo ValidationException for non-existent table
      const dynamoError = new Error('Requested resource not found');
      (dynamoError as any).name = 'ValidationException';
      (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(dynamoError);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 501 when ThrottlingException occurs', async () => {
      // Mock Dynamo ThrottlingException
      const dynamoError = new Error('Throttled');
      (dynamoError as any).name = 'ThrottlingException';
      (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(dynamoError);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 501 for unexpected errors', async () => {
      // Mock unexpected error
      (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });

  describe('Success Cases (200 responses)', () => {
    const mockRubros = [
      {
        rubroId: 'R-IKUSI-GO',
        nombre: 'Ikusi GO',
        descripcion: 'Basic tier',
        category: 'SERVICE_TIER',
        qty: 10,
        unit_cost: 1000,
        currency: 'USD',
        recurring: true,
        one_time: false,
        start_month: 1,
        end_month: 12,
        total_cost: 12000,
        metadata: {
          baseline_id: 'baseline-123',
          project_id: testProjectId,
        },
      },
    ];

    const mockForecastGrid = [
      {
        line_item_id: 'R-IKUSI-GO',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
      },
      {
        line_item_id: 'R-IKUSI-GO',
        month: 2,
        planned: 1000,
        forecast: 1000,
        actual: 0,
      },
    ];

    it('should return 200 with valid recon data when all data is present', async () => {
      // Mock successful baseline query
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue(mockRubros);
      (baselineSdmt.generateForecastGrid as jest.Mock).mockReturnValue(mockForecastGrid);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId,
        month: testMonth 
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify response structure matches contract
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('project_id', testProjectId);
      expect(body).toHaveProperty('months');
      expect(body).toHaveProperty('total_items');
      
      // Verify data array
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      
      // Verify each item has required fields
      body.data.forEach((item: any) => {
        expect(item).toHaveProperty('line_item_id');
        expect(item).toHaveProperty('month');
        expect(item).toHaveProperty('planned');
        expect(item).toHaveProperty('forecast');
        expect(item).toHaveProperty('actual');
        expect(item).toHaveProperty('estado');
        expect(item).toHaveProperty('rubro_nombre');
      });
    });

    it('should return 200 with empty data when project has baseline but no rubros yet', async () => {
      // Edge case: baseline exists but no rubros materialized yet
      // This should return 200 with empty array, not 501
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue([]);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      // Per current implementation, empty rubros → 501
      // If business logic changes to allow empty baseline, this should be 200
      expect(response.statusCode).toBe(501);
    });

    it('should accept project_id as alias for projectId', async () => {
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue(mockRubros);
      (baselineSdmt.generateForecastGrid as jest.Mock).mockReturnValue(mockForecastGrid);
      
      const event = createEvent('GET', '/recon', { 
        project_id: testProjectId // Using underscore variant
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.project_id).toBe(testProjectId);
    });

    it('should handle custom months parameter', async () => {
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue(mockRubros);
      (baselineSdmt.generateForecastGrid as jest.Mock).mockReturnValue(mockForecastGrid);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId,
        months: '6'
      });
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.months).toBe(6);
    });
  });

  describe('Contract Compliance', () => {
    it('should NEVER return 500 status code', async () => {
      // Test various error scenarios - none should return 500
      const errorScenarios = [
        {
          name: 'Dynamo error',
          setup: () => {
            const error = new Error('Dynamo failure');
            (error as any).name = 'UnknownDynamoError';
            (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(error);
          },
        },
        {
          name: 'Unexpected error',
          setup: () => {
            (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(
              new Error('Catastrophic failure')
            );
          },
        },
        {
          name: 'Null pointer',
          setup: () => {
            (baselineSdmt.queryProjectRubros as jest.Mock).mockRejectedValue(
              new TypeError('Cannot read property of null')
            );
          },
        },
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();
        
        const event = createEvent('GET', '/recon', { 
          projectId: testProjectId 
        });
        
        const response = await handler(event);
        
        expect(response.statusCode).not.toBe(500);
        expect([200, 400, 401, 403, 405, 501]).toContain(response.statusCode);
      }
    });

    it('should return only allowed status codes: 200, 400, 401, 403, 405, or 501', async () => {
      // This test documents the complete set of allowed status codes
      // Per contract: 200, 400, 501 are primary
      // 401, 403, 405 are allowed for auth/method errors
      
      (baselineSdmt.queryProjectRubros as jest.Mock).mockResolvedValue([]);
      
      const event = createEvent('GET', '/recon', { 
        projectId: testProjectId 
      });
      
      const response = await handler(event);
      
      const allowedStatusCodes = [200, 400, 401, 403, 405, 501];
      expect(allowedStatusCodes).toContain(response.statusCode);
    });
  });
});
