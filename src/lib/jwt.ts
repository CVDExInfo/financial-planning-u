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
  username?: string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string | string[];
  email_verified?: boolean;
  [key: string]: any;
}

/**
 * Decode JWT without verification (verify on backend only)
 * Use only for reading claims; always trust the server to validate signature
 *
 * Browser-safe implementation using atob (no Node Buffer dependency)
 *
 * @param token JWT string
 * @returns Decoded claims object
 * @throws Error if JWT format is invalid
 */
export function decodeJwt(token: string): JWTClaims {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format: expected 3 parts");
    }

    const payload = parts[1];

    // Convert base64url to base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    // Decode base64 to JSON string (browser-safe)
    const json = atob(padded);
    const decoded = JSON.parse(json);

    return decoded as JWTClaims;
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Backwards compatibility for existing imports
export const decodeJWT = decodeJwt;

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
export function extractGroupsFromClaims(claims: JWTClaims): string[] {
  const groups = claims["cognito:groups"];
  if (!groups) return [];

  if (Array.isArray(groups)) {
    return groups.map((group) => group.trim()).filter(Boolean);
  }

  if (typeof groups === "string") {
    return groups
      .split(/[\s,]+/)
      .map((g) => g.trim())
      .filter(Boolean);
  }

  return [];
}

// Backwards compatibility for existing imports
export const getGroupsFromClaims = extractGroupsFromClaims;

/**
 * Extract user information from JWT claims
 *
 * @param claims JWT claims object
 * @returns Object with id, username, email, and groups
 */
export function extractUserFromClaims(claims: JWTClaims) {
  return {
    id: claims.sub ?? null,
    username:
      claims?.["cognito:username"] ?? claims?.email ?? claims?.username ?? null,
    email: claims?.email ?? claims?.["cognito:username"] ?? claims?.username ?? null,
    groups: extractGroupsFromClaims(claims),
    emailVerified: claims?.email_verified || false,
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

    // Store new ID token (both unified and legacy keys)
    localStorage.setItem("cv.jwt", AuthenticationResult.IdToken);
    localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);
    console.log("[JWT] Token refreshed successfully");
    return AuthenticationResult.IdToken;
  } catch (error) {
    console.error("[JWT] Token refresh error:", error);
    // Clear tokens on refresh failure
    localStorage.removeItem("cv.jwt");
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
export type FinanzasRole = "PM" | "PMO" | "SDMT" | "VENDOR" | "EXEC_RO";

export function mapGroupsToRoles(cognitoGroups: string[]): FinanzasRole[] {
  const roles: Set<FinanzasRole> = new Set();

  // System/utility groups that should NOT grant application roles
  const ignoredGroups = ["acta-ui", "cognito" /* built-in */];

  for (const group of cognitoGroups) {
    const normalized = group.trim().toLowerCase();
    if (!normalized) continue;

    const isPmGroup =
      normalized === "pm" ||
      normalized.startsWith("pm-") ||
      normalized.includes("project_manager");

    // PM access: explicit PM groups
    if (isPmGroup) {
      roles.add("PM");
    }

    // PMO access: PMO/admin groups
    if (normalized === "admin" || normalized.includes("pmo")) {
      roles.add("PMO");
    }

    // SDMT access: SDT/SDMT/FIN/AUD
    if (
      normalized.includes("sdt") ||
      normalized.includes("sdmt") ||
      normalized.includes("fin") ||
      normalized.includes("aud")
    ) {
      roles.add("SDMT");
    }

    // VENDOR access: vendor-specific cohorts only
    if (
      normalized.includes("vendor") ||
      normalized.includes("proveedor") ||
      normalized.includes("partner")
    ) {
      roles.add("VENDOR");
    }

    // EXEC_RO: admin and exec-like groups
    if (
      normalized === "admin" ||
      normalized.includes("exec") ||
      normalized.includes("director") ||
      normalized.includes("manager")
    ) {
      roles.add("EXEC_RO");
    }
  }

  // Default to EXEC_RO if no roles inferred (read-only safest)
  if (roles.size === 0) {
    roles.add("EXEC_RO");
  }

  return Array.from(roles);
}

// Backwards compatibility for legacy imports
export const mapCognitoGroupsToRoles = mapGroupsToRoles;
