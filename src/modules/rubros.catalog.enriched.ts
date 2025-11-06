// AUTO-GENERATED helper — merge Catálogo de Rubros (items) with Taxonomía (clasificación)
// Drop next to `rubros.catalog.ts` and `rubros.taxonomia.ts`
// If your paths differ, adjust the import paths below.

import type { Rubro } from './rubros.catalog';
import { RUBROS } from './rubros.catalog';
import type { RubroTaxonomia } from './rubros.taxonomia';
import { CATALOGO_RUBROS, byLineaCodigo } from './rubros.taxonomia';

export type RubroEnriched = Rubro & {
  // Taxonomy link (optional until client finalizes mapping)
  linea_codigo?: string | null;
  categoria_codigo?: string | null;
  categoria?: string | null;
  linea_gasto?: string | null;
  tipo_ejecucion?: 'mensual' | 'puntual/hito' | null;
  tipo_costo?: 'OPEX' | 'CAPEX' | null;
  fuente_referencia?: string | null;
};

/**
 * Heuristics to resolve linea_codigo for a Rubro:
 *  1) If rubro.metadata?.linea_codigo exists, use it.
 *  2) Else, if rubro.rubro_id matches a linea_codigo from taxonomy, use it.
 *  3) Else, return null taxonomy (can be filled once client delivers mapping).
 */
function resolveLineaCodigo(rubro: Rubro): string | null {
  const metaLine = (rubro as any)?.metadata?.linea_codigo;
  if (typeof metaLine === 'string' && metaLine.trim()) return metaLine.trim();
  if (byLineaCodigo.has(rubro.rubro_id)) return rubro.rubro_id;
  return null;
}

export function enrichRubro(rubro: Rubro): RubroEnriched {
  const linea = resolveLineaCodigo(rubro);
  const tx: RubroTaxonomia | undefined = linea ? byLineaCodigo.get(linea) : undefined;
  return {
    ...rubro,
    linea_codigo: tx?.linea_codigo ?? null,
    categoria_codigo: tx?.categoria_codigo ?? null,
    categoria: tx?.categoria ?? null,
    linea_gasto: tx?.linea_gasto ?? null,
    tipo_ejecucion: (tx?.tipo_ejecucion as RubroEnriched['tipo_ejecucion']) ?? null,
    tipo_costo: (tx?.tipo_costo as RubroEnriched['tipo_costo']) ?? null,
    fuente_referencia: tx?.fuente_referencia ?? null,
  };
}

export const RUBROS_ENRICHED: RubroEnriched[] = RUBROS.map(enrichRubro);

/** Index by rubro_id for convenience */
export const byRubroId = new Map(RUBROS_ENRICHED.map(r => [r.rubro_id, r]));

/** Index rubros grouped by categoria_codigo */
export const byCategoriaCodigo = new Map<string, RubroEnriched[]>(
  RUBROS_ENRICHED.reduce((acc, r) => {
    const k = r.categoria_codigo ?? '_undefined_';
    const arr = acc.get(k) || [];
    arr.push(r);
    acc.set(k, arr);
    return acc;
  }, new Map<string, RubroEnriched[]>())
);
