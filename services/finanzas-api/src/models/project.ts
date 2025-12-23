/**
 * Canonical Project Data Model
 * 
 * This module defines the canonical Project schema and provides mappers
 * to transform raw DynamoDB records (with mixed Spanish/English fields)
 * into a consistent, English-only representation.
 * 
 * Key Goals:
 * - Normalize Spanish/English field duplicates
 * - Extract SDM identity for ABAC
 * - Maintain backward compatibility
 */

/**
 * Raw project record as stored in DynamoDB
 * Contains mixed Spanish/English fields for backward compatibility
 */
export interface ProjectRecord {
  pk: string;
  sk: string;
  
  // Identity (multiple variants for backward compatibility)
  id?: string;
  project_id?: string;
  projectId?: string;
  
  // Core fields (English)
  code?: string;
  name?: string;
  client?: string;
  description?: string;
  status?: string;
  currency?: string;
  mod_total?: number;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  
  // Core fields (Spanish)
  codigo?: string;
  nombre?: string;
  cliente?: string;
  descripcion?: string;
  estado?: string;
  moneda?: string;
  presupuesto_total?: number;
  totalBudget?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  
  // SDM/PM fields
  sdm_manager_email?: string;
  sdm_manager_name?: string;
  sd_manager_name?: string;
  pm_lead_email?: string;
  accepted_by?: string;
  acceptedBy?: string;
  aceptado_por?: string;
  
  // Baseline fields
  baseline_id?: string;
  baselineId?: string;
  baseline_status?: string;
  baselineStatus?: string;
  baseline_accepted_at?: string;
  baselineAcceptedAt?: string;
  
  // Additional metadata
  module?: string;
  source?: string;
  owner?: string;
  
  // Allow additional fields
  [key: string]: unknown;
}

/**
 * Canonical Project DTO (Data Transfer Object)
 * This is the ONLY representation exposed by the API and consumed by the frontend
 */
export interface ProjectDTO {
  projectId: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: string;
  currency: string;
  modTotal: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  
  // ABAC critical fields
  sdmManagerEmail?: string;
  sdmManagerName?: string;
  pmLeadEmail?: string;
  
  // Baseline tracking
  baselineId?: string;
  baselineStatus?: string;
  baselineAcceptedAt?: string;
  accepted_by?: string;
  rejected_by?: string;
  baseline_rejected_at?: string;
  rejection_comment?: string;
  rubros_count?: number;
  labor_cost?: number;
  non_labor_cost?: number;
  
  // Additional metadata
  module?: string;
  source?: string;
}

/**
 * Helper to extract first non-null/empty string from multiple field variants
 */
function firstNonEmpty(...values: Array<unknown>): string | undefined {
  for (const val of values) {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

/**
 * Helper to extract first valid number from multiple field variants
 */
function firstNumber(...values: Array<unknown>): number {
  for (const val of values) {
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 0) {
      return num;
    }
  }
  return 0;
}

/**
 * Helper to extract first valid date from multiple field variants
 */
function firstDate(...values: Array<unknown>): string | undefined {
  for (const val of values) {
    if (typeof val === "string" && val.trim().length > 0) {
      const date = new Date(val);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return undefined;
}

/**
 * Extract SDM manager email from various source fields
 * 
 * Priority:
 * 1. Explicit sdm_manager_email
 * 2. accepted_by / acceptedBy / aceptado_por (if looks like SDM)
 * 
 * Heuristic: If email contains "sdm", "manager", or domain patterns,
 * prefer it as SDM. Otherwise, it might be PM.
 */
function extractSDMEmail(record: ProjectRecord): string | undefined {
  // Priority 1: explicit SDM field
  const explicit = firstNonEmpty(record.sdm_manager_email);
  if (explicit) return explicit;
  
  // Priority 2: accepted_by variants
  const acceptedBy = firstNonEmpty(
    record.accepted_by,
    record.acceptedBy,
    record.aceptado_por
  );
  
  if (acceptedBy) {
    // Simple heuristic: if email contains "sdm" or "sd.", likely SDM
    const lower = acceptedBy.toLowerCase();
    if (lower.includes("sdm") || lower.includes("sd.")) {
      return acceptedBy;
    }
    // For now, accept any accepted_by as potential SDM
    // A more sophisticated approach would require additional context
    return acceptedBy;
  }
  
  return undefined;
}

/**
 * Extract PM lead email from various source fields
 */
function extractPMEmail(record: ProjectRecord): string | undefined {
  const explicit = firstNonEmpty(record.pm_lead_email);
  if (explicit) return explicit;
  
  // Could add more sophisticated extraction from accepted_by if needed
  // For now, only use explicit pm_lead_email
  return undefined;
}

/**
 * Generate a short, human-friendly project code from projectId.
 *
 * Notes on baseline handoff safety:
 * - This helper ONLY derives a display code; it does not influence the
 *   persisted projectId or any handoff collision safeguards.
 * - When a long/UUID-style projectId is encountered (e.g., when a new
 *   projectId is minted to avoid a baseline collision), we derive a short
 *   code from the baselineId or projectId to keep the UI readable without
 *   affecting the stored identifiers.
 */
function generateProjectCode(projectId: string, baselineId?: string): string {
  const MAX_CLEAN_CODE_LENGTH = 20;
  const CODE_SUFFIX_LENGTH = 8;
  
  // Check if projectId is a long UUID format
  const isLongUuid = /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  
  if (projectId.length > MAX_CLEAN_CODE_LENGTH || isLongUuid) {
    // Try to extract short code from baselineId
    if (baselineId) {
      const baselineIdShort = baselineId
        .replace(/^base_/, '')
        .substring(0, CODE_SUFFIX_LENGTH);
      return `P-${baselineIdShort}`;
    }
    
    // Fallback: use first 8 chars of projectId UUID (after P-)
    const uuidPart = projectId.replace(/^P-/, '').replace(/-/g, '');
    return `P-${uuidPart.substring(0, CODE_SUFFIX_LENGTH)}`;
  }
  
  // Short projectId - keep as-is
  return projectId;
}

/**
 * Map raw DynamoDB ProjectRecord to canonical ProjectDTO
 * 
 * This is the SINGLE SOURCE OF TRUTH for project data transformation.
 * All API responses should use this mapper to ensure consistency.
 */
export function mapToProjectDTO(record: ProjectRecord): ProjectDTO {
  // Extract projectId from various sources
  let projectId = firstNonEmpty(
    record.project_id,
    record.projectId,
    record.id
  );
  
  // If no explicit ID, try extracting from pk
  if (!projectId && typeof record.pk === "string" && record.pk.startsWith("PROJECT#")) {
    projectId = record.pk.replace("PROJECT#", "");
  }
  
  if (!projectId) {
    // Fallback to pk/sk combination if nothing else works
    projectId = String(record.pk ?? record.sk ?? "UNKNOWN-PROJECT");
  }
  
  // Extract baseline ID
  const baselineId = firstNonEmpty(record.baseline_id, record.baselineId);
  
  // Extract or generate code
  const existingCode = firstNonEmpty(record.code, record.codigo);
  const code = existingCode || generateProjectCode(projectId, baselineId);
  
  // Map all canonical fields
  const dto: ProjectDTO = {
    projectId,
    code,
    name: firstNonEmpty(record.name, record.nombre) || "Unnamed Project",
    client: firstNonEmpty(record.client, record.cliente) || "",
    description: firstNonEmpty(record.description, record.descripcion) || "",
    status: firstNonEmpty(record.status, record.estado) || "active",
    currency: firstNonEmpty(record.currency, record.moneda) || "USD",
    modTotal: firstNumber(
      record.mod_total,
      record.presupuesto_total,
      record.totalBudget
    ),
    startDate: firstDate(
      record.start_date,
      record.fecha_inicio
    ) || new Date().toISOString(),
    endDate: firstDate(
      record.end_date,
      record.fecha_fin
    ) || new Date().toISOString(),
    createdAt: firstDate(record.created_at) || new Date().toISOString(),
    updatedAt: firstDate(record.updated_at) || new Date().toISOString(),
    createdBy: firstNonEmpty(record.created_by),
    
    // ABAC fields
    sdmManagerEmail: extractSDMEmail(record),
    sdmManagerName: firstNonEmpty(record.sdm_manager_name, record.sd_manager_name),
    pmLeadEmail: extractPMEmail(record),
    
    // Baseline tracking
    baselineId,
    baselineStatus: firstNonEmpty(record.baseline_status, record.baselineStatus),
    baselineAcceptedAt: firstDate(
      record.baseline_accepted_at,
      record.baselineAcceptedAt
    ),
    accepted_by: firstNonEmpty(record.accepted_by, record.acceptedBy, record.aceptado_por),
    rejected_by: firstNonEmpty(record.rejected_by, record.rejectedBy, record.rechazado_por),
    baseline_rejected_at: firstDate(record.baseline_rejected_at, record.baselineRejectedAt),
    rejection_comment: firstNonEmpty(record.rejection_comment, record.rejectionComment, record.comentario_rechazo),
    rubros_count: firstNumber(record.rubros_count, record.rubrosCount, record.line_items_count),
    labor_cost: firstNumber(record.labor_cost, record.laborCost, record.costo_mod),
    non_labor_cost: firstNumber(record.non_labor_cost, record.nonLaborCost, record.costo_indirectos),
    
    // Additional metadata
    module: firstNonEmpty(record.module),
    source: firstNonEmpty(record.source),
  };
  
  return dto;
}

/**
 * Validate that a ProjectDTO has all required fields
 */
export function validateProjectDTO(dto: ProjectDTO): string[] {
  const errors: string[] = [];
  
  if (!dto.projectId) errors.push("projectId is required");
  if (!dto.code) errors.push("code is required");
  if (!dto.name) errors.push("name is required");
  if (!dto.currency) errors.push("currency is required");
  if (!dto.startDate) errors.push("startDate is required");
  if (!dto.endDate) errors.push("endDate is required");
  
  return errors;
}
