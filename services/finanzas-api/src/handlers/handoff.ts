import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { ddb, tableName, PutCommand } from "../lib/dynamo";

export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const id = event.pathParameters?.id;
  if (!id) return { statusCode: 400, body: "missing project id" };

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  const now = new Date().toISOString();

  const handoff = {
    pk: `PROJECT#${id}`,
    sk: `HANDOFF#${now}`,
    mod_total: body.mod_total,
    pct_ingenieros: body.pct_ingenieros,
    pct_sdm: body.pct_sdm,
    aceptado_por: body.aceptado_por,
    ts: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName("projects"),
      Item: handoff,
    })
  );

  // audit
  const userEmail =
    event.requestContext.authorizer?.jwt?.claims?.email || "system";

  const audit = {
    pk: `ENTITY#PROJECT#${id}`,
    sk: `TS#${now}`,
    action: "HANDOFF",
    resource_type: "project",
    resource_id: id,
    user: userEmail,
    timestamp: now,
    before: null,
    after: handoff,
    source: "API",
    ip_address: event.requestContext.http.sourceIp,
    user_agent: event.requestContext.http.userAgent,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName("audit_log"),
      Item: audit,
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
