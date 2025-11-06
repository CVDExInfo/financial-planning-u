import { RUBROS_CATALOG } from "./rubros.catalog";
import { RUBROS_TAXONOMIA } from "./rubros.taxonomia";

export interface RubroEnrichedItem {
  rubro_id: string;
  nombre: string;
  categoria: string;
  linea_codigo: string;
  tipo_costo: string;
  descripcion?: string;
}

// Enriquecer catálogo con taxonomía (join por rubro_id)
export const RUBROS_ENRICHED: RubroEnrichedItem[] = RUBROS_CATALOG.map(
  (base) => {
    const tax = RUBROS_TAXONOMIA.find((t) => t.rubro_id === base.rubro_id);
    return {
      rubro_id: base.rubro_id,
      nombre: base.nombre,
      descripcion: base.descripcion,
      categoria: tax?.categoria || "N/D",
      linea_codigo: tax?.linea_codigo || "N/D",
      tipo_costo: tax?.tipo_costo || "OPEX",
    };
  }
);

export default RUBROS_ENRICHED;
