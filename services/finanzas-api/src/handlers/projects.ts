import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ddb, tableName, PutCommand, ScanCommand } from '../lib/dynamo';
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
      id,
      cliente: body.cliente,
      nombre: body.nombre,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      moneda: body.moneda,
      presupuesto_total: body.presupuesto_total || 0,
      estado: 'active',
      created_at: now,
      created_by: event.requestContext.authorizer?.jwt?.claims?.email || 'system'
    };
    
    await ddb.send(new PutCommand({
      TableName: tableName('projects'),
      Item: item
    }));

    return { 
      statusCode: 201, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...item }) 
    };
  }

  // GET /projects
  const result = await ddb.send(new ScanCommand({
    TableName: tableName('projects'),
    Limit: 50
  }));
  
  return { 
    statusCode: 200, 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.Items ?? []) 
  };
};
