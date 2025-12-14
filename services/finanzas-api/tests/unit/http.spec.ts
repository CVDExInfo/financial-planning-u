/**
 * Unit tests for HTTP response utilities
 * Tests that all responses include proper CORS headers
 */

import { ok, bad, serverError, notFound, unauthorized, noContent, cors } from '../../src/lib/http';

describe('HTTP Response Utilities - CORS Headers', () => {
  describe('cors object', () => {
    it('should have wildcard origin', () => {
      expect(cors['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include all required HTTP methods', () => {
      const methods = cors['Access-Control-Allow-Methods'];
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('OPTIONS');
    });

    it('should include all required headers', () => {
      const headers = cors['Access-Control-Allow-Headers'];
      expect(headers).toContain('Content-Type');
      expect(headers).toContain('Authorization');
      expect(headers).toContain('X-Requested-With');
      expect(headers).toContain('X-Idempotency-Key');
    });

    it('should have max age set', () => {
      expect(cors['Access-Control-Max-Age']).toBe('86400');
    });

    it('should NOT include Access-Control-Allow-Credentials', () => {
      // We don't use credentials since authentication is via JWT in header, not cookies
      expect(cors).not.toHaveProperty('Access-Control-Allow-Credentials');
    });
  });

  describe('ok()', () => {
    it('should return 200 with CORS headers', () => {
      const response = ok({ message: 'test' });
      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual(cors);
      expect(JSON.parse(response.body)).toEqual({ message: 'test' });
    });

    it('should accept custom status code', () => {
      const response = ok({ id: '123' }, 201);
      expect(response.statusCode).toBe(201);
      expect(response.headers).toEqual(cors);
    });

    it('should include wildcard origin in headers', () => {
      const response = ok({ test: true });
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('bad()', () => {
    it('should return 400 with CORS headers', () => {
      const response = bad('Invalid request');
      expect(response.statusCode).toBe(400);
      expect(response.headers).toEqual(cors);
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid request' });
    });

    it('should accept custom status code', () => {
      const response = bad('Validation failed', 422);
      expect(response.statusCode).toBe(422);
      expect(response.headers).toEqual(cors);
    });

    it('should accept error object', () => {
      const response = bad({ error: 'test', code: 'ERR_001' });
      expect(JSON.parse(response.body)).toEqual({ error: 'test', code: 'ERR_001' });
    });

    it('should include wildcard origin in headers', () => {
      const response = bad('Error');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('serverError()', () => {
    it('should return 500 with CORS headers', () => {
      const response = serverError();
      expect(response.statusCode).toBe(500);
      expect(response.headers).toEqual(cors);
      expect(JSON.parse(response.body)).toEqual({ error: 'Internal server error' });
    });

    it('should accept custom message', () => {
      const response = serverError('Database connection failed');
      expect(JSON.parse(response.body)).toEqual({ error: 'Database connection failed' });
    });

    it('should include wildcard origin in headers', () => {
      const response = serverError();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('notFound()', () => {
    it('should return 404 with CORS headers', () => {
      const response = notFound();
      expect(response.statusCode).toBe(404);
      expect(response.headers).toEqual(cors);
      expect(JSON.parse(response.body)).toEqual({ error: 'Resource not found' });
    });

    it('should accept custom message', () => {
      const response = notFound('Project not found');
      expect(JSON.parse(response.body)).toEqual({ error: 'Project not found' });
    });

    it('should include wildcard origin in headers', () => {
      const response = notFound();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('unauthorized()', () => {
    it('should return 401 with CORS headers', () => {
      const response = unauthorized();
      expect(response.statusCode).toBe(401);
      expect(response.headers).toEqual(cors);
      expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
    });

    it('should accept custom message', () => {
      const response = unauthorized('Token expired');
      expect(JSON.parse(response.body)).toEqual({ error: 'Token expired' });
    });

    it('should include wildcard origin in headers', () => {
      const response = unauthorized();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('noContent()', () => {
    it('should return 204 with CORS headers', () => {
      const response = noContent();
      expect(response.statusCode).toBe(204);
      expect(response.headers).toEqual(cors);
      expect(response.body).toBe('');
    });

    it('should accept custom status code', () => {
      const response = noContent(200);
      expect(response.statusCode).toBe(200);
    });

    it('should include wildcard origin in headers', () => {
      const response = noContent();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('CORS headers consistency', () => {
    it('all response functions should return identical CORS headers', () => {
      const responses = [
        ok({ test: true }),
        bad('error'),
        serverError(),
        notFound(),
        unauthorized(),
        noContent(),
      ];

      responses.forEach((response) => {
        expect(response.headers).toEqual(cors);
      });
    });

    it('CORS headers should be present on every response', () => {
      const responses = [
        ok({ test: true }),
        bad('error'),
        serverError(),
        notFound(),
        unauthorized(),
        noContent(),
      ];

      responses.forEach((response) => {
        expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
        expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
        expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
        expect(response.headers).toHaveProperty('Access-Control-Max-Age');
      });
    });
  });
});
