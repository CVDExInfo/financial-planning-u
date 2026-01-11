/**
 * Utility to materialize rubros from allocations and invoices/prefacturas
 * Used when the rubros endpoint returns empty for a (project + baseline) combination
 */

export interface AllocationInput {
  id: string | number;
  category?: string;
  role?: string;
  description?: string;
  is_recurring?: boolean;
  fte_count?: number;
  rate?: number;
  start_month?: number;
  end_month?: number;
  project_id?: string;
  baseline_id?: string;
}

export interface PrefacturaInput {
  id: string | number;
  category?: string;
  description?: string;
  amount?: number;
  start_month?: number;
  end_month?: number;
  project_id?: string;
  baseline_id?: string;
}

export interface RubroModel {
  id: string;
  category: string;
  description: string;
  type: string;
  quantity: number;
  unitCost: number;
  monthsRange: string;
  isRecurring: boolean;
  source: 'allocation' | 'prefactura';
  projectId?: string;
  baselineId?: string;
}

/**
 * Map allocations to rubro model
 * Allocations represent labor resources (MOD, contractors, etc.)
 */
export function mapAllocationsToRubros(allocations: AllocationInput[]): RubroModel[] {
  return allocations.map(alloc => {
    const category = alloc.category || 'Mano de Obra Directa';
    const description = alloc.role || alloc.description || 'Labor Resource';
    const type = alloc.is_recurring ? 'Recurrente' : 'Único';
    const quantity = alloc.fte_count || 1;
    const unitCost = alloc.rate || 0;
    const startMonth = alloc.start_month || 1;
    const endMonth = alloc.end_month || 12;
    const monthsRange = `M${startMonth}-M${endMonth}`;

    return {
      id: `alloc-${alloc.id}`,
      category,
      description,
      type,
      quantity,
      unitCost,
      monthsRange,
      isRecurring: alloc.is_recurring || false,
      source: 'allocation' as const,
      projectId: alloc.project_id,
      baselineId: alloc.baseline_id,
    };
  });
}

/**
 * Map prefacturas/invoices to rubro model
 * Prefacturas represent non-labor costs (infrastructure, licenses, etc.)
 */
export function mapPrefacturasToRubros(prefacturas: PrefacturaInput[]): RubroModel[] {
  return prefacturas.map(pref => {
    const category = pref.category || 'Gastos Generales';
    const description = pref.description || 'Invoice/Prefactura';
    const type = 'Único'; // Invoices are typically one-time
    const quantity = 1;
    const unitCost = pref.amount || 0;
    const startMonth = pref.start_month || 1;
    const endMonth = pref.end_month || 1;
    const monthsRange = `M${startMonth}-M${endMonth}`;

    return {
      id: `pref-${pref.id}`,
      category,
      description,
      type,
      quantity,
      unitCost,
      monthsRange,
      isRecurring: false,
      source: 'prefactura' as const,
      projectId: pref.project_id,
      baselineId: pref.baseline_id,
    };
  });
}

/**
 * Merge allocations and prefacturas into a single rubros array
 * This is the main function used by SDMTForecast for the fallback scenario
 */
export function rubrosFromAllocations(
  allocations: AllocationInput[] = [],
  prefacturas: PrefacturaInput[] = []
): RubroModel[] {
  const allocRubros = mapAllocationsToRubros(allocations);
  const prefRubros = mapPrefacturasToRubros(prefacturas);
  
  return [...allocRubros, ...prefRubros];
}
