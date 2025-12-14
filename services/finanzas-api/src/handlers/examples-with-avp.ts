/**
 * Example Lambda Handler with AVP Integration
 * 
 * This file demonstrates how to integrate Amazon Verified Permissions (AVP)
 * into existing Lambda handlers. Copy these patterns to your actual handlers.
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureAuthorized, checkAuthFromEvent } from '../lib/avp';
import { ok, bad, unauthorized } from '../lib/http';

/**
 * Example 1: Simple authorization check with ensureAuthorized
 * 
 * Use this when you want to throw a 403 error if not authorized
 */
export const bulkAllocationsHandler = async (event: APIGatewayProxyEventV2) => {
  const projectId = event.pathParameters?.id;

  if (!projectId) {
    return bad('missing project id');
  }

  // Check authorization - throws 403 if not authorized
  await ensureAuthorized(
    event,
    'BulkAllocate',
    { type: 'Finanzas::Allocation', id: `ALLOC-${projectId}` },
    projectId
  );

  // If we reach here, user is authorized
  // TODO: Implement bulk allocation logic
  return ok({ message: 'Bulk allocations updated' });
};

/**
 * Example 2: Manual authorization check with custom error handling
 * 
 * Use this when you need more control over the response
 */
export const viewPlanHandler = async (event: APIGatewayProxyEventV2) => {
  const projectId = event.pathParameters?.id;

  if (!projectId) {
    return bad('missing project id');
  }

  // Check authorization manually
  const authorized = await checkAuthFromEvent(
    event,
    'ViewPlan',
    { type: 'Finanzas::Project', id: projectId },
    projectId
  );

  if (!authorized) {
    return unauthorized(`You do not have permission to view plan for project ${projectId}`);
  }

  // If we reach here, user is authorized
  // TODO: Fetch and return plan data
  return ok({ projectId, plan: [] });
};

/**
 * Example 3: Health check endpoint (public access)
 * 
 * Health endpoints typically don't need authorization, but if they do,
 * the AVP policy allows all users in dev/stg/prod environments
 */
export const healthHandler = async (event: APIGatewayProxyEventV2) => {
  // Optional: Check authorization for health endpoint
  // Most health endpoints skip authorization
  try {
    await ensureAuthorized(
      event,
      'ViewHealth',
      { type: 'Finanzas::Project', id: '*root*' }
    );
  } catch (_error) {
    // In dev mode with SKIP_AVP, this will pass
    // In production, unauthorized users will be blocked
  }

  const stage = process.env.STAGE_NAME || process.env.STAGE || 'dev';
  return ok({
    ok: true,
    service: 'finanzas-sd-api',
    stage,
    time: new Date().toISOString()
  });
};

/**
 * Example 4: Create operation with authorization
 */
export const createAdjustmentHandler = async (event: APIGatewayProxyEventV2) => {
  // Check authorization for creating adjustments
  await ensureAuthorized(
    event,
    'CreateAdjustment',
    { type: 'Finanzas::Adjustment', id: 'new' }
  );

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return bad('Invalid JSON in request body');
  }
  
  // TODO: Validate and create adjustment
  const adjustmentId = 'ADJ-' + Date.now();

  return ok({
    id: adjustmentId,
    message: 'Adjustment created',
    data: body
  }, 201);
};

/**
 * Example 5: List operation with authorization
 */
export const listProvidersHandler = async (event: APIGatewayProxyEventV2) => {
  // Check authorization for viewing providers
  await ensureAuthorized(
    event,
    'ViewProviders',
    { type: 'Finanzas::Provider', id: '*' }
  );

  // TODO: Fetch providers from database
  const providers = [];

  return ok({ providers });
};

/**
 * Example 6: Close month operation (project-scoped)
 */
export const closeMonthHandler = async (event: APIGatewayProxyEventV2) => {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return bad('Invalid JSON in request body');
  }

  const projectId = body.projectId;

  if (!projectId) {
    return bad('missing projectId');
  }

  // Check authorization for closing month on this project
  await ensureAuthorized(
    event,
    'CloseMonth',
    { type: 'Finanzas::Project', id: projectId },
    projectId
  );

  // TODO: Close month logic
  return ok({ message: `Month closed for project ${projectId}` });
};

/**
 * Example 7: Payroll ingest (FIN only)
 */
export const ingestPayrollHandler = async (event: APIGatewayProxyEventV2) => {
  // Check authorization for payroll ingest (FIN group only)
  await ensureAuthorized(
    event,
    'IngestPayroll',
    { type: 'Finanzas::PayrollFile', id: 'new' }
  );

  // TODO: Parse and ingest payroll data
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Payroll data ingested successfully' })
  };
};

/**
 * Example 8: Prefactura operations with different actions
 */
export const prefacturaWebhookHandler = async (event: APIGatewayProxyEventV2) => {
  const method = event.requestContext.http.method;

  if (method === 'GET') {
    // View prefacturas
    await ensureAuthorized(
      event,
      'ViewPrefactura',
      { type: 'Finanzas::Prefactura', id: '*' }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ prefacturas: [] })
    };
  } else if (method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const action = body.action; // 'send' or 'approve'

    if (action === 'send') {
      await ensureAuthorized(
        event,
        'SendPrefactura',
        { type: 'Finanzas::Prefactura', id: body.prefacturaId || 'new' }
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Prefactura sent' })
      };
    } else if (action === 'approve') {
      await ensureAuthorized(
        event,
        'ApprovePrefactura',
        { type: 'Finanzas::Prefactura', id: body.prefacturaId })
      ;
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Prefactura approved' })
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Invalid request' })
  };
};
