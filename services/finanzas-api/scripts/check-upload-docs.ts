import { randomUUID } from "crypto";

const apiBase = process.env.FINZ_API_BASE_URL;
const authToken = process.env.AUTH_TOKEN;

if (!apiBase) {
  console.error("FINZ_API_BASE_URL is required (e.g. https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev)");
  process.exit(1);
}

if (!authToken) {
  console.error("AUTH_TOKEN (Cognito ID token) is required to call /uploads/docs");
  process.exit(1);
}

const requestUrl = `${apiBase.replace(/\/$/, "")}/uploads/docs`;

async function main() {
  const suffix = randomUUID();
  const invoiceNumber = `INV-HEALTH-${Date.now()}`;
  const payload = {
    projectId: "P-TEST-123",
    module: "reconciliation",
    lineItemId: "TEST-LINE",
    invoiceNumber,
    invoiceDate: "2025-12-01",
    fileName: `healthcheck-${suffix}.txt`,
    contentType: "text/plain",
  };

  console.info("Requesting presigned URL from /uploads/docs", { requestUrl, payload });

  const presignResponse = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  const presignBody = await presignResponse.json().catch(() => ({}));
  console.info("Presign response", { status: presignResponse.status, body: presignBody });

  if (!presignResponse.ok || !presignBody.uploadUrl) {
    throw new Error(`Presign failed: status=${presignResponse.status} body=${JSON.stringify(presignBody)}`);
  }

  const putResponse = await fetch(presignBody.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": payload.contentType,
    },
    body: "healthcheck\n",
  });

  console.info("PUT to S3 result", {
    status: putResponse.status,
    ok: putResponse.ok,
    statusText: putResponse.statusText,
  });

  if (!putResponse.ok) {
    const text = await putResponse.text().catch(() => "<no-body>");
    throw new Error(`Upload failed: status=${putResponse.status} body=${text}`);
  }

  console.info("Health check upload succeeded", {
    bucket: presignBody.bucket,
    objectKey: presignBody.objectKey,
  });
}

main().catch((error) => {
  console.error("Health check failed", { message: (error as Error).message, error });
  process.exit(1);
});
