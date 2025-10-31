import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ddb, tableName } from '../lib/dynamo';

export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const id = event.pathParameters?.id;
  if (!id) return { statusCode: 400, body: 'missing project id' };

  const body = JSON.parse(event.body ?? '{}');
  const now = new Date().toISOString();

  const handoff = {
    pk: `PROJECT#${id}`,
    sk: `HANDOFF#${now}`,
    mod_total: body.mod_total,
    pct_ingenieros: body.pct_ingenieros,
    pct_sdm: body.pct_sdm,
    aceptado_por: body.aceptado_por,
    ts: now
  };

  await ddb.put({ TableName: tableName('projects'), Item: handoff }).promise();

  // audit
  const audit = {
    pk: `ENTITY#PROJECT#${id}`,
    sk: `TS#${now}`,
    action: 'HANDOFF',
    before: null,
    after: handoff
  };
  await ddb.put({ TableName: tableName('audit_log'), Item: audit }).promise();

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
