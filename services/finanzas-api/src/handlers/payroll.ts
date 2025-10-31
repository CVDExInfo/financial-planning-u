import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';

// TODO: Implement payroll data ingestion
// R1 requirement: POST /payroll/ingest
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  // TODO: Parse payroll file (CSV/Excel) and insert into payroll_actuals table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'POST /payroll/ingest - not implemented yet' })
  };
};
