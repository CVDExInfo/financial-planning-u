import { handler } from '../../src/handlers/adjustments';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock dependencies
jest.mock('../../src/lib/auth', () => ({
  ensureSDT: jest.fn()
}));

jest.mock('../../src/lib/dynamo', () => ({
  ddb: {
    put: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    scan: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    })
  },
  tableName: jest.fn((key: string) => `finz_${key}`)
}));

describe('Adjustments Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (method: string, body?: any, queryParams?: any): any => ({
    version: '2.0',
    routeKey: 'POST /adjustments',
    rawPath: '/adjustments',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-2.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/adjustments',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest-test'
      },
      requestId: 'test-request-id',
      routeKey: `${method} /adjustments`,
      stage: 'dev',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: {
        jwt: {
          claims: {
            sub: 'test-user-id',
            'cognito:groups': ['SDT']
          },
          scopes: []
        }
      }
    },
    body: body ? JSON.stringify(body) : undefined,
    queryStringParameters: queryParams,
    isBase64Encoded: false
  });

  describe('POST /adjustments', () => {
    it('should create adjustment with valid data', async () => {
      const body = {
        project_id: 'proj_123',
        tipo: 'exceso',
        monto: 1000000,
        justificacion: 'Scope change approved'
      };

      const event = mockEvent('POST', body);
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.id).toMatch(/^adj_[a-f0-9]{10}$/);
      expect(responseBody.project_id).toBe('proj_123');
      expect(responseBody.tipo).toBe('exceso');
      expect(responseBody.monto).toBe(1000000);
      expect(responseBody.estado).toBe('pending_approval');
    });

    it('should calculate pro-rata distribution for 3 months', async () => {
      const body = {
        project_id: 'proj_123',
        tipo: 'exceso',
        monto: 1000000,
        metodo_distribucion: 'pro_rata_forward',
        fecha_inicio: '2025-11-01',
        meses_impactados: 3
      };

      const event = mockEvent('POST', body);
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.distribucion).toHaveLength(3);
      expect(responseBody.distribucion[0].monto).toBe(333333.33);
      expect(responseBody.distribucion[1].monto).toBe(333333.33);
      expect(responseBody.distribucion[2].monto).toBe(333333.34);
      
      // Verify sum equals total
      const total = responseBody.distribucion.reduce((sum: number, d: any) => sum + d.monto, 0);
      expect(total).toBe(1000000);
    });

    it('should reject missing required fields', async () => {
      const body = {
        project_id: 'proj_123'
        // missing tipo and monto
      };

      const event = mockEvent('POST', body);
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toContain('Missing required fields');
    });

    it('should reject invalid tipo', async () => {
      const body = {
        project_id: 'proj_123',
        tipo: 'invalid_type',
        monto: 1000
      };

      const event = mockEvent('POST', body);
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toContain('Invalid tipo');
    });

    it('should reject negative monto', async () => {
      const body = {
        project_id: 'proj_123',
        tipo: 'exceso',
        monto: -1000
      };

      const event = mockEvent('POST', body);
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toContain('monto must be a positive number');
    });
  });

  describe('GET /adjustments', () => {
    it('should list all adjustments', async () => {
      const { ddb } = require('../../src/lib/dynamo');
      ddb.scan.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Items: [
            { id: 'adj_1', project_id: 'proj_123', tipo: 'exceso', monto: 1000 },
            { id: 'adj_2', project_id: 'proj_456', tipo: 'deficit', monto: 500 }
          ]
        })
      });

      const event = mockEvent('GET');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.adjustments).toHaveLength(2);
      expect(responseBody.count).toBe(2);
    });

    it('should filter by project_id', async () => {
      const event = mockEvent('GET', undefined, { project_id: 'proj_123' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should filter by estado', async () => {
      const event = mockEvent('GET', undefined, { estado: 'approved' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
