import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import * as dynamo from '../src/lib/dynamo';

const dynamoClientMock = mockClient(DynamoDBClient);
const docClientMock = mockClient(DynamoDBDocumentClient);

docClientMock.on(GetCommand).resolves({ Item: {} });
docClientMock.on(ScanCommand).resolves({ Items: [] });
docClientMock.on(PutCommand).resolves({});
docClientMock.on(QueryCommand).resolves({ Items: [] });

docClientMock.onAnyCommand().resolves({});
dynamoClientMock.onAnyCommand().resolves({});

const originalProjectExists = dynamo.projectExists;
const originalGetRubroTaxonomy = dynamo.getRubroTaxonomy;

const projectExistsMock = jest.spyOn(dynamo, 'projectExists');
const getRubroTaxonomyMock = jest.spyOn(dynamo, 'getRubroTaxonomy');

beforeEach(() => {
  projectExistsMock.mockResolvedValue(true);
  getRubroTaxonomyMock.mockImplementation(async rubroId => ({
    code: rubroId,
    description: '',
    category: '',
  }));
});

export {
  projectExistsMock,
  getRubroTaxonomyMock,
  originalProjectExists,
  originalGetRubroTaxonomy,
};
