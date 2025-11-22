import { getAccessToken } from '../../src/lib/planviewOAuth';
import { OAuthSecret } from '../../src/lib/secrets';
import { HttpRequestOptions } from '../../src/lib/httpClient';

describe('getAccessToken', () => {
  const secret: OAuthSecret = {
    client_id: 'client',
    client_secret: 'secret',
    base_url: 'https://example.com/myserver/public-api/v1',
  };

  it('builds urlencoded request with correct fields', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue(JSON.stringify({ access_token: 'token123' }));

    const token = await getAccessToken(secret, mockRequester as never);

    expect(token).toBe('token123');
    expect(mockRequester).toHaveBeenCalledTimes(1);
    const [options, body] = mockRequester.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.hostname).toBe('example.com');
    expect(options.path).toBe('/myserver/public-api/v1/oauth/token');
    expect(options.headers).toBeDefined();
    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const payload = body?.toString() ?? '';
    expect(payload).toContain('grant_type=client_credentials');
    expect(payload).toContain('client_id=client');
    expect(payload).toContain('client_secret=secret');
  });

  it('throws when access_token missing', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue('{"foo":"bar"}');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getAccessToken(secret, mockRequester as never)).rejects.toThrow('access_token missing from OAuth response');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('accepts accessToken variant with warning', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue(JSON.stringify({ accessToken: 'token456' }));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const token = await getAccessToken(secret, mockRequester as never);

    expect(token).toBe('token456');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs and throws on parse failure', async () => {
    const mockRequester = jest.fn<Promise<string>, [HttpRequestOptions, string | Buffer | undefined]>();
    mockRequester.mockResolvedValue('not-json');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getAccessToken(secret, mockRequester as never)).rejects.toThrow('Unable to parse OAuth token response');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
