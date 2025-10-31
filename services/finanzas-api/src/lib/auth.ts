import { APIGatewayProxyEventV2 } from 'aws-lambda';

export function ensureSDT(event: APIGatewayProxyEventV2) {
  const claims = (event.requestContext.authorizer as any)?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: 'unauthorized' };

  // Cognito typically returns groups as an array
  const groups: string[] = Array.isArray(claims['cognito:groups'])
    ? claims['cognito:groups']
    : [];

  if (!groups.includes('SDT')) {
    throw { statusCode: 403, body: 'forbidden: SDT required' };
  }
}
