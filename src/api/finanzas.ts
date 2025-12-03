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
  const { projectId, file, module, lineItemId, invoiceNumber, invoiceDate, vendor, amount } = _;
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
        parsed.error || parsed.message || rawText || "Upload authorization failed",
        response.status,
      );
    }

    const defaultMsg = parsed.error || parsed.message || rawText;
    const isServiceUnavailable = response.status === 503;
    const message = isServiceUnavailable
      ? parsed.error || "Uploads are temporarily unavailable. Please try again later."
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

  return {
    uploadUrl: parsed.uploadUrl,
    objectKey: parsed.objectKey,
    warnings: parsed.warnings || [],
    status: response.status,
  };
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
  warnings?: string[];
  status?: number;
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
    warnings: presign.warnings,
    status: presign.status,
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

  // The deployed API exposes /projects/{id}/rubros; keep a single fallback to
  // /catalog/rubros for legacy stacks that might still use that mount.
  const primary = `${base}/projects/${encodeURIComponent(projectId)}/rubros`;
  let res = await fetch(primary, {
    method: "POST",
    headers,
    body: JSON.stringify(wirePayload),
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${base}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros`;
    res = await fetch(fallback, {
      method: "POST",
      headers,
      body: JSON.stringify(wirePayload),
    });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`addProjectRubro failed (${res.status}): ${bodyText}`);
  }

  const text = await res.text();
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
    (dto.sk as string) ||
    "";

  const id = rubroId.replace(/^RUBRO#/, "");
  const name =
    (dto.nombre as string) ||
    (dto.descripcion as string) ||
    (dto.description as string) ||
    id ||
    "Rubro";
  const category =
    (dto.linea_codigo as string) ||
    (dto.categoria as string) ||
    (dto.category as string) ||
    "Rubro";

  const executionType =
    (dto.tipo_costo as string) || (dto.tipo_ejecucion as string) || "";

  const recurringFromType = executionType.toLowerCase() === "mensual";
  const oneTimeFromType =
    executionType.toLowerCase() === "puntual" ||
    executionType.toLowerCase() === "por_hito";

  const recurring = dto.recurring !== undefined ? dto.recurring : recurringFromType;
  const one_time =
    dto.one_time !== undefined ? dto.one_time : oneTimeFromType || !recurring;

  const qty = Number(dto.qty ?? dto.quantity ?? (dto as any).cantidad ?? 1) || 1;

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
    : Number((dto as any).end_month ?? (recurring ? 12 : start_month)) || 1;

  const totalAmount =
    Number(
      (dto as any).monto_total ??
        (dto as any).total ??
        (dto as any).total_amount ??
        dto.amount ??
        dto.monto ??
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

  let unit_cost = Number(dto.unit_cost ?? dto.amount ?? dto.monto ?? 0) || 0;

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

  return {
    id,
    category,
    subtype: (dto.tipo_costo as string) || undefined,
    vendor: (dto.vendor as string) || undefined,
    description: name,
    one_time: Boolean(one_time),
    recurring: Boolean(recurring && !one_time),
    qty,
    unit_cost,
    currency:
      ((dto as any).moneda as Currency) || (dto.currency as Currency) || "USD",
    fx_pair: dto.fx_pair as any,
    fx_rate_at_booking: dto.fx_rate_at_booking
      ? Number(dto.fx_rate_at_booking)
      : undefined,
    start_month,
    end_month,
    amortization: (dto.amortization as any) || "none",
    capex_flag: Boolean(dto.capex_flag),
    cost_center: dto.cost_center as string | undefined,
    gl_code: dto.gl_code as string | undefined,
    tax_pct: dto.tax_pct ? Number(dto.tax_pct) : undefined,
    indexation_policy: (dto.indexation_policy as any) || "none",
    attachments: Array.isArray(dto.attachments) ? (dto.attachments as string[]) : [],
    notes: (dto.notes as string) || undefined,
    created_at: (dto.created_at as string) || new Date().toISOString(),
    updated_at: (dto.updated_at as string) || new Date().toISOString(),
    created_by: (dto.created_by as string) || "finanzas-api",
    service_tier: dto.tier as string | undefined,
    service_type: dto.service_type as string | undefined,
    sla_uptime: dto.sla_uptime as string | undefined,
    deliverable: dto.deliverable as string | undefined,
    max_participants: dto.max_participants
      ? Number(dto.max_participants)
      : undefined,
    duration_days: dto.duration_days ? Number(dto.duration_days) : undefined,
  } satisfies LineItem;
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

    let payload = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as any)?.data)
      ? (res.data as any).data
      : [];

    // If the primary route returns an empty list, attempt the line-items alias
    // to capture the full catalog used by other modules.
    if (payload.length === 0) {
      const aliasPath = `/line-items?project_id=${encodeURIComponent(projectId)}`;
      res = await httpClient.get<LineItemDTO[] | { data?: LineItemDTO[] }>(
        aliasPath,
        { headers: buildAuthHeader() },
      );

      payload = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.data)
        ? (res.data as any).data
        : [];
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
    const response = await httpClient.get<ProjectsResponse>("/projects?limit=50", {
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

    const anyPayload = payload as { data?: Json[]; items?: Json[] };

    if (Array.isArray(anyPayload.data) || Array.isArray(anyPayload.items)) {
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
      if (payload?.data && Array.isArray(payload.data.items)) return payload.data.items;
      if (payload?.data && Array.isArray(payload.data.data)) return payload.data.data;
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

    const isNotFound = err instanceof HttpError && (err.status === 404 || err.status === 405);
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

    throw toFinanzasError(err, "Unable to load invoices");
  }
}