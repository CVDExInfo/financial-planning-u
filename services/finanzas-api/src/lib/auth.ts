import { APIGatewayProxyEventV2 } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

export type ApiGwEvent = APIGatewayProxyEventV2 & {
  __verifiedClaims?: VerifiedClaims;
};

type VerifiedClaims = {
  sub: string;
  email?: string;
  aud?: string;
  client_id?: string;
  iss?: string;
  "cognito:groups"?: string[] | string;
  [key: string]: unknown;
};

const DEFAULT_USER_POOL_ID = "us-east-2_FyHLtOhiY";
const DEFAULT_REGION = "us-east-2";

// Gather environment or default values.
const configuredUserPoolId =
  process.env.COGNITO_USER_POOL_ID ||
  process.env.CognitoUserPoolId ||
  DEFAULT_USER_POOL_ID;
const region = process.env.AWS_REGION || DEFAULT_REGION;

// Gather client IDs - must exist unless we're in an explicit test mode.
const configuredClientIds = (process.env.COGNITO_CLIENT_ID ||
  process.env.CognitoUserPoolClientId ||
  "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const isTestMode =
  process.env.FINZ_AUTH_ALLOW_MISSING_CLIENT_ID_FOR_TESTS === "true" ||
  process.env.NODE_ENV === "test";

// Fail fast if client ID is missing in real environments; warn and relax in tests.
if (!configuredClientIds.length) {
  const message =
    "[auth] COGNITO_CLIENT_ID environment variable is required. JWT audience validation cannot proceed.";

  if (isTestMode) {
    console.warn(
      "[auth] COGNITO_CLIENT_ID missing in test mode; audience validation is relaxed for unit tests."
    );
  } else {
    throw new Error(message);
  }
}

const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${configuredUserPoolId}`;

if (!process.env.COGNITO_USER_POOL_ID && configuredUserPoolId === DEFAULT_USER_POOL_ID) {
  console.warn(
    "[auth] COGNITO_USER_POOL_ID not set; using default user pool for production.",
    DEFAULT_USER_POOL_ID
  );
}

const verifierClientIds = configuredClientIds.length
  ? configuredClientIds
  : undefined;

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: verifierClientIds,
  tokenUse: "id",
});

const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: verifierClientIds,
  tokenUse: "access",
});

function authError(statusCode: number, message: string) {
  return { statusCode, body: message };
}

function extractBearerToken(event: ApiGwEvent): string {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header) {
    throw authError(401, "unauthorized: missing bearer token");
  }
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw authError(401, "unauthorized: missing bearer token");
  }
  return token;
}

async function verifyJwt(event: ApiGwEvent): Promise<VerifiedClaims> {
  if ((event as ApiGwEvent).__verifiedClaims) {
    return (event as ApiGwEvent).__verifiedClaims as VerifiedClaims;
  }

  const token = extractBearerToken(event);
  let payload: VerifiedClaims | null = null;

  try {
    payload = (await idTokenVerifier.verify(token)) as VerifiedClaims;
  } catch (idError) {
    try {
      payload = (await accessTokenVerifier.verify(token)) as VerifiedClaims;
    } catch (accessError) {
      throw authError(401, "unauthorized: invalid token");
    }
  }

  if (!payload) {
    throw authError(401, "unauthorized: invalid token (no payload)");
  }

  // Check issuer
  const tokenIssuer = typeof payload.iss === "string" ? payload.iss : "";
  if (tokenIssuer !== expectedIssuer) {
    throw authError(401, "unauthorized: invalid issuer");
  }

  // Check audience
  const audience =
    (typeof payload.aud === "string" && payload.aud) ||
    (typeof payload.client_id === "string" && payload.client_id) ||
    "";
  if (
    configuredClientIds.length &&
    (audience ? !configuredClientIds.includes(audience) : true)
  ) {
    throw authError(401, "unauthorized: invalid audience");
  }

  (event as ApiGwEvent).__verifiedClaims = payload;
  return payload;
}

/**
 * Finanzas SD RBAC mapping (kept in sync with frontend mapGroupsToRoles)
 * - ADMIN → ADMIN role (full access to all projects)
 * - PMO/PM → PMO role (read + write)
 * - SDT/SDMT/FIN/AUD → SDMT role (read + write)
 * - SDM → SDM role (read + write, but only to own projects)
 * - vendor/acta-ui patterns → VENDOR role (read)
 * - EXEC/EXEC_RO/director/manager → EXEC_RO role (read-only, all projects)
 * - tokens without recognized groups → no role (handlers must return 403)
 * Users that resolve to any role above can read; PMO or SDMT roles can write.
 */

const ROLE_PRIORITY = ["ADMIN", "PMO", "SDMT", "SDM", "VENDOR", "EXEC_RO"] as const;

type FinanzasRole = (typeof ROLE_PRIORITY)[number];

function mapGroupsToRoles(groups: string[]): FinanzasRole[] {
  const roles = new Set<FinanzasRole>();
  const hasAnyGroup = groups.length > 0;

  for (const group of groups) {
    const normalized = group.trim().toUpperCase();
    if (!normalized) continue;

    // ADMIN has highest priority
    if (normalized === "ADMIN") {
      roles.add("ADMIN");
    }

    if (normalized.includes("PMO") || normalized === "PM") {
      roles.add("PMO");
    }

    if (
      normalized.includes("SDT") ||
      normalized.includes("SDMT") ||
      normalized.includes("FIN") ||
      normalized.includes("AUD")
    ) {
      roles.add("SDMT");
    }

    // SDM - Service Delivery Manager (project-scoped access)
    if (normalized === "SDM" || normalized.includes("SDM")) {
      roles.add("SDM");
    }

    if (normalized.includes("VENDOR") || normalized.includes("ACTA-UI") || normalized.includes("ACTA")) {
      roles.add("VENDOR");
    }

    // EXEC_RO - Executive read-only
    if (
      normalized.includes("EXEC") ||
      normalized.includes("DIRECTOR") ||
      normalized.includes("MANAGER")
    ) {
      roles.add("EXEC_RO");
    }
  }

  // SECURITY: Users without any recognized groups get no role (not EXEC_RO).
  // This prevents ungrouped Cognito users from silently inheriting read access.
  // Handlers must return 403 Forbidden when roles array is empty.
  return Array.from(roles);
}

const canReadFromRoles = (roles: FinanzasRole[]) => roles.length > 0;
const canWriteFromRoles = (roles: FinanzasRole[]) =>
  roles.includes("PMO") || roles.includes("SDMT");

function parseGroupsFromClaims(claims: VerifiedClaims): string[] {
  const raw = claims["cognito:groups"];
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((g) => String(g).toUpperCase());
  }
  if (typeof raw === "string" && raw.trim().length) {
    return raw
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((g) => g.toUpperCase());
  }
  return [];
}

export async function getUserEmail(event: ApiGwEvent): Promise<string> {
  const claims = await verifyJwt(event);
  return (claims.email as string) || "system";
}

/**
 * Get user context including email, groups, and resolved roles
 * Useful for ABAC decision-making
 */
export interface UserContext {
  email: string;
  groups: string[];
  roles: FinanzasRole[];
  isAdmin: boolean;
  isExecRO: boolean;
  isSDM: boolean;
  isPMO: boolean;
  isSDMT: boolean;
}

export async function getUserContext(event: ApiGwEvent): Promise<UserContext> {
  const claims = await verifyJwt(event);
  const email = (claims.email as string) || "system";
  const groups = parseGroupsFromClaims(claims);
  const roles = mapGroupsToRoles(groups);

  return {
    email,
    groups,
    roles,
    isAdmin: roles.includes("ADMIN"),
    isExecRO: roles.includes("EXEC_RO"),
    isSDM: roles.includes("SDM"),
    isPMO: roles.includes("PMO"),
    isSDMT: roles.includes("SDMT"),
  };
}

export async function ensureSDT(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const hasSDT = groups.includes("SDT");
  if (!hasSDT) {
    throw { statusCode: 403, body: "forbidden: SDT required" };
  }
}

export async function ensurePMO(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const roles = mapGroupsToRoles(groups);
  if (!roles.includes("PMO")) {
    throw { statusCode: 403, body: "forbidden: PMO required" };
  }
}

export async function ensureCanWrite(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const roles = mapGroupsToRoles(groups);
  // PMO, SDMT, and SDM can all write (SDM writes to their own projects)
  if (roles.includes("PMO") || roles.includes("SDMT") || roles.includes("SDM")) return;

  throw { statusCode: 403, body: "forbidden: PM, SDT, or SDM required" };
}

export async function ensureCanRead(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const roles = mapGroupsToRoles(groups);
  if (canReadFromRoles(roles)) return;

  throw { statusCode: 403, body: "forbidden: valid group required" };
}
