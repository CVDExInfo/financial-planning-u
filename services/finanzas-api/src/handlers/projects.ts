import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite } from "../lib/auth";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import { ddb, tableName, PutCommand, ScanCommand } from "../lib/dynamo";
import crypto from "node:crypto";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    if (event.requestContext.http.method === "POST") {
      await ensureCanWrite(event);

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return bad("Invalid JSON in request body");
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

      return ok({ id, ...item }, 201);
    }

    // GET /projects
    await ensureCanRead(event);

    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName("projects"),
        Limit: 50,
      })
    );

    const projects = (result.Items ?? []).map((item) => {
      // Normalize identifiers and ensure fecha_fin exists for contract tests
      let derivedId =
        (typeof item.pk === "string" && item.pk.startsWith("PROJECT#")
          ? item.pk.replace("PROJECT#", "")
          : undefined) ||
        (item as Record<string, unknown>).project_id ||
        (item as Record<string, unknown>).projectId ||
        (item as Record<string, unknown>).id;

      if (!derivedId) {
        derivedId = String(
          (item as Record<string, unknown>).pk ??
            (item as Record<string, unknown>).sk ??
            "UNKNOWN-PROJECT"
        );
      }

      const fecha_fin =
        (item as Record<string, unknown>).fecha_fin ||
        (item as Record<string, unknown>).fechaFin ||
        (item as Record<string, unknown>).end_date ||
        null;

      return {
        id: derivedId,
        identifier: derivedId,
        cliente: (item as Record<string, unknown>).cliente ?? null,
        nombre: (item as Record<string, unknown>).nombre ?? null,
        fecha_inicio:
          (item as Record<string, unknown>).fecha_inicio ||
          (item as Record<string, unknown>).fechaInicio ||
          null,
        fecha_fin,
        moneda: (item as Record<string, unknown>).moneda ?? null,
        presupuesto_total:
          (item as Record<string, unknown>).presupuesto_total ||
          (item as Record<string, unknown>).presupuestoTotal ||
          0,
        estado: (item as Record<string, unknown>).estado ?? null,
        created_at:
          (item as Record<string, unknown>).created_at ||
          (item as Record<string, unknown>).createdAt ||
          null,
        created_by:
          (item as Record<string, unknown>).created_by ||
          (item as Record<string, unknown>).createdBy ||
          null,
      };
    });

    return ok({ data: projects, total: projects.length });
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    console.error("Error in projects handler", error);
    return serverError();
  }
};
