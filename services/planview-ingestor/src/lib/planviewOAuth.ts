import { URL } from 'url';
import { httpRequest, HttpRequestOptions } from './httpClient';
import { OAuthSecret } from './secrets';

export interface AccessTokenResponse {
  access_token: string;
}

const buildMultipartBody = (fields: Record<string, string>): { body: string; contentType: string; contentLength: number } => {
  const boundary = `----planview-boundary-${Date.now()}`;
  const parts = Object.entries(fields)
    .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    .join('');
  const closing = `--${boundary}--\r\n`;
  const body = parts + closing;
  const contentLength = Buffer.byteLength(body);
  const contentType = `multipart/form-data; boundary=${boundary}`;
  return { body, contentType, contentLength };
};

export async function getAccessToken(oauthSecret: OAuthSecret, requester: typeof httpRequest = httpRequest): Promise<string> {
  const tokenUrl = new URL('/public-api/v1/oauth/token', oauthSecret.base_url);
  const { body, contentLength, contentType } = buildMultipartBody({
    grant_type: 'client_credentials',
    client_id: oauthSecret.client_id,
    client_secret: oauthSecret.client_secret,
  });

  const requestOptions: HttpRequestOptions = {
    method: 'POST',
    protocol: tokenUrl.protocol,
    hostname: tokenUrl.hostname,
    port: tokenUrl.port || undefined,
    path: tokenUrl.pathname + tokenUrl.search,
    headers: {
      'Content-Type': contentType,
      'Content-Length': contentLength,
    },
  };

  const response = await requester(requestOptions, body);
  const parsed: Partial<AccessTokenResponse> = JSON.parse(response);
  if (!parsed.access_token) {
    throw new Error('access_token missing from OAuth response');
  }
  return parsed.access_token;
}
