import { z } from "zod";
import { HAS_API_BASE } from "@/config/env";
import { buildAuthHeader, handleAuthErrorStatus } from "@/config/api";
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
// Schema aligned with /catalog/rubros API response
export const RubroSchema = z.object({
  rubro_id: z.string(),
  nombre: z.string(),
  categoria: z.string().optional(),
  tipo_ejecucion: z.string().optional(),
  descripcion: z.string().optional(),
  linea_codigo: z.string().optional(), // Accounting line or cost center code
  tipo_costo: z.string().optional(), // Cost type (OPEX, CAPEX, etc.)
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
    const headers = { ...(init?.headers || {}), ...buildAuthHeader() };

    const response = await (async () => {
      switch (method) {
        case "POST":
          return httpClient.post<T>(path, parsedBody, { headers });
        case "PUT":
          return httpClient.put<T>(path, parsedBody, { headers });
        case "PATCH":
          return httpClient.patch<T>(path, parsedBody, { headers });
        case "DELETE":
          return httpClient.delete<T>(path, { headers });
        default:
          return httpClient.get<T>(path, { headers });
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

// Project schemas
export const ProjectCreateSchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().regex(/^PROJ-\d{4}-\d{3}$/),
  client: z.string().min(2).max(200),
  start_date: z.string(),
  end_date: z.string(),
  currency: z.enum(["USD", "EUR", "MXN"]),
  mod_total: z.number().min(0),
  description: z.string().max(1000).optional(),
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectSchema = ProjectCreateSchema.extend({
  id: z.string(),
  status: z.enum(["active", "completed", "on_hold", "cancelled"]),
  created_at: z.string(),
  updated_at: z.string(),
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
  return !!(
    localStorage.getItem("finz_access_token") ||
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
    localStorage.getItem("idToken") ||
    localStorage.getItem("cognitoIdToken") ||
    STATIC_TEST_TOKEN
  );
}

function checkAuth(): void {
  if (!isJwtPresent()) {
    throw new Error("You must be signed in to perform this action. Please log in with your Finance credentials.");
  }
}

export const finanzasClient = {
  async health(): Promise<
    { ok: boolean; stage?: string; time?: string } | undefined
  > {
    return http("/health");
  },

  async getRubros(): Promise<Rubro[]> {
    const payload = await http<unknown>("/catalog/rubros");
    const list = normalizeDataArray(payload);
    const parsed = z.array(RubroSchema).safeParse(list);

    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid rubros response");
    }

    return parsed.data;
  },

  async getAllocationRules(): Promise<AllocationRule[]> {
    const payload = await http<unknown>("/allocation-rules");
    const list = normalizeDataArray(payload);
    const parsed = z.array(AllocationRuleSchema).safeParse(list);

    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid allocation rules response");
    }

    return parsed.data;
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

  async createProvider(payload: ProviderCreate): Promise<unknown> {
    checkAuth();
    const data = await http<unknown>("/providers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data;
  },
};

export default finanzasClient;
