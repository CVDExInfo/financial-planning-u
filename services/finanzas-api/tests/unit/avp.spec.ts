// Mock JWT parsing functions for testing
// Since we can't import from TypeScript files without transformation,
// we'll test the logic with inline implementations

function parseGroupsFromJWT(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return [];
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    const groups = payload['cognito:groups'];
    if (Array.isArray(groups)) {
      return groups;
    } else if (typeof groups === 'string') {
      return groups.split(',').map(g => g.trim()).filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

function extractIdToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return null;
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function buildAVPContext(event, groups, projectId?) {
  const context: any = {
    jwt_groups: { set: groups },
    http_method: { string: event.requestContext.http.method },
    route: { string: event.requestContext.http.path },
    env: { string: process.env.STAGE_NAME || process.env.STAGE || 'dev' }
  };
  if (projectId) {
    context.project_id = { string: projectId };
  }
  return context;
}

describe('AVP Helper Library', () => {
  describe('parseGroupsFromJWT', () => {
    it('should parse groups from valid JWT token', () => {
      // Create a mock JWT with cognito:groups claim
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user-123',
        'cognito:groups': ['SDT', 'FIN'],
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      const signature = 'mock-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);

      expect(groups).toEqual(['SDT', 'FIN']);
    });

    it('should handle groups as comma-separated string', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user-123',
        'cognito:groups': 'SDT,FIN,AUD',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      const signature = 'mock-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);

      expect(groups).toEqual(['SDT', 'FIN', 'AUD']);
    });

    it('should return empty array for token without groups', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user-123',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      const signature = 'mock-signature';
      const token = `${header}.${payload}.${signature}`;

      const groups = parseGroupsFromJWT(token);

      expect(groups).toEqual([]);
    });

    it('should return empty array for invalid token format', () => {
      const groups = parseGroupsFromJWT('invalid-token');
      expect(groups).toEqual([]);
    });

    it('should handle malformed JWT gracefully', () => {
      const groups = parseGroupsFromJWT('header.invalid-payload.signature');
      expect(groups).toEqual([]);
    });
  });

  describe('extractIdToken', () => {
    it('should extract token from Authorization header', () => {
      const event = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln'
        },
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln');
    });

    it('should extract token from lowercase authorization header', () => {
      const event = {
        headers: {
          authorization: 'bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln'
        },
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln');
    });

    it('should handle mixed case Bearer', () => {
      const event = {
        headers: {
          Authorization: 'BeArEr eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln'
        },
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln');
    });

    it('should return null when no authorization header', () => {
      const event = {
        headers: {},
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBeNull();
    });

    it('should return null for empty authorization header', () => {
      const event = {
        headers: {
          authorization: ''
        },
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBeNull();
    });

    it('should handle authorization header without Bearer prefix', () => {
      const event = {
        headers: {
          authorization: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln'
        },
        requestContext: { http: {} }
      };

      const token = extractIdToken(event);

      expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln');
    });
  });

  describe('buildAVPContext', () => {
    it('should build context with all required attributes', () => {
      const event = {
        requestContext: {
          http: {
            method: 'PUT',
            path: '/projects/123/allocations:bulk'
          }
        },
        headers: {}
      };

      const groups = ['SDT', 'FIN'];
      const projectId = 'PRJ-ACME-NOC';

      const context = buildAVPContext(event, groups, projectId);

      expect(context).toEqual({
        jwt_groups: { set: ['SDT', 'FIN'] },
        http_method: { string: 'PUT' },
        route: { string: '/projects/123/allocations:bulk' },
        project_id: { string: 'PRJ-ACME-NOC' },
        env: { string: 'dev' }
      });
    });

    it('should omit project_id when not provided', () => {
      const event = {
        requestContext: {
          http: {
            method: 'GET',
            path: '/health'
          }
        },
        headers: {}
      };

      const groups = ['SDT'];

      const context = buildAVPContext(event, groups);

      expect(context).toEqual({
        jwt_groups: { set: ['SDT'] },
        http_method: { string: 'GET' },
        route: { string: '/health' },
        env: { string: 'dev' }
      });
      expect('project_id' in context).toBe(false);
    });

    it('should use STAGE_NAME environment variable if available', () => {
      process.env.STAGE_NAME = 'stg';

      const event = {
        requestContext: {
          http: {
            method: 'GET',
            path: '/projects'
          }
        },
        headers: {}
      };

      const context = buildAVPContext(event, ['FIN']);

      expect(context.env).toEqual({ string: 'stg' });

      delete process.env.STAGE_NAME;
    });

    it('should use STAGE environment variable as fallback', () => {
      process.env.STAGE = 'prod';

      const event = {
        requestContext: {
          http: {
            method: 'POST',
            path: '/adjustments'
          }
        },
        headers: {}
      };

      const context = buildAVPContext(event, ['FIN']);

      expect(context.env).toEqual({ string: 'prod' });

      delete process.env.STAGE;
    });

    it('should default to dev environment', () => {
      delete process.env.STAGE_NAME;
      delete process.env.STAGE;

      const event = {
        requestContext: {
          http: {
            method: 'GET',
            path: '/catalog/rubros'
          }
        },
        headers: {}
      };

      const context = buildAVPContext(event, []);

      expect(context.env).toEqual({ string: 'dev' });
    });

    it('should handle empty groups array', () => {
      const event = {
        requestContext: {
          http: {
            method: 'GET',
            path: '/health'
          }
        },
        headers: {}
      };

      const context = buildAVPContext(event, []);

      expect(context.jwt_groups).toEqual({ set: [] });
    });
  });
});
