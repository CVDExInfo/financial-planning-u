import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../../lib/auth";
import { fromAuthError, notFound, ok, bad, serverError } from "../../lib/http";
import {
  ddb,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  PutCommand,
  tableName,
} from "../../lib/dynamo";
import crypto from "node:crypto";

type InvoiceRecord = {
  pk: string;
  sk: string;
  invoiceId?: string;
  id?: string;
  projectId?: string;
  lineItemId?: string;
  month?: number;
  amount?: number;
  status?: string;
  description?: string;
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  documentKey?: string;
  file_name?: string;
  originalName?: string;
  contentType?: string;
  uploaded_by?: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type InvoiceStatus = "Pending" | "Matched" | "Disputed";

const ALLOWED_STATUSES: InvoiceStatus[] = ["Pending", "Matched", "Disputed"];

const normalizeInvoice = (item: InvoiceRecord) => {
  const idFromKey = item.sk?.replace(/^INVOICE#/, "") ?? item.sk;
  const invoiceId = item.invoiceId || item.id || idFromKey || "";
  const projectId = item.projectId || item.pk?.replace(/^PROJECT#/, "") || "";

  return {
    id: invoiceId,
    project_id: projectId,
    line_item_id: (item.lineItemId as string) || "",
    month: Number(item.month ?? 1),
    amount: Number(item.amount ?? 0),
    status: (item.status as InvoiceStatus) || "Pending",
    description: item.description,
    vendor: item.vendor,
    invoice_number: item.invoiceNumber,
    invoice_date: item.invoiceDate,
    documentKey: item.documentKey,
    file_name: item.file_name,
    originalName: item.originalName || item.file_name,
    contentType: item.contentType,
    uploaded_by: item.uploaded_by,
    uploaded_at: item.uploaded_at || item.created_at,
    updated_at: item.updated_at,
  };
};

type CreateInvoicePayload = {
  projectId?: string;
  lineItemId?: string;
  month?: number;
  amount?: number;
  description?: string;
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  documentKey?: string;
  originalName?: string;
  contentType?: string;
};

function parseCreatePayload(body: string | null): CreateInvoicePayload | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return {
      projectId: parsed.projectId ? String(parsed.projectId).trim() : undefined,
      lineItemId: parsed.lineItemId
        ? String(parsed.lineItemId).trim()
        : undefined,
      month:
        parsed.month !== undefined ? Number(parsed.month) : undefined,
      amount:
        parsed.amount !== undefined ? Number(parsed.amount) : undefined,
      description: parsed.description
        ? String(parsed.description)
        : undefined,
      vendor: parsed.vendor ? String(parsed.vendor).trim() : undefined,
      invoiceNumber: parsed.invoiceNumber
        ? String(parsed.invoiceNumber).trim()
        : undefined,
      invoiceDate: parsed.invoiceDate
        ? String(parsed.invoiceDate).trim()
        : undefined,
      documentKey: parsed.documentKey
        ? String(parsed.documentKey).trim()
        : undefined,
      originalName: parsed.originalName
        ? String(parsed.originalName).trim()
        : undefined,
      contentType: parsed.contentType
        ? String(parsed.contentType).trim()
        : undefined,
    };
  } catch (error) {
    console.warn("Invalid JSON for invoice create", error);
    return null;
  }
}

function mapDynamoError(
  error: unknown,
  context: Record<string, unknown>,
  tableKey: Parameters<typeof tableName>[0] = "prefacturas",
): APIGatewayProxyResultV2 {
  const name = (error as { name?: string } | undefined)?.name;
  const message = (error as { message?: string } | undefined)?.message || "";

  const failureContext = { ...context, tableName: tableName(tableKey), error };

  if (name === "ResourceNotFoundException") {
    console.error("Invoices table not found", failureContext);
    return bad("Invoices table not found", 503);
  }

  if (name === "AccessDeniedException") {
    console.error("Access denied writing invoices", failureContext);
    return bad("Access denied writing invoices", 503);
  }

  // Some Dynamo validation errors (missing table) surface as ValidationException
  if (
    name === "ValidationException" &&
    /Requested resource not found|non-existent table/i.test(message)
  ) {
    console.error("Invoices table not found (validation)", failureContext);
    return bad("Invoices table not found", 503);
  }

  // Throttling / throughput issues → treat as temporary 503
  if (
    name &&
    ["ThrottlingException", "ProvisionedThroughputExceededException"].includes(
      name,
    )
  ) {
    console.warn("Invoices table throttled", failureContext);
    return bad("Invoices storage temporarily unavailable", 503);
  }

  console.error("Invoices Dynamo failure", failureContext);
  return serverError("Error interno en Finanzas");
}

async function listInvoices(projectId: string) {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("prefacturas"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `PROJECT#${projectId}` },
      }),
    );

    const items = (result.Items as InvoiceRecord[]) || [];
    const data = items.map(normalizeInvoice);

    return ok({ data, projectId, total: data.length });
  } catch (error) {
    return mapDynamoError(error, { projectId, operation: "listInvoices" });
  }
}

async function getInvoice(projectId: string, invoiceId: string) {
  try {
    const response = await ddb.send(
      new GetCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `PROJECT#${projectId}`, sk: `INVOICE#${invoiceId}` },
      }),
    );

    if (!response.Item) {
      return notFound("Invoice not found");
    }

    return ok(normalizeInvoice(response.Item as InvoiceRecord));
  } catch (error) {
    return mapDynamoError(error, {
      projectId,
      invoiceId,
      operation: "getInvoice",
    });
  }
}

async function createInvoice(
  projectId: string,
  body: string | null,
  event: APIGatewayProxyEventV2,
) {
  const payload = parseCreatePayload(body);
  if (!payload) {
    return bad("Invalid JSON body", 400);
  }

  if (!payload.projectId) return bad("projectId is required", 400);
  if (payload.projectId !== projectId)
    return bad("projectId mismatch between path and body", 400);
  if (!payload.lineItemId) return bad("lineItemId is required", 400);

  if (
    !payload.month ||
    !Number.isInteger(payload.month) ||
    payload.month < 1 ||
    payload.month > 12
  ) {
    return bad("month must be an integer between 1 and 12", 400);
  }

  if (
    !payload.amount ||
    !Number.isFinite(payload.amount) ||
    payload.amount <= 0
  ) {
    return bad("amount must be a positive number", 400);
  }

  const invoiceDateValue = payload.invoiceDate
    ? Date.parse(payload.invoiceDate)
    : undefined;
  const normalizedInvoiceDate =
    typeof invoiceDateValue === "number" && !Number.isNaN(invoiceDateValue)
      ? new Date(invoiceDateValue).toISOString()
      : undefined;

  // Soft validation for rubro membership to avoid writing invoices to the wrong project
  console.info("InvoicesFn validate line item", {
    projectId,
    lineItemId: payload.lineItemId,
  });
  try {
    const rubro = await ddb.send(
      new GetCommand({
        TableName: tableName("rubros"),
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: `RUBRO#${payload.lineItemId}`,
        },
      }),
    );
    if (!rubro.Item) {
      return bad("lineItemId not found for project", 400);
    }
  } catch (error) {
    return mapDynamoError(
      error,
      { projectId, lineItemId: payload.lineItemId, operation: "validateLineItem" },
      "rubros",
    );
  }

  const invoiceId = `INV-${crypto.randomUUID().split("-")[0]}`;
  const now = new Date().toISOString();

  let uploadedBy: string | undefined;
  try {
    uploadedBy = await getUserEmail(event as never);
  } catch (error) {
    console.warn("Unable to resolve uploader email for invoice", {
      projectId,
      error,
    });
  }

  const item: InvoiceRecord = {
    pk: `PROJECT#${projectId}`,
    sk: `INVOICE#${invoiceId}`,
    invoiceId,
    id: invoiceId,
    projectId,
    lineItemId: payload.lineItemId,
    invoiceNumber:
      payload.invoiceNumber ||
      `INV-${Date.now().toString(36).toUpperCase()}`,
    amount: payload.amount,
    month: payload.month,
    vendor: payload.vendor,
    description: payload.description,
    invoiceDate: normalizedInvoiceDate,
    documentKey: payload.documentKey,
    originalName: payload.originalName,
    contentType: payload.contentType,
    status: "Pending",
    uploaded_by: uploadedBy,
    uploaded_at: now,
    created_at: now,
    updated_at: now,
  };

  if (!payload.documentKey) {
    console.warn("Invoice created without documentKey", { projectId, invoiceId });
  }

  console.info("InvoicesFn creating invoice", {
    projectId,
    lineItemId: payload.lineItemId,
    invoiceId,
    amount: payload.amount,
    month: payload.month,
    documentKey: payload.documentKey,
  });

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName("prefacturas"),
        Item: item,
      }),
    );
  } catch (error) {
    return mapDynamoError(error, {
      projectId,
      invoiceId,
      operation: "createInvoice",
    });
  }

  return ok(normalizeInvoice(item), 201);
}

async function updateStatus(
  projectId: string,
  invoiceId: string,
  body: string | null,
) {
  let payload: { status?: unknown; comment?: unknown };
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    return bad("Invalid JSON body", 400);
  }

  const status = payload.status as InvoiceStatus | undefined;
  const comment =
    typeof payload.comment === "string" && payload.comment.trim().length
      ? payload.comment.trim()
      : undefined;

  if (!status) {
    return bad("status is required", 400);
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return bad("Invalid invoice status", 400);
  }

  const now = new Date().toISOString();
  const updateParts = ["#status = :status", "updated_at = :now"] as string[];
  const values: Record<string, unknown> = { ":status": status, ":now": now };

  if (comment) {
    updateParts.push("#comment = :comment");
    values[":comment"] = comment;
  }

  let result;
  try {
    result = await ddb.send(
      new UpdateCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `PROJECT#${projectId}`, sk: `INVOICE#${invoiceId}` },
        UpdateExpression: `SET ${updateParts.join(", ")}`,
        ExpressionAttributeNames: {
          "#status": "status",
          ...(comment ? { "#comment": "comment" } : {}),
        },
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        ReturnValues: "ALL_NEW",
      }),
    );
  } catch (error) {
    return mapDynamoError(error, {
      projectId,
      invoiceId,
      operation: "updateStatus",
    });
  }

  const attributes = result.Attributes as InvoiceRecord | undefined;
  if (!attributes) {
    return serverError("Failed to update invoice status");
  }

  return ok(normalizeInvoice(attributes));
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method ?? "";
  const rawPath = event.rawPath ?? "";
  const projectId = event.pathParameters?.projectId;
  const invoiceId = event.pathParameters?.invoiceId;

  try {
    if (!projectId) {
      return bad("Missing projectId", 400);
    }

    const isInvoicesCollection = rawPath.endsWith("/invoices");
    if (isInvoicesCollection && method === "GET") {
      await ensureCanRead(event as never);
      return listInvoices(projectId);
    }

    if (isInvoicesCollection && method === "POST") {
      await ensureCanWrite(event as never);
      return createInvoice(projectId, event.body ?? null, event);
    }

    const isInvoiceLookup =
      rawPath.includes("/invoices/") &&
      !rawPath.endsWith("/status") &&
      method === "GET";

    if (isInvoiceLookup) {
      if (!invoiceId) {
        return bad("Missing invoiceId", 400);
      }
      await ensureCanRead(event as never);
      return getInvoice(projectId, invoiceId);
    }

    const isStatusUpdate =
      rawPath.endsWith("/status") && ["PUT", "POST"].includes(method);
    if (isStatusUpdate) {
      if (!invoiceId) {
        return bad("Missing invoiceId", 400);
      }
      await ensureCanWrite(event as never);
      return updateStatus(projectId, invoiceId, event.body ?? null);
    }

    return notFound("Route not handled by InvoicesFn");
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("InvoicesFn error", {
      projectId,
      rawPath,
      method,
      error,
    });
    return serverError(message);
  }
}
