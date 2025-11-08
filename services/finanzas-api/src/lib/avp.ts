import {
  VerifiedPermissionsClient,
  IsAuthorizedWithTokenCommand,
} from "@aws-sdk/client-verifiedpermissions";

// Initialize the AVP client
const vpClient = new VerifiedPermissionsClient({ 
  region: process.env.AWS_REGION || "us-east-2" 
});

/**
 * Parse JWT groups from ID token
 * Decodes the token (middle segment) and extracts cognito:groups
 */
export function parseGroupsFromJWT(idToken: string): string[] {
  try {
    // JWT format: header.payload.signature
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      console.warn("[avp] Invalid JWT format");
      return [];
    }

    // Decode the payload (base64url)
    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(decoded);

    // Extract cognito:groups
    const groups = claims["cognito:groups"];
    if (Array.isArray(groups)) {
      return groups.map(String);
    } else if (typeof groups === "string") {
      return groups.split(/[\s,]+/).filter(Boolean);
    }

    return [];
  } catch (err) {
    console.error("[avp] Failed to parse groups from JWT:", err);
    return [];
  }
}

/**
 * Check authorization using Amazon Verified Permissions with Cognito ID token
 * 
 * @param idToken - Cognito ID token (not access token)
 * @param action - Cedar action name (e.g., "BulkAllocate")
 * @param resource - Resource object with type and id
 * @param context - Additional context for the authorization decision
 * @returns true if authorized (ALLOW), false otherwise
 */
export async function checkAuthWithToken(
  idToken: string,
  action: string,
  resource: { type: string; id: string },
  context: Record<string, any>
): Promise<boolean> {
  // If POLICY_STORE_ID is not set, skip AVP checks (for development/testing)
  if (!process.env.POLICY_STORE_ID) {
    console.warn("[avp] POLICY_STORE_ID not set, skipping AVP authorization");
    return true;
  }

  try {
    // Build the context map for AVP
    // Convert context values to the format expected by AVP
    const contextMap: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      if (Array.isArray(value)) {
        contextMap[key] = { set: value.map(v => ({ string: String(v) })) };
      } else if (typeof value === "boolean") {
        contextMap[key] = { boolean: value };
      } else if (typeof value === "number") {
        contextMap[key] = { long: value };
      } else {
        contextMap[key] = { string: String(value) };
      }
    }

    const command = new IsAuthorizedWithTokenCommand({
      policyStoreId: process.env.POLICY_STORE_ID!,
      identityToken: idToken, // pass Cognito ID token as-is
      action: {
        actionType: "Finanzas::Action",
        actionId: action,
      },
      resource: {
        entityType: resource.type,
        entityId: resource.id,
      },
      context: { contextMap },
    });

    const response = await vpClient.send(command);

    // Log the decision for debugging
    console.log(
      `[avp] Authorization decision: ${response.decision} - action=${action}, resource=${resource.type}:${resource.id}`
    );

    return response.decision === "ALLOW";
  } catch (err) {
    console.error("[avp] Authorization check failed:", err);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Extract the ID token from the Authorization header
 */
export function extractIdToken(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    return null;
  }

  // Remove "Bearer " prefix
  return authHeader.replace(/^Bearer\s+/i, "");
}
