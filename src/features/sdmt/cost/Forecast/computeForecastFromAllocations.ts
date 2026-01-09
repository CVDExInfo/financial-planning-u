/**
 * Allocation type definition for forecast fallback logic
 */
export interface Allocation {
  month: string | number; // "YYYY-MM" format or numeric 1-12
  amount: number;
  rubroId?: string;
  rubro_id?: string;
  line_item_id?: string;
  rubro_type?: string;
  projectId?: string;
}

/**
 * Compute minimal forecast from allocations data
 * 
 * When server forecast is empty but allocations exist, this creates a basic
 * forecast grid showing month totals from allocation data.
 * 
 * @param allocations - Allocation records from /allocations endpoint
 * @param rubros - Line items from /rubros endpoint (for enrichment)
 * @param months - Number of months to generate
 * @param projectId - Project identifier
 * @returns Array of forecast cells with month totals
 */
import type { LineItem } from '@/types/domain';

export interface ForecastRow {
  line_item_id: string;
  rubroId?: string;
  description?: string;
  category?: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  last_updated: string;
  updated_by: string;
  projectId?: string;
  projectName?: string;
}

export function computeForecastFromAllocations(
  allocations: Allocation[],
  rubros: LineItem[],
  months: number,
  projectId?: string
): ForecastRow[] {
  if (!allocations || allocations.length === 0) {
    return [];
  }

  const rubroWithProject = rubros.find(
    (rubro) => (rubro as { projectId?: string }).projectId
  ) as { projectId?: string } | undefined;
  const resolvedProjectId =
    projectId ||
    allocations.find((alloc) => alloc.projectId)?.projectId ||
    rubroWithProject?.projectId;

  if (!resolvedProjectId) {
    console.warn(
      "[computeForecastFromAllocations] Missing projectId; cannot build fallback forecast rows."
    );
    return [];
  }

  // Group allocations by month and rubroId
  const allocationMap = new Map<string, { month: number; amount: number; rubroId?: string }[]>();
  
  allocations.forEach(alloc => {
    // Parse month from allocation (could be "2025-01" format or month number)
    let monthNum = 0;
    if (typeof alloc.month === 'number') {
      monthNum = alloc.month;
    } else if (typeof alloc.month === 'string') {
      const match = alloc.month.match(/\d{4}-(\d{2})/);
      if (match) {
        monthNum = parseInt(match[1], 10);
      }
    }
    
    if (monthNum >= 1 && monthNum <= 12) {
      const rubroId = alloc.rubroId || alloc.rubro_id || alloc.line_item_id || 'UNKNOWN';
      const key = `${rubroId}-${monthNum}`;
      
      if (!allocationMap.has(key)) {
        allocationMap.set(key, []);
      }
      
      allocationMap.get(key)!.push({
        month: monthNum,
        amount: Number(alloc.amount || 0),
        rubroId,
      });
    }
  });

  // Create forecast cells from aggregated allocations
  const forecastCells: ForecastRow[] = [];
  
  allocationMap.forEach((allocList, key) => {
    if (allocList.length === 0) return;
    
    const firstAlloc = allocList[0];
    const totalAmount = allocList.reduce((sum, a) => sum + a.amount, 0);
    const rubroId = firstAlloc.rubroId || 'UNKNOWN';
    
    // Try to find matching rubro for metadata
    const matchingRubro = rubros.find(r => r.id === rubroId);
    
    forecastCells.push({
      line_item_id: rubroId,
      rubroId: rubroId,
      description: matchingRubro?.description || `Allocation ${rubroId}`,
      category: matchingRubro?.category || 'Allocations',
      month: firstAlloc.month,
      planned: totalAmount,
      forecast: totalAmount,
      actual: 0,
      variance: 0,
      last_updated: new Date().toISOString(),
      updated_by: 'system-allocations',
      projectId: resolvedProjectId,
    });
  });

  return forecastCells;
}
