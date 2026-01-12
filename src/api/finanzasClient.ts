import { z } from "zod";
import { API_BASE, HAS_API_BASE } from "@/config/env";
import { buildAuthHeader, getAuthToken, handleAuthErrorStatus } from "@/config/api";
import httpClient, { HttpError } from "@/lib/http-client";

if (!HAS_API_BASE) {
  // Non-fatal in dev; API client will throw on call
  console.warn(
    "VITE_API_BASE_URL is not set. Finanzas API client is disabled."
  );
} else if (import.meta.env.DEV) {
  // Debug logging for dev mode only
  console.log("[Finz] finanzasClient initialized with shared httpClient");
}

// Schemas
// Schema aligned with /catalog/rubros API response (accepts id/code variants)
export const RubroSchema = z
  .object({
    rubro_id: z.string().optional(),
    id: z.string().optional(),
    code: z.string().optional(),
    nombre: z.string().optional(),
    categoria: z.string().optional(),
    tipo_ejecucion: z.string().optional(),
    descripcion: z.string().optional(),
    linea_codigo: z.string().optional(), // Accounting line or cost center code
    tipo_costo: z.string().optional(), // Cost type (OPEX, CAPEX, etc.)
  })
  .transform((raw) => {
    const rubroId =
      raw.rubro_id || raw.id || raw.code || raw.nombre || "rubrosinid";
    return {
      rubro_id: rubroId,
      nombre:
        raw.nombre ||
        raw.descripcion ||
        raw.code ||
        raw.rubro_id ||
        raw.id ||
        "Rubro sin nombre",
      categoria: raw.categoria,
      tipo_ejecucion: raw.tipo_ejecucion,
      descripcion: raw.descripcion,
      linea_codigo: raw.linea_codigo || raw.code,
      tipo_costo: raw.tipo_costo,
    };
  });

export const RubroListSchema = z.object({
  data: z.array(RubroSchema),
  total: z.number().optional(),
});

export type Rubro = z.infer<typeof RubroSchema>;

// Allocation Rules Schema
export const AllocationRuleSchema = z.object({
  rule_id: z.string(),
  linea_codigo: z.string(),
  driver: z.string(),
  split: z
    .array(
      z.object({
        to: z.object({
          project_id: z.string().optional(),
          cost_center: z.string().optional(),
        }),
        pct: z.number(),
      })
    )
    .optional(),
  fixed_amount: z.number().optional(),
  active: z.boolean(),
  priority: z.number().optional(),
});

export const AllocationRuleListSchema = z.object({
  data: z.array(AllocationRuleSchema),
});

export type AllocationRule = z.infer<typeof AllocationRuleSchema>;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function normalizeDataArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }

  return [];
}

const logBudgetMonthlyFailure = (path: string, error: unknown) => {
  if (!import.meta.env.DEV) return;

  const status = error instanceof HttpError ? error.status : undefined;
  const base = API_BASE ? API_BASE.replace(/\/+$/, "") : "";
  const url = base ? `${base}/${path.replace(/^\/+/, "")}` : path;
  const message = error instanceof Error ? error.message : String(error);

  console.warn("[Finz] budgets/all-in/monthly failed after retries", {
    url,
    status,
    message,
  });
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!HAS_API_BASE) {
    throw new Error("Finanzas API base URL is not configured");
  }

  const method = ((init?.method || "GET").toUpperCase() || "GET") as HttpMethod;
  const parsedBody = (() => {
    if (!init?.body) return undefined;
    if (typeof init.body === "string") {
      try {
        return JSON.parse(init.body);
      } catch (error) {
        console.warn("finanzasClient could not parse request body as JSON", error);
        return init.body;
      }
    }
    return init.body;
  })();

  try {
    // Normalize path to prevent double slashes and preserve stage (e.g., /dev)
    // Strip leading slashes from the path to ensure proper concatenation
    const normalizedPath = path.replace(/^\/+/, '');
    
    // Always attach auth headers; allow callers to add extras without removing JWT.
    const headers = { ...(init?.headers || {}), ...buildAuthHeader() };

    const response = await (async () => {
      switch (method) {
        case "POST":
          return httpClient.post<T>(normalizedPath, parsedBody, { headers });
        case "PUT":
          return httpClient.put<T>(normalizedPath, parsedBody, { headers });
        case "PATCH":
          return httpClient.patch<T>(normalizedPath, parsedBody, { headers });
        case "DELETE":
          return httpClient.delete<T>(normalizedPath, { headers });
        default:
          return httpClient.get<T>(normalizedPath, { headers });
      }
    })();

    return response.data as T;
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 501) {
        throw new Error(
          "This feature is not yet implemented on the server (501). The backend handler needs to be completed."
        );
      }

      if (error.status === 401 || error.status === 403) {
        handleAuthErrorStatus(error.status);
      }
    }

    // Surface any parsing or connectivity issues explicitly
    if (error instanceof Error && /HTML|DOCTYPE|<html/i.test(error.message)) {
      throw new Error(
        `${error.message} Check VITE_API_BASE_URL configuration or reverse proxy wiring.`
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Unknown network error while calling Finanzas API");
  }
}

/**
 * HTTP request with exponential backoff retry logic
 * Retries up to 3 times on network errors or 5xx status codes
 * Does not retry on 4xx client errors
 */
async function httpWithRetry<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await http<T>(path, init);
    } catch (error) {
      // Check if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Don't retry on 4xx client errors
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      if (import.meta.env.DEV) {
        console.log(`[Finz] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for ${path}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

function normalizeListResponse<T>(payload: { data?: unknown } | unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}

function toProjectRubroRequest(payload: RubroCreate): ProjectRubroRequest {
  const normalized: ProjectRubroRequest = {
    rubroIds: payload.rubro_id ? [payload.rubro_id] : [],
    monto_total: payload.monto_total,
    tipo_ejecucion: payload.tipo_ejecucion,
    meses_programados: payload.meses_programados,
    notas: payload.notas,
  };

  const parsed = ProjectRubroRequestSchema.safeParse(normalized);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => issue.message || issue.path.join("."))
      .join("; ");

    throw new Error(
      details ||
        "Datos del rubro inválidos. Revisa el ID, monto y tipo de ejecución antes de intentar nuevamente."
    );
  }

  return parsed.data;
}

// Project schemas - Canonical (English only, camelCase)
export const ProjectCreateSchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().regex(/^PROJ-\d{4}-\d{3}$/),
  client: z.string().min(2).max(200),
  start_date: z.string(),
  end_date: z.string(),
  currency: z.enum(["USD", "EUR", "MXN", "COP"]),
  mod_total: z.number().min(0),
  description: z.string().max(1000).optional(),
  sdm_manager_email: z.string().email().optional(), // Optional in schema (SDM auto-assigned, PMO/SDMT provide explicitly)
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

// Canonical Project schema - matches backend ProjectDTO
export const ProjectSchema = z.object({
  projectId: z.string(),
  code: z.string(),
  name: z.string(),
  client: z.string(),
  description: z.string(),
  status: z.string(),
  currency: z.string(),
  modTotal: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  // ABAC fields
  sdmManagerEmail: z.string().optional(),
  sdmManagerName: z.string().optional(),
  pmLeadEmail: z.string().optional(),
  // Baseline tracking
  baselineId: z.string().optional(),
  baselineStatus: z.string().optional(),
  baselineAcceptedAt: z.string().optional(),
  // Additional metadata
  module: z.string().optional(),
  source: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

// Rubro create schema
export const RubroCreateSchema = z.object({
  rubro_id: z.string(),
  monto_total: z.number().min(0),
  tipo_ejecucion: z.enum(["mensual", "puntual", "por_hito"]),
  meses_programados: z.array(z.string()).optional(),
  notas: z.string().max(1000).optional(),
});

export type RubroCreate = z.infer<typeof RubroCreateSchema>;

const ProjectRubroRequestSchema = z.object({
  rubroIds: z.array(z.string()).min(1),
  monto_total: z.number().min(0).optional(),
  tipo_ejecucion: z.enum(["mensual", "puntual", "por_hito"]).optional(),
  meses_programados: z.array(z.string()).optional(),
  notas: z.string().max(1000).optional(),
});

type ProjectRubroRequest = z.infer<typeof ProjectRubroRequestSchema>;

// Baseline detail response type
export type BaselineDetailResponse = {
  baseline_id: string;
  project_id: string;
  project_name: string;
  status: string;
  created_by: string;
  accepted_by?: string;
  accepted_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  labor_estimates: Array<{
    rubroId: string;
    role: string;
    country: string;
    level: string;
    fte_count: number;
    hourly_rate: number;
    hours_per_month: number;
    on_cost_percentage: number;
    start_month: number;
    end_month: number;
  }>;
  non_labor_estimates: Array<{
    rubroId: string;
    category: string;
    description: string;
    amount: number;
    currency: string;
    one_time: boolean;
    start_month?: number;
    end_month?: number;
    vendor?: string;
    capex_flag: boolean;
  }>;
  duration_months?: number;
  total_amount: number;
  currency: string;
  created_at: string;
};

// Allocation bulk schema
export const AllocationBulkSchema = z.object({
  allocations: z.array(
    z.object({
      rubro_id: z.string(),
      mes: z.string(),
      monto_planeado: z.number().min(0),
    })
  ).min(1),
});

export type AllocationBulk = z.infer<typeof AllocationBulkSchema>;

// Adjustment create schema
export const AdjustmentCreateSchema = z.object({
  project_id: z.string(),
  tipo: z.enum(["exceso", "reduccion", "reasignacion"]),
  monto: z.number().min(0),
  origen_rubro_id: z.string().optional(),
  destino_rubro_id: z.string().optional(),
  fecha_inicio: z.string(),
  metodo_distribucion: z.enum(["pro_rata_forward", "pro_rata_all", "single_month"]).optional(),
  justificacion: z.string().max(2000).optional(),
  solicitado_por: z.string().email(),
});

export type AdjustmentCreate = z.infer<typeof AdjustmentCreateSchema>;

export const AdjustmentSchema = AdjustmentCreateSchema.extend({
  id: z.string(),
  estado: z.enum(["pending_approval", "approved", "rejected"]).optional(),
  meses_impactados: z.array(z.string()).optional(),
  distribucion: z
    .array(
      z.object({
        mes: z.string(),
        monto: z.number(),
      })
    )
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const AdjustmentListSchema = z.object({
  data: z.array(AdjustmentSchema),
  total: z.number().optional(),
});

export type Adjustment = z.infer<typeof AdjustmentSchema>;

// Provider create schema
export const ProviderCreateSchema = z.object({
  nombre: z.string().min(3).max(200),
  tax_id: z.string().min(5).max(50),
  tipo: z.enum(["servicios", "materiales", "software", "infraestructura"]),
  contacto_nombre: z.string().max(200).optional(),
  contacto_email: z.string().email().optional(),
  contacto_telefono: z.string().max(50).optional(),
  pais: z.string().min(2).max(100).optional(),
  notas: z.string().max(2000).optional(),
});

export type ProviderCreate = z.infer<typeof ProviderCreateSchema>;

const ProviderMetadataSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined ? undefined : value));

export const ProviderSchema = ProviderCreateSchema.extend({
  id: z.string(),
  estado: z.enum(["active", "inactive", "suspended"]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: ProviderMetadataSchema,
});

export const ProviderListSchema = z.object({
  data: z.array(ProviderSchema),
  total: z.number().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;

function validateProjectPayload(payload: ProjectCreate): ProjectCreate {
  const parsed = ProjectCreateSchema.safeParse(payload);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) =>
        issue.message
          ? `${issue.path.join(".") || "campo"}: ${issue.message}`
          : issue.path.join(".") || "campo"
      )
      .join("; ");

    throw new Error(
      details ||
        "Datos de proyecto inválidos. Verifica código, fechas, moneda y monto MOD."
    );
  }

  return parsed.data;
}

function isJwtPresent(): boolean {
  return !!getAuthToken();
}

function checkAuth(): void {
  if (!isJwtPresent()) {
    throw new Error("You must be signed in to perform this action. Please log in with your Finance credentials.");
  }
}

function isBudgetMissingError(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 404 || error.status === 405);
}

export const finanzasClient = {
  async health(): Promise<
    { ok: boolean; stage?: string; time?: string } | undefined
  > {
    return http("/health");
  },

  async getRubros(): Promise<Rubro[]> {
    const payload = await http<unknown>("/catalog/rubros");
    const data = normalizeDataArray<unknown>(payload);
    const parsed = z.array(RubroSchema).safeParse(data);

    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid rubros response");
    }

    return parsed.data;
  },

  async getAllocationRules(): Promise<AllocationRule[]> {

    const payload = await http<{ data: unknown } | AllocationRule[]>(
      "/allocation-rules",
    );
    const data = normalizeListResponse<AllocationRule>(payload);
    const parsed = AllocationRuleListSchema.safeParse({ data });
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid allocation rules response");
    }

    return parsed.data.data;
  },

  async getAdjustments(params: { projectId?: string; limit?: number } = {}): Promise<Adjustment[]> {
    const search = new URLSearchParams();
    if (params.projectId) search.set("project_id", params.projectId);
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();

    const data = await http<{ data: unknown }>(`/adjustments${query ? `?${query}` : ""}`);
    const parsed = AdjustmentListSchema.safeParse(data);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid adjustments response");
    }
    return parsed.data.data;
  },

  async getProviders(params: { tipo?: string; estado?: string; limit?: number } = {}): Promise<Provider[]> {
    const search = new URLSearchParams();
    if (params.tipo) search.set("tipo", params.tipo);
    if (params.estado) search.set("estado", params.estado);
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();

    const data = await http<{ data: unknown }>(`/providers${query ? `?${query}` : ""}`);
    const parsed = ProviderListSchema.safeParse(data);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid providers response");
    }
    return parsed.data.data;
  },

  // Write operations
  async createProject(payload: ProjectCreate): Promise<Project> {
    checkAuth();
    const validPayload = validateProjectPayload(payload);
    const data = await http<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    return data;
  },

  async createProjectRubro(projectId: string, payload: RubroCreate): Promise<Rubro> {
    checkAuth();
    const requestBody = toProjectRubroRequest(payload);

    const data = await http<Rubro>(`/projects/${projectId}/rubros`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    return data;
  },

  async saveAllocations(projectId: string, payload: AllocationBulk): Promise<{ updated_count: number; allocations: unknown[] }> {
    checkAuth();
    const data = await http<{ updated_count: number; allocations: unknown[] }>(
      `/projects/${projectId}/allocations:bulk`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return data;
  },

  async createAdjustment(payload: AdjustmentCreate): Promise<unknown> {
    checkAuth();
    const data = await http<unknown>("/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data;
  },

  async createProvider(payload: ProviderCreate): Promise<Provider> {
    checkAuth();
    const data = await http<unknown>("/providers", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const parsed = ProviderSchema.safeParse(data);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid provider response from server");
    }

    return parsed.data;
  },

  /**
   * Bulk update forecast values for allocations (PMO only)
   */
  async bulkUpsertForecast(
    projectId: string,
    items: Array<{ rubroId: string; month: number; forecast: number }>
  ): Promise<{ success: boolean; updated: number; skipped: number; total: number }> {
    checkAuth();
    const data = await http<{ success: boolean; updated: number; skipped: number; total: number }>(
      `/projects/${projectId}/allocations:bulk?type=forecast`,
      {
        method: "PUT",
        body: JSON.stringify({ items }),
      }
    );
    return data;
  },

  /**
   * Get annual all-in budget for a specific year
   */
  async getAllInBudget(year: number): Promise<{
    year: number;
    amount: number | null;
    currency: string;
    updated_at?: string;
    updated_by?: string;
  } | null> {
    checkAuth();
    try {
      const data = await http<{
        year: number;
        amount: number | null;
        currency: string;
        updated_at?: string;
        updated_by?: string;
      }>(`/budgets/all-in?year=${year}`, {
        method: "GET",
      });
      return data;
    } catch (error) {
      if (isBudgetMissingError(error)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Set or update annual all-in budget (PMO/ADMIN only)
   */
  async putAllInBudget(
    year: number,
    amount: number,
    currency: string = "USD"
  ): Promise<{
    year: number;
    amount: number;
    currency: string;
    updated_at: string;
    updated_by: string;
  }> {
    checkAuth();
    const data = await http<{
      year: number;
      amount: number;
      currency: string;
      updated_at: string;
      updated_by: string;
    }>(`/budgets/all-in`, {
      method: "PUT",
      body: JSON.stringify({ year, amount, currency }),
    });
    return data;
  },

  /**
   * Get annual budget overview with cross-project totals
   */
  async getAllInBudgetOverview(year: number): Promise<{
    year: number;
    budgetAllIn: { amount: number; currency: string } | null;
    totals: {
      planned: number;
      forecast: number;
      actual: number;
      varianceBudgetVsForecast: number;
      varianceBudgetVsActual: number;
      percentBudgetConsumedActual: number | null;
      percentBudgetConsumedForecast: number | null;
    };
    byProject?: Array<{
      projectId: string;
      projectCode?: string;
      planned: number;
      forecast: number;
      actual: number;
    }>;
  } | null> {
    checkAuth();
    try {
      const data = await http<{
        year: number;
        budgetAllIn: { amount: number; currency: string } | null;
        totals: {
          planned: number;
          forecast: number;
          actual: number;
          varianceBudgetVsForecast: number;
          varianceBudgetVsActual: number;
          percentBudgetConsumedActual: number | null;
          percentBudgetConsumedForecast: number | null;
        };
        byProject?: Array<{
          projectId: string;
          projectCode?: string;
          planned: number;
          forecast: number;
          actual: number;
        }>;
      }>(`/budgets/all-in/overview?year=${year}`, {
        method: "GET",
      });
      return data;
    } catch (error) {
      if (isBudgetMissingError(error)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get monthly budget allocations for a specific year
   */
  async getAllInBudgetMonthly(year: number): Promise<{
    year: number;
    currency: string;
    months: Array<{ month: string; amount: number }>;
    updated_at?: string;
    updated_by?: string;
  } | null> {
    checkAuth();
    const path = `/budgets/all-in/monthly?year=${year}`;
    try {
      const data = await http<{
        year: number;
        currency: string;
        months: Array<{ month: string; amount: number }>;
        updated_at?: string;
        updated_by?: string;
      }>(path, {
        method: "GET",
      });
      return data;
    } catch (error) {
      if (isBudgetMissingError(error)) {
        return null;
      }
      logBudgetMonthlyFailure(path, error);
      throw error;
    }
  },

  /**
   * Set or update monthly budget allocations (PMO/ADMIN only)
   */
  async putAllInBudgetMonthly(
    year: number,
    currency: string,
    months: Array<{ month: string; amount: number }>
  ): Promise<{
    year: number;
    currency: string;
    months: Array<{ month: string; amount: number }>;
    updated_at: string;
    updated_by: string;
  }> {
    checkAuth();
    const path = `/budgets/all-in/monthly`;
    try {
      const data = await http<{
        year: number;
        currency: string;
        months: Array<{ month: string; amount: number }>;
        updated_at: string;
        updated_by: string;
      }>(path, {
        method: "PUT",
        body: JSON.stringify({ year, currency, months }),
      });
      return data;
    } catch (error) {
      logBudgetMonthlyFailure(path, error);
      throw error;
    }
  },

  /**
   * Get baseline summary for a project
   * Returns original baseline values (totals, FTEs, roles) and PDF link
   */
  async getBaselineSummary(projectId: string): Promise<{
    baselineId: string;
    total: number;
    totalLabor: number;
    totalNonLabor: number;
    ftes: number;
    rolesCount: number;
    signedBy: string | null;
    signedAt: string | null;
    contractValue: number;
    currency: string;
    doc: {
      objectKey: string | null;
      s3Url: string;
    } | null;
    baselinePayloadExists: boolean;
    error?: string;
    message?: string;
  }> {
    checkAuth();
    const data = await http<{
      baselineId: string;
      total: number;
      totalLabor: number;
      totalNonLabor: number;
      ftes: number;
      rolesCount: number;
      signedBy: string | null;
      signedAt: string | null;
      contractValue: number;
      currency: string;
      doc: {
        objectKey: string | null;
        s3Url: string;
      } | null;
      baselinePayloadExists: boolean;
      error?: string;
      message?: string;
    }>(`projects/${projectId}/baseline-summary`);
    return data;
  },

  /**
   * Run admin backfill to materialize baseline rubros
   * Requires admin privileges
   */
  async runBackfill(
    projectId: string,
    dryRun: boolean = true
  ): Promise<{
    success: boolean;
    dryRun: boolean;
    baselineId: string;
    result: {
      rubrosPlanned?: number;
      rubrosWritten?: number;
    };
    error?: string;
    message?: string;
  }> {
    checkAuth();
    const data = await http<{
      success: boolean;
      dryRun: boolean;
      baselineId: string;
      result: {
        rubrosPlanned?: number;
        rubrosWritten?: number;
      };
      error?: string;
      message?: string;
    }>(`admin/backfill`, {
      method: 'POST',
      body: JSON.stringify({ projectId, dryRun }),
    });
    return data;
  },

  /**
   * Get baseline details by ID
   * Returns full baseline with labor_estimates and non_labor_estimates
   */
  async getBaselineById(
    baselineId: string,
    options?: { signal?: AbortSignal }
  ): Promise<BaselineDetailResponse> {
    checkAuth();
    return await httpWithRetry<BaselineDetailResponse>(`/baselines/${baselineId}`, {
      method: 'GET',
      signal: options?.signal,
    });
  },

  /**
   * Get rubros for a specific baseline
   * Returns array of rubros materialized for the baseline
   */
  async getRubrosForBaseline(
    projectId: string,
    baselineId: string,
    options?: { signal?: AbortSignal }
  ): Promise<Array<{
    rubro_id: string;
    nombre: string;
    categoria?: string;
    tipo_ejecucion?: string;
    descripcion?: string;
    linea_codigo?: string;
    tipo_costo?: string;
  }>> {
    checkAuth();
    const result = await httpWithRetry<{ data: unknown[] } | unknown[]>(
      `/projects/${projectId}/baselines/${baselineId}/rubros`,
      {
        method: 'GET',
        signal: options?.signal,
      }
    );
    return normalizeListResponse(result);
  },

  /**
   * Get allocations for a specific baseline
   * Used as fallback when rubros are not materialized
   */
  async getAllocationsForBaseline(
    projectId: string,
    baselineId: string,
    options?: { signal?: AbortSignal }
  ): Promise<Array<{
    allocation_id: string;
    rubro_id: string;
    mes: string;
    monto_planeado: number;
    monto_forecast?: number;
    baseline_id?: string;
  }>> {
    checkAuth();
    const result = await httpWithRetry<{ data: unknown[] } | unknown[]>(
      `/projects/${projectId}/baselines/${baselineId}/allocations`,
      {
        method: 'GET',
        signal: options?.signal,
      }
    );
    return normalizeListResponse(result);
  },

  /**
   * Get prefacturas for a specific baseline
   * Used as fallback when rubros are not materialized
   */
  async getPrefacturasForBaseline(
    projectId: string,
    baselineId: string,
    options?: { signal?: AbortSignal }
  ): Promise<Array<{
    prefactura_id: string;
    rubro_id?: string;
    descripcion: string;
    monto: number;
    mes: string;
    tipo: string;
    baseline_id?: string;
  }>> {
    checkAuth();
    const result = await httpWithRetry<{ data: unknown[] } | unknown[]>(
      `/projects/${projectId}/baselines/${baselineId}/prefacturas`,
      {
        method: 'GET',
        signal: options?.signal,
      }
    );
    return normalizeListResponse(result);
  },
};

export default finanzasClient;
