"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const planviewOAuth_1 = require("../../src/lib/planviewOAuth");
describe('getAccessToken', () => {
    const secret = {
        client_id: 'client',
        client_secret: 'secret',
        base_url: 'https://example.com',
    };
    it('builds multipart request with correct fields', async () => {
        const mockRequester = jest.fn();
        mockRequester.mockResolvedValue(JSON.stringify({ access_token: 'token123' }));
        const token = await (0, planviewOAuth_1.getAccessToken)(secret, mockRequester);
        expect(token).toBe('token123');
        expect(mockRequester).toHaveBeenCalledTimes(1);
        const [options, body] = mockRequester.mock.calls[0];
        expect(options.method).toBe('POST');
        expect(options.hostname).toBe('example.com');
        expect(options.path).toBe('/public-api/v1/oauth/token');
        expect(options.headers).toBeDefined();
        expect(options.headers['Content-Type']).toContain('multipart/form-data');
        const payload = body?.toString() ?? '';
        expect(payload).toContain('grant_type');
        expect(payload).toContain('client_credentials');
        expect(payload).toContain('client_id');
        expect(payload).toContain('client');
        expect(payload).toContain('client_secret');
        expect(payload).toContain('secret');
    });
    it('throws when access_token missing', async () => {
        const mockRequester = jest.fn();
        mockRequester.mockResolvedValue('{}');
        await expect((0, planviewOAuth_1.getAccessToken)(secret, mockRequester)).rejects.toThrow('access_token missing');
    });
});
