import { httpRequest } from '../../src/lib/httpClient';
import { buildBasicAuthHeader, fetchEntityAllPages } from '../../src/lib/odataClient';

jest.mock('../../src/lib/httpClient');

const mockedHttpRequest = jest.mocked(httpRequest);

describe('odataClient', () => {
  beforeEach(() => {
    mockedHttpRequest.mockReset();
  });

  it('buildBasicAuthHeader encodes credentials', () => {
    const header = buildBasicAuthHeader('user', 'pass');
    expect(header).toBe('Basic dXNlcjpwYXNz');
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
