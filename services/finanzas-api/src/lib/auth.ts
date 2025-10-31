import { APIGatewayProxyEventV2 } from 'aws-lambda';

export function ensureSDT(event: APIGatewayProxyEventV2) {
  const claims = (event.requestContext.authorizer as any)?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: 'unauthorized' };

  const groups: string[] =
    typeof claims['cognito:groups'] === 'string'
      ? (claims['cognito:groups'] as string).split(',')
      : (claims['cognito:groups'] as string[]) || [];

  if (!groups.includes('SDT')) {
    throw { statusCode: 403, body: 'forbidden: SDT required' };
  }
}
