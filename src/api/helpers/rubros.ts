/**
 * Canonical Rubros Taxonomy Helpers
 * 
 * This module provides the single source of truth for rubros taxonomy
 * used across PMO Estimator and SDMT modules. It ensures consistent
 * data lineage from Estimator → Baseline → Rubros → Forecast.
 * 
 * UPDATED: Now uses canonical taxonomy from @/lib/rubros/canonical-taxonomy
 */

import {
  CANONICAL_RUBROS_TAXONOMY,
  getCanonicalRubroId,
  isValidRubroId as validateRubroId,
  type CanonicalRubroTaxonomy,
} from '@/lib/rubros/canonical-taxonomy';
import { MOD_ROLE_MAPPING, MOD_ROLES, type RubroTaxonomia } from '@/modules/rubros.taxonomia';
import type { MODRole } from '@/modules/modRoles';

// Re-export MODRole type for convenience
export type { MODRole };

/**
 * Extended metadata for a rubro that includes both catalog and taxonomy info
 */
export interface RubroMeta {
  /** Canonical rubro ID / linea_codigo used in SDMT (e.g., "MOD-ING", "GSV-REU") */
  id: string;
  /** User-friendly label for display */
  label: string;
  /** Type of rubro: labor (MOD) or non-labor (all others) */
  type: 'labor' | 'non-labor';
  /** Category code (e.g., "MOD", "GSV", "SOI") */
  category?: string;
  /** Category name (e.g., "Mano de Obra Directa") */
  categoryName?: string;
  /** Expense line description */
  description?: string;
  /** Execution type: monthly recurring or one-time */
  executionType?: 'mensual' | 'puntual/hito';
  /** Cost type: OPEX or CAPEX */
  costType?: 'OPEX' | 'CAPEX';
  /** Country (for labor rubros only) */
  country?: string;
  /** Seniority level (for labor rubros only) */
  level?: string;
}

/**
 * Mapping from MOD roles to their corresponding linea_codigo in taxonomy
 */
const MOD_ROLE_TO_LINEA_CODIGO: Record<MODRole, string> = {
  'Ingeniero Delivery': 'MOD-LEAD',
  'Ingeniero Soporte N1': 'MOD-ING',
  'Ingeniero Soporte N2': 'MOD-ING',
  'Ingeniero Soporte N3': 'MOD-ING',
  'Service Delivery Manager': 'MOD-SDM',
  'Project Manager': 'MOD-PM',
};

/**
 * Get all rubros from the canonical taxonomy
 * 
 * @returns Promise resolving to array of all rubros with enriched metadata
 */
export async function fetchRubrosCatalog(): Promise<RubroMeta[]> {
  // Use canonical taxonomy as single source of truth
  return Promise.resolve(
    CANONICAL_RUBROS_TAXONOMY.map((taxonomy) => ({
      id: taxonomy.id, // Canonical ID (linea_codigo)
      label: taxonomy.linea_gasto,
      type: taxonomy.categoria_codigo === 'MOD' ? 'labor' : 'non-labor',
      category: taxonomy.categoria_codigo,
      categoryName: taxonomy.categoria,
      description: taxonomy.descripcion,
      executionType: taxonomy.tipo_ejecucion,
      costType: taxonomy.tipo_costo,
    }))
  );
}

/**
 * Get only labor rubros (MOD - Mano de Obra Directa)
 * 
 * @returns Promise resolving to array of labor rubros
 */
export async function fetchLaborRubros(): Promise<RubroMeta[]> {
  const allRubros = await fetchRubrosCatalog();
  return allRubros.filter((r) => r.type === 'labor');
}

/**
 * Get only non-labor rubros (all categories except MOD)
 * 
 * @returns Promise resolving to array of non-labor rubros
 */
export async function fetchNonLaborRubros(): Promise<RubroMeta[]> {
  const allRubros = await fetchRubrosCatalog();
  return allRubros.filter((r) => r.type === 'non-labor');
}

/**
 * Map a MOD role name to its canonical linea_codigo
 * 
 * @param role - MOD role name (e.g., "Ingeniero Delivery")
 * @returns Canonical linea_codigo (e.g., "MOD-LEAD") or undefined if not found
 */
/**
 * Default rubro codes for fallback scenarios
 * GSV-REU is used as default for non-labor since it's a common service management category
 */
export const DEFAULT_LABOR_RUBRO = "MOD-ING";
export const DEFAULT_NON_LABOR_RUBRO = "GSV-REU";

export function mapModRoleToRubroId(role: MODRole): string | undefined {
  return MOD_ROLE_TO_LINEA_CODIGO[role];
}

/**
 * Map a linea_codigo back to MOD role(s)
 * 
 * @param lineaCodigo - Canonical linea_codigo (e.g., "MOD-ING")
 * @returns Array of MOD roles that map to this linea_codigo
 */
export function mapRubroIdToModRoles(lineaCodigo: string): MODRole[] {
  const roles = MOD_ROLE_MAPPING[lineaCodigo];
  if (!roles) return [];
  return Array.isArray(roles) ? roles : [roles];
}

/**
 * Get a specific rubro by its linea_codigo (supports legacy IDs)
 * 
 * @param lineaCodigo - Canonical linea_codigo or legacy ID
 * @returns RubroMeta or undefined if not found
 */
export async function getRubroByCode(lineaCodigo: string): Promise<RubroMeta | undefined> {
  // Normalize to canonical ID first
  const canonicalId = getCanonicalRubroId(lineaCodigo);
  const allRubros = await fetchRubrosCatalog();
  return allRubros.find((r) => r.id === canonicalId);
}

/**
 * Get rubros grouped by category
 * 
 * @returns Promise resolving to map of category code to rubros
 */
export async function getRubrosByCategory(): Promise<Map<string, RubroMeta[]>> {
  const allRubros = await fetchRubrosCatalog();
  const grouped = new Map<string, RubroMeta[]>();
  
  for (const rubro of allRubros) {
    const category = rubro.category || '_undefined_';
    const existing = grouped.get(category) || [];
    existing.push(rubro);
    grouped.set(category, existing);
  }
  
  return grouped;
}

/**
 * Validate if a rubroId exists in the canonical taxonomy
 * 
 * @param rubroId - Rubro ID to validate (canonical or legacy)
 * @returns true if valid, false otherwise
 */
export function isValidRubroId(rubroId: string): boolean {
  return validateRubroId(rubroId);
}

/**
 * Get all available MOD roles for labor estimation
 * 
 * @returns Array of MOD role names
 */
export function getModRoles(): readonly MODRole[] {
  return MOD_ROLES;
}

// ============================================================================
// API Helper Functions for Project Rubros
// ============================================================================

export type AttachRubroInput = {
  rubroId?: string;
  rubroIds?: string[];
  qty: number;
  unitCost: number;
  type: string;
  duration: string;
  [key: string]: unknown;
};

export type AttachRubroOptions = {
  apiBase: string;
  headers?: HeadersInit;
  fetchImpl?: typeof fetch;
};

export type DetachRubroOptions = AttachRubroOptions;

export function buildRubroPayload(input: AttachRubroInput) {
  const derivedIds = Array.isArray(input.rubroIds)
    ? input.rubroIds
    : input.rubroId
    ? [input.rubroId]
    : [];

  if (!derivedIds.length) {
    throw new Error("rubroId is required to attach line items");
  }

  return {
    rubroIds: derivedIds.map((id) => ({
      rubroId: id,
      qty: input.qty,
      unitCost: input.unitCost,
      type: input.type,
      duration: input.duration,
    })),
    qty: input.qty,
    unitCost: input.unitCost,
    type: input.type,
    duration: input.duration,
  };
}

export async function postProjectRubros<T = Record<string, unknown>>(
  projectId: string,
  payload: AttachRubroInput,
  options: AttachRubroOptions,
): Promise<T> {
  const body = JSON.stringify(buildRubroPayload(payload));
  const fetcher = options.fetchImpl ?? fetch;
  const headers = options.headers ?? { "Content-Type": "application/json" };

  const primary = `${options.apiBase}/projects/${encodeURIComponent(
    projectId,
  )}/rubros`;
  let res = await fetcher(primary, {
    method: "POST",
    headers,
    body,
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${options.apiBase}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros`;
    res = await fetcher(fallback, { method: "POST", headers, body });
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
  options: DetachRubroOptions,
): Promise<void> {
  const fetcher = options.fetchImpl ?? fetch;
  const headers = options.headers ?? { "Content-Type": "application/json" };

  const primary = `${options.apiBase}/projects/${encodeURIComponent(
    projectId,
  )}/rubros/${encodeURIComponent(rubroId)}`;
  let res = await fetcher(primary, {
    method: "DELETE",
    headers,
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${options.apiBase}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros/${encodeURIComponent(rubroId)}`;
    res = await fetcher(fallback, { method: "DELETE", headers });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`deleteProjectRubro failed (${res.status}): ${bodyText}`);
  }
}
