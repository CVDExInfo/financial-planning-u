// Fixed missing closing brace to resolve ESLint parsing error (CI gate).
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
  
  let parsed: any;
  try {
    parsed = JSON.parse(response);
  } catch (err) {
    console.error("Failed to parse OAuth token response", {
      snippet: String(response).slice(0, 500),
    });
    throw new Error(
      `Unable to parse OAuth token response: ${(err as Error).message}`
    );
  }
  
  if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
    return parsed.access_token;
  }
  
  // Fallback: some APIs use "accessToken"
  if (typeof parsed.accessToken === "string" && parsed.accessToken.length > 0) {
    console.warn(
      'OAuth response used "accessToken" instead of "access_token"; using it.'
    );
    return parsed.accessToken;
  }
  
  console.error("OAuth token response missing expected access_token property", {
    snippet: JSON.stringify(parsed).slice(0, 500),
  });
  
  throw new Error(
    `access_token missing from OAuth response: ${JSON.stringify(parsed).slice(
      0,
      500
    )}`
  );
}
