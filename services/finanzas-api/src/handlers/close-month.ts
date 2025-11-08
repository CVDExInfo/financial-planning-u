import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { checkAuthWithToken, extractIdToken, parseGroupsFromJWT } from '../lib/avp';
import { buildAvpContext } from '../lib/avp-actions';

// TODO: Implement month close process
// R1 requirement: POST /close-month?mes=YYYY-MM
export const handler = async (event: APIGatewayProxyEventV2) => {
  // Legacy auth check (keep for backward compatibility)
  ensureSDT(event);
  
  const mes = event.queryStringParameters?.mes;

  if (!mes) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing mes parameter (YYYY-MM)' }) };
  }

  // AVP authorization check
  const idToken = extractIdToken(event.headers);
  if (idToken && process.env.POLICY_STORE_ID) {
    const groups = parseGroupsFromJWT(idToken);
    const context = buildAvpContext(event);
    context.jwt_groups = groups;

    const authorized = await checkAuthWithToken(
      idToken,
      'CloseMonth',
      { type: 'Finanzas::Project', id: event.queryStringParameters?.project_id || '*' },
      context
    );

    if (!authorized) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Forbidden: insufficient permissions to close month' }) 
      };
    }
  }

  // TODO: Lock allocations, calculate final balances, generate reports
  return {
    statusCode: 501,
    body: JSON.stringify({ message: `POST /close-month?mes=${mes} - not implemented yet` })
  };
};
