import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { ensureCanRead, ensureCanWrite } from "../../lib/auth";
import { fromAuthError, notFound, ok, bad, serverError } from "../../lib/http";
import {
  ddb,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  tableName,
} from "../../lib/dynamo";

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
  documentKey?: string;
  file_name?: string;
  originalName?: string;
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
    documentKey: item.documentKey,
    file_name: item.file_name,
    originalName: item.originalName || item.file_name,
    uploaded_by: item.uploaded_by,
    uploaded_at: item.uploaded_at || item.created_at,
    updated_at: item.updated_at,
  };
};

async function listInvoices(projectId: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName("prefacturas"),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `PROJECT#${projectId}` },
    })
  );

  const items = (result.Items as InvoiceRecord[]) || [];
  const data = items.map(normalizeInvoice);

  return ok({ data, projectId, total: data.length });
}

async function getInvoice(projectId: string, invoiceId: string) {
  const response = await ddb.send(
    new GetCommand({
      TableName: tableName("prefacturas"),
      Key: { pk: `PROJECT#${projectId}`, sk: `INVOICE#${invoiceId}` },
    })
  );

  if (!response.Item) {
    return notFound("Invoice not found");
  }

  return ok(normalizeInvoice(response.Item as InvoiceRecord));
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

  const result = await ddb.send(
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
    })
  );

  const attributes = result.Attributes as InvoiceRecord | undefined;
  if (!attributes) {
    return serverError("Failed to update invoice status");
  }

  return ok(normalizeInvoice(attributes));
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext?.http?.method ?? "";
    const rawPath = event.rawPath ?? "";
    const projectId = event.pathParameters?.projectId;
    const invoiceId = event.pathParameters?.invoiceId;

    if (!projectId) {
      return bad("Missing projectId", 400);
    }

    const isInvoicesCollection =
      rawPath.endsWith("/invoices") && method === "GET";
    if (isInvoicesCollection) {
      await ensureCanRead(event as never);
      return listInvoices(projectId);
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
      return updateStatus(projectId, invoiceId, event.body);
    }

    return notFound("Route not handled by InvoicesFn");
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("InvoicesFn error", error);
    return serverError(message);
  }
}
