// src/api/finanzas.ts
// Finanzas API client — minimal, typed where stable, resilient where backends are still converging.

import { API_BASE, HAS_API_BASE } from "@/config/env";
import type { InvoiceDoc } from "@/types/domain";

type Json = Record<string, unknown>;

// ---------- Environment ----------
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";

function requireApiBase(): string {
  if (!HAS_API_BASE) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Finanzas API client is disabled."
    );
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

async function jsonOrText(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- Common DTOs ----------
export type InvoiceStatus = "Pending" | "Matched" | "Disputed";

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number; // 1–12
  amount: number; // numeric (parse in UI)
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string; // yyyy-mm-dd
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

export type LineItemDTO = {
  id: string;
  [key: string]: unknown;
};

// ---------- Utility for upload pipeline ----------
async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Presign + S3 upload ----------
export type UploadModule =
  | "prefactura"
  | "catalog"
  | "reconciliation"
  | "changes";
export type UploadStage = "presigning" | "uploading" | "complete";
type PresignResponse = {
  uploadUrl: string;
  objectKey: string;
};

async function presignUpload(_: {
  projectId: string;
  file: File;
  module: UploadModule;
  lineItemId?: string;
  invoiceNumber?: string;
}): Promise<PresignResponse> {
  const { projectId, file, module, lineItemId, invoiceNumber } = _;
  const base = requireApiBase();
  const body = {
    projectId,
    module,
    lineItemId,
    invoiceNumber,
    contentType: file.type || "application/octet-stream",
    originalName: file.name,
    checksumSha256: await sha256(file),
  };
  return fetchJson<PresignResponse>(`${base}/uploads/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
}

async function uploadFileWithPresign(
  file: File,
  presign: PresignResponse
): Promise<void> {
  const rsp = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!rsp.ok) throw new Error(`S3 PUT failed (${rsp.status})`);
}

// ---------- Invoices ----------
export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload,
  options?: { module?: UploadModule }
): Promise<InvoiceDTO> {
  if (USE_MOCKS)
    throw new Error("Invoice upload is disabled when VITE_USE_MOCKS=true");
  if (!projectId) throw new Error("Missing projectId");
  if (!payload?.file) throw new Error("No file selected");
  if (!payload.line_item_id) throw new Error("Line item is required");
  if (!(payload.month >= 1 && payload.month <= 12))
    throw new Error("Month must be between 1 and 12");
  if (!Number.isFinite(payload.amount))
    throw new Error("Amount must be a finite number");

  const presign = await presignUpload({
    projectId,
    file: payload.file,
    module: options?.module ?? "reconciliation",
    lineItemId: payload.line_item_id,
    invoiceNumber: payload.invoice_number,
  });
  await uploadFileWithPresign(payload.file, presign);

  const base = requireApiBase();
  const body = {
    projectId,
    lineItemId: payload.line_item_id,
    month: payload.month,
    amount: payload.amount,
    description: payload.description,
    vendor: payload.vendor,
    invoiceNumber:
      payload.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`,
    invoiceDate: payload.invoice_date,
    documentKey: presign.objectKey,
  };

  return fetchJson<InvoiceDTO>(`${base}/prefacturas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
}

// Canonical uploadSupportingDocument - single, future-proof signature
export type UploadSupportingDocPayload = {
  projectId: string;
  module?: UploadModule;
  file: File;
  lineItemId?: string;
  invoiceNumber?: string;
};

export type UploadSupportingDocResult = {
  documentKey: string;
  originalName: string;
  contentType: string;
};

export type UploadSupportingDocOptions = {
  onStageChange?: (stage: UploadStage) => void;
};

export async function uploadSupportingDocument(
  payload: UploadSupportingDocPayload,
  options?: UploadSupportingDocOptions
): Promise<UploadSupportingDocResult> {
  if (!payload.projectId) throw new Error("projectId is required");
  if (!payload.file) throw new Error("file is required");

  const moduleName = payload.module ?? "prefactura";
  options?.onStageChange?.("presigning");
  const presign = await presignUpload({
    projectId: payload.projectId,
    file: payload.file,
    module: moduleName,
    lineItemId: payload.lineItemId,
    invoiceNumber: payload.invoiceNumber,
  });

  options?.onStageChange?.("uploading");
  await uploadFileWithPresign(payload.file, presign);
  options?.onStageChange?.("complete");

  return {
    documentKey: presign.objectKey,
    originalName: payload.file.name,
    contentType: payload.file.type || "application/octet-stream",
  };
}

export async function updateInvoiceStatus(
  projectId: string,
  invoiceId: string,
  body: { status: InvoiceStatus; comment?: string }
): Promise<InvoiceDTO> {
  const base = requireApiBase();
  return fetchJson<InvoiceDTO>(
    `${base}/projects/${encodeURIComponent(
      projectId
    )}/invoices/${encodeURIComponent(invoiceId)}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
    }
  );
}

// ---------- Catalog: add rubro to project (Service Tier selection) ----------

// Keep the payload flexible while APIs converge. Prefer a typed shape once the OpenAPI is finalized.
export type AddProjectRubroInput = Record<string, unknown>;

// Some backends mount under /projects/{id}/catalog/rubros; older ones under /projects/{id}/rubros.
// Try the modern path first, then fall back once on 404/405.
export async function addProjectRubro<T = Json>(
  projectId: string,
  payload: AddProjectRubroInput
): Promise<T> {
  const base = requireApiBase();
  const headers = { "Content-Type": "application/json", ...authHeader() };

  const primary = `${base}/projects/${encodeURIComponent(
    projectId
  )}/catalog/rubros`;
  let res = await fetch(primary, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(projectId)}/rubros`;
    res = await fetch(fallback, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`addProjectRubro failed (${res.status}): ${bodyText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/* ──────────────────────────────────────────────────────────
   Catalog: fetch project rubros / line items
   Used by: src/hooks/useProjectLineItems.ts
   ────────────────────────────────────────────────────────── */
export async function getProjectRubros(
  projectId: string
): Promise<LineItemDTO[]> {
  if (USE_MOCKS) {
    throw new Error("getProjectRubros is disabled when VITE_USE_MOCKS=true");
  }
  if (!projectId) throw new Error("projectId is required");

  const base = requireApiBase();
  const headers = { ...authHeader() };

  // Prefer the newer /line-items endpoint; fall back to /rubros if needed
  const primaryUrl = `${base}/projects/${encodeURIComponent(
    projectId
  )}/line-items`;
  let res = await fetch(primaryUrl, { method: "GET", headers });

  if (res.status === 404 || res.status === 405) {
    const fallbackUrl = `${base}/projects/${encodeURIComponent(
      projectId
    )}/rubros`;
    res = await fetch(fallbackUrl, { method: "GET", headers });
  }

  if (!res.ok) {
    const body = (await jsonOrText(res)) as string;
    throw new Error(`getProjectRubros failed (${res.status}): ${body}`);
  }

  const text = await res.text();
  return (text ? (JSON.parse(text) as LineItemDTO[]) : []) as LineItemDTO[];
}

// Optional helpers used by tests/smokes
export async function getProjects(): Promise<Json> {
  const base = requireApiBase();
  return fetchJson<Json>(`${base}/projects?limit=50`, {
    method: "GET",
    headers: authHeader(),
  });
}

// Alias for compatibility with tests/hooks referencing older helper name
export const getProjectLineItems = getProjectRubros;

// Get invoices for a project
export async function getInvoices(projectId: string): Promise<InvoiceDoc[]> {
  const base = requireApiBase();
  const params = new URLSearchParams({ projectId });
  const response = await fetchJson<{ data?: any[] }>(
    `${base}/prefacturas?${params.toString()}`,
    { method: "GET", headers: authHeader() }
  );

  const rows = Array.isArray(response?.data) ? response.data : [];
  return rows.map((item) => ({
    id: item.invoiceId || item.id || item.sk || "",
    line_item_id: item.lineItemId || item.line_item_id || "",
    month: Number(item.month) || 1,
    amount: Number(item.amount) || 0,
    currency: (item.currency as InvoiceDoc["currency"]) || "USD",
    file_url: item.file_url,
    file_name: item.file_name,
    documentKey: item.documentKey,
    originalName: item.originalName || item.file_name,
    contentType: item.contentType,
    status: (item.status as InvoiceStatus) || "Pending",
    comments: item.comments,
    uploaded_by: item.uploaded_by || item.uploader || "unknown",
    uploaded_at:
      item.created_at || item.uploaded_at || new Date().toISOString(),
    matched_at: item.matched_at,
    matched_by: item.matched_by,
  }));
}
