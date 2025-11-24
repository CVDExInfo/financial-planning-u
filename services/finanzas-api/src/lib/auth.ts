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

const userPoolId =
  process.env.COGNITO_USER_POOL_ID || process.env.CognitoUserPoolId || "";
const clientId =
  process.env.COGNITO_CLIENT_ID || process.env.CognitoUserPoolClientId || "";
const region = process.env.AWS_REGION || "us-east-2";
const issuer =
  process.env.COGNITO_ISSUER ||
  (userPoolId
    ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
    : "");

if (!userPoolId || !clientId) {
  console.error(
    "[auth] COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID environment variables are missing. JWT validation will fail."
  );
}

const idTokenVerifier =
  userPoolId && clientId
    ? CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: "id",
      })
    : null;

const accessTokenVerifier =
  userPoolId && clientId
    ? CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: "access",
      })
    : null;

function extractBearerToken(event: ApiGwEvent): string {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header) {
    throw { statusCode: 401, body: "unauthorized" };
  }

  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw { statusCode: 401, body: "unauthorized" };
  }

  return token;
}

async function verifyJwt(event: ApiGwEvent): Promise<VerifiedClaims> {
  if ((event as ApiGwEvent).__verifiedClaims) {
    return (event as ApiGwEvent).__verifiedClaims as VerifiedClaims;
  }

  if (!idTokenVerifier || !accessTokenVerifier) {
    throw { statusCode: 401, body: "unauthorized" };
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
      throw { statusCode: 401, body: "unauthorized" };
    }
  }

  if (!payload) {
    throw { statusCode: 401, body: "unauthorized" };
  }

  const tokenIssuer = typeof payload.iss === "string" ? payload.iss : "";
  if (issuer && tokenIssuer !== issuer) {
    console.warn("[auth] Issuer mismatch", { tokenIssuer, expected: issuer });
    throw { statusCode: 403, body: "forbidden: invalid issuer" };
  }

  const audience =
    (typeof payload.aud === "string" && payload.aud) ||
    (typeof payload.client_id === "string" && payload.client_id) ||
    "";
  if (audience && clientId && audience !== clientId) {
    console.warn("[auth] Audience mismatch", { audience, expected: clientId });
    throw { statusCode: 403, body: "forbidden: invalid audience" };
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
