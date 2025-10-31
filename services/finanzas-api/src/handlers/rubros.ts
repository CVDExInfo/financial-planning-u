import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement project rubros (budget line items) management
// R1 requirement: POST/GET /projects/{id}/rubros
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const projectId = event.pathParameters?.id;
  const method = event.requestContext.http.method;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing project id' }) };
  }

  if (method === 'POST') {
    // TODO: Create/update rubro for project
    return {
      statusCode: 501,
      body: JSON.stringify({ message: 'POST /projects/{id}/rubros - not implemented yet' })
    };
  }

  // GET - list rubros for project
  // TODO: Fetch from DynamoDB rubros table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'GET /projects/{id}/rubros - not implemented yet' })
  };
};
