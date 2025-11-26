// src/api/finanzas.ts
// Finanzas API client — minimal, typed where stable, resilient where backends are still converging.

import { API_BASE, HAS_API_BASE } from "@/config/env";
import { buildAuthHeader, handleAuthErrorStatus } from "@/config/api";
import type { InvoiceDoc } from "@/types/domain";
import httpClient, { HttpError } from "@/lib/http-client";
import {
  normalizeProjectsPayload,
  type ProjectsResponse,
  type Json,
} from "./finanzas-projects-helpers";

// ---------- Environment ----------
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";

function requireApiBase(): string {
  if (!HAS_API_BASE) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Finanzas API client is disabled.",
    );
  }
  return API_BASE;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    handleAuthErrorStatus(res.status);

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

export class FinanzasApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "FinanzasApiError";
  }
}

function ensureApiBase(): void {
  if (!HAS_API_BASE) {
    throw new FinanzasApiError(
      "Finanzas API is not configured. Set VITE_API_BASE_URL to enable data loading.",
    );
  }
}

function toFinanzasError(err: unknown, fallback: string): FinanzasApiError {
  if (err instanceof FinanzasApiError) return err;
  if (err instanceof HttpError) {
    return new FinanzasApiError(err.message || fallback, err.status);
  }
  if (err instanceof Error) {
    return new FinanzasApiError(err.message, (err as any).status);
  }
  return new FinanzasApiError(fallback);
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
    headers: { "Content-Type": "application/json", ...buildAuthHeader() },
    body: JSON.stringify(body),
  });
}

async function uploadFileWithPresign(
  file: File,
  presign: PresignResponse,
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
  options?: { module?: UploadModule },
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
    headers: { "Content-Type": "application/json", ...buildAuthHeader() },
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
  options?: UploadSupportingDocOptions,
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
  body: { status: InvoiceStatus; comment?: string },
): Promise<InvoiceDTO> {
  ensureApiBase();
  if (!projectId) throw new FinanzasApiError("projectId is required");
  if (!invoiceId) throw new FinanzasApiError("invoiceId is required");

  try {
    const res = await httpClient.put<InvoiceDTO>(
      `/projects/${encodeURIComponent(
        projectId,
      )}/invoices/${encodeURIComponent(invoiceId)}/status`,
      body,
      { headers: buildAuthHeader() },
    );
    return res.data;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }
    if (err instanceof HttpError && (err.status === 404 || err.status === 405)) {
      throw new FinanzasApiError(
        "Updating invoice status is not available in this environment yet.",
        err.status,
      );
    }
    throw toFinanzasError(err, "Unable to update invoice status");
  }
}

// ---------- Catalog: add rubro to project (Service Tier selection) ----------

// Keep the payload flexible while APIs converge. Prefer a typed shape once the OpenAPI is finalized.
export type AddProjectRubroInput = Record<string, unknown>;

// Some backends mount under /projects/{id}/catalog/rubros; older ones under /projects/{id}/rubros.
// Try the modern path first, then fall back once on 404/405.
export async function addProjectRubro<T = Json>(
  projectId: string,
  payload: AddProjectRubroInput,
): Promise<T> {
  const base = requireApiBase();
  const headers = { "Content-Type": "application/json", ...buildAuthHeader() };

  // The deployed API exposes /projects/{id}/rubros; keep a single fallback to
  // /catalog/rubros for legacy stacks that might still use that mount.
  const primary = `${base}/projects/${encodeURIComponent(projectId)}/rubros`;
  let res = await fetch(primary, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros`;
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
  projectId: string,
): Promise<LineItemDTO[]> {
  if (USE_MOCKS) {
    throw new Error("getProjectRubros is disabled when VITE_USE_MOCKS=true");
  }

  ensureApiBase();
  if (!projectId) throw new FinanzasApiError("projectId is required");

  try {
    // Primary path used by the consolidated API Gateway deployment
    const primaryPath = `/projects/${encodeURIComponent(projectId)}/rubros`;
    let res = await httpClient.get<LineItemDTO[] | { data?: LineItemDTO[] }>(
      primaryPath,
      { headers: buildAuthHeader() },
    );

    // Some environments expose the catalog under /projects/{id}/catalog/rubros
    if (res.status === 404 || res.status === 405) {
      const fallbackPath = `/projects/${encodeURIComponent(
        projectId,
      )}/catalog/rubros`;
      res = await httpClient.get<LineItemDTO[] | { data?: LineItemDTO[] }>(
        fallbackPath,
        { headers: buildAuthHeader() },
      );
    }

    const payload = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as any)?.data)
      ? (res.data as any).data
      : [];

    return payload as LineItemDTO[];
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }
    if (err instanceof HttpError && (err.status === 404 || err.status === 405)) {
      return [];
    }
    throw toFinanzasError(err, "Unable to load catalog data");
  }
}

// ---------- Projects ----------
export {
  normalizeProjectsPayload,
  type ProjectsResponse,
  type Json,
} from "./finanzas-projects-helpers";

// Optional helpers used by tests/smokes
export async function getProjects(): Promise<ProjectsResponse> {
  ensureApiBase();

  try {
    const response = await httpClient.get<ProjectsResponse>("/projects?limit=50", {
      headers: buildAuthHeader(),
    });

    // Normalize a bit but keep it backwards compatible for callers:
    // - If backend returns an array, just return it.
    // - If backend returns { data } or { items }, return that object.
    if (Array.isArray(response)) {
      return response;
    }

    const anyResponse = response as { data?: Json[]; items?: Json[] };

    if (Array.isArray(anyResponse.data) || Array.isArray(anyResponse.items)) {
      return anyResponse;
    }

    // Fallback: return an empty list-shaped object to avoid runtime crashes
    return { data: [] };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }
    throw toFinanzasError(err, "Unable to load projects");
  }
}

// Alias for compatibility with tests/hooks referencing older helper name
export const getProjectLineItems = getProjectRubros;

// Get invoices for a project
export async function getInvoices(projectId: string): Promise<InvoiceDoc[]> {
  ensureApiBase();
  if (!projectId) throw new FinanzasApiError("projectId is required");

  try {
    const params = new URLSearchParams({ projectId });
    const response = await httpClient.get<{ data?: any[] }>(
      `/prefacturas?${params.toString()}`,
      { headers: buildAuthHeader() },
    );

    const payload = response?.data as any;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : [];
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
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }

    if (err instanceof HttpError) {
      if (err.status === 404) {
        return [];
      }
      if (err.status === 403) {
        throw new FinanzasApiError(
          "Access to invoices is restricted for this project.",
          403,
        );
      }
    }

    throw toFinanzasError(err, "Unable to load invoices");
  }
}
