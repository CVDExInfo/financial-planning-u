import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import crypto from "node:crypto";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import { ddb, PutCommand, QueryCommand, tableName } from "../lib/dynamo";

type InvoicePayload = {
  projectId: string;
  lineItemId: string;
  invoiceNumber: string;
  amount: number;
  month: number;
  vendor?: string;
  description?: string;
  documentKey: string;
};

const parseBody = (raw: string | null | undefined): InvoicePayload | null => {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const base: InvoicePayload = {
    projectId: String(data.projectId || "").trim(),
    lineItemId: String(data.lineItemId || "").trim(),
    invoiceNumber: String(data.invoiceNumber || "").trim(),
    amount: Number(data.amount),
    month: Number(data.month),
    vendor: data.vendor ? String(data.vendor) : undefined,
    description: data.description ? String(data.description) : undefined,
    documentKey: String(data.documentKey || "").trim(),
  };

  return base;
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;

    if (method === "GET") {
      ensureCanRead(event as unknown as Parameters<typeof ensureCanRead>[0]);
      const projectId = event.queryStringParameters?.projectId?.trim();
      if (!projectId) {
        return bad("Missing required parameter: projectId");
      }

      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("prefacturas"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      );

      return ok({
        data: result.Items ?? [],
        projectId,
        total: result.Count ?? 0,
      });
    }

    if (method === "POST") {
      ensureCanWrite(event as unknown as Parameters<typeof ensureCanWrite>[0]);

      const payload = parseBody(event.body);
      if (!payload) {
        return bad("Invalid JSON body");
      }

      const {
        projectId,
        lineItemId,
        invoiceNumber,
        amount,
        month,
        vendor,
        description,
        documentKey,
      } = payload;

      if (!projectId) return bad("projectId is required");
      if (!lineItemId) return bad("lineItemId is required");
      if (!invoiceNumber) return bad("invoiceNumber is required");
      if (!Number.isFinite(amount) || amount <= 0) {
        return bad("amount must be a positive number");
      }
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return bad("month must be between 1 and 12");
      }
      if (!documentKey) return bad("documentKey is required");

      const now = new Date().toISOString();
      const invoiceId = `INV-${crypto
        .randomUUID()
        .split("-")
        .slice(0, 2)
        .join("")}`;

      const item = {
        pk: `PROJECT#${projectId}`,
        sk: `INVOICE#${invoiceId}`,
        invoiceId,
        id: invoiceId,
        projectId,
        lineItemId,
        invoiceNumber,
        amount,
        month,
        vendor,
        description,
        documentKey,
        uploaded_by: getUserEmail(
          event as unknown as Parameters<typeof getUserEmail>[0]
        ),
        created_at: now,
        updated_at: now,
      };

      await ddb.send(
        new PutCommand({
          TableName: tableName("prefacturas"),
          Item: item,
        })
      );

      return ok(item, 201);
    }

    return bad(`Method ${method} not allowed`, 405);
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) {
      return authError;
    }

    console.error("Error in prefacturas handler:", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
