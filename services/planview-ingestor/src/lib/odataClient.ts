import { httpRequest } from './httpClient';

export interface ODataPage<T = any> {
  value?: T[];
  '@odata.nextLink'?: string;
  d?: {
    results?: T[];
    '__next'?: string;
  };
}

export const buildBasicAuthHeader = (username: string, password?: string): string => {
  // For Planview OData, the E1 Postman collection sets both username and password to the auth token.
  // If password is not provided, reuse username as password, so creds = "token:token".
  const effectivePassword = password && password.length > 0 ? password : username;

  const creds = `${username}:${effectivePassword}`;
  const encoded = Buffer.from(creds, 'utf-8').toString('base64');
  return `Basic ${encoded}`;
};

const fetchEntityPage = async (url: string, authHeader: string): Promise<ODataPage> => {
  const parsed = new URL(url);
  let responseBody: string;
  try {
    responseBody = await httpRequest(
      {
        method: 'GET',
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );
  } catch (err) {
    const message = (err as Error).message || '';
    if (message.startsWith('HTTP 401')) {
      console.error(
        'Planview OData returned 401 Unauthorized. This usually means the auth token is invalid, expired, or the "Use OData Feed" feature is not enabled for this user.',
        { url },
      );
    } else if (message.startsWith('HTTP 302') && message.includes('/planview/login/')) {
      console.error('Planview OData redirected to login. This indicates the service is treating the request as unauthenticated.', {
        url,
      });
    }
    throw err;
  }

  try {
    return JSON.parse(responseBody) as ODataPage;
  } catch (error) {
    console.error('Failed to parse OData response for', url, error);
    throw new Error('Invalid JSON response from OData service');
  }
};

export const fetchEntityAllPages = async (
  baseUrl: string,
  entity: string,
  authHeader: string,
): Promise<any[]> => {
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error(`Invalid baseUrl provided for OData: "${baseUrl ?? ''}"`);
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let nextUrl: string | undefined = `${normalizedBase}/${entity}`;
  const allItems: any[] = [];

  while (nextUrl) {
    const page = await fetchEntityPage(nextUrl, authHeader);
    const pageItems = Array.isArray(page.value)
      ? page.value
      : Array.isArray(page.d?.results)
        ? page.d?.results || []
        : [];
    allItems.push(...pageItems);

    nextUrl = page['@odata.nextLink'] || page.d?.['__next'];
  }

  return allItems;
};

export { fetchEntityPage };
