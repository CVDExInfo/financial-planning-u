import { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";
import { ensureCanRead, ensureCanWrite } from "../lib/auth";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import { ddb, tableName, PutCommand, ScanCommand } from "../lib/dynamo";
import crypto from "node:crypto";

/**
 * Payload sent by the UI (Crear Proyecto modal)
 * {
 *   name: string;       // e.g. "Mobile Banking App MVP"
 *   code: string;       // PROJ-YYYY-NNN
 *   client: string;     // customer name
 *   start_date: string; // yyyy-mm-dd
 *   end_date: string;   // yyyy-mm-dd
 *   currency: "USD" | "EUR" | "MXN"
 *   mod_total: number;  // numeric MOD budget
 *   description?: string;
 * }
 */

const dateString = z
  .string()
  .min(8, "Date is required")
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid date format");

const projectPayloadSchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().regex(/^PROJ-\d{4}-\d{3}$/),
  client: z.string().min(2).max(200),
  start_date: dateString,
  end_date: dateString,
  currency: z.enum(["USD", "EUR", "MXN"]),
  mod_total: z
    .coerce
    .number({ invalid_type_error: "mod_total must be a number" })
    .min(0, "mod_total must be zero or greater"),
  description: z.string().max(1000).optional(),
});

const normalizeIncomingProject = (raw: Record<string, unknown>) => ({
  name: raw.name ?? raw.nombre,
  code: raw.code ?? raw.codigo,
  client: raw.client ?? raw.cliente,
  start_date: raw.start_date ?? raw.startDate ?? raw.fecha_inicio,
  end_date: raw.end_date ?? raw.endDate ?? raw.fecha_fin,
  currency: raw.currency ?? raw.moneda,
  mod_total: raw.mod_total ?? raw.modTotal ?? raw.presupuesto_total,
  description: raw.description ?? raw.descripcion ?? raw.project_description,
});

export const normalizeProjectItem = (
  item: Record<string, unknown>
): Record<string, unknown> => {
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
    (item as Record<string, unknown>).endDate ||
    null;

  const start_date =
    (item as Record<string, unknown>).fecha_inicio ||
    (item as Record<string, unknown>).fechaInicio ||
    (item as Record<string, unknown>).start_date ||
    (item as Record<string, unknown>).startDate ||
    null;

  return {
    id: derivedId,
    identifier: derivedId,
    project_id: derivedId,
    projectId: derivedId,
    cliente: (item as Record<string, unknown>).cliente ?? null,
    client: (item as Record<string, unknown>).client ??
      (item as Record<string, unknown>).cliente ?? null,
    nombre: (item as Record<string, unknown>).nombre ?? null,
    name:
      (item as Record<string, unknown>).name ??
      (item as Record<string, unknown>).nombre ??
      null,
    code:
      (item as Record<string, unknown>).code ??
      (item as Record<string, unknown>).codigo ??
      null,
    fecha_inicio: start_date,
    start_date,
    fecha_fin,
    end_date: fecha_fin,
    moneda: (item as Record<string, unknown>).moneda ?? null,
    currency:
      (item as Record<string, unknown>).currency ??
      (item as Record<string, unknown>).moneda ??
      null,
    presupuesto_total: Number(
      (item as Record<string, unknown>).presupuesto_total ||
        (item as Record<string, unknown>).presupuestoTotal ||
        (item as Record<string, unknown>).mod_total ||
        (item as Record<string, unknown>).modTotal ||
        0
    ),
    mod_total: Number(
      (item as Record<string, unknown>).mod_total ||
        (item as Record<string, unknown>).presupuesto_total ||
        (item as Record<string, unknown>).presupuestoTotal ||
        0
    ),
    estado: (item as Record<string, unknown>).estado ?? null,
    status:
      (item as Record<string, unknown>).status ??
      (item as Record<string, unknown>).estado ??
      null,
    description:
      (item as Record<string, unknown>).description ??
      (item as Record<string, unknown>).descripcion ??
      null,
    descripcion:
      (item as Record<string, unknown>).descripcion ??
      (item as Record<string, unknown>).description ??
      null,
    created_at:
      (item as Record<string, unknown>).created_at ||
      (item as Record<string, unknown>).createdAt ||
      null,
    created_by:
      (item as Record<string, unknown>).created_by ||
      (item as Record<string, unknown>).createdBy ||
      null,
  };
};

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

      const normalizedPayload = normalizeIncomingProject(body);
      const parsed = projectPayloadSchema.safeParse(normalizedPayload);

      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => issue.message || issue.path.join("."))
          .join("; ");
        return bad(
          detail || "Invalid project payload. Please check required fields.",
          422
        );
      }

      const payload = parsed.data;

      if (new Date(payload.end_date).getTime() < new Date(payload.start_date).getTime()) {
        return bad("end_date must be on or after start_date", 422);
      }

      const id = "P-" + crypto.randomUUID();
      const now = new Date().toISOString();
      const createdBy =
        event.requestContext.authorizer?.jwt?.claims?.email || "system";

      const item = {
        pk: `PROJECT#${id}`,
        sk: "METADATA",
        id,
        project_id: id,
        projectId: id,
        nombre: payload.name,
        name: payload.name,
        codigo: payload.code,
        code: payload.code,
        cliente: payload.client,
        client: payload.client,
        fecha_inicio: payload.start_date,
        start_date: payload.start_date,
        fecha_fin: payload.end_date,
        end_date: payload.end_date,
        moneda: payload.currency,
        currency: payload.currency,
        presupuesto_total: payload.mod_total,
        mod_total: payload.mod_total,
        descripcion: payload.description,
        description: payload.description,
        estado: "active",
        status: "active",
        created_at: now,
        updated_at: now,
        created_by: createdBy,
      };

      try {
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
            code: item.code,
            fecha_inicio: item.fecha_inicio,
            fecha_fin: item.fecha_fin,
          },
          source: "API",
          ip_address: event.requestContext.http?.sourceIp,
          user_agent: event.requestContext.http?.userAgent,
        };

        await ddb.send(
          new PutCommand({
            TableName: tableName("audit_log"),
            Item: auditEntry,
          })
        );
      } catch (ddbError) {
        const errorObj = ddbError as Error;
        console.error("ProjectsFn put failed", {
          projectId: id,
          errorName: errorObj?.name,
          message: errorObj?.message,
        });
        throw ddbError;
      }

      return ok(normalizeProjectItem(item), 201);
    }

    // GET /projects
    await ensureCanRead(event);

    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName("projects"),
        Limit: 50,
      })
    );

    const projects = (result.Items ?? []).map((item) =>
      normalizeProjectItem(item as Record<string, unknown>)
    );

    return ok({ data: projects, total: projects.length });
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    // Handle DynamoDB-specific errors with appropriate status codes
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("DynamoDB table not found", {
        error,
        table: tableName("projects"),
        operation: event.requestContext?.http?.method,
        path: event.rawPath,
      });
      return bad(`Required table not found: ${tableName("projects")}. Check infrastructure deployment.`, 503);
    }

    if (error && (error as { name?: string }).name === "AccessDeniedException") {
      console.error("DynamoDB access denied", {
        error,
        table: tableName("projects"),
        operation: event.requestContext?.http?.method,
      });
      return bad("Database access denied - check IAM permissions", 503);
    }

    console.error("Error in projects handler", {
      error,
      stack: error instanceof Error ? (error as Error).stack : undefined,
      method: event.requestContext?.http?.method,
      path: event.rawPath,
    });
    return serverError();
  }
};
