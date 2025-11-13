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
}

// Schemas
export const RubroSchema = z.object({
  id: z.string().optional(),
  rubro_id: z.string().optional(),
  code: z.string().optional(),
  nombre: z.string(),
  categoria: z.string().optional(),
  tipo_ejecucion: z.string().optional(),
  descripcion: z.string().optional(),
  centro: z.string().optional(),
  regla: z.string().optional(),
  linea_codigo: z.string().optional(), // Accounting line or cost center code
  tipo_costo: z.string().optional(), // Cost type (OPEX, CAPEX, etc.)
  metadata: z.record(z.any()).optional(),
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
};

export default finanzasClient;
