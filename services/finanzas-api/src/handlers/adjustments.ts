import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ddb, tableName } from '../lib/dynamo';
import crypto from 'node:crypto';

/**
 * Adjustments Handler - POST/GET /adjustments
 * Manages budget adjustments with pro-rata distribution
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
  const startTime = Date.now();
  
  try {
    ensureSDT(event);
    const method = event.requestContext.http.method;
    const userId = ((event.requestContext as any).authorizer?.jwt?.claims?.sub) || 'unknown';

    if (method === 'POST') {
      return await createAdjustment(event, userId, startTime);
    }

    // GET - list adjustments
    return await listAdjustments(event, userId, startTime);
  } catch (error: any) {
    const latency = Date.now() - startTime;
    console.error(JSON.stringify({
      route: '/adjustments',
      method: event.requestContext.http.method,
      status: error.statusCode || 500,
      error: error.message || 'Internal error',
      latency
    }));
    
    return {
      statusCode: error.statusCode || 500,
      body: typeof error.body === 'string' ? error.body : JSON.stringify({ error: error.message || 'Internal error' })
    };
  }
};

async function createAdjustment(event: APIGatewayProxyEventV2, userId: string, startTime: number) {
  const body = JSON.parse(event.body ?? '{}');
  
  // Validate required fields
  if (!body.project_id || !body.tipo || !body.monto) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: project_id, tipo, monto' })
    };
  }

  // Validate tipo
  if (!['exceso', 'deficit', 'reajuste'].includes(body.tipo)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid tipo. Must be exceso, deficit, or reajuste' })
    };
  }

  // Validate monto is a positive number
  if (typeof body.monto !== 'number' || body.monto <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'monto must be a positive number' })
    };
  }

  const id = 'adj_' + crypto.randomBytes(5).toString('hex');
  const now = new Date().toISOString();

  // Calculate pro-rata distribution if applicable
  let distribucion = [];
  if (body.metodo_distribucion === 'pro_rata_forward' && body.fecha_inicio) {
    const meses_impactados = body.meses_impactados || 3; // Default to 3 months
    const montoPerMonth = Math.floor(body.monto / meses_impactados * 100) / 100;
    const remainder = Math.round((body.monto - montoPerMonth * (meses_impactados - 1)) * 100) / 100;
    
    for (let i = 0; i < meses_impactados; i++) {
      const fecha = new Date(body.fecha_inicio);
      fecha.setMonth(fecha.getMonth() + i);
      const mes = fecha.toISOString().substring(0, 7);
      
      distribucion.push({
        mes,
        monto: i === meses_impactados - 1 ? remainder : montoPerMonth
      });
    }
  }

  const item = {
    pk: `ADJ#${id}`,
    sk: 'METADATA',
    id,
    project_id: body.project_id,
    tipo: body.tipo,
    monto: body.monto,
    estado: 'pending_approval',
    origen_rubro_id: body.origen_rubro_id || null,
    fecha_inicio: body.fecha_inicio || null,
    metodo_distribucion: body.metodo_distribucion || 'single_month',
    distribucion: distribucion.length > 0 ? distribucion : null,
    justificacion: body.justificacion || '',
    solicitado_por: body.solicitado_por || userId,
    created_at: now,
    created_by: userId
  };

  await ddb.put({ 
    TableName: tableName('adjustments'), 
    Item: item 
  }).promise();

  const latency = Date.now() - startTime;
  console.log(JSON.stringify({
    route: '/adjustments',
    method: 'POST',
    status: 201,
    userId,
    adjustmentId: id,
    latency
  }));

  return { 
    statusCode: 201, 
    body: JSON.stringify(item) 
  };
}

async function listAdjustments(event: APIGatewayProxyEventV2, userId: string, startTime: number) {
  const queryParams = event.queryStringParameters || {};
  const projectId = queryParams.project_id;
  const estado = queryParams.estado;
  
  let params: any = {
    TableName: tableName('adjustments'),
    Limit: 50
  };

  // If project_id is provided, query by project_id
  if (projectId) {
    params.FilterExpression = 'project_id = :projectId';
    params.ExpressionAttributeValues = { ':projectId': projectId };
    
    if (estado) {
      params.FilterExpression += ' AND estado = :estado';
      params.ExpressionAttributeValues[':estado'] = estado;
    }
  } else if (estado) {
    params.FilterExpression = 'estado = :estado';
    params.ExpressionAttributeValues = { ':estado': estado };
  }

  const result = await ddb.scan(params).promise();
  
  const latency = Date.now() - startTime;
  console.log(JSON.stringify({
    route: '/adjustments',
    method: 'GET',
    status: 200,
    userId,
    count: result.Items?.length || 0,
    latency
  }));

  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      adjustments: result.Items || [],
      count: result.Items?.length || 0
    }) 
  };
}
