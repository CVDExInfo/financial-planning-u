import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ddb, tableName } from '../lib/dynamo';
import crypto from 'node:crypto';

export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  if (event.requestContext.http.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const id = 'P-' + crypto.randomUUID();
    const now = new Date().toISOString();

    const item = {
      pk: `PROJECT#${id}`,
      sk: 'METADATA',
      cliente: body.cliente,
      nombre: body.nombre,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      moneda: body.moneda,
      created_at: now
    };
    await ddb.put({ TableName: tableName('projects'), Item: item }).promise();

    return { statusCode: 201, body: JSON.stringify({ id, ...item }) };
  }

  // GET /projects
  const items = await ddb.scan({ TableName: tableName('projects'), Limit: 50 }).promise();
  return { statusCode: 200, body: JSON.stringify(items.Items ?? []) };
};
