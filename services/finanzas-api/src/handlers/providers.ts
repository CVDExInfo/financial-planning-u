import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement providers (vendors) management
// R1 requirement: POST/GET /providers
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const method = event.requestContext.http.method;

  if (method === 'POST') {
    // TODO: Create provider entry
    return {
      statusCode: 501,
      body: JSON.stringify({ message: 'POST /providers - not implemented yet' })
    };
  }

  // GET - list providers
  // TODO: Query providers table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'GET /providers - not implemented yet' })
  };
};
