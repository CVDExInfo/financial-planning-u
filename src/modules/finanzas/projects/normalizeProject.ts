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
    sd_manager_name:
      safeString(
        (raw as any)?.sd_manager_name ||
          (raw as any)?.sdManagerName ||
          (raw as any)?.sdm_manager_name ||
          (raw as any)?.sdmManagerName ||
          "",
      ) || null,
    sdm_manager_email:
      safeString(
        (raw as any)?.sdm_manager_email ||
          (raw as any)?.sdmManagerEmail ||
          "",
      ) || null,
    baseline_id:
      safeString(
        (raw as any)?.baselineId || (raw as any)?.baseline_id || "",
      ) || undefined,
    baseline_status:
      safeString(
        (raw as any)?.baselineStatus || (raw as any)?.baseline_status || "",
      ) || null,
    accepted_by:
      safeString((raw as any)?.accepted_by || (raw as any)?.acceptedBy || "") ||
      null,
    baseline_accepted_at:
      safeString(
        (raw as any)?.baselineAcceptedAt ||
          (raw as any)?.baseline_accepted_at ||
          "",
      ) || null,
    rejected_by:
      safeString((raw as any)?.rejected_by || (raw as any)?.rejectedBy || "") ||
      null,
    baseline_rejected_at:
      safeString(
        (raw as any)?.baseline_rejected_at || (raw as any)?.baselineRejectedAt || "",
      ) || null,
    rejection_comment:
      safeString(
        (raw as any)?.rejection_comment || (raw as any)?.rejectionComment || "",
      ) || null,
    updated_at: safeString((raw as any)?.updatedAt || "") || undefined,
    created_at: safeString((raw as any)?.createdAt || "") || undefined,
  } as ProjectForUI;
}
