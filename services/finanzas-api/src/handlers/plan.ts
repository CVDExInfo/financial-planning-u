import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement financial plan generation for a given month
// R1 requirement: GET /projects/{id}/plan?mes=YYYY-MM
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const projectId = event.pathParameters?.id;
  const mes = event.queryStringParameters?.mes;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing project id' }) };
  }

  if (!mes) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing mes parameter (YYYY-MM)' }) };
  }

  // TODO: Generate financial plan from allocations, payroll, adjustments
  return {
    statusCode: 501,
    body: JSON.stringify({ message: `GET /projects/${projectId}/plan?mes=${mes} - not implemented yet` })
  };
};
