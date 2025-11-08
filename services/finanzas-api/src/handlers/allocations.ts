import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { checkAuthWithToken, extractIdToken, parseGroupsFromJWT } from '../lib/avp';
import { buildAvpContext } from '../lib/avp-actions';

// TODO: Implement bulk allocations update
// R1 requirement: PUT /projects/{id}/allocations:bulk
export const handler = async (event: APIGatewayProxyEventV2) => {
  // Legacy auth check (keep for backward compatibility)
  ensureSDT(event);
  
  const projectId = event.pathParameters?.id;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing project id' }) };
  }

  // AVP authorization check
  const idToken = extractIdToken(event.headers);
  if (idToken && process.env.POLICY_STORE_ID) {
    const groups = parseGroupsFromJWT(idToken);
    const context = buildAvpContext(event);
    context.jwt_groups = groups;

    const authorized = await checkAuthWithToken(
      idToken,
      'BulkAllocate',
      { type: 'Finanzas::Allocation', id: `ALLOC-${projectId}` },
      context
    );

    if (!authorized) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Forbidden: insufficient permissions for bulk allocation' }) 
      };
    }
  }

  // TODO: Parse bulk allocation data and update DynamoDB allocations table
  return {
    statusCode: 501,
    body: JSON.stringify({ message: 'PUT /projects/{id}/allocations:bulk - not implemented yet' })
  };
};
