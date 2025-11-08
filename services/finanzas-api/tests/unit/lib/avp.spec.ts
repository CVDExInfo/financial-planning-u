import { parseGroupsFromJWT, extractIdToken } from '../../../src/lib/avp';
import { getActionMapping, buildAvpContext } from '../../../src/lib/avp-actions';

describe('AVP Helper Functions', () => {
  describe('parseGroupsFromJWT', () => {
    it('should parse groups from valid JWT', () => {
      // Create a minimal JWT with cognito:groups
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user',
        'cognito:groups': ['SDT', 'FIN']
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);
      expect(groups).toEqual(['SDT', 'FIN']);
    });

    it('should handle string format groups', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user',
        'cognito:groups': 'SDT,FIN,AUD'
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);
      expect(groups).toEqual(['SDT', 'FIN', 'AUD']);
    });

    it('should return empty array for invalid token', () => {
      const groups = parseGroupsFromJWT('invalid-token');
      expect(groups).toEqual([]);
    });

    it('should return empty array for token without groups', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user'
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);
      expect(groups).toEqual([]);
    });
  });

  describe('extractIdToken', () => {
    it('should extract token from Authorization header', () => {
      const headers = {
        authorization: 'Bearer test-token-123'
      };
      const token = extractIdToken(headers);
      expect(token).toBe('test-token-123');
    });

    it('should handle case-insensitive Authorization header', () => {
      const headers = {
        Authorization: 'Bearer test-token-456'
      };
      const token = extractIdToken(headers);
      expect(token).toBe('test-token-456');
    });

    it('should handle token without Bearer prefix', () => {
      const headers = {
        authorization: 'test-token-789'
      };
      const token = extractIdToken(headers);
      expect(token).toBe('test-token-789');
    });

    it('should return null for missing header', () => {
      const headers = {};
      const token = extractIdToken(headers);
      expect(token).toBeNull();
    });
  });

  describe('getActionMapping', () => {
    it('should map health endpoint correctly', () => {
      const mapping = getActionMapping('/health', 'GET');
      expect(mapping).toBeDefined();
      expect(mapping?.action).toBe('ViewHealth');
      expect(mapping?.resourceType).toBe('Finanzas::Project');
    });

    it('should map catalog rubros endpoint', () => {
      const mapping = getActionMapping('/catalog/rubros', 'GET');
      expect(mapping).toBeDefined();
      expect(mapping?.action).toBe('ViewRubros');
      expect(mapping?.resourceType).toBe('Finanzas::Rubro');
    });

    it('should map bulk allocations endpoint', () => {
      const mapping = getActionMapping('/projects/123/allocations:bulk', 'PUT');
      expect(mapping).toBeDefined();
      expect(mapping?.action).toBe('BulkAllocate');
      expect(mapping?.resourceType).toBe('Finanzas::Allocation');
    });

    it('should map close month endpoint', () => {
      const mapping = getActionMapping('/close-month', 'POST');
      expect(mapping).toBeDefined();
      expect(mapping?.action).toBe('CloseMonth');
      expect(mapping?.resourceType).toBe('Finanzas::Project');
    });

    it('should return null for unknown route', () => {
      const mapping = getActionMapping('/unknown/route', 'GET');
      expect(mapping).toBeNull();
    });
  });

  describe('buildAvpContext', () => {
    it('should build context from API Gateway event', () => {
      const event = {
        requestContext: {
          http: {
            method: 'PUT',
            path: '/projects/123/allocations:bulk'
          }
        },
        pathParameters: {
          id: '123'
        }
      };

      const context = buildAvpContext(event);
      expect(context.http_method).toBe('PUT');
      expect(context.route).toBe('/projects/123/allocations:bulk');
      expect(context.project_id).toBe('123');
      expect(context.env).toBeDefined();
    });

    it('should handle missing path parameters', () => {
      const event = {
        requestContext: {
          http: {
            method: 'GET',
            path: '/health'
          }
        }
      };

      const context = buildAvpContext(event);
      expect(context.http_method).toBe('GET');
      expect(context.route).toBe('/health');
      expect(context.project_id).toBeUndefined();
    });

    it('should use default values for missing properties', () => {
      const event = {};

      const context = buildAvpContext(event);
      expect(context.http_method).toBe('GET');
      expect(context.route).toBe('');
      expect(context.jwt_groups).toEqual([]);
    });
  });
});
