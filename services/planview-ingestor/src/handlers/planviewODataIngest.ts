import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
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

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const odataSecretId = process.env.ODATA_SECRET_ID || 'planview/qa/odata';
  const rawBucket = ensureEnv('RAW_BUCKET');
  const entities = (process.env.ODATA_ENTITIES || 'Activity')
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
