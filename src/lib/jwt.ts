/**
 * JWT decoding and validation utilities for Cognito ID tokens
 *
 * NOTE: This only decodes and validates format/expiration.
 * Signature validation MUST happen on the server (API Gateway authorizer).
 * Never trust a JWT until the server validates its signature.
 */

export interface JWTClaims {
  sub: string;
  aud?: string;
  iss?: string;
  exp: number;
  iat: number;
  email?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string | string[];
  email_verified?: boolean;
  [key: string]: any;
}

/**
 * Decode JWT without verification (verify on backend only)
 * Use only for reading claims; always trust the server to validate signature
 *
 * @param token JWT string
 * @returns Decoded claims object
 * @throws Error if JWT format is invalid
 */
export function decodeJWT(token: string): JWTClaims {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format: expected 3 parts");
    }

    const decoded = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );

    return decoded as JWTClaims;
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Check if JWT is expired based on exp claim
 *
 * @param claims JWT claims object
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(claims: JWTClaims): boolean {
  if (!claims.exp) return true;
  // exp is in seconds, Date.now() is in milliseconds
  return claims.exp * 1000 < Date.now();
}

/**
 * Validate JWT basic structure and expiration (not signature)
 * Signature validation must happen on backend (API Gateway authorizer)
 *
 * @param token JWT string
 * @returns true if token is valid (not expired and well-formed), false otherwise
 */
export function isTokenValid(token: string): boolean {
  try {
    const claims = decodeJWT(token);
    return !isTokenExpired(claims);
  } catch {
    return false;
  }
}

/**
 * Extract groups from JWT claims
 * Cognito may return groups as comma-separated string or array
 *
 * @param claims JWT claims object
 * @returns Array of group names
 */
export function getGroupsFromClaims(claims: JWTClaims): string[] {
  const groups = claims["cognito:groups"];
  if (!groups) return [];

  if (Array.isArray(groups)) {
    return groups;
  }

  if (typeof groups === "string") {
    return groups.split(",").map((g) => g.trim());
  }

  return [];
}

/**
 * Extract user information from JWT claims
 *
 * @param claims JWT claims object
 * @returns Object with id, username, email, and groups
 */
export function extractUserFromClaims(claims: JWTClaims) {
  return {
    id: claims.sub,
    username: claims["cognito:username"] || claims.email || "user",
    email: claims.email || "unknown",
    groups: getGroupsFromClaims(claims),
    emailVerified: claims.email_verified || false,
  };
}

/**
 * Refresh JWT using refresh token (post-MVP optional)
 *
 * @param region AWS region
 * @param clientId Cognito app client ID
 * @returns New ID token string or null if refresh fails
 */
export async function refreshJWT(
  region: string,
  clientId: string
): Promise<string | null> {
  const refreshToken = localStorage.getItem("finz_refresh_token");

  if (!refreshToken) {
    console.warn("[JWT] No refresh token available");
    return null;
  }

  try {
    const response = await fetch(
      `https://cognito-idp.${region}.amazonaws.com/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({
          ClientId: clientId,
          AuthFlow: "REFRESH_TOKEN_AUTH",
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("[JWT] Token refresh failed:", response.status);
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    const { AuthenticationResult } = data;

    if (!AuthenticationResult?.IdToken) {
      throw new Error("No ID token in refresh response");
    }

    // Store new ID token
    localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);
    console.log("[JWT] Token refreshed successfully");
    return AuthenticationResult.IdToken;
  } catch (error) {
    console.error("[JWT] Token refresh error:", error);
    // Clear tokens on refresh failure
    localStorage.removeItem("finz_jwt");
    localStorage.removeItem("finz_refresh_token");
    return null;
  }
}

/**
 * Get time until token expiration
 *
 * @param claims JWT claims object
 * @returns Milliseconds until expiration, or 0 if expired
 */
export function getTokenExpiresIn(claims: JWTClaims): number {
  if (!claims.exp) return 0;
  const expiresAt = claims.exp * 1000;
  const now = Date.now();
  return Math.max(0, expiresAt - now);
}

/**
 * Format token expiration for display
 *
 * @param claims JWT claims object
 * @returns Human-readable expiration string
 */
export function formatTokenExpiration(claims: JWTClaims): string {
  const ms = getTokenExpiresIn(claims);

  if (ms === 0) return "Expired";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Map Cognito groups to application UserRoles
 * Cognito groups: PM, SDT, FIN, AUD, admin, acta-ui-ikusi, etc.
 * Application roles: PMO, SDMT, VENDOR, EXEC_RO
 *
 * @param cognitoGroups Array of Cognito group names
 * @returns Array of application UserRole values
 */
export function mapCognitoGroupsToRoles(cognitoGroups: string[]): string[] {
  const roles: Set<string> = new Set();

  for (const group of cognitoGroups) {
    const g = group.toLowerCase();

    // PMO access: users in PM, admin, or PMO groups
    if (g.includes("pm") || g === "admin" || g.includes("pmo")) {
      roles.add("PMO");
    }

    // SDMT access: users in SDT, FIN, AUD, or SDMT groups
    if (
      g.includes("sdt") ||
      g.includes("fin") ||
      g.includes("aud") ||
      g.includes("sdmt")
    ) {
      roles.add("SDMT");
    }

    // VENDOR access: users in vendor or acta-ui-* groups (staffing platform)
    if (g.includes("vendor") || g.includes("acta-ui")) {
      roles.add("VENDOR");
    }

    // EXEC_RO: add as option for all admin users
    if (g === "admin") {
      roles.add("EXEC_RO");
    }
  }

  // If no roles mapped, default to SDMT (everyone has at least read access)
  if (roles.size === 0) {
    roles.add("SDMT");
  }

  return Array.from(roles);
}
