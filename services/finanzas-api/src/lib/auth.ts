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

// Gather client IDs - must exist!
const configuredClientIds = (process.env.COGNITO_CLIENT_ID ||
  process.env.CognitoUserPoolClientId ||
  "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Fail fast if client ID is missing.
if (!configuredClientIds.length) {
  throw new Error(
    "[auth] COGNITO_CLIENT_ID environment variable is required. JWT audience validation cannot proceed."
  );
}

const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${configuredUserPoolId}`;

if (!process.env.COGNITO_USER_POOL_ID && configuredUserPoolId === DEFAULT_USER_POOL_ID) {
  console.warn(
    "[auth] COGNITO_USER_POOL_ID not set; using default user pool for production.",
    DEFAULT_USER_POOL_ID
  );
}

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: configuredClientIds,
  tokenUse: "id",
});

const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: configuredClientIds,
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

const WRITE_GROUPS = ["SDT", "PM"] as const;
const READ_GROUPS = ["FIN", "SDT", "PM", "AUD"] as const;

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

export async function ensureSDT(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const hasSDT = groups.includes("SDT");
  if (!hasSDT) {
    throw { statusCode: 403, body: "forbidden: SDT required" };
  }
}

export async function ensureCanWrite(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const canWrite = groups.some((g) => WRITE_GROUPS.includes(g as (typeof WRITE_GROUPS)[number]));
  if (!canWrite) {
    throw { statusCode: 403, body: "forbidden: PM or SDT required" };
  }
}

export async function ensureCanRead(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const canRead = groups.some((g) => READ_GROUPS.includes(g as (typeof READ_GROUPS)[number]));
  if (!canRead) {
    throw { statusCode: 403, body: "forbidden: valid group required" };
  }
}
