// Lightweight event typing (avoid dependency issues with aws-lambda types in node16 bundling)
type ApiGwEvent = {
  requestContext: {
    authorizer?: {
      jwt?: { claims?: Record<string, unknown> }
    }
  }
};

// Flexible SDT membership check supporting array or string forms.
// Some environments/tools may serialize cognito:groups as a comma-separated string.
export function ensureSDT(event: ApiGwEvent) {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw { statusCode: 401, body: 'unauthorized' };

  let groups: string[] = [];
  const raw = claims['cognito:groups'] as unknown;
  if (Array.isArray(raw)) {
    groups = raw.map(String);
  } else if (typeof raw === 'string' && raw.trim().length) {
    // Split on comma or whitespace
    groups = raw.split(/[\s,]+/).filter(Boolean);
  }

  const hasSDT = groups.some(g => g.toUpperCase() === 'SDT');
  if (!hasSDT) {
    // Temporary debug: surface observed groups to logs to diagnose unexpected 403
    console.warn('[auth] SDT check failed; groups observed:', groups);
    throw { statusCode: 403, body: 'forbidden: SDT required' };
  }
}
