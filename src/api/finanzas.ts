/* src/api/finanzas.ts
 * Finanzas API client (browser-side) — minimal, dependency-free.
 * Endpoints assumed from R1 contracts and current UI usage.
 */

type Json = Record<string, unknown>;

/* ──────────────────────────────────────────────────────────
   Environment & helpers
   ────────────────────────────────────────────────────────── */
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS ?? "false") === "true";
const MAX_MB = 50;

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Finanzas API client is disabled.");
  }
  return API_BASE;
}

function authHeader(): Record<string, string> {
  // Keep it simple: Cognito IdToken usually stored client-side by your AuthProvider
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

async function jsonOrText(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

/* ──────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────── */
export type InvoiceStatus = "Pending" | "Matched" | "Disputed";

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

export type InvoiceDTO = {
  id: string;
  line_item_id: string;
  month: number;
  amount: number;
  status: InvoiceStatus;
  documentKey?: string;
  file_name?: string;
  originalName?: string;
  uploaded_at: string;
  uploaded_by: string;
};

export type LineItemDTO = {
  id: string;
  category?: string;
  description?: string;
  qty?: number;
  unit_cost?: number;
  uom?: string;
  service_tier?: string;
  // any server-provided computed fields:
  total_cost?: number;
} & Json;

export type AddProjectRubroInput = {
  // Accepts either a tier code/name or full line item fields.
  tier?: string;
  category?: string;
  description?: string;
  qty?: number;
  unit_cost?: number;
  uom?: string;
  // permit future/unknown fields to avoid runtime compile churn
  [k: string]: unknown;
};

/* ──────────────────────────────────────────────────────────
   Catalog: addProjectRubro (Service Tier → POST rubro)
   Used by: src/components/ServiceTierSelector.tsx
   ────────────────────────────────────────────────────────── */
export async function addProjectRubro(
  projectId: string,
  inputOrTier: AddProjectRubroInput | string
): Promise<LineItemDTO> {
  if (USE_MOCKS) {
    throw new Error("addProjectRubro is disabled when VITE_USE_MOCKS=true");
  }
  if (!projectId) throw new Error("projectId is required");

  const base = requireApiBase();

  // Normalize payload: if a string is passed, treat it as the tier
  const payload: AddProjectRubroInput =
    typeof inputOrTier === "string" ? { tier: inputOrTier } : { ...inputOrTier };

  // Map to server’s expected fields (keep tier as service_tier too)
  const body: Json = {
    ...payload,
    service_tier: payload.tier ?? payload.service_tier,
  };

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/line-items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const t = (await jsonOrText(res)) as string;
    throw new Error(`Failed to add project rubro (${res.status}): ${t}`);
  }
  return (await res.json()) as LineItemDTO;
}

/* ──────────────────────────────────────────────────────────
   Reconciliation: updateInvoiceStatus
   Used by: SDMTReconciliation.tsx
   ────────────────────────────────────────────────────────── */
export async function updateInvoiceStatus(
  projectId: string,
  invoiceId: string,
  body: { status: InvoiceStatus; comment?: string }
): Promise<InvoiceDTO> {
  if (USE_MOCKS) throw new Error("updateInvoiceStatus disabled with mocks");
  if (!projectId) throw new Error("projectId is required");
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!body?.status) throw new Error("status is required");

  const base = requireApiBase();
  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const t = (await jsonOrText(res)) as string;
    throw new Error(`Failed to update invoice status (${res.status}): ${t}`);
  }
  return (await res.json()) as InvoiceDTO;
}

/* ──────────────────────────────────────────────────────────
   Uploads: presign → S3 → create invoice record
   Used by: SDMTReconciliation.tsx
   ────────────────────────────────────────────────────────── */
type PresignPOST = { url: string; key: string; fields: Record<string, string> };
type PresignPUT = { url: string; key: string; method: "PUT"; headers?: Record<string, string> };
type PresignResponse = PresignPOST | PresignPUT;

async function presignInvoiceUpload(projectId: string, file: File): Promise<PresignResponse> {
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
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = (await jsonOrText(res)) as string;
    throw new Error(`Failed to presign upload (${res.status}): ${t}`);
  }
  return (await res.json()) as PresignResponse;
}

async function uploadInvoiceFileToS3(file: File, presign: PresignResponse): Promise<void> {
  if ("fields" in presign) {
    const form = new FormData();
    Object.entries(presign.fields).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);

    const resp = await fetch(presign.url, { method: "POST", body: form });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`S3 POST failed (${resp.status}): ${t}`);
    }
    return;
  }

  const resp = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream", ...(presign.headers || {}) },
    body: file,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`S3 PUT failed (${resp.status}): ${t}`);
  }
}

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
      headers: { "Content-Type": "application/json", ...authHeader() },
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
    const t = (await jsonOrText(res)) as string;
    throw new Error(`Failed to create invoice (${res.status}): ${t}`);
  }
  return (await res.json()) as InvoiceDTO;
}

/** Public orchestrator */
export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
): Promise<InvoiceDTO> {
  if (USE_MOCKS) throw new Error("Invoice upload is disabled when VITE_USE_MOCKS=true");
  if (!projectId) throw new Error("Missing projectId");
  if (!payload?.file) throw new Error("No file selected");
  if (!payload.line_item_id) throw new Error("Line item is required");
  if (!(payload.month >= 1 && payload.month <= 12)) throw new Error("Month must be between 1 and 12");
  if (!Number.isFinite(payload.amount)) throw new Error("Amount must be a finite number");
  const sizeMb = payload.file.size / (1024 * 1024);
  if (sizeMb > MAX_MB) throw new Error(`File too large: ${sizeMb.toFixed(1)} MB (max ${MAX_MB} MB)`);

  const presign = await presignInvoiceUpload(projectId, payload.file);
  await uploadInvoiceFileToS3(payload.file, presign);
  return createInvoiceRecord(projectId, payload, presign.key);
}

// Aliases used by Prefactura's Review/Sign step, etc.
export const uploadInvoiceDocument = uploadInvoice;
export async function uploadSupportingDocument(
  projectId: string,
  payload: UploadInvoicePayload
): Promise<InvoiceDTO> {
  return uploadInvoice(projectId, payload);
}
