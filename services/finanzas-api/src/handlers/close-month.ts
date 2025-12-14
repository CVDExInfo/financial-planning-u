import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { bad, notImplemented } from '../lib/http';

// TODO: Implement month close process
// R1 requirement: POST /close-month?mes=YYYY-MM
export const handler = async (event: APIGatewayProxyEventV2) => {
  await ensureSDT(event);
  const mes = event.queryStringParameters?.mes;

  if (!mes) {
    return bad('missing mes parameter (YYYY-MM)');
  }

  // TODO: Lock allocations, calculate final balances, generate reports
  return notImplemented(`POST /close-month?mes=${mes} - not implemented yet`);
};
