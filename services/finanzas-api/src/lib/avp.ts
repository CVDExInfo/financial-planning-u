import {
  VerifiedPermissionsClient,
  IsAuthorizedWithTokenCommand,
  Decision
} from "@aws-sdk/client-verifiedpermissions";
import { APIGatewayProxyEventV2 } from 'aws-lambda';

// Initialize AVP client
const vpClient = new VerifiedPermissionsClient({ region: process.env.AWS_REGION || "us-east-2" });

/**
 * Context attributes passed to AVP for authorization decisions
 */
export interface AVPContext {
  jwt_groups: { set: string[] };
  http_method: { string: string };
  route: { string: string };
  project_id?: { string: string };
  env: { string: string };
  suspended?: { boolean: boolean };
}

/**
 * Resource definition for AVP authorization
 */
export interface AVPResource {
  type: string;
  id: string;
}

/**
 * Parse Cognito groups from JWT token
 * The ID token contains groups in the "cognito:groups" claim
 */
export function parseGroupsFromJWT(idToken: string): string[] {
  try {
    // JWT format: header.payload.signature
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      console.warn('[AVP] Invalid JWT format');
      return [];
    }

    // Decode the payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Extract cognito:groups
    const groups = payload['cognito:groups'];
    if (Array.isArray(groups)) {
      return groups;
    } else if (typeof groups === 'string') {
      // Handle case where groups might be a comma-separated string
      return groups.split(',').map(g => g.trim()).filter(Boolean);
    }

    return [];
  } catch (error) {
    console.error('[AVP] Failed to parse JWT groups:', error);
    return [];
  }
}

/**
 * Extract ID token from Authorization header
 */
export function extractIdToken(event: APIGatewayProxyEventV2): string | null {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return null;
  }

  // Remove "Bearer " prefix
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/**
 * Build AVP context from Lambda event
 */
export function buildAVPContext(
  event: APIGatewayProxyEventV2,
  groups: string[],
  projectId?: string
): AVPContext {
  const context: AVPContext = {
    jwt_groups: { set: groups },
    http_method: { string: event.requestContext.http.method },
    route: { string: event.requestContext.http.path },
    env: { string: process.env.STAGE_NAME || process.env.STAGE || 'dev' }
  };

  if (projectId) {
    context.project_id = { string: projectId };
  }

  return context;
}

/**
 * Check authorization using AVP IsAuthorizedWithToken
 * 
 * @param idToken - Cognito ID token from Authorization header
 * @param action - Cedar action name (e.g., "BulkAllocate")
 * @param resource - Resource type and ID
 * @param context - Context attributes for the request
 * @returns Promise<boolean> - true if authorized, false otherwise
 */
export async function checkAuthWithToken(
  idToken: string,
  action: string,
  resource: AVPResource,
  context: AVPContext
): Promise<boolean> {
  const policyStoreId = process.env.POLICY_STORE_ID;
  
  if (!policyStoreId) {
    console.error('[AVP] POLICY_STORE_ID environment variable not set');
    // In development, you might want to allow access if AVP is not configured
    if (process.env.STAGE === 'dev' && process.env.SKIP_AVP === 'true') {
      console.warn('[AVP] Skipping authorization check (SKIP_AVP=true in dev)');
      return true;
    }
    return false;
  }

  try {
    const command = new IsAuthorizedWithTokenCommand({
      policyStoreId,
      identityToken: idToken,
      action: {
        actionType: "ACTION",
        actionId: `Finanzas::Action::"${action}"`
      },
      resource: {
        entityType: resource.type,
        entityId: resource.id
      },
      context: {
        contextMap: context as any
      }
    });

    const response = await vpClient.send(command);
    
    // Log decision for audit/debugging
    console.log('[AVP] Authorization decision:', {
      action,
      resource: resource.id,
      decision: response.decision,
      determiningPolicies: response.determiningPolicies?.length || 0
    });

    return response.decision === Decision.ALLOW;
  } catch (error) {
    console.error('[AVP] Authorization check failed:', error);
    return false;
  }
}

/**
 * Convenience function to check authorization from a Lambda event
 * 
 * @param event - API Gateway event
 * @param action - Cedar action name
 * @param resource - Resource type and ID
 * @param projectId - Optional project ID from path parameters
 * @returns Promise<boolean> - true if authorized, false otherwise
 */
export async function checkAuthFromEvent(
  event: APIGatewayProxyEventV2,
  action: string,
  resource: AVPResource,
  projectId?: string
): Promise<boolean> {
  const idToken = extractIdToken(event);
  if (!idToken) {
    console.warn('[AVP] No ID token found in request');
    return false;
  }

  const groups = parseGroupsFromJWT(idToken);
  const context = buildAVPContext(event, groups, projectId);

  return checkAuthWithToken(idToken, action, resource, context);
}

/**
 * Throw 403 error if not authorized
 */
export async function ensureAuthorized(
  event: APIGatewayProxyEventV2,
  action: string,
  resource: AVPResource,
  projectId?: string
): Promise<void> {
  const authorized = await checkAuthFromEvent(event, action, resource, projectId);
  
  if (!authorized) {
    throw {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Forbidden',
        message: `Not authorized to perform ${action} on ${resource.type}:${resource.id}`
      })
    };
  }
}
