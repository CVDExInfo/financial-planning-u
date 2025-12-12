/**
 * Test Helpers for Behavioral API Tests
 * 
 * Utilities for authenticating with Cognito, making API calls, and validating responses.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

// Configuration from environment or known defaults
const API_BASE_URL =
  process.env.FINZ_API_BASE ||
  process.env.DEV_API_URL ||
  process.env.VITE_API_BASE_URL ||
  "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev";

const COGNITO_REGION = process.env.AWS_REGION || process.env.COGNITO_REGION || "us-east-2";
const COGNITO_CLIENT_ID =
  process.env.COGNITO_WEB_CLIENT || process.env.COGNITO_CLIENT_ID;
const CLOUDFRONT_ORIGIN = process.env.CF_DOMAIN;

// Token cache to avoid rate limits
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

export interface RoleCredentials {
  username: string;
  password: string;
  role: string;
}

export interface CorsHeaders {
  "access-control-allow-origin"?: string;
  "access-control-allow-methods"?: string;
  "access-control-allow-headers"?: string;
  "access-control-allow-credentials"?: string;
  "access-control-max-age"?: string;
}

/**
 * Get the API base URL from environment or configuration
 */
export function getApiBaseUrl(): string {
  const url = API_BASE_URL.replace(/\/$/, ""); // Remove trailing slash
  if (!url) {
    throw new Error(
      "API base URL not configured. Set FINZ_API_BASE or DEV_API_URL environment variable."
    );
  }
  return url;
}

/**
 * Get CloudFront origin for CORS tests
 */
export function getCloudFrontOrigin(): string {
  if (!CLOUDFRONT_ORIGIN) {
    throw new Error("CF_DOMAIN environment variable must be set");
  }
  return CLOUDFRONT_ORIGIN.replace(/\/$/, "");
}

/**
 * Authenticate with Cognito and get ID token
 * Caches tokens per username to avoid rate limits
 * 
 * @param credentials - Username and password
 * @returns ID token string
 */
export async function getCognitoToken(credentials: RoleCredentials): Promise<string> {
  if (!COGNITO_CLIENT_ID) {
    throw new Error("COGNITO_WEB_CLIENT or COGNITO_CLIENT_ID environment variable must be set");
  }

  const cacheKey = `${credentials.username}:${credentials.role}`;
  const cached = tokenCache[cacheKey];

  // Return cached token if it's still valid (expires in more than 5 minutes)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const client = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: credentials.username,
        PASSWORD: credentials.password,
      },
    });

    const response = await client.send(command);

    if (!response.AuthenticationResult?.IdToken) {
      throw new Error(`Authentication failed for ${credentials.role}: No ID token in response`);
    }

    // Cache token (Cognito tokens typically expire in 1 hour)
    const token = response.AuthenticationResult.IdToken;
    const expiresAt = Date.now() + 55 * 60 * 1000; // 55 minutes
    tokenCache[cacheKey] = { token, expiresAt };

    return token;
  } catch (error) {
    throw new Error(
      `Failed to authenticate ${credentials.role}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send CORS preflight request (OPTIONS)
 * 
 * @param url - Full URL to test
 * @param method - HTTP method to request access for (GET, POST, PATCH, etc.)
 * @returns Response with CORS headers
 */
export async function corsPreflight(
  url: string,
  method: string = "GET"
): Promise<{
  status: number;
  headers: CorsHeaders;
  passed: boolean;
  errors: string[];
}> {
  const origin = getCloudFrontOrigin();
  const errors: string[] = [];

  try {
    const response = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

    const corsHeaders: CorsHeaders = {
      "access-control-allow-origin": response.headers.get("access-control-allow-origin") || undefined,
      "access-control-allow-methods": response.headers.get("access-control-allow-methods") || undefined,
      "access-control-allow-headers": response.headers.get("access-control-allow-headers") || undefined,
      "access-control-allow-credentials": response.headers.get("access-control-allow-credentials") || undefined,
      "access-control-max-age": response.headers.get("access-control-max-age") || undefined,
    };

    // Validate CORS headers
    const allowOrigin = corsHeaders["access-control-allow-origin"];
    if (!allowOrigin || (allowOrigin !== "*" && allowOrigin !== origin)) {
      errors.push(
        `access-control-allow-origin header missing or incorrect. Expected: ${origin} or *, Got: ${allowOrigin}`
      );
    }

    const allowMethods = corsHeaders["access-control-allow-methods"]?.toUpperCase() || "";
    if (!allowMethods.includes(method.toUpperCase())) {
      errors.push(
        `access-control-allow-methods does not include ${method}. Got: ${allowMethods}`
      );
    }

    const allowHeaders = corsHeaders["access-control-allow-headers"]?.toLowerCase() || "";
    if (!allowHeaders.includes("authorization") || !allowHeaders.includes("content-type")) {
      errors.push(
        `access-control-allow-headers missing required headers (authorization, content-type). Got: ${allowHeaders}`
      );
    }

    return {
      status: response.status,
      headers: corsHeaders,
      passed: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to send preflight request: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      status: 0,
      headers: {},
      passed: false,
      errors,
    };
  }
}

/**
 * Make authenticated API request
 * 
 * @param endpoint - API endpoint (relative path)
 * @param token - Bearer token
 * @param options - Fetch options
 * @returns Response data and metadata
 */
export async function apiRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<{
  status: number;
  data: any;
  headers: Record<string, string>;
  error?: string;
}> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let data: any = null;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else if (response.status !== 204) {
      // Try to read as text for non-JSON responses
      try {
        const text = await response.text();
        data = text || null;
      } catch {
        data = null;
      }
    }

    return {
      status: response.status,
      data,
      headers,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 0,
      data: null,
      headers: {},
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Pick a project with a baseline from projects array
 * Falls back to any project if none have baselines
 * 
 * @param projects - Array of projects from API
 * @returns Selected project or null
 */
export function pickProjectWithBaseline(projects: any[]): any | null {
  if (!Array.isArray(projects) || projects.length === 0) {
    return null;
  }

  // Try to find a project with a baseline
  const withBaseline = projects.find(
    (p) => p.baselineId || p.baseline_id || p.has_baseline
  );

  if (withBaseline) {
    return withBaseline;
  }

  // Fallback to first project
  return projects[0];
}

/**
 * Get role credentials from environment variables
 * 
 * @param role - Role name (PMO, SDM_FIN, SDMT, EXEC_RO, NO_GROUP)
 * @returns Credentials or null if not configured
 */
export function getRoleCredentials(role: string): RoleCredentials | null {
  const envPrefix = `E2E_${role.toUpperCase().replace(/-/g, "_")}`;
  const username = process.env[`${envPrefix}_EMAIL`] || process.env[`${envPrefix}_USERNAME`];
  const password = process.env[`${envPrefix}_PASSWORD`];

  if (!username || !password) {
    console.warn(`⚠️  Credentials not configured for role: ${role}`);
    console.warn(`   Set ${envPrefix}_EMAIL and ${envPrefix}_PASSWORD environment variables`);
    return null;
  }

  return {
    username,
    password,
    role,
  };
}

/**
 * Get test credentials with fallback to alternate roles
 * 
 * @param preferredRoles - Array of role names to try in order
 * @returns First available credentials or null
 */
export function getTestCredentials(preferredRoles: string[]): RoleCredentials | null {
  for (const role of preferredRoles) {
    const credentials = getRoleCredentials(role);
    if (credentials) {
      return credentials;
    }
  }
  return null;
}

/**
 * Validate response has expected shape
 * 
 * @param data - Response data
 * @param shape - Expected shape descriptor
 * @returns Validation result
 */
export function validateShape(
  data: any,
  shape: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(shape)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    const actualType = Array.isArray(data[key]) ? "array" : typeof data[key];
    if (expectedType === "array" && !Array.isArray(data[key])) {
      errors.push(`Field ${key} should be array, got ${actualType}`);
    } else if (expectedType !== "array" && actualType !== expectedType) {
      errors.push(`Field ${key} should be ${expectedType}, got ${actualType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print test evidence summary
 */
export function printEvidence(
  role: string,
  endpoint: string,
  status: number,
  result: "PASS" | "FAIL",
  details?: string
): void {
  const icon = result === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${role}] ${endpoint} → HTTP ${status} ${result}${details ? ` (${details})` : ""}`);
}
