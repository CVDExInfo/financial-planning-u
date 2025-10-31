import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement bulk allocations update
// R1 requirement: PUT /projects/{id}/allocations:bulk
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const projectId = event.pathParameters?.id;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing project id' }) };
  }

  // TODO: Parse bulk allocation data and update DynamoDB allocations table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'PUT /projects/{id}/allocations:bulk - not implemented yet' })
  };
};
