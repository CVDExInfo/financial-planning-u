#!/usr/bin/env node
import { randomUUID } from "node:crypto";

const apiBase = process.env.FINZ_API_BASE_URL;
const authToken = process.env.FINZ_API_TOKEN;
const projectId = process.env.PROJECT_ID;

if (!apiBase) {
  console.error(
    "FINZ_API_BASE_URL is required (e.g. https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev)",
  );
  process.exit(1);
}

if (!authToken) {
  console.error("FINZ_API_TOKEN (Cognito ID token) is required to call /uploads/docs");
  process.exit(1);
}

if (!projectId) {
  console.error("PROJECT_ID is required for the docs upload health check");
  process.exit(1);
}

const requestUrl = `${apiBase.replace(/\/$/, "")}/uploads/docs`;

async function main() {
  const suffix = randomUUID().split("-")[0];
  const invoiceNumber = "INV-HEALTHCHECK";
  const payload = {
    projectId,
    module: "reconciliation",
    lineItemId: "HEALTHCHECK-LINE",
    invoiceNumber,
    invoiceDate: "2025-12-01",
    originalName: `healthcheck-${suffix}.txt`,
    fileName: `healthcheck-${suffix}.txt`,
    contentType: "text/plain",
  };

  console.info("[HEALTHCHECK] Requesting presigned URL", { requestUrl, payload });

  const presignResponse = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  const presignBody = await presignResponse
    .json()
    .catch(async () => ({ raw: await presignResponse.text().catch(() => "") }));

  if (presignResponse.ok && presignBody.uploadUrl) {
    console.info("[HEALTHCHECK] presign OK", {
      status: presignResponse.status,
      bucket: presignBody.bucket,
      objectKey: presignBody.objectKey,
    });
  } else {
    console.error("[HEALTHCHECK] presign error", {
      status: presignResponse.status,
      body: presignBody,
    });
    process.exit(1);
  }

  const putResponse = await fetch(presignBody.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": payload.contentType,
    },
    body: "healthcheck\n",
  });

  if (putResponse.ok) {
    console.info("[HEALTHCHECK] S3 PUT OK", {
      status: putResponse.status,
      statusText: putResponse.statusText,
    });
  } else {
    const text = await putResponse.text().catch(() => "<no-body>");
    console.error("[HEALTHCHECK] S3 PUT failed", {
      status: putResponse.status,
      statusText: putResponse.statusText,
      body: text,
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[HEALTHCHECK] Failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
