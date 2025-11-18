import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ddb, tableName, QueryCommand } from '../lib/dynamo';
import { ok, bad } from '../lib/http';

/**
 * GET /projects/{id}/plan
 * Returns financial plan/forecast data for a project
 * Aggregates data from allocations, payroll, and adjustments tables
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const projectId = event.pathParameters?.id;

  if (!projectId) {
    return bad('missing project id');
  }

  try {
    // Query allocations for this project
    const allocationsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('allocations'),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
        },
      })
    );

    // Query payroll actuals for this project
    const payrollResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('payroll_actuals'),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
        },
      })
    );

    // Query adjustments for this project
    const adjustmentsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName('adjustments'),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
        },
      })
    );

    // Combine data into forecast cells
    const allocations = allocationsResult.Items || [];
    const payrolls = payrollResult.Items || [];
    const adjustments = adjustmentsResult.Items || [];

    // Build forecast cells from allocations
    const forecastCells = allocations.map((allocation: any) => ({
      line_item_id: allocation.rubroId || allocation.line_item_id || 'unknown',
      month: allocation.month || 1,
      planned: allocation.planned || allocation.monto_planeado || 0,
      forecast: allocation.forecast || allocation.monto_proyectado || allocation.planned || 0,
      actual: allocation.actual || allocation.monto_real || 0,
      variance: (allocation.actual || 0) - (allocation.planned || 0),
      variance_reason: allocation.variance_reason,
      notes: allocation.notes || allocation.notas,
      last_updated: allocation.updated_at || allocation.created_at || new Date().toISOString(),
      updated_by: allocation.updated_by || allocation.created_by || 'system',
    }));

    // Add payroll data as forecast cells
    payrolls.forEach((payroll: any) => {
      forecastCells.push({
        line_item_id: `payroll-${payroll.empleado_id || 'unknown'}`,
        month: payroll.month || 1,
        planned: payroll.salario_base || 0,
        forecast: payroll.salario_base || 0,
        actual: payroll.salario_real || payroll.salario_base || 0,
        variance: (payroll.salario_real || 0) - (payroll.salario_base || 0),
        variance_reason: payroll.motivo,
        notes: payroll.notas,
        last_updated: payroll.fecha_pago || payroll.created_at || new Date().toISOString(),
        updated_by: payroll.created_by || 'system',
      });
    });

    // Add adjustments as forecast cells
    adjustments.forEach((adj: any) => {
      forecastCells.push({
        line_item_id: adj.rubroId || adj.line_item_id || 'adjustment',
        month: adj.month || 1,
        planned: 0,
        forecast: adj.monto || 0,
        actual: adj.monto || 0,
        variance: adj.monto || 0,
        variance_reason: adj.tipo || adj.reason,
        notes: adj.descripcion || adj.notes,
        last_updated: adj.created_at || new Date().toISOString(),
        updated_by: adj.created_by || 'system',
      });
    });

    return ok(forecastCells);
  } catch (error) {
    console.error('Error generating plan:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d7t9x3j66yd8k.cloudfront.net',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
