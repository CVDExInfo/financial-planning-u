import { getAccessToken } from '../../src/lib/planviewOAuth';
import { OAuthSecret } from '../../src/lib/secrets';
import { HttpRequestOptions } from '../../src/lib/httpClient';

describe('getAccessToken', () => {
  const secret: OAuthSecret = {
    client_id: 'client',
    client_secret: 'secret',
    base_url: 'https://example.com',
  };

  it('builds multipart request with correct fields', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue(JSON.stringify({ access_token: 'token123' }));

    const token = await getAccessToken(secret, mockRequester as never);

    expect(token).toBe('token123');
    expect(mockRequester).toHaveBeenCalledTimes(1);
    const [options, body] = mockRequester.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.hostname).toBe('example.com');
    expect(options.path).toBe('/public-api/v1/oauth/token');
    expect(options.headers).toBeDefined();
    expect((options.headers as Record<string, unknown>)['Content-Type']).toContain('multipart/form-data');
    const payload = body?.toString() ?? '';
    expect(payload).toContain('grant_type');
    expect(payload).toContain('client_credentials');
    expect(payload).toContain('client_id');
    expect(payload).toContain('client');
    expect(payload).toContain('client_secret');
    expect(payload).toContain('secret');
  });

  it('throws when access_token missing', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue('{}');

    await expect(getAccessToken(secret, mockRequester as never)).rejects.toThrow('access_token missing');
  });
});
