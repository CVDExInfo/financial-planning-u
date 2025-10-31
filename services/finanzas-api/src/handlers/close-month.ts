import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement month close process
// R1 requirement: POST /close-month?mes=YYYY-MM
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const mes = event.queryStringParameters?.mes;

  if (!mes) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing mes parameter (YYYY-MM)' }) };
  }

  // TODO: Lock allocations, calculate final balances, generate reports
  return {
    statusCode: 501,
    body: JSON.stringify({ message: `POST /close-month?mes=${mes} - not implemented yet` })
  };
};
