import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { ddb, tableName, PutCommand, ScanCommand } from "../lib/dynamo";
import crypto from "node:crypto";

export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  if (event.requestContext.http.method === "POST") {
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

    const id = "P-" + crypto.randomUUID();
    const now = new Date().toISOString();

    const item = {
      pk: `PROJECT#${id}`,
      sk: "METADATA",
      id,
      cliente: body.cliente,
      nombre: body.nombre,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      moneda: body.moneda,
      presupuesto_total: body.presupuesto_total || 0,
      estado: "active",
      created_at: now,
      created_by:
        event.requestContext.authorizer?.jwt?.claims?.email || "system",
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName("projects"),
        Item: item,
      })
    );

    // Write audit log entry
    const auditEntry = {
      pk: `ENTITY#PROJECT#${id}`,
      sk: `TS#${now}`,
      action: "CREATE_PROJECT",
      resource_type: "project",
      resource_id: id,
      user: item.created_by,
      timestamp: now,
      before: null,
      after: {
        id,
        cliente: item.cliente,
        nombre: item.nombre,
        presupuesto_total: item.presupuesto_total,
      },
      source: "API",
      ip_address: event.requestContext.http.sourceIp,
      user_agent: event.requestContext.http.userAgent,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName("audit_log"),
        Item: auditEntry,
      })
    );

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...item }),
    };
  }

  // GET /projects
  const result = await ddb.send(
    new ScanCommand({
      TableName: tableName("projects"),
      Limit: 50,
    })
  );

  // Ensure consistent schema by including all expected fields
  const projects = (result.Items ?? []).map(item => ({
    ...item,
    fecha_inicio: item.fecha_inicio ?? null,
    fecha_fin: item.fecha_fin ?? null,
    cliente: item.cliente ?? null,
    nombre: item.nombre ?? null,
    moneda: item.moneda ?? null,
    presupuesto_total: item.presupuesto_total ?? 0,
    estado: item.estado ?? "active",
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(projects),
  };
};
