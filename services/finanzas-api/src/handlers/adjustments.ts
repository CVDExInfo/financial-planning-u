// Minimal event typing to avoid dependency issues with aws-lambda v2 types
type ApiGwEvent = {
  requestContext: unknown;
  pathParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
};
// Node16/nodenext requires explicit extension; authorizer util compiled to auth.js
import { ensureSDT } from "../lib/auth.js";

// TODO: Implement adjustments management
// R1 requirement: POST/GET /adjustments
export const handler = async (event: ApiGwEvent) => {
  try {
    // Soft auth enforcement for R1 (allow visibility even if SDT group mismatch); future harden
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- temporary cast until full APIGatewayProxyEventV2 typing restored
      ensureSDT(event as any);
    } catch (authErr) {
      console.warn("[adjustments] SDT enforcement skipped:", authErr);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- requestContext shape provided by API Gateway v2
    const method = (event.requestContext as any).http.method;

    if (method === "POST") {
      // TODO: Create adjustment entry (persist to DynamoDB Adjustments table)
      return {
        statusCode: 501,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "POST /adjustments - not implemented yet",
        }),
      };
    }

    // GET - list adjustments
    // TODO: Query adjustments table (future: pagination, filtering by project, date range)
    return {
      statusCode: 501,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "GET /adjustments - not implemented yet",
      }),
    };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusCode" in err) {
      const e = err as { statusCode?: number; body?: string };
      return {
        statusCode: e.statusCode || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: e.body || "error" }),
      };
    }
    console.error("/adjustments unhandled error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "internal error" }),
    };
  }
};
