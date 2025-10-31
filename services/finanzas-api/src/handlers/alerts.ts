import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement alerts retrieval
// R1 requirement: GET /alerts
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  // TODO: Query alerts table for active alerts
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'GET /alerts - not implemented yet', alerts: [] })
  };
};
