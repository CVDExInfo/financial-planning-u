import { APIGatewayProxyEventV2 } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import { ensureCanWrite, getUserEmail } from "../lib/auth";
import { bad, ok, serverError } from "../lib/http";
import { ddb, PutCommand, tableName } from "../lib/dynamo";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-2" });
const DOCS_BUCKET = process.env.DOCS_BUCKET;
const ALLOWED_MODULES = new Set([
  "prefactura",
  "catalog",
  "reconciliation",
  "changes",
]);

type UploadPayload = {
  projectId: string;
  module: string;
  lineItemId?: string;
  invoiceNumber?: string;
  contentType: string;
  originalName: string;
  vendor?: string;
  amount?: number;
  invoiceDate?: string;
  checksumSha256?: string;
};

function parsePayload(raw: string | null | undefined): UploadPayload | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw);
    return {
      projectId: String(payload.projectId || "").trim(),
      module: String(payload.module || "").trim().toLowerCase(),
      lineItemId: payload.lineItemId ? String(payload.lineItemId).trim() : undefined,
      invoiceNumber: payload.invoiceNumber
        ? String(payload.invoiceNumber).trim()
        : undefined,
      contentType: String(payload.contentType || "").trim(),
      originalName: String(payload.originalName || "").trim(),
      vendor: payload.vendor ? String(payload.vendor).trim() : undefined,
      amount:
        typeof payload.amount === "number"
          ? payload.amount
          : payload.amount
            ? Number(payload.amount)
            : undefined,
      invoiceDate: payload.invoiceDate
        ? String(payload.invoiceDate).trim()
        : payload.date
          ? String(payload.date).trim()
          : undefined,
      checksumSha256: payload.checksumSha256
        ? String(payload.checksumSha256).trim()
        : undefined,
    };
  } catch (error) {
    console.warn("Invalid JSON body for /uploads/docs", error);
    return null;
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanWrite(event as unknown as Parameters<typeof ensureCanWrite>[0]);

    if (!DOCS_BUCKET) {
      throw new Error("DOCS_BUCKET environment variable is not configured");
    }

    const payload = parsePayload(event.body);
    if (!payload) {
      return bad("Invalid JSON body");
    }

    const {
      projectId,
      module: moduleName,
      lineItemId,
      invoiceNumber,
      contentType,
      originalName,
      vendor,
      amount,
      invoiceDate,
      checksumSha256,
    } = payload;

    if (!projectId) return bad("projectId is required");
    if (!moduleName || !ALLOWED_MODULES.has(moduleName)) {
      return bad(
        "module must be one of prefactura, catalog, reconciliation, changes"
      );
    }
    if (!contentType) return bad("contentType is required");
    if (!originalName) return bad("originalName is required");

    const parsedInvoiceDate = invoiceDate ? Date.parse(invoiceDate) : undefined;
    const normalizedInvoiceDate =
      typeof parsedInvoiceDate === "number" && !Number.isNaN(parsedInvoiceDate)
        ? new Date(parsedInvoiceDate).toISOString()
        : undefined;
    const metadataInvoiceDate =
      normalizedInvoiceDate ||
      (invoiceDate ? new Date(invoiceDate).toISOString() : undefined);

    if (amount !== undefined && !Number.isFinite(amount)) {
      return bad("amount must be a valid number when provided");
    }

    if (moduleName === "reconciliation") {
      if (!lineItemId) return bad("lineItemId is required for reconciliation");
      if (!invoiceDate) return bad("invoiceDate is required for reconciliation");
      if (!normalizedInvoiceDate)
        return bad("invoiceDate must be a valid date for reconciliation");
      if (!vendor) return bad("vendor is required for reconciliation");
      if (!Number.isFinite(amount) || Number(amount) <= 0) {
        return bad("amount must be a positive number for reconciliation");
      }
    }

    const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = crypto.randomUUID().split("-")[0];
    const contextPart = lineItemId || invoiceNumber || timestamp;
    const objectKey = `docs/${projectId}/${moduleName}/${contextPart}-${suffix}-${safeName}`;

    const putCommand = new PutObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 600 });

    const createdAt = new Date().toISOString();
    const documentId = `DOC-${crypto.randomUUID().split("-")[0]}`;
    const metadataItem = {
      pk: `DOC#${projectId}`,
      sk: `${moduleName.toUpperCase()}#${createdAt}#${documentId}`,
      documentId,
      projectId,
      module: moduleName,
      objectKey,
      lineItemId,
      invoiceNumber,
      vendor,
      amount,
      invoiceDate: metadataInvoiceDate,
      checksumSha256,
      contentType,
      originalName,
      uploader: await getUserEmail(
        event as unknown as Parameters<typeof getUserEmail>[0]
      ),
      created_at: createdAt,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName("docs"),
        Item: metadataItem,
      })
    );

    return ok({ uploadUrl, objectKey, documentId, metadata: metadataItem }, 201);
  } catch (error) {
    const name = (error as { name?: string } | undefined)?.name;
    if (name === "ResourceNotFoundException" || name === "AccessDeniedException") {
      const message =
        name === "ResourceNotFoundException"
          ? "Docs table not found or not provisioned (TABLE_DOCS)"
          : "Access denied writing to docs table";
      return bad(message, 503);
    }

    console.error("upload-docs error", error);
    return serverError(
      error instanceof Error ? error.message : "Failed to create upload URL"
    );
  }
};
