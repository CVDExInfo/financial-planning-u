// src/api/finanzas.ts
// Finanzas API client — minimal, typed where stable, resilient where backends are still converging.

import { API_BASE, HAS_API_BASE } from "@/config/env";
import { buildAuthHeader, handleAuthErrorStatus } from "@/config/api";
import type { Currency, InvoiceDoc, LineItem } from "@/types/domain";
import httpClient, { HttpError } from "@/lib/http-client";
import {
  type ProjectsResponse,
  type Json,
} from "./finanzas-projects-helpers";
import {
  byLineaCodigo as taxonomyByLineaCodigo,
} from "@/modules/rubros.taxonomia";
import { taxonomyByRubroId } from "@/modules/rubros.catalog.enriched";
import { toast } from "sonner";
import { ensureCategory } from "@/lib/rubros-category-utils";

// ---------- Environment ----------
const envSource =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) ||
  (typeof process !== "undefined" ? (process.env as Record<string, string>) : {});

const USE_MOCKS = String(envSource?.VITE_USE_MOCKS || "false") === "true";

function requireApiBase(): string {
  if (!HAS_API_BASE) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Finanzas API client is disabled.",
    );
  }
  return API_BASE;
}

export class FinanzasApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "FinanzasApiError";
  }
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    // Default to CORS-friendly settings so CloudFront/API Gateway consistently allow requests
    mode: init.mode ?? "cors",
    cache: init.cache ?? "no-store",
    // Do NOT force credentials; some API Gateway deployments reject credentialed requests
    // unless they explicitly set Access-Control-Allow-Credentials. Allow callers to opt in.
    ...init,
  });
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    try {
      handleAuthErrorStatus(res.status);
    } catch (err) {
      throw toFinanzasError(
        err,
        text || `${init.method || "GET"} ${url} → ${res.status}`,
        res.status,
      );
    }

    // Helpful signal for CORS/preflight troubles
    if (res.status === 0 || /TypeError: Failed to fetch/.test(text)) {
      throw new FinanzasApiError(`Network/CORS error calling ${url}`, res.status);
    }

    throw new FinanzasApiError(
      `${init.method || "GET"} ${url} → ${res.status} ${text}`.trim(),
      res.status,
    );
  }

  // Some POSTs legitimately return empty bodies; guard it.
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function ensureApiBase(): void {
  if (!HAS_API_BASE) {
    throw new FinanzasApiError(
      "Finanzas API is not configured. Set VITE_API_BASE_URL to enable data loading.",
    );
  }
}

function toFinanzasError(
  err: unknown,
  fallback: string,
  statusOverride?: number,
): FinanzasApiError {
  if (err instanceof FinanzasApiError) return err;
  if (err instanceof HttpError) {
    return new FinanzasApiError(
      err.message || fallback,
      err.status ?? statusOverride,
    );
  }
  if (err instanceof Error) {
    return new FinanzasApiError(
      err.message,
      (err as any).status ?? statusOverride,
    );
  }
  return new FinanzasApiError(fallback, statusOverride);
}

const isDevEnv =
  (typeof import.meta !== "undefined" && Boolean((import.meta as any)?.env?.DEV)) ||
  (typeof process !== "undefined" && process.env?.NODE_ENV === "development");

const logApiDebug = (
  message: string,
  payload?: Record<string, unknown> | string | number,
): void => {
  if (isDevEnv) {
    console.info(`[finanzas-api] ${message}`, payload ?? "");
  }
};

const validateArrayResponse = (value: unknown, label: string): any[] => {
  // Handle direct array response
  if (Array.isArray(value)) return value;
  
  // Handle wrapped responses: {data: []}, {items: []}, {Data: []}
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (Array.isArray(candidate.data)) return candidate.data;
    if (Array.isArray(candidate.items)) return candidate.items;
    if (Array.isArray(candidate.Data)) return candidate.Data;
  }
  
  // Log warning but return empty array instead of throwing
  console.warn(`[finanzas-api] ${label} returned unexpected shape:`, typeof value);
  return [];
};

// ---------- MOD sources ----------

const MOCK_PAYROLL_ROWS = [
  { month: "2025-01", totalActualMOD: 105000, projectId: "DEMO" },
  { month: "2025-02", totalActualMOD: 95000, projectId: "DEMO" },
];

const MOCK_ALLOCATIONS_ROWS = [
  {
    month: "2025-01",
    amount: 120000,
    projectId: "DEMO",
    rubro_type: "MOD",
  },
];

const MOCK_BASELINE_ROWS = [
  { month: "2025-01", totalPlanMOD: 110000, projectId: "DEMO" },
];

const MOCK_ADJUSTMENTS_ROWS = [
  { month: "2025-01", amount: 5000, projectId: "DEMO", adjustmentType: "delta" },
];

export interface PayrollActualInput {
  projectId: string;
  month: string;
  rubroId: string;
  amount: number;
  currency?: string;
  allocationId?: string;
  resourceCount?: number;
  source?: string;
  uploadedBy?: string;
  notes?: string;
}

async function fetchArraySource(
  url: string,
  label: string,
): Promise<any[]> {
  try {
    const response = await fetchJson<any[]>(url, {
      headers: buildAuthHeader(),
    });

    const asArray = validateArrayResponse(response, label);
    logApiDebug(`${label} rows`, { count: asArray.length, url });

    return asArray;
  } catch (err) {
    // Handle expected "not implemented" or "not found" status codes silently
    if (err instanceof FinanzasApiError && err.status) {
      const isExpectedUnavailable = [404, 405, 501].includes(err.status);
      
      if (isExpectedUnavailable) {
        // Silently return empty array for unimplemented/missing endpoints
        logApiDebug(`${label} endpoint unavailable (${err.status}), returning empty array`, { url });
        return [];
      }
    }
    
    // For real network errors (TypeError/Failed to fetch), downgrade severity
    const isNetworkError = 
      err instanceof TypeError || 
      (err instanceof Error && /Failed to fetch/i.test(err.message));
    
    if (isNetworkError) {
      console.warn(`[finanzas-api] ${label} network error`, err);
      // Don't show toast for network errors to avoid spam
      return [];
    }
    
    // For other errors, log and show minimal toast
    console.error(`[finanzas-api] ${label} failed`, err);
    if (typeof toast?.error === "function") {
      toast.error("No se pudo cargar los datos", {
        description: "Mostramos una vista vacía mientras se restablece la conexión",
      });
    }
    return [];
  }
}

export async function getPayroll(projectId?: string): Promise<any[]> {
  ensureApiBase();

  if (USE_MOCKS) {
    logApiDebug("getPayroll (mock)", { count: MOCK_PAYROLL_ROWS.length });
    return MOCK_PAYROLL_ROWS;
  }

  const query = projectId
    ? `?projectId=${encodeURIComponent(projectId)}&project_id=${encodeURIComponent(projectId)}`
    : "";
  const url = `${requireApiBase()}/payroll${query}`;

  try {
    return await fetchArraySource(url, "getPayroll");
  } catch (err) {
    throw toFinanzasError(err, "Unable to load payroll rows");
  }
}

export async function createPayrollActual(row: PayrollActualInput) {
  ensureApiBase();

  try {
    const headers = { ...buildAuthHeader(), "Content-Type": "application/json" };
    return await fetchJson(`${requireApiBase()}/payroll/actuals`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
    });
  } catch (err) {
    throw toFinanzasError(err, "Unable to upload payroll actual");
  }
}

export async function bulkUploadPayrollActuals(payload: PayrollActualInput[] | FormData) {
  ensureApiBase();

  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;

  try {
    return await fetchJson<{ insertedCount: number; errors?: { index: number; message: string }[] }>(
      `${requireApiBase()}/payroll/actuals/bulk`,
      {
        method: "POST",
        headers: isFormData ? buildAuthHeader() : { ...buildAuthHeader(), "Content-Type": "application/json" },
        body: isFormData ? (payload as FormData) : JSON.stringify(payload),
      }
    );
  } catch (err) {
    throw toFinanzasError(err, "Unable to upload payroll actuals");
  }
}

export async function getAllocations(projectId?: string, baselineId?: string): Promise<any[]> {
  ensureApiBase();

  if (USE_MOCKS) {
    logApiDebug("getAllocations (mock)", { count: MOCK_ALLOCATIONS_ROWS.length });
    return MOCK_ALLOCATIONS_ROWS;
  }

  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (baselineId) params.set('baseline', baselineId);
  
  const url = `${requireApiBase()}/allocations${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    return await fetchArraySource(url, "getAllocations");
  } catch (err) {
    throw toFinanzasError(err, "Unable to load allocations rows");
  }
}

export async function getBaseline(projectId?: string): Promise<any[]> {
  ensureApiBase();

  if (USE_MOCKS) {
    logApiDebug("getBaseline (mock)", { count: MOCK_BASELINE_ROWS.length });
    return MOCK_BASELINE_ROWS;
  }

  const query = projectId
    ? `?projectId=${encodeURIComponent(projectId)}&project_id=${encodeURIComponent(projectId)}`
    : "";
  const url = `${requireApiBase()}/baseline${query}`;

  try {
    return await fetchArraySource(url, "getBaseline");
  } catch (err) {
    throw toFinanzasError(err, "Unable to load baseline rows");
  }
}

export interface BaselineDetail {
  baseline_id: string;
  project_id?: string;
  project_name?: string;
  // Labor and non-labor estimates can be at top level or in payload
  labor_estimates?: Array<{
    rubroId?: string;
    role?: string;
    country?: string;
    level?: string;
    fte_count?: number;
    hourly_rate?: number;
    rate?: number; // Alternative field name
    hours_per_month?: number;
    on_cost_percentage?: number;
    start_month?: number;
    end_month?: number;
  }>;
  non_labor_estimates?: Array<{
    rubroId?: string;
    category?: string;
    description?: string;
    amount?: number;
    vendor?: string;
    one_time?: boolean;
    capex_flag?: boolean;
    start_month?: number;
    end_month?: number;
  }>;
  // DynamoDB stores data in payload field
  payload?: {
    labor_estimates?: Array<{
      rubroId?: string;
      role?: string;
      country?: string;
      level?: string;
      fte_count?: number;
      hourly_rate?: number;
      rate?: number;
      hours_per_month?: number;
      on_cost_percentage?: number;
      start_month?: number;
      end_month?: number;
    }>;
    non_labor_estimates?: Array<{
      rubroId?: string;
      category?: string;
      description?: string;
      amount?: number;
      vendor?: string;
      one_time?: boolean;
      capex_flag?: boolean;
      start_month?: number;
      end_month?: number;
    }>;
    project_name?: string;
    project_description?: string;
    client_name?: string;
    currency?: string;
    start_date?: string;
    duration_months?: number;
    contract_value?: number;
    sdm_manager_name?: string;
    sdm_manager_email?: string;
    signed_by?: string;
    signed_at?: string;
    signed_role?: string;
    assumptions?: string[];
    fx_indexation?: Record<string, unknown>;
    supporting_documents?: Array<{
      documentId?: string;
      documentKey?: string;
      originalName?: string;
      uploadedAt?: string;
      contentType?: string;
    }>;
  };
  supporting_documents?: Array<{
    documentId?: string;
    documentKey?: string;
    originalName?: string;
    uploadedAt?: string;
    contentType?: string;
  }>;
  total_amount?: number;
  currency?: string;
  created_at?: string;
  signed_by?: string;
  signed_at?: string;
  sdm_manager_name?: string;
  sdm_manager_email?: string;
  // Materialization metadata
  metadata?: {
    materialization_queued_at?: string;
    materialization_status?: string;
    materialization_failed?: boolean;
    materializedAt?: string;
    materialized_at?: string;
  };
  materializedAt?: string;
}

/**
 * Get baseline details by ID including labor and non-labor estimates
 */
export async function getBaselineById(
  baselineId: string
): Promise<BaselineDetail> {
  ensureApiBase();

  const url = `${requireApiBase()}/baseline/${encodeURIComponent(baselineId)}`;

  try {
    const result = await fetchJson<BaselineDetail>(url, {
      method: "GET",
      headers: {
        ...buildAuthHeader(),
        "Content-Type": "application/json",
      },
    });

    return result;
  } catch (err) {
    throw toFinanzasError(err, "Unable to load baseline details");
  }
}

export async function getAdjustments(projectId?: string): Promise<any[]> {
  ensureApiBase();

  if (USE_MOCKS) {
    logApiDebug("getAdjustments (mock)", {
      count: MOCK_ADJUSTMENTS_ROWS.length,
    });
    return MOCK_ADJUSTMENTS_ROWS;
  }

  const query = projectId
    ? `?projectId=${encodeURIComponent(projectId)}&project_id=${encodeURIComponent(projectId)}`
    : "";
  const url = `${requireApiBase()}/adjustments${query}`;

  try {
    return await fetchArraySource(url, "getAdjustments");
  } catch (err) {
    throw toFinanzasError(err, "Unable to load adjustments rows");
  }
}

// ---------- Common DTOs ----------
export type InvoiceStatus = "Pending" | "Matched" | "Disputed" | "PendingDeletionApproval" | "PendingCorrectionApproval";

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
  id?: string;
  rubro_id?: string;
  rubroId?: string;
  sk?: string;
  nombre?: string;
  categoria?: string;
  linea_codigo?: string;
  tipo_costo?: string;
  description?: string;
  descripcion?: string;
  tier?: string;
  project_id?: string;
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
  bucket: string;
  documentId?: string;
  metadata?: Record<string, unknown>;
  warnings?: string[];
  status?: number;
};

async function presignUpload(_: {
  projectId: string;
  file: File;
  module: UploadModule;
  lineItemId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  vendor?: string;
  amount?: number;
}): Promise<PresignResponse> {
  const {
    projectId,
    file,
    module,
    lineItemId,
    invoiceNumber,
    invoiceDate,
    vendor,
    amount,
  } = _;
  const base = requireApiBase();
  const body = {
    projectId,
    module,
    lineItemId,
    invoiceNumber,
    invoiceDate,
    vendor,
    amount,
    contentType: file.type || "application/octet-stream",
    originalName: file.name,
    checksumSha256: await sha256(file),
  };

  let response: Response;
  try {
    response = await fetch(`${base}/uploads/docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildAuthHeader() },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message =
      error instanceof TypeError
        ? `Network error contacting uploads service at ${base}/uploads/docs`
        : error instanceof Error
        ? error.message
        : String(error);
    throw new FinanzasApiError(message);
  }

  const rawText = await response.text().catch(() => "");
  let parsed: Partial<PresignResponse & { error?: string; message?: string }> =
    {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Keep fallback message below
  }

  if (!response.ok) {
    try {
      handleAuthErrorStatus(response.status);
    } catch (err) {
      throw toFinanzasError(
        err,
        parsed.error ||
          parsed.message ||
          rawText ||
          "Upload authorization failed",
        response.status,
      );
    }

    const defaultMsg = parsed.error || parsed.message || rawText;
    const isServiceUnavailable = response.status === 503;
    const message = isServiceUnavailable
      ? parsed.error ||
        "Uploads are temporarily unavailable. Please try again later."
      : response.status >= 500
      ? "Error interno en Finanzas"
      : defaultMsg || `Upload request failed (${response.status})`;

    throw new FinanzasApiError(message, response.status);
  }

  if (!parsed.uploadUrl || !parsed.objectKey) {
    throw new FinanzasApiError(
      "Upload service returned an unexpected response while preparing the document upload.",
      response.status,
    );
  }

  if (!parsed.bucket) {
    throw new FinanzasApiError(
      "Upload service did not return bucket information. Please contact support.",
      response.status,
    );
  }

  return {
    uploadUrl: parsed.uploadUrl,
    objectKey: parsed.objectKey,
    bucket: parsed.bucket,
    documentId: (parsed as any).documentId,
    metadata: (parsed as any).metadata,
    warnings: parsed.warnings || [],
    status: response.status,
  };
}

function buildNetworkErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Failed uploading document to storage. Please check your connection and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function uploadFileWithPresign(
  file: File,
  presign: PresignResponse,
): Promise<void> {
  let rsp: Response | undefined;
  try {
    rsp = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
  } catch (error) {
    const message = buildNetworkErrorMessage(error);

    if (import.meta.env.DEV) {
      try {
        const origin = new URL(presign.uploadUrl).origin;
        console.error("[uploadFileWithPresign] S3 PUT failed", {
          origin,
          status: rsp?.status,
          statusText: rsp?.statusText,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        console.error("[uploadFileWithPresign] S3 PUT failed", {
          status: rsp?.status,
          statusText: rsp?.statusText,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new FinanzasApiError(message);
  }

  if (!rsp.ok) {
    if (import.meta.env.DEV) {
      try {
        const origin = new URL(presign.uploadUrl).origin;
        console.error("[uploadFileWithPresign] S3 PUT failed", {
          origin,
          status: rsp.status,
          statusText: rsp.statusText,
        });
      } catch {
        console.error("[uploadFileWithPresign] S3 PUT failed", {
          status: rsp.status,
          statusText: rsp.statusText,
        });
      }
    }

    const statusPart = rsp.status ? ` (status ${rsp.status})` : "";
    throw new FinanzasApiError(
      `Failed uploading document to storage${statusPart}.`,
      rsp.status,
    );
  }
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

  const parsedInvoiceDate = payload.invoice_date
    ? Date.parse(payload.invoice_date)
    : undefined;
  const normalizedInvoiceDate =
    typeof parsedInvoiceDate === "number" && !Number.isNaN(parsedInvoiceDate)
      ? new Date(parsedInvoiceDate).toISOString()
      : undefined;
  if (payload.invoice_date && !normalizedInvoiceDate) {
    throw new FinanzasApiError("Invoice date must be a valid date string");
  }

  const presign = await presignUpload({
    projectId,
    file: payload.file,
    module: options?.module ?? "reconciliation",
    lineItemId: payload.line_item_id,
    invoiceNumber: payload.invoice_number,
    invoiceDate: normalizedInvoiceDate ?? payload.invoice_date,
    vendor: payload.vendor,
    amount: payload.amount,
  });

  if (import.meta.env.DEV) {
    console.info("[uploadInvoice] Presign successful", {
      projectId,
      line_item_id: payload.line_item_id,
      amount: payload.amount,
      invoice_number: payload.invoice_number,
      invoice_date: normalizedInvoiceDate ?? payload.invoice_date,
      vendor: payload.vendor,
      module: options?.module ?? "reconciliation",
      objectKey: presign.objectKey,
      bucket: presign.bucket,
    });
  }

  await uploadFileWithPresign(payload.file, presign);

  const body = {
    projectId,
    lineItemId: payload.line_item_id,
    month: payload.month,
    amount: payload.amount,
    description: payload.description,
    vendor: payload.vendor,
    invoiceNumber:
      payload.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`,
    invoiceDate: normalizedInvoiceDate ?? payload.invoice_date,
    documentKey: presign.objectKey,
    originalName: payload.file.name,
    contentType: payload.file.type || "application/octet-stream",
  };

  try {
    const response = await httpClient.post<InvoiceDTO>(
      `/projects/${encodeURIComponent(projectId)}/invoices`,
      body,
      { headers: buildAuthHeader() },
    );
    return response.data;
  } catch (err) {
    if (err instanceof HttpError && [404, 405].includes(err.status)) {
      const base = requireApiBase();
      return fetchJson<InvoiceDTO>(`${base}/prefacturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeader() },
        body: JSON.stringify(body),
      });
    }

    throw toFinanzasError(err, "Unable to upload invoice");
  }
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
  documentId?: string;
  metadata?: Record<string, unknown>;
  warnings?: string[];
  status?: number;
};

export type PrefacturaSupportingDocRef = {
  // Preferred snake_case fields for backend compatibility
  document_id?: string;
  document_key: string;
  original_name?: string;
  uploaded_at?: string;
  content_type?: string;
  // Legacy camelCase aliases kept for backward compatibility
  documentId?: string;
  documentKey?: string;
  originalName?: string;
  uploadedAt?: string;
  contentType?: string;
};

export type PrefacturaBaselinePayload = {
  project_id: string;
  project_name: string;
  project_description?: string;
  client_name?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_months?: number;
  contract_value?: number;
  sdm_manager_name?: string;
  assumptions?: string[];
  labor_estimates: Record<string, unknown>[];
  non_labor_estimates: Record<string, unknown>[];
  fx_indexation?: Record<string, unknown>;
  supporting_documents?: PrefacturaSupportingDocRef[];
  signed_by?: string;
  signed_role?: string;
  signed_at?: string;
  deal_inputs?: {
    project_name?: string;
    client_name?: string;
    contract_value?: number;
    duration_months?: number;
    start_date?: string;
    end_date?: string;
    currency?: string;
  };
};

export type PrefacturaBaselineResponse = {
  baselineId: string;
  projectId: string;
  status: string;
  signatureHash?: string;
  totalAmount?: number;
  createdAt?: string;
};

export type PrefacturaBaselineListItem = {
  baseline_id: string;
  project_id: string;
  project_name?: string;
  client_name?: string;
  status?: string;
  total_amount?: number;
  created_at?: string;
  signed_by?: string;
  signed_at?: string;
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
    documentId: presign.documentId,
    metadata: presign.metadata,
    warnings: presign.warnings,
    status: presign.status,
  };
}

export async function createPrefacturaBaseline(
  payload: PrefacturaBaselinePayload
): Promise<PrefacturaBaselineResponse> {
  ensureApiBase();
  const base = requireApiBase();

  try {
    const response = await fetch(`${base}/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildAuthHeader() },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const backendMessage =
        typeof parsed === "string"
          ? parsed
          : parsed?.message || "Hubo un problema al crear la línea base.";

      if (response.status >= 500) {
        throw new FinanzasApiError(
          "Hubo un problema al crear la línea base.",
          response.status
        );
      }

      throw new FinanzasApiError(backendMessage, response.status);
    }

    const baselineResponse: PrefacturaBaselineResponse = {
      baselineId: parsed.baselineId || parsed.baseline_id || "",
      projectId: parsed.projectId || parsed.project_id || payload.project_id,
      status: parsed.status || "PendingSDMT",
      signatureHash: parsed.signatureHash || parsed.signature_hash,
      totalAmount: parsed.totalAmount || parsed.total_amount,
      createdAt: parsed.createdAt || parsed.created_at,
    };

    return baselineResponse;
  } catch (error) {
    if (error instanceof FinanzasApiError) {
      throw error;
    }

    throw new FinanzasApiError(
      error instanceof Error ? error.message : "Failed to create baseline"
    );
  }
}

export async function listPrefacturaBaselines(status?: string): Promise<{
  items: PrefacturaBaselineListItem[];
}> {
  ensureApiBase();
  const base = requireApiBase();

  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${base}/prefacturas/baselines${query}`, {
    headers: buildAuthHeader(),
  });

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new FinanzasApiError(
      parsed?.message || "No se pudieron obtener las líneas base",
      res.status
    );
  }

  return parsed;
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
export type AddProjectRubroInput = {
  rubroId?: string;
  rubroIds?: string[];
  [key: string]: unknown;
};

// Some backends mount under /projects/{id}/catalog/rubros; older ones under /projects/{id}/rubros.
// Try the modern path first, then fall back once on 404/405.
export async function addProjectRubro<T = Json>(
  projectId: string,
  payload: AddProjectRubroInput,
): Promise<T> {
  const base = requireApiBase();
  const headers = { "Content-Type": "application/json", ...buildAuthHeader() };

  // Normalize payload to backend expectations: prefer rubroIds array, wrap
  // legacy rubroId when provided.
  const hasRubroIds = Array.isArray(payload.rubroIds) && payload.rubroIds.length > 0;
  const hasRubroId = typeof payload.rubroId === "string" && payload.rubroId.length > 0;

  const { rubroIds, rubroId, ...sharedFields } = payload;
  const rubroEntries: Array<Record<string, unknown>> = hasRubroIds
    ? rubroIds.map((entry) =>
        typeof entry === "string"
          ? { ...sharedFields, rubroId: entry }
          : { ...sharedFields, ...(entry as Record<string, unknown>) },
      )
    : hasRubroId
    ? [{ ...sharedFields, rubroId }]
    : [];

  const wirePayload: Record<string, unknown> = {
    ...sharedFields,
    rubroIds: rubroEntries.length > 0 ? rubroEntries : rubroIds,
  };

  const requestBody = JSON.stringify(wirePayload);

  const requestOnce = async (url: string): Promise<Response> => {
    logApiDebug("POST rubro", { url, body: wirePayload });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
      });

      logApiDebug("POST rubro response", { url, status: res.status });
      return res;
    } catch (error) {
      logApiDebug("POST rubro network error", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new FinanzasApiError(
        error instanceof Error ? error.message : "Network error saving rubro",
      );
    }
  };

  // The deployed API exposes /projects/{id}/rubros; keep a single fallback to
  // /catalog/rubros for legacy stacks that might still use that mount.
  const primary = `${base}/projects/${encodeURIComponent(projectId)}/rubros`;
  let res = await requestOnce(primary);

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros`;
    res = await requestOnce(fallback);
  }

  if (res.status === 401 || res.status === 403) {
    handleAuthErrorStatus(res.status);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    logApiDebug("POST rubro failed", {
      url: res.url,
      status: res.status,
      body: bodyText,
    });
    if (res.status === 0) {
      throw new FinanzasApiError(`Network/CORS error calling ${res.url}`, res.status);
    }
    throw new FinanzasApiError(
      `addProjectRubro failed (${res.status}): ${bodyText || res.statusText}`,
      res.status,
    );
  }

  const text = await res.text().catch(() => "");
  logApiDebug("POST rubro succeeded", { url: res.url, status: res.status });
  return (text ? JSON.parse(text) : {}) as T;
}

export async function deleteProjectRubro(
  projectId: string,
  rubroId: string,
): Promise<void> {
  const base = requireApiBase();
  const headers = { "Content-Type": "application/json", ...buildAuthHeader() };

  const primary = `${base}/projects/${encodeURIComponent(
    projectId,
  )}/rubros/${encodeURIComponent(rubroId)}`;
  let res = await fetch(primary, { method: "DELETE", headers });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros/${encodeURIComponent(rubroId)}`;
    res = await fetch(fallback, { method: "DELETE", headers });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`deleteProjectRubro failed (${res.status}): ${bodyText}`);
  }
}

const applyTaxonomy = (
  item: LineItem & {
    linea_codigo?: string;
    categoria?: string;
    tipo_costo?: string;
  },
):
  | LineItem
  | (LineItem & {
      linea_codigo?: string;
      categoria?: string;
      tipo_costo?: string;
    }) => {
  const taxonomy =
    taxonomyByRubroId.get(item.id) ||
    taxonomyByLineaCodigo.get(item.linea_codigo || item.id);

  if (!taxonomy) return item;

  const lineaCodigo = taxonomy.linea_codigo || item.linea_codigo;
  const categoria = taxonomy.categoria || item.category;
  const tipo_costo = taxonomy.tipo_costo || item.tipo_costo;
  const description =
    item.description ||
    taxonomy.linea_gasto ||
    taxonomy.descripcion ||
    item.id;

  return {
    ...item,
    linea_codigo: lineaCodigo || item.id,
    categoria: categoria || item.category,
    tipo_costo,
    category: categoria || item.category,
    description,
  };
};

/* ──────────────────────────────────────────────────────────
   Catalog: fetch project rubros / line items
   Used by: src/hooks/useProjectLineItems.ts

   Invoice dropdown data flow (Prefacturas/Reconciliation):
   UI → getProjectRubros(projectId)
      → GET /projects/{projectId}/rubros (primary)
      → expects { data: [{ rubro_id, nombre, linea_codigo?, tipo_costo? }] }
   Legacy fallback: GET /projects/{projectId}/catalog/rubros
   ────────────────────────────────────────────────────────── */
const normalizeLineItem = (dto: LineItemDTO): LineItem => {
  const rubroId =
    (dto.id as string) ||
    (dto.rubro_id as string) ||
    (dto.rubroId as string) ||
    (dto as any).codigo ||
    (dto.linea_codigo as string) ||
    (dto.sk as string) ||
    "";

  const id = rubroId.replace(/^RUBRO#/, "");
  const lineaCodigo = (dto.linea_codigo as string) || id;
  const categoria =
    (dto.categoria as string) ||
    (dto.category as string) ||
    (dto as any).linea_gasto ||
    lineaCodigo ||
    "Rubro";
  const name =
    (dto.nombre as string) ||
    (dto.descripcion as string) ||
    (dto.description as string) ||
    categoria ||
    id ||
    "Rubro";
  const tipoCosto = (dto.tipo_costo as string) || undefined;

  const executionType = ((dto as any).tipo_ejecucion as string) || "";

  const recurringFromType = executionType.toLowerCase() === "mensual";
  const oneTimeFromType =
    executionType.toLowerCase() === "puntual" ||
    executionType.toLowerCase() === "puntual/hito" ||
    executionType.toLowerCase() === "por_hito";

  const recurring =
    dto.recurring !== undefined ? dto.recurring : recurringFromType;
  const one_time =
    dto.one_time !== undefined ? dto.one_time : oneTimeFromType || !recurring;

  const qty =
    Number(dto.qty ?? dto.quantity ?? (dto as any).cantidad ?? 1) || 1;

  const scheduledMonths = Array.isArray((dto as any).meses_programados)
    ? ((dto as any).meses_programados as string[])
    : [];

  const parseMonth = (value?: string): number => {
    if (!value) return 1;
    const parts = value.split("-");
    const monthPart = parts.length === 2 ? parts[1] : parts[0];
    const month = Number(monthPart);
    return month >= 1 && month <= 12 ? month : 1;
  };

  const start_month = scheduledMonths.length
    ? parseMonth(scheduledMonths[0])
    : Number((dto as any).start_month ?? 1) || 1;
  const end_month = scheduledMonths.length
    ? parseMonth(scheduledMonths[scheduledMonths.length - 1])
    : Number(
        (dto as any).end_month ?? (recurring ? 12 : start_month),
      ) || 1;

  const totalAmount =
    Number(
      (dto as any).monto_total ??
        (dto as any).total ??
        (dto as any).total_amount ??
        (dto as any).amount ??
        (dto as any).monto ??
        0,
    ) || 0;
  const monthlyAmount =
    Number(
      (dto as any).monto_mensual ??
        (dto as any).monto_mensual_estimado ??
        (dto as any).monthly_amount ??
        0,
    ) || 0;

  const durationMonths = Math.max(
    scheduledMonths.length || end_month - start_month + 1,
    1,
  );

  let unit_cost =
    Number((dto as any).unit_cost ?? (dto as any).amount ?? (dto as any).monto) ||
    0;

  if (recurring) {
    if (monthlyAmount > 0) {
      unit_cost = monthlyAmount;
    } else if (totalAmount > 0 && durationMonths > 0) {
      unit_cost = totalAmount / durationMonths;
    }
  }

  if (!recurring && unit_cost === 0 && totalAmount > 0 && qty > 0) {
    unit_cost = totalAmount / qty;
  }

  const base = {
    id,
    category: categoria,
    subtype: tipoCosto || undefined,
    vendor: (dto as any).vendor as string | undefined,
    description: name,
    one_time: Boolean(one_time),
    recurring: Boolean(recurring && !one_time),
    qty,
    unit_cost,
    currency:
      ((dto as any).moneda as Currency) ||
      (dto as any).currency ||
      "USD",
    fx_pair: (dto as any).fx_pair,
    fx_rate_at_booking: (dto as any).fx_rate_at_booking
      ? Number((dto as any).fx_rate_at_booking)
      : undefined,
    start_month,
    end_month,
    amortization: (dto as any).amortization || "none",
    capex_flag: Boolean((dto as any).capex_flag),
    cost_center: (dto as any).cost_center as string | undefined,
    gl_code: (dto as any).gl_code as string | undefined,
    tax_pct: (dto as any).tax_pct ? Number((dto as any).tax_pct) : undefined,
    indexation_policy: (dto as any).indexation_policy || "none",
    attachments: Array.isArray((dto as any).attachments)
      ? ((dto as any).attachments as string[])
      : [],
    notes: ((dto as any).notes as string) || undefined,
    created_at:
      ((dto as any).created_at as string) || new Date().toISOString(),
    updated_at:
      ((dto as any).updated_at as string) || new Date().toISOString(),
    created_by: ((dto as any).created_by as string) || "finanzas-api",
    service_tier: (dto.tier as string) || undefined,
    service_type: (dto as any).service_type as string | undefined,
    sla_uptime: (dto as any).sla_uptime as string | undefined,
    deliverable: (dto as any).deliverable as string | undefined,
    max_participants: (dto as any).max_participants
      ? Number((dto as any).max_participants)
      : undefined,
    duration_days: (dto as any).duration_days
      ? Number((dto as any).duration_days)
      : undefined,
    linea_codigo: lineaCodigo,
    categoria,
    tipo_costo: tipoCosto,
  } as LineItem & {
    linea_codigo?: string;
    categoria?: string;
    tipo_costo?: string;
  };

  return applyTaxonomy(ensureCategory(base));
};

const coerceLineItemList = (input: unknown): LineItemDTO[] => {
  if (Array.isArray(input)) return input as LineItemDTO[];
  if (!input || typeof input !== "object") return [];

  const candidate = input as Record<string, unknown>;
  if (Array.isArray(candidate.data)) return candidate.data as LineItemDTO[];
  if (Array.isArray(candidate.items)) return candidate.items as LineItemDTO[];
  if (Array.isArray((candidate as any).line_items))
    return (candidate as any).line_items as LineItemDTO[];
  return [];
};

export async function getProjectRubros(
  projectId: string,
): Promise<LineItem[]> {
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

    let payload = coerceLineItemList(res.data);

    // If the primary route returns an empty list, attempt the line-items alias
    // to capture the full catalog used by other modules.
    if (payload.length === 0) {
      const aliasPath = `/line-items?project_id=${encodeURIComponent(
        projectId,
      )}`;
      res = await httpClient.get<LineItemDTO[] | { data?: LineItemDTO[] }>(
        aliasPath,
        { headers: buildAuthHeader() },
      );

      payload = coerceLineItemList(res.data);
    }

    return payload
      .map(normalizeLineItem)
      .filter((item) => !!item.id)
      .filter(
        (item, idx, arr) =>
          idx === arr.findIndex((candidate) => candidate.id === item.id),
      );
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      try {
        handleAuthErrorStatus(err.status);
      } catch (authErr) {
        throw new FinanzasApiError(
          authErr instanceof Error
            ? authErr.message
            : "Sesión expirada, por favor vuelve a iniciar sesión.",
          err.status,
        );
      }

      throw new FinanzasApiError(
        err.status === 401
          ? "Sesión expirada, por favor vuelve a iniciar sesión."
          : "No tienes permiso para ver rubros de este proyecto.",
        err.status,
      );
    }
    if (err instanceof HttpError && (err.status === 404 || err.status === 405)) {
      return [];
    }
    throw toFinanzasError(err, "Unable to load catalog data");
  }
}

/**
 * Get project rubros with taxonomy fallback
 * Returns both normalized line items and taxonomy lookup map
 */
export async function getProjectRubrosWithTaxonomy(
  projectId: string,
): Promise<{ lineItems: LineItem[]; taxonomyByRubroId: Record<string, { description?: string; category?: string }> }> {
  const lineItems = await getProjectRubros(projectId);
  
  // Build taxonomy lookup from the imported taxonomyByRubroId Map
  const taxonomyLookup: Record<string, { description?: string; category?: string }> = {};
  
  // Convert Map to Record for easier consumption
  taxonomyByRubroId.forEach((taxonomy, rubroId) => {
    taxonomyLookup[rubroId] = {
      description: taxonomy.linea_gasto || taxonomy.descripcion,
      category: taxonomy.categoria,
    };
  });
  
  return { lineItems, taxonomyByRubroId: taxonomyLookup };
}

// ---------- Projects ----------
export {
  normalizeProjectsPayload,
  type ProjectsResponse,
  type Json,
} from "./finanzas-projects-helpers";

export type CreateProjectPayload = {
  name: string;
  code: string;
  client: string;
  start_date: string; // yyyy-mm-dd
  end_date: string; // yyyy-mm-dd
  currency: string; // e.g. "USD"
  mod_total: number | string;
  description?: string;
};

// Optional helpers used by tests/smokes
export async function getProjects(): Promise<ProjectsResponse> {
  ensureApiBase();

  try {
    const response = await httpClient.get<ProjectsResponse>("/projects?limit=100", {
      headers: buildAuthHeader(),
    });

    // Extract the payload from the HttpResponse wrapper
    const payload = response.data;

    // Normalize a bit but keep it backwards compatible for callers:
    // - If backend returns an array, just return it.
    // - If backend returns { data } or { items }, return that object.
    if (Array.isArray(payload)) {
      return payload;
    }

    const anyPayload = payload as ProjectsResponse | undefined;

    if (
      anyPayload &&
      (Array.isArray((anyPayload as any).data) ||
        Array.isArray((anyPayload as any).items))
    ) {
      return anyPayload;
    }

    // Preserve alternate shapes (Items/projects/results/records) so downstream
    // normalization can extract project arrays instead of dropping the payload.
    if (anyPayload && typeof anyPayload === "object") {
      return anyPayload;
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

export async function createProject(
  payload: CreateProjectPayload,
): Promise<Json> {
  ensureApiBase();

  try {
    const body = {
      ...payload,
      mod_total:
        typeof payload.mod_total === "string"
          ? Number(payload.mod_total)
          : payload.mod_total,
    };

    const res = await httpClient.post<Json>("/projects", body, {
      headers: buildAuthHeader(),
    });

    return res.data;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }

    throw toFinanzasError(err, "Unable to create project");
  }
}

export type MODProjectionByMonth = {
  month: string;
  totalPlanMOD: number;
  totalForecastMOD: number;
  totalActualMOD: number;
  payrollTarget?: number;
  projectCount: number;
};

export async function getPayrollDashboard(): Promise<MODProjectionByMonth[]> {
  ensureApiBase();

  try {
    const response = await httpClient.get<MODProjectionByMonth[]>("/payroll/dashboard", {
      headers: buildAuthHeader(),
    });

    return response.data;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }
    throw toFinanzasError(err, "Unable to load payroll dashboard data");
  }
}

export type HandoffBaselinePayload = {
  baseline_id: string;
  mod_total?: number;
  pct_ingenieros?: number;
  pct_sdm?: number;
  aceptado_por?: string;
};

export type HandoffBaselineResponse = {
  projectId: string;
  baselineId: string;
  status?: string;
};

export async function handoffBaseline(
  projectId: string,
  payload: HandoffBaselinePayload,
): Promise<HandoffBaselineResponse> {
  ensureApiBase();

  const url = `${requireApiBase()}/projects/${encodeURIComponent(
    projectId,
  )}/handoff`;
  const idempotencyKey = `handoff-${projectId}-${payload.baseline_id}-${Date.now()}`;

  try {
    const result = await fetchJson<HandoffBaselineResponse>(url, {
      method: "POST",
      headers: {
        ...buildAuthHeader(),
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    return {
      projectId: result.projectId || projectId,
      baselineId: result.baselineId || payload.baseline_id,
      status: result.status || "HandoffComplete",
    };
  } catch (err) {
    throw toFinanzasError(err, "Unable to handoff baseline");
  }
}

export interface AcceptBaselinePayload {
  baseline_id?: string;
  accepted_by?: string;
}

export interface AcceptBaselineResponse {
  projectId: string;
  baselineId: string;
  baseline_status: string;
  accepted_by: string;
  baseline_accepted_at: string;
}

export async function acceptBaseline(
  projectId: string,
  payload?: AcceptBaselinePayload,
): Promise<AcceptBaselineResponse> {
  ensureApiBase();

  const url = `${requireApiBase()}/projects/${encodeURIComponent(
    projectId,
  )}/accept-baseline`;

  try {
    // Build request body: backend requires baseline_id
    const requestBody: Record<string, string> = {};
    if (payload?.baseline_id) {
      requestBody.baseline_id = payload.baseline_id;
    }
    if (payload?.accepted_by) {
      requestBody.accepted_by = payload.accepted_by;
    }

    const result = await fetchJson<AcceptBaselineResponse>(url, {
      method: "PATCH",
      headers: {
        ...buildAuthHeader(),
        "Content-Type": "application/json",
      },
      // Backend expects baseline_id in the request body
      body: Object.keys(requestBody).length > 0
        ? JSON.stringify(requestBody)
        : undefined,
    });

    // Return the response as-is from the server without adding fallback values
    // that don't reflect actual server state
    return result;
  } catch (err) {
    throw toFinanzasError(err, "Unable to accept baseline");
  }
}

export interface RejectBaselinePayload {
  baseline_id: string;
  rejected_by?: string;
  comment?: string;
}

export interface RejectBaselineResponse {
  projectId: string;
  baselineId: string;
  baseline_status: string;
  rejected_by: string;
  baseline_rejected_at: string;
  rejection_comment?: string;
}

export async function rejectBaseline(
  projectId: string,
  payload: RejectBaselinePayload,
): Promise<RejectBaselineResponse> {
  ensureApiBase();

  const url = `${requireApiBase()}/projects/${encodeURIComponent(
    projectId,
  )}/reject-baseline`;

  try {
    const result = await fetchJson<RejectBaselineResponse>(url, {
      method: "PATCH",
      headers: {
        ...buildAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return result;
  } catch (err) {
    throw toFinanzasError(err, "Unable to reject baseline");
  }
}

// Alias for compatibility with tests/hooks referencing older helper name
export const getProjectLineItems = getProjectRubros;

// Get invoices for a project
export async function getInvoices(projectId: string): Promise<InvoiceDoc[]> {
  ensureApiBase();
  if (!projectId) throw new FinanzasApiError("projectId is required");

  const normalizeInvoice = (item: any): InvoiceDoc => ({
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
    uploaded_at: item.created_at || item.uploaded_at || new Date().toISOString(),
    matched_at: item.matched_at,
    matched_by: item.matched_by,
  });

  const toArray = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object") {
      const data = (payload as any).data;
      if (Array.isArray(data)) return data;
    }
    return [];
  };

  try {
    const parseInvoices = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.data)) return payload.data;
      if (payload && Array.isArray(payload.items)) return payload.items;
      if (payload?.data && Array.isArray(payload.data.items))
        return payload.data.items;
      if (payload?.data && Array.isArray(payload.data.data))
        return payload.data.data;
      return [];
    };

    const mapInvoice = (item: any): InvoiceDoc => ({
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
    });

    const primaryPath = `/projects/${encodeURIComponent(projectId)}/invoices`;
    try {
      const response = await httpClient.get<{ data?: any[] }>(primaryPath, {
        headers: buildAuthHeader(),
      });
      return parseInvoices(response.data).map(mapInvoice);
    } catch (err) {
      if (err instanceof HttpError && [404, 405].includes(err.status)) {
        // Fall back to legacy /prefacturas route
      } else if (err instanceof HttpError && err.status >= 500) {
        // Try legacy route before surfacing server errors
      } else {
        throw err;
      }
    }

    const params = new URLSearchParams({ projectId });
    const legacyResponse = await httpClient.get<{ data?: any[] }>(
      `/prefacturas?${params.toString()}`,
      { headers: buildAuthHeader() },
    );

    return parseInvoices(legacyResponse.data).map(mapInvoice);
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      handleAuthErrorStatus(err.status);
    }

    const isNotFound =
      err instanceof HttpError && (err.status === 404 || err.status === 405);
    if (!isNotFound) {
      if (err instanceof HttpError) {
        if (err.status === 403) {
          throw new FinanzasApiError(
            "Access to invoices is restricted for this project.",
            403,
          );
        }
      }
    }

    try {
      const params = new URLSearchParams({ projectId });
      const fallback = await httpClient.get<{ data?: any[] } | any[]>(
        `/prefacturas?${params.toString()}`,
        { headers: buildAuthHeader() },
      );

      return toArray(fallback.data).map(normalizeInvoice);
    } catch (fallbackErr) {
      if (
        fallbackErr instanceof HttpError &&
        (fallbackErr.status === 401 || fallbackErr.status === 403)
      ) {
        handleAuthErrorStatus(fallbackErr.status);
      }
      if (
        fallbackErr instanceof HttpError &&
        (fallbackErr.status === 404 || fallbackErr.status === 405)
      ) {
        return [];
      }

      throw toFinanzasError(fallbackErr, "Unable to load invoices");
    }
  }
}

/**
 * Fetch all projects from DynamoDB (for dropdowns)
 */
export async function fetchProjects(): Promise<Array<{
  projectId: string;
  code: string;
  name: string;
  client?: string;
}>> {
  ensureApiBase();
  const headers = buildAuthHeader();

  try {
    const response = await fetchJson<{ projects: any[] }>(`${requireApiBase()}/projects`, {
      method: "GET",
      headers,
    });

    return (response.projects || []).map((p: any) => ({
      projectId: p.project_id || p.projectId,
      code: p.code || p.project_code || p.projectId,
      name: p.name || p.project_name || "Sin nombre",
      client: p.client || p.client_name,
    }));
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

/**
 * Fetch all rubros from taxonomy (for dropdowns)
 */
export async function fetchRubros(): Promise<Array<{
  rubroId: string;
  code: string;
  description: string;
  category: string;
}>> {
  // Use client-side taxonomy for now
  // This can be replaced with a backend call if needed
  const { CATALOGO_RUBROS } = await import("@/modules/rubros.taxonomia");
  
  return CATALOGO_RUBROS.map((r) => ({
    rubroId: r.linea_codigo,
    code: r.linea_codigo,
    description: r.linea_gasto,
    category: r.categoria,
  }));
}

/**
 * Simple client helper for finanzas API calls
 */
function getFinanzasClient() {
  const base = requireApiBase();
  return {
    async get<T>(endpoint: string): Promise<T> {
      const url = `${base}${endpoint}`;
      return fetchJson<T>(url, {
        method: "GET",
        headers: buildAuthHeader(),
      });
    },
    async mutate<T>(endpoint: string, options: { method: string; body: string }): Promise<T> {
      const url = `${base}${endpoint}`;
      return fetchJson<T>(url, {
        method: options.method,
        headers: { ...buildAuthHeader(), "Content-Type": "application/json" },
        body: options.body,
      });
    },
  };
}

/**
 * Bulk update allocations with forecast adjustments
 * @param projectId - Project ID
 * @param allocations - Array of allocations to update
 * @param type - Type of allocation: "planned" or "forecast"
 */
export async function bulkUpdateAllocations(
  projectId: string,
  allocations: Array<{
    rubro_id: string;
    mes: string;
    monto_planeado?: number;
    monto_proyectado?: number;
  }>,
  type: "planned" | "forecast" = "planned"
): Promise<{
  updated_count: number;
  type: string;
  allocations: Array<{
    rubro_id: string;
    mes: string;
    status: string;
  }>;
}> {
  const client = getFinanzasClient();
  const endpoint = `/projects/${projectId}/allocations:bulk?type=${type}`;
  
  return client.mutate(endpoint, {
    method: "PUT",
    body: JSON.stringify({ allocations }),
  });
}

/**
 * Get annual all-in budget for a specific year
 * @param year - Year to get budget for
 */
export async function getAnnualBudget(year: number): Promise<{
  year: number;
  amount: number;
  currency: string;
  lastUpdated: string;
  updatedBy: string;
} | null> {
  try {
    const client = getFinanzasClient();
    const endpoint = `/budgets/all-in?year=${year}`;
    
    return await client.get(endpoint);
  } catch (error: any) {
    // Return null if budget not found (404)
    if (error?.status === 404 || error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Set or update annual all-in budget
 * @param year - Year to set budget for
 * @param amount - Budget amount
 * @param currency - Currency (USD, EUR, MXN)
 */
export async function setAnnualBudget(
  year: number,
  amount: number,
  currency: string = "USD"
): Promise<{
  year: number;
  amount: number;
  currency: string;
  lastUpdated: string;
  updatedBy: string;
}> {
  const client = getFinanzasClient();
  const endpoint = "/budgets/all-in";
  
  return client.mutate(endpoint, {
    method: "PUT",
    body: JSON.stringify({ year, amount, currency }),
  });
}
