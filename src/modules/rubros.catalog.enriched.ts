// AUTO-GENERATED helper — merge Catálogo de Rubros (items) with Taxonomía (clasificación)
// Drop next to `rubros.catalog.ts` and `rubros.taxonomia.ts`
// If your paths differ, adjust the import paths below.

import type { Rubro } from "./rubros.catalog.ts";
import { RUBROS } from "./rubros.catalog.ts";
import type { RubroTaxonomia } from "./rubros.taxonomia.ts";
import { CATALOGO_RUBROS, byLineaCodigo } from "./rubros.taxonomia.ts";

export type RubroEnriched = Rubro & {
  // Taxonomy link (optional until client finalizes mapping)
  linea_codigo?: string | null;
  categoria_codigo?: string | null;
  categoria?: string | null;
  linea_gasto?: string | null;
  tipo_ejecucion?: "mensual" | "puntual/hito" | null;
  tipo_costo?: "OPEX" | "CAPEX" | null;
  fuente_referencia?: string | null;
};

/**
 * Heuristics to resolve linea_codigo for a Rubro:
 *  1) If rubro.metadata?.linea_codigo exists, use it.
 *  2) Else, if rubro.rubro_id matches a linea_codigo from taxonomy, use it.
 *  3) Else, return null taxonomy (can be filled once client delivers mapping).
 */
type RubroMetadata = {
  metadata?: {
    linea_codigo?: string | null;
  } | null;
};

// Deterministic mapping from rubro_id → taxonomy entry (same ordering as the
// source spreadsheets). This ensures legacy IDs like RB0001 are tied to
// CATALOGO_RUBROS even when no metadata is attached in Dynamo.
const taxonomyByRubroId = new Map<string, RubroTaxonomia>();
RUBROS.forEach((rubro, idx) => {
  const taxonomy = CATALOGO_RUBROS[idx];
  if (taxonomy) {
    taxonomyByRubroId.set(rubro.rubro_id, taxonomy);
  }
});

function resolveLineaCodigo(rubro: Rubro): string | null {
  const metaLine = (rubro as RubroMetadata)?.metadata?.linea_codigo;
  if (typeof metaLine === "string" && metaLine.trim()) return metaLine.trim();
  const mapped = taxonomyByRubroId.get(rubro.rubro_id)?.linea_codigo;
  if (mapped) return mapped;
  if (byLineaCodigo.has(rubro.rubro_id)) return rubro.rubro_id;
  return null;
}

export function enrichRubro(rubro: Rubro): RubroEnriched {
  const linea = resolveLineaCodigo(rubro);
  const tx: RubroTaxonomia | undefined = linea
    ? byLineaCodigo.get(linea)
    : taxonomyByRubroId.get(rubro.rubro_id) ?? undefined;
  return {
    ...rubro,
    linea_codigo: tx?.linea_codigo ?? null,
    categoria_codigo: tx?.categoria_codigo ?? null,
    categoria: tx?.categoria ?? null,
    linea_gasto: tx?.linea_gasto ?? null,
    tipo_ejecucion:
      (tx?.tipo_ejecucion as RubroEnriched["tipo_ejecucion"]) ?? null,
    tipo_costo: (tx?.tipo_costo as RubroEnriched["tipo_costo"]) ?? null,
    fuente_referencia: tx?.fuente_referencia ?? null,
  };
}

export const RUBROS_ENRICHED: RubroEnriched[] = RUBROS.map(enrichRubro);

/** Index by rubro_id for convenience */
export const byRubroId = new Map(RUBROS_ENRICHED.map((r) => [r.rubro_id, r]));

/** Index taxonomy by rubro_id for reuse outside this module */
export { taxonomyByRubroId };

/** Index rubros grouped by categoria_codigo */
export const byCategoriaCodigo = new Map<string, RubroEnriched[]>(
  RUBROS_ENRICHED.reduce((acc, r) => {
    const k = r.categoria_codigo ?? "_undefined_";
    const arr = acc.get(k) || [];
    arr.push(r);
    acc.set(k, arr);
    return acc;
  }, new Map<string, RubroEnriched[]>())
);
