import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient, BatchWriteItemCommand, WriteRequest } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { buildBasicAuthHeader, fetchEntityAllPages } from '../lib/odataClient';
import { getSecretJson, ODataSecret } from '../lib/secrets';
import { writeJsonToS3 } from '../lib/s3Writer';

const ensureEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const dynamo = new DynamoDBClient({});

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const batchWriteAll = async (tableName: string, items: Record<string, unknown>[]): Promise<void> => {
  if (!items.length) return;

  const chunks = chunkArray(items, 25);

  for (const chunk of chunks) {
    let unprocessed: Record<string, WriteRequest[]> = {
      [tableName]: chunk.map((item) => ({
        PutRequest: {
          Item: marshall(item, { removeUndefinedValues: true }),
        },
      })),
    };

    let attempts = 0;
    do {
      const response = await dynamo.send(new BatchWriteItemCommand({ RequestItems: unprocessed }));
      unprocessed = (response.UnprocessedItems as Record<string, WriteRequest[]>) ?? {};
      const hasUnprocessed = Object.keys(unprocessed).length > 0;

      if (!hasUnprocessed) {
        break;
      }

      attempts += 1;
      const backoff = attempts * 100;
      console.warn(`Retrying batch write for ${tableName}, attempt ${attempts}`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    } while (attempts < 3);

    if (Object.keys(unprocessed).length > 0) {
      console.error(`Unprocessed items remain for ${tableName} after retries`, unprocessed);
    }
  }
};

interface EntityResultSummary {
  entity: string;
  count: number;
  key: string;
}

const buildRunTimestamp = (): string =>
  new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  const odataSecretId = process.env.ODATA_SECRET_ID || 'planview/qa/odata';
  const rawBucket = ensureEnv('RAW_BUCKET');
  const projectsTableName = process.env.PROJECTS_TABLE || 'PlanviewProjects';
  const financialFactsTableName = process.env.FINANCIAL_FACTS_TABLE || 'PlanviewFinancialFacts';
  const entities = (process.env.ODATA_ENTITIES || 'Project_Dimension,FinancialFacts')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (entities.length === 0) {
    throw new Error('No OData entities configured');
  }

  const secret = await getSecretJson<ODataSecret>(odataSecretId);
  const baseUrl = secret.odata_url;
  const authHeader = buildBasicAuthHeader(secret.username, secret.password);

  const runTimestamp = buildRunTimestamp();
  const results: EntityResultSummary[] = [];

  for (const entity of entities) {
    console.info(`Fetching OData entity ${entity}`);
    const items = await fetchEntityAllPages(baseUrl, entity, authHeader);
    const key = `odata/${entity}/run=${runTimestamp}.json`;
    const payload = JSON.stringify({ entity, count: items.length, data: items });
    await writeJsonToS3(rawBucket, key, payload);
    results.push({ entity, count: items.length, key });

    if (entity === 'Project_Dimension') {
      const projectsToWrite = items
        .map((item: Record<string, any>) => ({
          ppl_code: item.ppl_code ?? item.PPL_Code ?? item.Ppl_Code ?? item.structure_code,
          project_name: item.Project_Name ?? item.project_name,
          project_status: item.Project_Status ?? item.project_status,
          work_type: item.Work_Type ?? item.work_type,
          work_id: item.Work_ID ?? item.work_id,
          work_description: item.Work_Description ?? item.work_description,
          lifecycle_stage: item.Lifecycle_Stage ?? item.lifecycle_stage,
          overall_status_assessment:
            item.Overall_Status_Assessment ?? item.overall_status_assessment,
          raw: item,
        }))
        .filter((item) => item.ppl_code);

      await batchWriteAll(projectsTableName, projectsToWrite);
    }

    if (entity === 'FinancialFacts') {
      const factsToWrite = items
        .map((item: Record<string, any>) => ({
          ppl_code: item.structure_code ?? item.ppl_code ?? item.PPL_Code,
          period_id: item.period_id?.toString() ?? item.Period_ID?.toString(),
          account_type: item.Account_Type ?? item.account_type,
          cost_amount: item.COST_AMOUNT ?? item.cost_amount,
          benefit_amount: item.BENEFIT_AMOUNT ?? item.benefit_amount,
          baseline_cost: item.Baseline_Cost ?? item.baseline_cost,
          baseline_benefit: item.Baseline_Benefit ?? item.baseline_benefit,
          currency_code: item.Currency_Code ?? item.currency_code,
          currency_symbol: item.Currency_Symbol ?? item.currency_symbol,
          forecast_version_indicator:
            item.Forecast_Version_Indicator ?? item.forecast_version_indicator,
          baseline_version_indicator:
            item.Baseline_Version_Indicator ?? item.baseline_version_indicator,
          raw: item,
        }))
        .filter((item) => item.ppl_code && item.period_id);

      await batchWriteAll(financialFactsTableName, factsToWrite);
    }
  }

  const summary = {
    entities,
    results,
  };

  console.info('Planview OData ingest complete', summary);

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
};
