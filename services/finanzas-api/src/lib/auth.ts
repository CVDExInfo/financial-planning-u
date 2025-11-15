// Lightweight event typing (avoid dependency issues with aws-lambda types in node16 bundling)
type ApiGwEvent = {
  requestContext: {
    authorizer?: {
      jwt?: { claims?: Record<string, unknown> };
    };
  };
};

// Helper to extract groups from JWT claims
function getGroups(event: ApiGwEvent): string[] {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) return [];

  let groups: string[] = [];
  const raw = claims["cognito:groups"] as unknown;
  if (Array.isArray(raw)) {
    groups = raw.map(String);
  } else if (typeof raw === "string" && raw.trim().length) {
    // Split on comma or whitespace
    groups = raw.split(/[\s,]+/).filter(Boolean);
  }
  return groups.map((g) => g.toUpperCase());
}

// Helper to extract user email from JWT claims
export function getUserEmail(event: ApiGwEvent): string {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  return (claims?.email as string) || "system";
}

// Flexible SDT membership check supporting array or string forms.
// Some environments/tools may serialize cognito:groups as a comma-separated string.
export function ensureSDT(event: ApiGwEvent) {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: "unauthorized" };

  const groups = getGroups(event);
  const hasSDT = groups.includes("SDT");
  if (!hasSDT) {
    // Temporary debug: surface observed groups to logs to diagnose unexpected 403
    console.warn("[auth] SDT check failed; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: SDT required" };
  }
}

// RBAC check: PM and SDT can write (create/update)
export function ensureCanWrite(event: ApiGwEvent) {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: "unauthorized" };

  const groups = getGroups(event);
  const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
  if (!canWrite) {
    console.warn("[auth] Write permission denied; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: PM or SDT required" };
  }
}

// RBAC check: All authenticated users with valid groups can read
export function ensureCanRead(event: ApiGwEvent) {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: "unauthorized" };

  const groups = getGroups(event);
  const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
  if (!canRead) {
    console.warn("[auth] Read permission denied; groups observed:", groups);
    throw { statusCode: 403, body: "forbidden: valid group required" };
  }
}
