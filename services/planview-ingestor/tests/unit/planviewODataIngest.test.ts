import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getSecretJson } from '../../src/lib/secrets';
import { fetchEntityAllPages } from '../../src/lib/odataClient';
import { writeJsonToS3 } from '../../src/lib/s3Writer';
import { handler } from '../../src/handlers/planviewODataIngest';

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  const sendMock = jest.fn();
  return {
    ...actual,
    DynamoDBClient: jest.fn(() => ({
      send: sendMock,
    })),
    __sendMock: sendMock,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/client-dynamodb') as {
  __sendMock: jest.Mock;
};

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
    sendMock.mockReset();
    sendMock.mockResolvedValue({ UnprocessedItems: {} });
    jest.useFakeTimers().setSystemTime(new Date('2024-01-02T03:04:05.678Z'));
    process.env = { ...originalEnv };
    process.env.RAW_BUCKET = 'planview-ingest-qa-703671891952';
    process.env.ODATA_ENTITIES = 'Project_Dimension,FinancialFacts';
    process.env.ODATA_SECRET_ID = 'planview/qa/odata';

    mockedGetSecretJson.mockResolvedValue({
      username: 'TOKEN123',
      password: '',
      odata_url: 'https://example.com/odataservice/odataservice.svc',
    } as any);

    mockedFetchEntityAllPages
      .mockResolvedValueOnce([
        {
          ppl_code: 'PPL-001',
          Project_Name: 'Project A',
          Project_Status: 'Active',
          Work_Type: 'Type A',
          Lifecycle_Stage: 'Stage 1',
        },
      ])
      .mockResolvedValueOnce([
        {
          structure_code: 'PPL-001',
          period_id: '202401',
          Account_Type: 'Cost',
          COST_AMOUNT: 100,
          BENEFIT_AMOUNT: 0,
          Currency_Code: 'USD',
        },
        {
          structure_code: 'PPL-002',
          period_id: '202402',
          Account_Type: 'Benefit',
          COST_AMOUNT: 0,
          BENEFIT_AMOUNT: 200,
        },
      ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fetches entities, writes to S3, and returns summary', async () => {
    const response = (await handler()) as APIGatewayProxyStructuredResultV2;

    expect(mockedGetSecretJson).toHaveBeenCalledWith('planview/qa/odata');
    expect(mockedFetchEntityAllPages).toHaveBeenCalledTimes(2);
    expect(mockedFetchEntityAllPages).toHaveBeenCalledWith(
      'https://example.com/odataservice/odataservice.svc',
      'Project_Dimension',
      expect.any(String),
    );

    const expectedKey1 = 'odata/Project_Dimension/run=20240102T030405Z.json';
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
    expect(body1).toMatchObject({
      entity: 'Project_Dimension',
      count: 1,
      data: [
        expect.objectContaining({
          ppl_code: 'PPL-001',
          Project_Name: 'Project A',
        }),
      ],
    });

    const body2 = JSON.parse(mockedWriteJsonToS3.mock.calls[1][2]);
    expect(body2).toMatchObject({
      entity: 'FinancialFacts',
      count: 2,
      data: expect.arrayContaining([expect.objectContaining({ period_id: '202401' })]),
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    const projectWrite = sendMock.mock.calls[0][0] as any;
    const financialWrite = sendMock.mock.calls[1][0] as any;

    expect(projectWrite.input.RequestItems.PlanviewProjects).toHaveLength(1);
    const marshalledProject = projectWrite.input.RequestItems.PlanviewProjects[0].PutRequest.Item;
    expect(marshalledProject).toEqual(
      expect.objectContaining({
        ppl_code: { S: 'PPL-001' },
        project_name: { S: 'Project A' },
      }),
    );

    expect(financialWrite.input.RequestItems.PlanviewFinancialFacts).toHaveLength(2);
    const firstFact = financialWrite.input.RequestItems.PlanviewFinancialFacts[0].PutRequest.Item;
    expect(firstFact).toEqual(
      expect.objectContaining({
        ppl_code: { S: 'PPL-001' },
        period_id: { S: '202401' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const parsed = JSON.parse(response.body as string);
    expect(parsed.entities).toEqual(['Project_Dimension', 'FinancialFacts']);
    expect(parsed.results).toEqual([
      { entity: 'Project_Dimension', count: 1, key: expectedKey1 },
      { entity: 'FinancialFacts', count: 2, key: expectedKey2 },
    ]);
  });
});
