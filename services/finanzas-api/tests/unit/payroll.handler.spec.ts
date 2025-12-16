/**
 * Unit tests for payroll handler with mocked DynamoDB
 */

import { handler } from '../../src/handlers/payroll';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as dynamo from '../../src/lib/dynamo';
import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from '../../src/lib/dynamo';

// Mock auth
jest.mock('../../src/lib/auth', () => ({
  ensureSDT: jest.fn().mockResolvedValue(undefined),
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
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
    projectExists: jest.fn().mockResolvedValue(true),
    getRubroTaxonomy: jest.fn().mockResolvedValue({
      code: 'MOD-DEV-SR',
      description: 'Developer Senior',
      category: 'MOD',
    }),
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

    const projectMetadata = {
      pk: `PROJECT#${testProjectId}`,
      sk: 'METADATA',
      currency: 'USD',
    };

    const rubroMetadata = {
      pk: 'RUBRO#MOD-ING',
      sk: 'METADATA',
      linea_codigo: 'MOD-ING',
      categoria: 'MOD',
      descripcion: 'Ingenieros de soporte (mensual)',
    };

    const rubroTaxonomy = {
      pk: 'LINEA#MOD-ING',
      linea_codigo: 'MOD-ING',
      categoria: 'MOD',
      categoria_codigo: 'MOD',
      linea_gasto: 'Ingenieros de soporte (mensual)',
      descripcion: 'Ingenieros de soporte (mensual)',
    };

    (dynamo.ddb.send as jest.Mock).mockImplementation((command) => {
      const table = (command as any).input?.TableName || '';

      if (command instanceof GetCommand) {
        if (table.includes('projects')) {
          return Promise.resolve({ Item: projectMetadata });
        }
        if (table.includes('rubros')) {
          return Promise.resolve({ Item: rubroMetadata });
        }
        return Promise.resolve({ Item: undefined });
      }

      if (command instanceof QueryCommand) {
        if (table.includes('rubros_taxonomia')) {
          return Promise.resolve({ Items: [rubroTaxonomy] });
        }
        return Promise.resolve({ Items: [] });
      }

      if (command instanceof ScanCommand) {
        return Promise.resolve({ Items: [] });
      }

      return Promise.resolve({ Items: [] });
    });
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

  describe('POST /payroll/actuals/bulk', () => {
    it('should exist and accept bulk payroll actuals', async () => {
      // We're testing that the endpoint exists and handles requests properly
      // The detailed validation is tested in the existing "returns partial success" test
      const event = createEvent('POST', '/payroll/actuals/bulk', []);

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body).toHaveProperty('insertedCount');
      expect(body).toHaveProperty('errors');
      expect(Array.isArray(body.errors)).toBe(true);
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

  describe('POST /payroll/actuals/bulk', () => {
    it('returns partial success when some rows fail validation', async () => {
      (dynamo.ddb.send as jest.Mock).mockImplementation((command) => {
        const table = (command as any).input?.TableName || '';
        if (command instanceof GetCommand) {
          if (table.includes('projects')) {
            return Promise.resolve({ Item: { pk: `PROJECT#${testProjectId}`, sk: 'METADATA' } });
          }
          if (table.includes('rubros')) {
            return Promise.resolve({ Item: { pk: 'RUBRO#MOD-ING', sk: 'METADATA', linea_codigo: 'MOD-ING' } });
          }
        }
        if (command instanceof QueryCommand && table.includes('rubros_taxonomia')) {
          return Promise.resolve({ Items: [{ pk: 'LINEA#MOD-ING', linea_codigo: 'MOD-ING', categoria: 'MOD' }] });
        }
        if (command instanceof BatchWriteCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({ Items: [] });
      });

      const rows = [
        { projectId: testProjectId, rubroId: 'MOD-ING', month: testPeriod, amount: 5000 },
        { projectId: testProjectId, month: testPeriod, amount: -10 },
      ];

      const event = createEvent('POST', '/payroll/actuals/bulk', rows);
      event.headers = { 'content-type': 'application/json' } as any;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.insertedCount).toBe(1);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].index).toBe(1);
    });
  });

  describe('Payroll actuals integration', () => {
    const payrollStore: any[] = [];

    beforeEach(() => {
      payrollStore.length = 0;
      (dynamo.ddb.send as jest.Mock).mockImplementation((command) => {
        const table = (command as any).input?.TableName || '';
        const projectMetadata = {
          pk: `PROJECT#${testProjectId}`,
          sk: 'METADATA',
          currency: 'USD',
        };
        const rubroMetadata = {
          pk: 'RUBRO#MOD-ING',
          sk: 'METADATA',
          linea_codigo: 'MOD-ING',
          categoria: 'MOD',
          descripcion: 'Ingenieros de soporte (mensual)',
        };
        const rubroTaxonomy = {
          pk: 'LINEA#MOD-ING',
          linea_codigo: 'MOD-ING',
          categoria: 'MOD',
          categoria_codigo: 'MOD',
          linea_gasto: 'Ingenieros de soporte (mensual)',
          descripcion: 'Ingenieros de soporte (mensual)',
        };

        if (command instanceof GetCommand) {
          if (table.includes('projects')) {
            return Promise.resolve({ Item: projectMetadata });
          }
          if (table.includes('rubros')) {
            return Promise.resolve({ Item: rubroMetadata });
          }
        }

        if (command instanceof QueryCommand && table.includes('rubros_taxonomia')) {
          return Promise.resolve({ Items: [rubroTaxonomy] });
        }

        if (command instanceof PutCommand) {
          payrollStore.push((command as any).input.Item);
          return Promise.resolve({});
        }

        if (command instanceof BatchWriteCommand) {
          const items = (command as any).input.RequestItems?.[dynamo.tableName('payroll_actuals')] || [];
          items.forEach((req: any) => payrollStore.push(req.PutRequest.Item));
          return Promise.resolve({ UnprocessedItems: {} });
        }

        if (command instanceof QueryCommand) {
          if (table.includes('allocations')) {
            return Promise.resolve({ Items: [] });
          }
          const pk = (command as any).input.ExpressionAttributeValues?.[':pk'];
          const sk = (command as any).input.ExpressionAttributeValues?.[':sk'];
          const Items = payrollStore.filter((item) => item.pk === pk && (!sk || item.sk?.startsWith(sk)));
          return Promise.resolve({ Items });
        }

        if (command instanceof ScanCommand) {
          const pkPrefix = (command as any).input.ExpressionAttributeValues?.[':pkPrefix'];
          const skPrefix = (command as any).input.ExpressionAttributeValues?.[':sk'];
          const Items = payrollStore.filter(
            (item) => item.pk?.startsWith(pkPrefix) && (!skPrefix || item.sk?.startsWith(skPrefix))
          );
          return Promise.resolve({ Items });
        }

        return Promise.resolve({ Items: [] });
      });

      (dynamo.queryPayrollByProject as jest.Mock).mockImplementation(async (projectId: string) =>
        payrollStore.filter((item) => item.pk?.startsWith(`PROJECT#${projectId}`))
      );

      (dynamo.queryPayrollByPeriod as jest.Mock).mockImplementation(async (projectId: string, period: string) =>
        payrollStore.filter((item) => item.pk === `PROJECT#${projectId}` && item.sk?.startsWith(`PAYROLL#${period}`))
      );
    });

    it('surfaces new actual amounts in payroll summary', async () => {
      const postEvent = createEvent('POST', '/payroll/actuals', {
        projectId: testProjectId,
        rubroId: 'MOD-ING',
        month: testPeriod,
        amount: 7500,
      });
      postEvent.headers = { 'content-type': 'application/json' } as any;
      const postResponse = await handler(postEvent);
      expect(postResponse.statusCode).toBe(201);

      const summaryEvent = createEvent('GET', '/payroll/summary', undefined, {
        projectId: testProjectId,
      });
      const response = await handler(summaryEvent);
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      const summaryRow = body.find((row: any) => row.period === testPeriod);
      expect(summaryRow).toBeDefined();
      expect(summaryRow.actualMOD).toBe(7500);
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

  describe('POST /payroll with validation', () => {
    it('should reject when project does not exist', async () => {
      (dynamo.projectExists as jest.MockedFunction<typeof dynamo.projectExists>).mockResolvedValueOnce(false);

      const event = createEvent('POST', '/payroll', {
        projectId: 'P-NONEXISTENT',
        period: testPeriod,
        kind: 'actual',
        amount: 5000,
        currency: 'USD',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('does not exist');
    });

    it('should reject when rubro does not exist', async () => {
      (dynamo.projectExists as jest.MockedFunction<typeof dynamo.projectExists>).mockResolvedValueOnce(true);
      (dynamo.getRubroTaxonomy as jest.MockedFunction<typeof dynamo.getRubroTaxonomy>).mockResolvedValueOnce(null);

      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
        period: testPeriod,
        kind: 'actual',
        amount: 5000,
        currency: 'USD',
        rubroId: 'INVALID-RUBRO',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('does not exist');
    });

    it('should accept valid currency codes', async () => {
      const mockEntry = {
        id: 'payroll_actual_test123',
        projectId: testProjectId,
        period: testPeriod,
        kind: 'actual' as const,
        amount: 50000,
        currency: 'COP',
      };

      (dynamo.putPayrollEntry as jest.Mock).mockResolvedValue(mockEntry);

      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
        period: testPeriod,
        kind: 'actual',
        amount: 50000,
        currency: 'COP',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.currency).toBe('COP');
    });

    it('should reject invalid currency codes', async () => {
      const event = createEvent('POST', '/payroll', {
        projectId: testProjectId,
        period: testPeriod,
        kind: 'actual',
        amount: 5000,
        currency: 'INVALID',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toContain('Validation failed');
    });
  });
});
