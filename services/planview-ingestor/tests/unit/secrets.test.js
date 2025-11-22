"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const secrets_1 = require("../../src/lib/secrets");
describe('getSecretJson', () => {
    it('parses OAuth secret correctly', async () => {
        const mockClient = {
            send: jest.fn(async () => ({ SecretString: JSON.stringify({ client_id: 'a', client_secret: 'b', base_url: 'https://example.com' }) })),
        };
        const value = await (0, secrets_1.getSecretJson)('test', mockClient);
        expect(value.client_id).toBe('a');
        expect(value.client_secret).toBe('b');
        expect(value.base_url).toBe('https://example.com');
    });
    it('parses OData secret correctly', async () => {
        const mockClient = {
            send: jest.fn(async () => ({ SecretString: JSON.stringify({ username: 'user', password: 'pass', odata_url: 'http://odata' }) })),
        };
        const value = await (0, secrets_1.getSecretJson)('odata', mockClient);
        expect(value.username).toBe('user');
        expect(value.password).toBe('pass');
        expect(value.odata_url).toBe('http://odata');
    });
    it('throws when secret string missing', async () => {
        const mockClient = {
            send: jest.fn(async () => ({})),
        };
        await expect((0, secrets_1.getSecretJson)('missing', mockClient)).rejects.toThrow('Secret missing has no string value');
    });
});
