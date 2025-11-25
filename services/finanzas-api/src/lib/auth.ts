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
const configuredUserPoolId =
  process.env.COGNITO_USER_POOL_ID ||
  process.env.CognitoUserPoolId ||
  DEFAULT_USER_POOL_ID;
const configuredClientIds = (process.env.COGNITO_CLIENT_ID ||
  process.env.CognitoUserPoolClientId ||
  "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const region = process.env.AWS_REGION || DEFAULT_REGION;
const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${configuredUserPoolId}`;

if (!process.env.COGNITO_USER_POOL_ID && configuredUserPoolId === DEFAULT_USER_POOL_ID) {
  console.warn(
    "[auth] COGNITO_USER_POOL_ID not set; defaulting to production pool",
    DEFAULT_USER_POOL_ID
  );
}

if (!configuredClientIds.length) {
  console.error(
    "[auth] COGNITO_CLIENT_ID environment variable is missing. JWT audience validation will fail."
  );
}

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: configuredClientIds.length ? configuredClientIds : undefined,
  tokenUse: "id",
});

const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: configuredUserPoolId,
  clientId: configuredClientIds.length ? configuredClientIds : undefined,
  tokenUse: "access",
});

function authError(statusCode: number, message: string) {
  return { statusCode, body: message };
}

function extractBearerToken(event: ApiGwEvent): string {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header) {
    console.warn("[auth] Missing Authorization header");
    throw authError(401, "unauthorized: missing bearer token");
  }

  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    console.warn("[auth] Empty bearer token provided");
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
      console.warn("[auth] JWT verification failed", { idError, accessError });
      throw authError(401, "unauthorized: invalid token");
    }
  }

  if (!payload) {
    console.warn("[auth] Verification returned empty payload");
    throw authError(401, "unauthorized: invalid token");
  }

  const tokenIssuer = typeof payload.iss === "string" ? payload.iss : "";
  if (tokenIssuer !== expectedIssuer) {
    console.warn("[auth] Issuer mismatch", { tokenIssuer, expected: expectedIssuer });
    throw authError(401, "unauthorized: invalid issuer");
  }

  const audience =
    (typeof payload.aud === "string" && payload.aud) ||
    (typeof payload.client_id === "string" && payload.client_id) ||
    "";
  if (
    configuredClientIds.length &&
    (audience ? !configuredClientIds.includes(audience) : true)
  ) {
    console.warn("[auth] Audience mismatch", {
      audience,
      expected: configuredClientIds,
    });
    throw authError(401, "unauthorized: invalid audience");
  }

  (event as ApiGwEvent).__verifiedClaims = payload;
  return payload;
}

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
    console.warn("[auth] SDT check failed; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: SDT required" };
  }
}

export async function ensureCanWrite(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
  if (!canWrite) {
    console.warn("[auth] Write permission denied; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: PM or SDT required" };
  }
}

export async function ensureCanRead(event: ApiGwEvent) {
  const claims = await verifyJwt(event);
  const groups = parseGroupsFromClaims(claims);
  const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
  if (!canRead) {
    console.warn("[auth] Read permission denied; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: valid group required" };
  }
}
