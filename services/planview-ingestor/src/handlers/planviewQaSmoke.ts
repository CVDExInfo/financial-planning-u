import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getSecretJson, OAuthSecret, ODataSecret } from '../lib/secrets';
import { getAccessToken } from '../lib/planviewOAuth';
import { httpRequest } from '../lib/httpClient';
import { writeJsonToS3 } from '../lib/s3Writer';

interface SmokeResponse {
  workItems: number;
  bucket: string;
  key: string;
  odataStatus: string;
}

const env = process.env;

const ensureEnv = (name: string): string => {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

async function fetchWorkItems(oauthSecret: OAuthSecret, testProjectId: string, accessToken: string): Promise<{ body: string; count: number }> {
  const baseUrl = oauthSecret.base_url;
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error(
      `Invalid or missing base_url in OAuth secret. Got "${baseUrl ?? ''}".`,
    );
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const workUrl = new URL(`work?filter=project.Id%20.eq%20${encodeURIComponent(testProjectId)}`, normalizedBaseUrl);
  console.info('Requesting Planview work from', workUrl.toString());
  const responseBody = await httpRequest(
    {
      method: 'GET',
      protocol: workUrl.protocol,
      hostname: workUrl.hostname,
      port: workUrl.port || undefined,
      path: workUrl.pathname + workUrl.search,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch (err) {
    console.error('Failed to parse work response', err);
    throw new Error('Invalid JSON response from Planview Work endpoint');
  }

  const dataArray = (parsed as { data?: unknown }).data;
  const count = Array.isArray(dataArray) ? dataArray.length : 0;

  return { body: responseBody, count };
}

async function checkOData(secretId: string): Promise<string> {
  try {
    const odataSecret = await getSecretJson<ODataSecret>(secretId);
    const baseODataUrl = odataSecret.odata_url;
    if (!baseODataUrl || !baseODataUrl.startsWith('http')) {
      throw new Error(
        `Invalid or missing odata_url in OData secret. Got "${baseODataUrl ?? ''}". ` +
          'Expected something like "https://ikusi-sb.pvcloud.com/planview/odataservice/odataservice.svc".',
      );
    }

    const metadataUrl = `${baseODataUrl.replace(/\/+$/, '')}/$metadata`;
    console.info('Requesting Planview OData metadata from', metadataUrl);
    const basicAuthHeader = `Basic ${Buffer.from(`${odataSecret.username}:${odataSecret.password || ''}`).toString('base64')}`;
    const url = new URL(metadataUrl);
    await httpRequest({
      method: 'GET',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      headers: {
        Authorization: basicAuthHeader,
        Accept: 'application/xml',
      },
    });
    return 'ok';
  } catch (error) {
    console.warn('OData metadata check failed', error);
    return 'failed';
  }
}

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const oauthSecretId = ensureEnv('OAUTH_SECRET_ID');
  const odataSecretId = env.ODATA_SECRET_ID;
  const bucket = ensureEnv('RAW_BUCKET');
  const testProjectId = ensureEnv('TEST_PROJECT_ID');

  console.info('Starting Planview QA smoke test');
  const oauthSecret = await getSecretJson<OAuthSecret>(oauthSecretId);
  const accessToken = await getAccessToken(oauthSecret);

  const { body: workBody, count } = await fetchWorkItems(oauthSecret, testProjectId, accessToken);

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const key = `raw/work/env=qa/test-project-${testProjectId}-${timestamp}.json`;
  await writeJsonToS3(bucket, key, workBody);

  const odataStatus = odataSecretId ? await checkOData(odataSecretId) : 'skipped';

  const response: SmokeResponse = {
    workItems: count,
    bucket,
    key,
    odataStatus,
  };

  console.info('Planview QA smoke test complete', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};
