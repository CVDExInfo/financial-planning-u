import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement pre-invoice webhook for external integrations
// R1 requirement: POST/GET /prefacturas/webhook
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const method = event.requestContext.http.method;

  if (method === 'POST') {
    // TODO: Process incoming webhook for pre-invoice
    return {
      statusCode: 501,
      body: JSON.stringify({ message: 'POST /prefacturas/webhook - not implemented yet' })
    };
  }

  // GET - retrieve webhook status/history
  // TODO: Query webhook logs
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'GET /prefacturas/webhook - not implemented yet' })
  };
};
