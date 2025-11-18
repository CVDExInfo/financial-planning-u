// ---- Invoice upload pipeline (presign ➜ S3 ➜ create record) ----

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number;              // 1–12
  amount: number;             // numeric, already parsed in the UI
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;      // yyyy-mm-dd
};

type PresignPOST = {
  url: string;
  key: string;
  fields: Record<string, string>;
};

type PresignPUT = {
  url: string;
  key: string;
  method: "PUT";
  headers?: Record<string, string>;
};

type PresignResponse = PresignPOST | PresignPUT;

type InvoiceDTO = {
  id: string;
  line_item_id: string;
  month: number;
  amount: number;
  status: "Pending" | "Matched" | "Disputed";
  documentKey?: string;
  file_name?: string;
  originalName?: string;
  uploaded_at: string;
  uploaded_by: string;
};

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";
const MAX_MB = 50;

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Finanzas API client is disabled.");
  }
  return API_BASE;
}

function authHeader(): Record<string, string> {
  // Minimal token lookup; adapt if you have a central auth helper
  const token =
    localStorage.getItem("idToken") ||
    localStorage.getItem("cognitoIdToken") ||
    sessionStorage.getItem("idToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fileExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/**
 * 1) Ask API for a presigned S3 upload (no file bytes here)
 *    POST /uploads/docs → { url, key, fields? | headers?, method? }
 */
async function presignInvoiceUpload(
  projectId: string,
  file: File
): Promise<PresignResponse> {
  const base = requireApiBase();

  const body = {
    project_id: projectId,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    purpose: "invoice",
    checksum_sha256: await sha256(file),
  };

  const res = await fetch(`${base}/uploads/docs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Failed to presign upload (${res.status}): ${t}`);
  }

  return (await res.json()) as PresignResponse;
}

/**
 * 2) Upload file to S3 using the presigned info.
 *    Supports both POST (fields) and PUT presign styles.
 */
async function uploadInvoiceFileToS3(
  file: File,
  presign: PresignResponse
): Promise<void> {
  if ("fields" in presign) {
    // POST policy
    const form = new FormData();
    Object.entries(presign.fields).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);

    const resp = await fetch(presign.url, {
      method: "POST",
      body: form,
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`S3 POST failed (${resp.status}): ${t}`);
    }
    return;
  }

  // PUT presign
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
  };

  const resp = await fetch(presign.url, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`S3 PUT failed (${resp.status}): ${t}`);
  }
}

/**
 * 3) Create invoice record in API, referencing the uploaded documentKey.
 */
async function createInvoiceRecord(
  projectId: string,
  payload: UploadInvoicePayload,
  documentKey: string
): Promise<InvoiceDTO> {
  const base = requireApiBase();
  const {
    file,
    line_item_id,
    month,
    amount,
    description,
    vendor,
    invoice_number,
    invoice_date,
  } = payload;

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        line_item_id,
        month,
        amount,
        description,
        vendor,
        invoice_number,
        invoice_date,
        documentKey,
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        extension: fileExt(file.name),
        size: file.size,
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Failed to create invoice (${res.status}): ${t}`);
  }

  return (await res.json().catch(() => ({}))) as InvoiceDTO;
}

/**
 * Public orchestrator used by SDMTReconciliation and other modules.
 * Validates, presigns, uploads to S3, then creates the invoice record.
 */
export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
): Promise<InvoiceDTO> {
  if (USE_MOCKS) {
    throw new Error("Invoice upload is disabled when VITE_USE_MOCKS=true");
  }

  if (!projectId) throw new Error("Missing projectId");
  if (!payload?.file) throw new Error("No file selected");
  if (!payload.line_item_id) throw new Error("Line item is required");

  if (!(payload.month >= 1 && payload.month <= 12)) {
    throw new Error("Month must be between 1 and 12");
  }

  if (!Number.isFinite(payload.amount)) {
    throw new Error("Amount must be a finite number");
  }

  const sizeMb = payload.file.size / (1024 * 1024);
  if (sizeMb > MAX_MB) {
    throw new Error(
      `File too large: ${sizeMb.toFixed(1)} MB (max ${MAX_MB.toFixed(1)} MB)`
    );
  }

  // 1) Presign
  const presign = await presignInvoiceUpload(projectId, payload.file);

  // 2) Upload to S3
  await uploadInvoiceFileToS3(payload.file, presign);

  // 3) Create invoice record referencing the uploaded documentKey
  const documentKey = presign.key;
  return createInvoiceRecord(projectId, payload, documentKey);
}

// Optional alias for new code that wants a more explicit name
export const uploadInvoiceDocument = uploadInvoice;
