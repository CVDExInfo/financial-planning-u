import { URL } from 'url';
import { httpRequest, HttpRequestOptions } from './httpClient';
import { OAuthSecret } from './secrets';

export interface AccessTokenResponse {
  access_token: string;
}

// planview/qa/oauth secret JSON:
// {
//   "client_id": "<access key>",
//   "client_secret": "<token/secret>",
//   "base_url": "https://ikusi-sb.pvcloud.com/planview/public-api/v1"
// }
export async function getAccessToken(oauthSecret: OAuthSecret, requester: typeof httpRequest = httpRequest): Promise<string> {
  const rawBase = oauthSecret.base_url;
  if (!rawBase || !rawBase.startsWith('http')) {
    throw new Error(
      `Invalid or missing base_url in OAuth secret. Got "${rawBase ?? ''}". ` +
        'Expected something like "https://ikusi-sb.pvcloud.com/planview/public-api/v1".',
    );
  }

  const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const tokenUrl = new URL('oauth/token', baseUrl);
  console.info('Requesting Planview OAuth token from', tokenUrl.toString());

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: oauthSecret.client_id,
    client_secret: oauthSecret.client_secret,
  });
  const body = params.toString();

  const requestOptions: HttpRequestOptions = {
    method: 'POST',
    protocol: tokenUrl.protocol,
    hostname: tokenUrl.hostname,
    port: tokenUrl.port || undefined,
    path: tokenUrl.pathname + tokenUrl.search,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      Accept: 'application/json',
    },
  };

  const response = await requester(requestOptions, body);
  const parsed: Partial<AccessTokenResponse> = JSON.parse(response);
  if (!parsed.access_token) {
    throw new Error('access_token missing from OAuth response');
  }
  return parsed.access_token;
}
