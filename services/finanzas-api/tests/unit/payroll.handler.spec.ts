/**
 * Unit tests for payroll handler with mocked DynamoDB
 */

import { handler } from '../../src/handlers/payroll';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as dynamo from '../../src/lib/dynamo';

// Mock auth
jest.mock('../../src/lib/auth', () => ({
  ensureSDT: jest.fn().mockResolvedValue(undefined),
}));

// Mock DynamoDB operations
jest.mock('../../src/lib/dynamo', () => {
  const actual = jest.requireActual('../../src/lib/dynamo');
  return {
    ...actual,
    ddb: {
      send: jest.fn(),
    },
    putPayrollEntry: jest.fn(),
    queryPayrollByProject: jest.fn(),
    queryPayrollByPeriod: jest.fn(),
  };
});

// Helper to create test event
function createEvent(
  method: string,
  path: string,
  body?: any,
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
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
  };
}

describe('Payroll Handler Tests', () => {
  const testProjectId = 'P-TEST-PAYROLL-001';
  const testPeriod = '2025-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payroll', () => {
    it('should create a plan payroll entry', async () => {
      const mockEntry = {
        id: 'payroll_plan_abc1234567',
        projectId: testProjectId,
        period: testPeriod,
        kind: 'plan' as const,
        amount: 10000,
        currency: 'USD',
        pk: `PROJECT#${testProjectId}#MONTH#${testPeriod}`,
        sk: 'PAYROLL#PLAN#payroll_plan_abc1234567',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      (dynamo.putPayrollEntry as jest.Mock).mockResolvedValue(mockEntry);

      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
        period: testPeriod,
        kind: 'plan',
        amount: 10000,
        currency: 'USD',
        source: 'test',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.kind).toBe('plan');
      expect(body.amount).toBe(10000);
      expect(dynamo.putPayrollEntry).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid JSON', async () => {
      const event = createEvent('POST', '/payroll');
      event.body = 'invalid json';

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Invalid JSON');
    });

    it('should reject missing required fields', async () => {
      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Validation failed');
    });

    it('should reject negative amount', async () => {
      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
        period: testPeriod,
        kind: 'plan',
        amount: -100,
        currency: 'USD',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Validation failed');
    });
  });

  describe('GET /payroll', () => {
    it('should return all payroll entries for a project', async () => {
      const mockEntries = [
        {
          id: 'payroll_plan_test001',
          projectId: testProjectId,
          period: testPeriod,
          kind: 'plan' as const,
          amount: 10000,
          currency: 'USD',
        },
        {
          id: 'payroll_forecast_test001',
          projectId: testProjectId,
          period: testPeriod,
          kind: 'forecast' as const,
          amount: 12000,
          currency: 'USD',
        },
      ];

      (dynamo.queryPayrollByProject as jest.Mock).mockResolvedValue(mockEntries);

      const event = createEvent('GET', '/payroll', null, {
        projectId: testProjectId,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(dynamo.queryPayrollByProject).toHaveBeenCalledWith(testProjectId, undefined);
    });

    it('should filter by period', async () => {
      const mockEntries = [
        {
          id: 'payroll_plan_test001',
          projectId: testProjectId,
          period: testPeriod,
          kind: 'plan' as const,
          amount: 10000,
          currency: 'USD',
        },
      ];

      (dynamo.queryPayrollByPeriod as jest.Mock).mockResolvedValue(mockEntries);

      const event = createEvent('GET', '/payroll', null, {
        projectId: testProjectId,
        period: testPeriod,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.length).toBe(1);
      expect(dynamo.queryPayrollByPeriod).toHaveBeenCalledWith(testProjectId, testPeriod, undefined);
    });

    it('should require projectId', async () => {
      const event = createEvent('GET', '/payroll');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Missing required query parameter: projectId');
    });

    it('should reject invalid kind parameter', async () => {
      const event = createEvent('GET', '/payroll', null, {
        projectId: testProjectId,
        kind: 'invalid',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Invalid kind parameter');
    });
  });

  describe('GET /payroll/summary', () => {
    it('should return time series with breakdown', async () => {
      const mockPayroll = [
        {
          id: 'payroll_plan_summary001',
          projectId: testProjectId,
          period: testPeriod,
          kind: 'plan' as const,
          amount: 10000,
          currency: 'USD',
        },
      ];

      (dynamo.queryPayrollByProject as jest.Mock).mockResolvedValue(mockPayroll);
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({ Items: [] });

      const event = createEvent('GET', '/payroll/summary', null, {
        projectId: testProjectId,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should require projectId', async () => {
      const event = createEvent('GET', '/payroll/summary');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Missing required query parameter: projectId');
    });
  });

  describe('GET /payroll/dashboard', () => {
    it('should return aggregated MOD projections', async () => {
      // Mock scan calls to return empty results
      (dynamo.ddb.send as jest.Mock).mockImplementation(() => 
        Promise.resolve({ Items: [] })
      );

      const event = createEvent('GET', '/payroll/dashboard');

      const response = await handler(event);
      
      if (response.statusCode !== 200) {
        console.error('Dashboard error response:', response.body);
      }

      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should include payrollTarget field based on plan MOD', async () => {
      // Mock projects with start dates
      const mockProjects = [
        {
          pk: 'PROJECT#P-TEST-001',
          sk: 'META',
          start_date: '2025-01-15',
          projectId: 'P-TEST-001',
        },
      ];

      // Mock payroll entries
      const mockPayroll = [
        {
          pk: 'PROJECT#P-TEST-001#MONTH#2025-01',
          sk: 'PAYROLL#plan#123',
          projectId: 'P-TEST-001',
          period: '2025-01',
          kind: 'plan',
          amount: 10000,
        },
        {
          pk: 'PROJECT#P-TEST-001#MONTH#2025-01',
          sk: 'PAYROLL#forecast#456',
          projectId: 'P-TEST-001',
          period: '2025-01',
          kind: 'forecast',
          amount: 9500,
        },
      ];

      // Mock scan calls - first for projects, then for payroll
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({ Items: mockProjects })
        .mockResolvedValueOnce({ Items: mockPayroll });

      const event = createEvent('GET', '/payroll/dashboard');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);

      // Verify first month has payrollTarget
      const firstMonth = body[0];
      expect(firstMonth).toHaveProperty('month');
      expect(firstMonth).toHaveProperty('totalPlanMOD');
      expect(firstMonth).toHaveProperty('totalForecastMOD');
      expect(firstMonth).toHaveProperty('totalActualMOD');
      expect(firstMonth).toHaveProperty('payrollTarget');
      expect(firstMonth).toHaveProperty('projectCount');

      // Verify payrollTarget is 110% of plan MOD
      if (firstMonth.totalPlanMOD > 0) {
        expect(firstMonth.payrollTarget).toBeCloseTo(firstMonth.totalPlanMOD * 1.1, 2);
      }
    });
  });

  describe('Method routing', () => {
    it('should reject unsupported methods', async () => {
      const event = createEvent('PUT', '/payroll');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
      expect(body.error).toContain('not allowed');
    });

    it('should reject wrong method for /payroll/summary', async () => {
      const event = createEvent('POST', '/payroll/summary');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
    });
  });
});
