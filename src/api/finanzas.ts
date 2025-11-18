// src/api/finanzas.ts
// Finanzas API client — minimal, typed where stable, resilient where backends are still converging.

type Json = Record<string, unknown>;

// ---------- Environment ----------
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Finanzas API client is disabled.");
  }
  return API_BASE;
}

function authHeader(): Record<string, string> {
  // Adjust if you keep tokens elsewhere (AuthProvider adds to storage today).
  const token =
    localStorage.getItem("idToken") ||
    localStorage.getItem("cognitoIdToken") ||
    sessionStorage.getItem("idToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Helpful signal for CORS/preflight troubles
    if (res.status === 0 || /TypeError: Failed to fetch/.test(body)) {
      throw new Error(`Network/CORS error calling ${url}`);
    }
    throw new Error(`${init.method || "GET"} ${url} → ${res.status} ${body}`);
  }
  // Some POSTs legitimately return empty bodies; guard it.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ---------- Common DTOs ----------
export type InvoiceStatus = "Pending" | "Matched" | "Disputed";

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number;              // 1–12
  amount: number;             // numeric (parse in UI)
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;      // yyyy-mm-dd
};

export type InvoiceDTO = {
  id: string;
  project_id: string;
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

// ---------- Utility for upload pipeline ----------
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

// ---------- Presign + S3 upload ----------
type PresignPOST = { url: string; key: string; fields: Record<string, string> };
type PresignPUT = { url: string; key: string; method: "PUT"; headers?: Record<string, string> };
type PresignResponse = PresignPOST | PresignPUT;

async function presignUpload(projectId: string, file: File, purpose: "invoice" | "supporting") {
  const base = requireApiBase();
  const body = {
    project_id: projectId,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    purpose,
    checksum_sha256: await sha256(file),
  };
  return fetchJson<PresignResponse>(`${base}/uploads/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
}

async function uploadFileWithPresign(file: File, presign: PresignResponse): Promise<void> {
  if ("fields" in presign) {
    const form = new FormData();
    Object.entries(presign.fields).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);
    const rsp = await fetch(presign.url, { method: "POST", body: form });
    if (!rsp.ok) throw new Error(`S3 POST failed (${rsp.status})`);
    return;
  }
  const rsp = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream", ...(presign.headers || {}) },
    body: file,
  });
  if (!rsp.ok) throw new Error(`S3 PUT failed (${rsp.status})`);
}

// ---------- Invoices ----------
export async function uploadInvoice(projectId: string, payload: UploadInvoicePayload): Promise<InvoiceDTO> {
  if (USE_MOCKS) throw new Error("Invoice upload is disabled when VITE_USE_MOCKS=true");
  if (!projectId) throw new Error("Missing projectId");
  if (!payload?.file) throw new Error("No file selected");
  if (!payload.line_item_id) throw new Error("Line item is required");
  if (!(payload.month >= 1 && payload.month <= 12)) throw new Error("Month must be between 1 and 12");
  if (!Number.isFinite(payload.amount)) throw new Error("Amount must be a finite number");

  const presign = await presignUpload(projectId, payload.file, "invoice");
  await uploadFileWithPresign(payload.file, presign);

  const base = requireApiBase();
  const body = {
    line_item_id: payload.line_item_id,
    month: payload.month,
    amount: payload.amount,
    description: payload.description,
    vendor: payload.vendor,
    invoice_number: payload.invoice_number,
    invoice_date: payload.invoice_date,
    documentKey: presign.key,
    originalName: payload.file.name,
    contentType: payload.file.type || "application/octet-stream",
    extension: fileExt(payload.file.name),
    size: payload.file.size,
  };

  return fetchJson<InvoiceDTO>(`${base}/projects/${encodeURIComponent(projectId)}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
}

// Alias used by Prefactura upload flows (same pipeline for now).
export const uploadSupportingDocument = uploadInvoice;

export async function updateInvoiceStatus(
  projectId: string,
  invoiceId: string,
  body: { status: InvoiceStatus; comment?: string }
): Promise<InvoiceDTO> {
  const base = requireApiBase();
  return fetchJson<InvoiceDTO>(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
    },
  );
}

// ---------- Catalog: add rubro to project (Service Tier selection) ----------

// Keep the payload flexible while APIs converge. Prefer a typed shape once the OpenAPI is finalized.
export type AddProjectRubroInput = Record<string, unknown>;

// Some backends mount under /projects/{id}/catalog/rubros; older ones under /projects/{id}/rubros.
// Try the modern path first, then fall back once on 404/405.
export async function addProjectRubro<T = Json>(projectId: string, payload: AddProjectRubroInput): Promise<T> {
  const base = requireApiBase();
  const headers = { "Content-Type": "application/json", ...authHeader() };

  const primary = `${base}/projects/${encodeURIComponent(projectId)}/catalog/rubros`;
  let res = await fetch(primary, { method: "POST", headers, body: JSON.stringify(payload) });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(projectId)}/rubros`;
    res = await fetch(fallback, { method: "POST", headers, body: JSON.stringify(payload) });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`addProjectRubro failed (${res.status}): ${bodyText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

// Optional helpers used by tests/smokes
export async function getProjects(): Promise<Json> {
  const base = requireApiBase();
  return fetchJson<Json>(`${base}/projects?limit=50`, { method: "GET", headers: authHeader() });
}

export async function getProjectLineItems(projectId: string): Promise<Json> {
  const base = requireApiBase();
  return fetchJson<Json>(
    `${base}/projects/${encodeURIComponent(projectId)}/catalog/line-items`,
    { method: "GET", headers: authHeader() },
  );
}
