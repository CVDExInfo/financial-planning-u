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

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    ensureCanWrite(event as unknown as Parameters<typeof ensureCanWrite>[0]);

    if (!DOCS_BUCKET) {
      throw new Error("DOCS_BUCKET environment variable is not configured");
    }

    if (!event.body) {
      return bad("Missing request body");
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return bad("Invalid JSON body");
    }

    const projectId = String(payload.projectId || "").trim();
    const moduleName = String(payload.module || "")
      .trim()
      .toLowerCase();
    const lineItemId = payload.lineItemId
      ? String(payload.lineItemId).trim()
      : undefined;
    const invoiceNumber = payload.invoiceNumber
      ? String(payload.invoiceNumber).trim()
      : undefined;
    const contentType = String(payload.contentType || "").trim();
    const originalName = String(payload.originalName || "").trim();

    if (!projectId) {
      return bad("projectId is required");
    }
    if (!moduleName || !ALLOWED_MODULES.has(moduleName)) {
      return bad(
        "module must be one of prefactura, catalog, reconciliation, changes"
      );
    }
    if (!contentType) {
      return bad("contentType is required");
    }
    if (!originalName) {
      return bad("originalName is required");
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
    const metadataItem = {
      pk: `DOC#${projectId}`,
      sk: `${moduleName.toUpperCase()}#${createdAt}#${suffix}`,
      projectId,
      module: moduleName,
      objectKey,
      lineItemId,
      invoiceNumber,
      contentType,
      originalName,
      uploader: getUserEmail(
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

    return ok({ uploadUrl, objectKey });
  } catch (error) {
    console.error("upload-docs error", error);
    return serverError(
      error instanceof Error ? error.message : "Failed to create upload URL"
    );
  }
};
