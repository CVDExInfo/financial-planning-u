import { type Json } from "@/api/finanzas-projects-helpers";
import { type ProjectForUI } from "./useProjects";

const safeString = (value: unknown, fallback = "") =>
  (value ? String(value) : fallback).trim();

/**
 * Normalize canonical ProjectDTO from backend to ProjectForUI
 * 
 * The backend now returns canonical English-only fields (ProjectDTO).
 * This mapper ensures the UI receives the data in the expected format.
 */
export function normalizeProjectForUI(raw: Json): ProjectForUI {
  // Backend now returns canonical fields: projectId, code, name, client, etc.
  // These are all in English and camelCase
  
  return {
    id: safeString((raw as any)?.projectId || (raw as any)?.id || ""),
    code: safeString((raw as any)?.code || ""),
    name: safeString((raw as any)?.name || ""),
    client: safeString((raw as any)?.client || ""),
    start_date: safeString((raw as any)?.startDate || "") || undefined,
    end_date: safeString((raw as any)?.endDate || "") || undefined,
    mod_total: Number((raw as any)?.modTotal ?? 0) || 0,
    currency: safeString((raw as any)?.currency || "USD"),
    status: safeString((raw as any)?.status || "active"),
    baseline_id: safeString((raw as any)?.baselineId || "") || undefined,
    baseline_status: safeString((raw as any)?.baselineStatus || "") || null,
    accepted_by: safeString((raw as any)?.sdmManagerEmail || "") || null,
    baseline_accepted_at: safeString((raw as any)?.baselineAcceptedAt || "") || null,
    rejected_by: null, // Not in canonical schema yet
    baseline_rejected_at: null, // Not in canonical schema yet
    rejection_comment: null, // Not in canonical schema yet
    updated_at: safeString((raw as any)?.updatedAt || "") || undefined,
    created_at: safeString((raw as any)?.createdAt || "") || undefined,
  } as ProjectForUI;
}
