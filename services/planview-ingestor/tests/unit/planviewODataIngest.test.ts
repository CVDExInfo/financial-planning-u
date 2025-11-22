import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecretJson } from '../../src/lib/secrets';
import { fetchEntityAllPages } from '../../src/lib/odataClient';
import { writeJsonToS3 } from '../../src/lib/s3Writer';
import { handler } from '../../src/handlers/planviewODataIngest';

jest.mock('../../src/lib/secrets');
jest.mock('../../src/lib/odataClient', () => {
  const actual = jest.requireActual('../../src/lib/odataClient');
  return {
    ...actual,
    fetchEntityAllPages: jest.fn(),
  };
});
jest.mock('../../src/lib/s3Writer');

const mockedGetSecretJson = jest.mocked(getSecretJson);
const mockedFetchEntityAllPages = jest.mocked(fetchEntityAllPages);
const mockedWriteJsonToS3 = jest.mocked(writeJsonToS3);

describe('planviewODataIngest handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-02T03:04:05.678Z'));
    process.env = { ...originalEnv };
    process.env.RAW_BUCKET = 'planview-ingest-qa-703671891952';
    process.env.ODATA_ENTITIES = 'Activity,FinancialFacts';
    process.env.ODATA_SECRET_ID = 'planview/qa/odata';

    mockedGetSecretJson.mockResolvedValue({
      username: 'TOKEN123',
      password: '',
      odata_url: 'https://example.com/odataservice/odataservice.svc',
    } as any);

    mockedFetchEntityAllPages
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fetches entities, writes to S3, and returns summary', async () => {
    const response = (await handler({} as any, {} as any, () => undefined)) as APIGatewayProxyResult;

    expect(mockedGetSecretJson).toHaveBeenCalledWith('planview/qa/odata');
    expect(mockedFetchEntityAllPages).toHaveBeenCalledTimes(2);
    expect(mockedFetchEntityAllPages).toHaveBeenCalledWith(
      'https://example.com/odataservice/odataservice.svc',
      'Activity',
      expect.any(String),
    );

    const expectedKey1 = 'odata/Activity/run=20240102T030405Z.json';
    const expectedKey2 = 'odata/FinancialFacts/run=20240102T030405Z.json';

    expect(mockedWriteJsonToS3).toHaveBeenNthCalledWith(
      1,
      'planview-ingest-qa-703671891952',
      expectedKey1,
      expect.any(String),
    );
    expect(mockedWriteJsonToS3).toHaveBeenNthCalledWith(
      2,
      'planview-ingest-qa-703671891952',
      expectedKey2,
      expect.any(String),
    );

    const body1 = JSON.parse(mockedWriteJsonToS3.mock.calls[0][2]);
    expect(body1).toMatchObject({ entity: 'Activity', count: 1, data: [{ id: 1 }] });

    const body2 = JSON.parse(mockedWriteJsonToS3.mock.calls[1][2]);
    expect(body2).toMatchObject({ entity: 'FinancialFacts', count: 2, data: [{ id: 2 }, { id: 3 }] });

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.entities).toEqual(['Activity', 'FinancialFacts']);
    expect(parsed.results).toEqual([
      { entity: 'Activity', count: 1, key: expectedKey1 },
      { entity: 'FinancialFacts', count: 2, key: expectedKey2 },
    ]);
  });
});
