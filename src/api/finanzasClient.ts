import { z } from "zod";

// Env config
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

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
  metadata: z.record(z.any()).optional(),
});

export const RubroListSchema = z.object({
  data: z.array(RubroSchema),
  total: z.number().optional(),
});

export type Rubro = z.infer<typeof RubroSchema>;

function getAuthHeader(): Record<string, string> {
  // If you later store a JWT in localStorage/session, add it here.
  const token = localStorage.getItem("finz_jwt");
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
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  // @ts-expect-error - allow unknown return for non-json
  return undefined;
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
};

export default finanzasClient;
