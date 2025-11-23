import { httpRequest } from '../../src/lib/httpClient';
import { buildBasicAuthHeader, fetchEntityAllPages } from '../../src/lib/odataClient';

jest.mock('../../src/lib/httpClient');

const mockedHttpRequest = jest.mocked(httpRequest);

describe('odataClient', () => {
  beforeEach(() => {
    mockedHttpRequest.mockReset();
  });

  it('uses explicit password when provided', () => {
    const header = buildBasicAuthHeader('user', 'pass');
    expect(header).toBe('Basic dXNlcjpwYXNz');
  });

  it('uses username as password when password is missing (token:token)', () => {
    const header = buildBasicAuthHeader('TOKEN123');
    const expected = Buffer.from('TOKEN123:TOKEN123').toString('base64');
    expect(header).toBe(`Basic ${expected}`);
  });

  it('fetchEntityAllPages retrieves single page value array', async () => {
    mockedHttpRequest.mockResolvedValueOnce(
      JSON.stringify({
        value: [{ id: 1 }],
      }),
    );

    const items = await fetchEntityAllPages('https://example.com/odata', 'Activity', 'Basic abc');

    expect(items).toEqual([{ id: 1 }]);
    expect(mockedHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        hostname: 'example.com',
        path: '/odata/Activity',
      }),
    );
  });

  it('fetchEntityAllPages follows @odata.nextLink pagination', async () => {
    mockedHttpRequest
      .mockResolvedValueOnce(
        JSON.stringify({
          value: [{ id: 1 }],
          '@odata.nextLink': 'https://example.com/odata/Activity?$skiptoken=abc',
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          value: [{ id: 2 }, { id: 3 }],
        }),
      );

    const items = await fetchEntityAllPages('https://example.com/odata', 'Activity', 'Basic abc');

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(mockedHttpRequest).toHaveBeenCalledTimes(2);
    expect(mockedHttpRequest.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        path: '/odata/Activity',
      }),
    );
    expect(mockedHttpRequest.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        path: '/odata/Activity?$skiptoken=abc',
      }),
    );
  });

  it('logs a helpful error when redirected to login', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockedHttpRequest.mockRejectedValueOnce(new Error('HTTP 302 https://example.com/planview/login/'));

    await expect(
      fetchEntityAllPages('https://example.com/odata', 'Activity', 'Basic abc'),
    ).rejects.toThrow('HTTP 302 https://example.com/planview/login/');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Planview OData redirected to login. This indicates the service is treating the request as unauthenticated.',
      { url: 'https://example.com/odata/Activity' },
    );
    consoleSpy.mockRestore();
  });

  it('logs a helpful error when receiving 401 unauthorized', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockedHttpRequest.mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'));

    await expect(
      fetchEntityAllPages('https://example.com/odata', 'Activity', 'Basic abc'),
    ).rejects.toThrow('HTTP 401 Unauthorized');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Planview OData returned 401 Unauthorized. This usually means the auth token is invalid, expired, or the "Use OData Feed" feature is not enabled for this user.',
      { url: 'https://example.com/odata/Activity' },
    );
    consoleSpy.mockRestore();
  });

  it('fetchEntityAllPages supports legacy d.results format', async () => {
    mockedHttpRequest.mockResolvedValueOnce(
      JSON.stringify({
        d: {
          results: [{ legacy: true }],
        },
      }),
    );

    const items = await fetchEntityAllPages('https://example.com/odata', 'Legacy', 'Basic abc');
    expect(items).toEqual([{ legacy: true }]);
  });
});
