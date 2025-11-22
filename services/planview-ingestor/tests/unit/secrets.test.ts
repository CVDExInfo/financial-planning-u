import { getSecretJson, OAuthSecret, ODataSecret } from '../../src/lib/secrets';
import { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

describe('getSecretJson', () => {
  it('parses OAuth secret correctly', async () => {
    const mockClient = {
      send: jest.fn(async () => ({ SecretString: JSON.stringify({ client_id: 'a', client_secret: 'b', base_url: 'https://example.com' }) } as GetSecretValueCommandOutput)),
    } as unknown as SecretsManagerClient;

    const value = await getSecretJson<OAuthSecret>('test', mockClient);
    expect(value.client_id).toBe('a');
    expect(value.client_secret).toBe('b');
    expect(value.base_url).toBe('https://example.com');
  });

  it('parses OData secret correctly', async () => {
    const mockClient = {
      send: jest.fn(async () => ({ SecretString: JSON.stringify({ username: 'user', password: 'pass', odata_url: 'http://odata' }) } as GetSecretValueCommandOutput)),
    } as unknown as SecretsManagerClient;

    const value = await getSecretJson<ODataSecret>('odata', mockClient);
    expect(value.username).toBe('user');
    expect(value.password).toBe('pass');
    expect(value.odata_url).toBe('http://odata');
  });

  it('throws when secret string missing', async () => {
    const mockClient = {
      send: jest.fn(async () => ({}) as GetSecretValueCommandOutput),
    } as unknown as SecretsManagerClient;

    await expect(getSecretJson<ODataSecret>('missing', mockClient)).rejects.toThrow('Secret missing has no string value');
  });
});
