import { z } from "zod";

// Env config
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
// Optional: Dev/test mode token (set at build time via VITE_API_JWT_TOKEN)
// For production, tokens are obtained via OAuth
const STATIC_TEST_TOKEN = import.meta.env.VITE_API_JWT_TOKEN || "";

if (!BASE) {
  // Non-fatal in dev; API client will throw on call
  console.warn(
    "VITE_API_BASE_URL is not set. Finanzas API client is disabled."
  );
} else if (import.meta.env.DEV) {
  // Debug logging for dev mode only
  console.log("[Finz] finanzasClient initialized with BASE:", BASE);
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

function getAuthHeader(): Record<string, string> {
  // Priority: 1) Unified cv.jwt, 2) Legacy finz_jwt, 3) Static test token from env (for dev/CI)
  const token =
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
    STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("Finanzas API base URL is not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...getAuthHeader(),
    },
    credentials: "omit",
    mode: "cors",
  });
  if (!res.ok) {
    // Special handling for 501 Not Implemented
    if (res.status === 501) {
      throw new Error("This feature is not yet implemented on the server (501). The backend handler needs to be completed.");
    }
    
    // Special handling for 401/403 authorization errors
    if (res.status === 401) {
      throw new Error("You must be signed in to perform this action. Please log in with your Finance credentials.");
    }
    if (res.status === 403) {
      throw new Error("You must be signed in and have the Finance role to perform this action. Please check your permissions.");
    }
    
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  
  // Content-Type safety: Guard against HTML responses
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    // Check if response looks like HTML (common when API base URL is wrong or returns login page)
    const isHTML = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html");
    if (isHTML) {
      throw new Error(
        `API returned HTML (likely login page or wrong endpoint) instead of JSON. ` +
        `Check VITE_API_BASE_URL configuration. Content-Type: ${ct || "(none)"}`
      );
    }
    throw new Error(
      `Expected JSON, got ${ct || "(none)"}. First bytes: ${text.slice(0, 80)}`
    );
  }
  
  return res.json();
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

function isJwtPresent(): boolean {
  return !!(
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
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
    const data = await http<{ data: unknown }>("/catalog/rubros");
    const parsed = RubroListSchema.safeParse(data);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid rubros response");
    }
    return parsed.data.data;
  },

  async getAllocationRules(): Promise<AllocationRule[]> {
    const data = await http<{ data: unknown }>("/allocation-rules");
    const parsed = AllocationRuleListSchema.safeParse(data);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error("Invalid allocation rules response");
    }
    return parsed.data.data;
  },

  // Write operations
  async createProject(payload: ProjectCreate): Promise<Project> {
    checkAuth();
    const data = await http<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data;
  },

  async createProjectRubro(projectId: string, payload: RubroCreate): Promise<Rubro> {
    checkAuth();
    const data = await http<Rubro>(`/projects/${projectId}/rubros`, {
      method: "POST",
      body: JSON.stringify(payload),
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
