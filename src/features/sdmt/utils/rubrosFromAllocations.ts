/**
 * Rubros from Allocations - Baseline Materialization Fallback
 * 
 * When rubros endpoint returns empty for an accepted baseline, this module
 * provides in-memory materialization from allocations and prefacturas.
 * 
 * NO DATABASE WRITES - All transformations are in-memory only.
 */

export type Rubro = {
  rubro_id: string;
  nombre: string;
  categoria?: string;
  tipo_ejecucion?: string;
  descripcion?: string;
  linea_codigo?: string;
  tipo_costo?: string;
  source?: 'allocation' | 'prefactura';
  unitCost?: number;
  quantity?: number;
  isRecurring?: boolean;
  monthsRange?: [number, number];
};

export type Allocation = {
  allocation_id: string;
  rubro_id: string;
  mes: string;
  monto_planeado: number;
  monto_forecast?: number;
  baseline_id?: string;
};

export type Prefactura = {
  prefactura_id: string;
  rubro_id?: string;
  descripcion: string;
  monto: number;
  mes: string;
  tipo: string;
  baseline_id?: string;
};

/**
 * Map allocations to Rubro models
 * Groups allocations by rubro_id and computes aggregated metadata
 */
export function mapAllocationsToRubros(allocations: Allocation[]): Rubro[] {
  // Group by rubro_id
  const grouped = allocations.reduce((acc, alloc) => {
    if (!alloc.rubro_id) return acc;
    
    if (!acc[alloc.rubro_id]) {
      acc[alloc.rubro_id] = [];
    }
    acc[alloc.rubro_id].push(alloc);
    return acc;
  }, {} as Record<string, Allocation[]>);

  // Convert groups to Rubro models
  return Object.entries(grouped).map(([rubroId, allocList]) => {
    // Parse month indices from mes field (e.g., "M1", "M2", "2025-01")
    const monthIndices = allocList
      .map(a => parseMonthIndex(a.mes))
      .filter(m => m !== null) as number[];

    const minMonth = monthIndices.length > 0 ? Math.min(...monthIndices) : 1;
    const maxMonth = monthIndices.length > 0 ? Math.max(...monthIndices) : 1;

    // Sum amounts
    const totalAmount = allocList.reduce((sum, a) => sum + (a.monto_planeado || 0), 0);

    // Detect if recurring (multiple months)
    const isRecurring = monthIndices.length > 1;

    // Compute unit cost (average per month if recurring)
    const unitCost = isRecurring && monthIndices.length > 0
      ? totalAmount / monthIndices.length
      : totalAmount;

    return {
      rubro_id: `alloc-${sanitizeId(rubroId)}`,
      nombre: rubroId, // Use rubro_id as name placeholder
      categoria: 'Allocation',
      tipo_ejecucion: isRecurring ? 'mensual' : 'puntual',
      descripcion: `Materialized from ${allocList.length} allocation(s)`,
      source: 'allocation' as const,
      unitCost,
      quantity: monthIndices.length,
      isRecurring,
      monthsRange: [minMonth, maxMonth],
    };
  });
}

/**
 * Map prefacturas to Rubro models
 * Each prefactura becomes a separate rubro
 */
export function mapPrefacturasToRubros(prefacturas: Prefactura[]): Rubro[] {
  return prefacturas.map(pref => {
    const monthIndex = parseMonthIndex(pref.mes) || 1;

    return {
      rubro_id: `pref-${sanitizeId(pref.prefactura_id)}`,
      nombre: pref.descripcion || `Prefactura ${pref.prefactura_id}`,
      categoria: pref.tipo || 'Prefactura',
      tipo_ejecucion: 'puntual',
      descripcion: pref.descripcion,
      source: 'prefactura' as const,
      unitCost: pref.monto,
      quantity: 1,
      isRecurring: false,
      monthsRange: [monthIndex, monthIndex],
    };
  });
}

/**
 * Merge allocations and prefacturas into a unified rubros list
 * Normalizes month ranges and computes metadata
 */
export function rubrosFromAllocations(
  allocations: Allocation[],
  prefacturas: Prefactura[]
): Rubro[] {
  const allocRubros = mapAllocationsToRubros(allocations);
  const prefRubros = mapPrefacturasToRubros(prefacturas);

  // Merge and return
  return [...allocRubros, ...prefRubros];
}

/**
 * Parse month index from various formats
 * Supports: "M1", "M12", "2025-01", "2025-12", etc.
 */
function parseMonthIndex(mes: string): number | null {
  if (!mes) return null;

  // Format: "M1", "M12"
  const mMatch = mes.match(/^M(\d+)$/i);
  if (mMatch) {
    return parseInt(mMatch[1], 10);
  }

  // Format: "YYYY-MM"
  const dateMatch = mes.match(/^\d{4}-(\d{2})$/);
  if (dateMatch) {
    return parseInt(dateMatch[1], 10);
  }

  // Format: just a number "1", "12"
  const num = parseInt(mes, 10);
  if (!isNaN(num) && num >= 1 && num <= 100) {
    return num;
  }

  return null;
}

/**
 * Sanitize ID to ensure valid rubro_id
 * Removes special characters and ensures non-empty
 */
function sanitizeId(id: string): string {
  if (!id || typeof id !== 'string') {
    return 'unknown';
  }
  // Replace non-alphanumeric chars (except dash and underscore) with dash
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50) || 'unknown';
}
