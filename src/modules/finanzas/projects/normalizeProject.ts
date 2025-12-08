import { getProjectDisplay } from "@/lib/projects/display";
import { type Json } from "@/api/finanzas-projects-helpers";
import { type ProjectForUI } from "./useProjects";

const safeString = (value: unknown, fallback = "") =>
  (value ? String(value) : fallback).trim();

export function normalizeProjectForUI(raw: Json): ProjectForUI {
  const display = getProjectDisplay(raw as any);
  const updatedAt = safeString(
    raw.updated_at || (raw as any)?.updatedAt || (raw as any)?.last_updated || "",
  );
  const createdAt = safeString(
    raw.created_at || (raw as any)?.createdAt || (raw as any)?.dateCreated || "",
  );

  return {
    id: display.id,
    code: display.code,
    name: display.name,
    client: display.client || "",
    start_date: safeString(raw.start_date || (raw as any)?.fecha_inicio || "") || undefined,
    end_date: safeString(raw.end_date || (raw as any)?.fecha_fin || "") || undefined,
    mod_total: Number(raw.mod_total ?? (raw as any)?.presupuesto_total ?? 0) || 0,
    currency: safeString(raw.currency || (raw as any)?.moneda || "USD"),
    status: safeString(raw.status || (raw as any)?.estado || "Activo"),
    baseline_id: safeString(raw.baseline_id || (raw as any)?.baselineId || "") || undefined,
    baseline_status:
      safeString(raw.baseline_status || (raw as any)?.baselineStatus || "") || null,
    accepted_by:
      safeString((raw as any)?.accepted_by || (raw as any)?.aceptado_por || "") || null,
    baseline_accepted_at:
      safeString(
        (raw as any)?.baseline_accepted_at || (raw as any)?.baselineAcceptedAt || "",
      ) || null,
    updated_at: updatedAt || undefined,
    created_at: createdAt || undefined,
  } as ProjectForUI;
}
