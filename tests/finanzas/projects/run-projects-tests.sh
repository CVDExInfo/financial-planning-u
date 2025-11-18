// src/api/finanzas.ts
// Drop-in replacement for uploadInvoice with S3 presigned upload + invoice registration.

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number;
  amount: number;
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string; // ISO yyyy-mm-dd
};

// If you already have a shared HTTP wrapper (e.g., apiFetch or httpFetch), import it here.
// Adjust the import to match your repo (client.ts or http-client.ts).
import { apiFetch } from "@/api/client"; // ← adjust if your wrapper lives elsewhere

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, "") ||
  "/finanzas/api"; // fallback only if CF path-rewrite is configured

type PresignResponse =
  | {
      method?: "POST";
      url: string;
      key: string; // S3 object key (documentKey)
      fields: Record<string, string>;
    }
  | {
      method: "PUT";
      url: string; // direct PUT URL
      key: string;
      headers?: Record<string, string>;
    };

function assertApiBase(): string {
  if (!API_BASE || API_BASE === "/finanzas/api") {
    // Keep the error explicit so the UI can surface a useful banner.
    // (Your ErrorBanner already handles this message.)
    throw new Error(
      "VITE_API_BASE_URL is not set. Finanzas API client is disabled."
    );
  }
  return API_BASE;
}

/**
 * Uploads an invoice document to S3 via a presigned URL and registers the record in Finanzas.
 * 1) POST /uploads/presign  -> { url, key, fields? | headers?, method }
 * 2) Upload to S3           -> 204/201 OK
 * 3) POST /projects/{id}/invoices with documentKey + metadata
 */
export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
) {
  if (!projectId) throw new Error("Missing projectId.");
  if (!payload?.file) throw new Error("No file selected for upload.");
  if (!payload.line_item_id) throw new Error("Line item is required.");
  if (payload.month == null || Number.isNaN(Number(payload.month))) {
    throw new Error("Month is required.");
  }
  if (payload.amount == null || Number.isNaN(Number(payload.amount))) {
    throw new Error("Amount is required.");
  }

  const base = assertApiBase();
  const file = payload.file;
  const contentType = file.type || "application/octet-stream";

  // 1) Presign request (module/entity naming is for server-side routing/auditing)
  const presignRes = await apiFetch(`${base}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module: "finanzas",
      entity: "invoice",
      projectId,
      contentType,
      originalName: file.name,
    }),
  });

  if (!presignRes.ok) {
    const text = await presignRes.text().catch(() => "");
    throw new Error(
      `Failed to presign upload (HTTP ${presignRes.status}): ${text}`
    );
  }

  const presign: PresignResponse = await presignRes.json();

  // 2) Upload to S3 (supports POST or PUT contracts)
  if ((presign as any).fields) {
    // S3 POST policy
    const { url, fields, key } = presign as Extract<PresignResponse, { fields: Record<string, string> }>;
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);

    const s3Post = await fetch(url, { method: "POST", body: form });
    if (!(s3Post.status === 204 || s3Post.status === 201 || s3Post.ok)) {
      const body = await s3Post.text().catch(() => "");
      throw new Error(`S3 POST upload failed (HTTP ${s3Post.status}): ${body}`);
    }

    // 3) Register invoice
    return await registerInvoice(base, projectId, {
      ...payload,
      documentKey: key,
      originalName: file.name,
      contentType,
      size: file.size,
    });
  } else {
    // Direct PUT URL
    const { url, key, headers } = presign as Extract<PresignResponse, { method: "PUT" }>;
    const s3Put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType, ...(headers || {}) },
      body: file,
    });
    if (!s3Put.ok) {
      const body = await s3Put.text().catch(() => "");
      throw new Error(`S3 PUT upload failed (HTTP ${s3Put.status}): ${body}`);
    }

    // 3) Register invoice
    return await registerInvoice(base, projectId, {
      ...payload,
      documentKey: key,
      originalName: file.name,
      contentType,
      size: file.size,
    });
  }
}

type RegisterBody = UploadInvoicePayload & {
  documentKey: string;
  originalName?: string;
  contentType?: string;
  size?: number;
};

async function registerInvoice(
  base: string,
  projectId: string,
  body: RegisterBody
) {
  // Only send serializable invoice metadata to the API (no File objects)
  const {
    file: _omitFile,
    line_item_id,
    month,
    amount,
    description,
    vendor,
    invoice_number,
    invoice_date,
    documentKey,
    originalName,
    contentType,
    size,
  } = body;

  const registerRes = await apiFetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        line_item_id,
        month,
        amount,
        description,
        vendor,
        invoice_number,
        invoice_date,
        documentKey,
        originalName,
        contentType,
        size,
      }),
    }
  );

  if (!registerRes.ok) {
    const text = await registerRes.text().catch(() => "");
    throw new Error(
      `Failed to register invoice (HTTP ${registerRes.status}): ${text}`
    );
  }

  return registerRes.json().catch(() => ({}));
}
