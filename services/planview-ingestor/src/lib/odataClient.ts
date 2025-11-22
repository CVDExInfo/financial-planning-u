import { httpRequest } from './httpClient';

export interface ODataPage<T = any> {
  value?: T[];
  '@odata.nextLink'?: string;
  d?: {
    results?: T[];
    '__next'?: string;
  };
}

export const buildBasicAuthHeader = (username: string, password = ''): string => {
  const credentials = `${username}:${password ?? ''}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
};

const fetchEntityPage = async (url: string, authHeader: string): Promise<ODataPage> => {
  const parsed = new URL(url);
  const responseBody = await httpRequest(
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
