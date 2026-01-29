/**
 * canonicalMatrix.ts
 * 
 * Canonical matrix module - single source of truth for forecast data.
 * Normalizes forecast payloads, reconciles invoices into actuals, combines allocations/lineItems,
 * and produces deterministic ordered matrix rows.
 * 
 * Key responsibilities:
 * - Build canonical matrix from multiple data sources (forecasts, invoices, allocations, lineItems)
 * - Derive KPIs from matrix (presupuesto, pronostico, real, consumo, varianza)
 * - Ensure data consistency across UI components and exports
 * - Use canonical keys: (projectId, rubroId, lineItemId, costType)
 */

import type { ForecastCell, LineItem, InvoiceDoc } from '@/types/domain';
import type { Allocation } from '../Forecast/computeForecastFromAllocations';

/**
 * Canonical matrix row representing a single cost item across all months
 */
export interface CanonicalMatrixRow {
  // Canonical keys for deduplication and matching
  projectId: string;
  projectName?: string;
  rubroId: string;
  lineItemId: string;
  costType: string; // 'labor' | 'non-labor' | 'other'
  
  // Descriptive fields
  description?: string;
  category?: string;
  
  // Monthly data (up to 60 months)
  // Each month has: planned, forecast, actual
  [key: `month_${number}_planned`]: number;
  [key: `month_${number}_forecast`]: number;
  [key: `month_${number}_actual`]: number;
  
  // Metadata
  lastUpdated?: string;
  updatedBy?: string;
}

/**
 * Project index for quick lookup
 */
export interface ProjectIndex {
  [projectId: string]: {
    name: string;
    rows: CanonicalMatrixRow[];
  };
}

/**
 * Aggregated totals across all matrix rows
 */
export interface CanonicalTotals {
  // Monthly totals (up to 60 months)
  byMonth: Array<{
    month: number;
    planned: number;
    forecast: number;
    actual: number;
  }>;
  
  // Overall totals
  overall: {
    planned: number;
    forecast: number;
    actual: number;
  };
}

/**
 * Result of building canonical matrix
 */
export interface CanonicalMatrixResult {
  matrixRows: CanonicalMatrixRow[];
  projectIndex: ProjectIndex;
  totals: CanonicalTotals;
}

/**
 * Input parameters for building canonical matrix
 */
export interface BuildCanonicalMatrixInput {
  projects: Array<{ id: string; name: string }>;
  forecastPayloads: Array<{ projectId: string; data: ForecastCell[] }>;
  allocations?: Allocation[];
  invoices?: InvoiceDoc[];
  lineItems?: LineItem[];
  baselineDetail?: any; // BaselineDetail type
  monthsToShow: number;
}

/**
 * Derived KPIs from canonical matrix
 */
export interface DerivedKpis {
  presupuesto: number; // Total planned budget
  pronostico: number;  // Total forecast
  real: number;        // Total actual spend
  consumo: number;     // Consumption % (real/presupuesto * 100)
  varianza: number;    // Variance (pronostico - presupuesto)
}

/**
 * Normalize a rubro ID to canonical form
 */
function normalizeRubroId(rubroId: string | undefined | null): string {
  if (!rubroId) return '';
  return rubroId.trim().toLowerCase().replace(/[_\s-]+/g, '_');
}

/**
 * Determine cost type from category or rubro ID
 */
function determineCostType(category?: string, rubroId?: string): string {
  if (!category && !rubroId) return 'other';
  
  const cat = (category || '').toLowerCase();
  const rubro = (rubroId || '').toLowerCase();
  
  if (cat.includes('labor') || cat.includes('mano de obra') || rubro.includes('labor')) {
    return 'labor';
  }
  
  if (cat.includes('non-labor') || cat.includes('no labor') || rubro.includes('nonlabor')) {
    return 'non-labor';
  }
  
  return 'other';
}

/**
 * Build canonical key for a matrix row
 */
function buildCanonicalKey(
  projectId: string,
  rubroId: string,
  lineItemId: string,
  costType: string
): string {
  return `${projectId}|${rubroId}|${lineItemId}|${costType}`;
}

/**
 * Build canonical matrix from multiple data sources
 * 
 * This is the single source of truth for all forecast data.
 * It normalizes and merges data from:
 * - Forecast payloads (planned/forecast values)
 * - Invoices (actual values)
 * - Allocations (budget allocation data)
 * - Line items (baseline items)
 * 
 * The output is a deterministic, deduplicated list of matrix rows.
 */
export function buildCanonicalMatrix(input: BuildCanonicalMatrixInput): CanonicalMatrixResult {
  const {
    projects,
    forecastPayloads,
    allocations = [],
    invoices = [],
    lineItems = [],
    monthsToShow,
  } = input;
  
  // Step 1: Create a map to deduplicate rows by canonical key
  const rowMap = new Map<string, CanonicalMatrixRow>();
  
  // Step 2: Process forecast payloads
  forecastPayloads.forEach(({ projectId, data }) => {
    const project = projects.find(p => p.id === projectId);
    const projectName = project?.name || projectId;
    
    data.forEach(cell => {
      const rubroId = normalizeRubroId(cell.rubroId || cell.line_item_id);
      const lineItemId = normalizeRubroId(cell.line_item_id) || rubroId;
      const category = (cell as any).category;
      const costType = determineCostType(category, rubroId);
      
      const key = buildCanonicalKey(projectId, rubroId, lineItemId, costType);
      
      let row = rowMap.get(key);
      if (!row) {
        // Initialize new row with all months set to 0
        row = {
          projectId,
          projectName,
          rubroId,
          lineItemId,
          costType,
          description: (cell as any).description || '',
          category,
          lastUpdated: cell.last_updated,
          updatedBy: cell.updated_by,
        } as CanonicalMatrixRow;
        
        // Initialize all month fields to 0
        for (let m = 1; m <= monthsToShow; m++) {
          (row as any)[`month_${m}_planned`] = 0;
          (row as any)[`month_${m}_forecast`] = 0;
          (row as any)[`month_${m}_actual`] = 0;
        }
        
        rowMap.set(key, row);
      }
      
      // Set values for this month
      const month = cell.month;
      if (month >= 1 && month <= monthsToShow) {
        (row as any)[`month_${month}_planned`] = cell.planned || 0;
        (row as any)[`month_${month}_forecast`] = cell.forecast || 0;
        (row as any)[`month_${month}_actual`] = cell.actual || 0;
      }
    });
  });
  
  // Step 3: Process invoices to update actual values
  invoices.forEach(invoice => {
    if (invoice.status !== 'Matched') return;
    
    const rubroId = normalizeRubroId(
      invoice.rubro_canonical || 
      invoice.rubroId || 
      invoice.rubro_id || 
      invoice.line_item_id
    );
    const lineItemId = invoice.line_item_id || rubroId;
    
    // Try to find matching row (may need to search across projects)
    rowMap.forEach((row, key) => {
      if (
        normalizeRubroId(row.rubroId) === rubroId ||
        normalizeRubroId(row.lineItemId) === normalizeRubroId(lineItemId)
      ) {
        const month = invoice.month;
        if (month >= 1 && month <= monthsToShow) {
          // Add invoice amount to actual
          const currentActual = (row as any)[`month_${month}_actual`] || 0;
          (row as any)[`month_${month}_actual`] = currentActual + (invoice.amount || 0);
          
          // Update metadata
          if (invoice.matched_at && (!row.lastUpdated || invoice.matched_at > row.lastUpdated)) {
            row.lastUpdated = invoice.matched_at;
            row.updatedBy = invoice.matched_by || row.updatedBy;
          }
        }
      }
    });
  });
  
  // Step 4: Process allocations for fallback data
  allocations.forEach(allocation => {
    const projectId = allocation.projectId || 'unknown';
    const project = projects.find(p => p.id === projectId);
    const projectName = project?.name || projectId;
    
    const rubroId = normalizeRubroId(allocation.rubroId || allocation.rubro_id);
    const lineItemId = allocation.line_item_id || rubroId;
    const costType = determineCostType(allocation.rubro_type, rubroId);
    
    const key = buildCanonicalKey(projectId, rubroId, lineItemId, costType);
    
    // Only add if not already present from forecast
    if (!rowMap.has(key)) {
      const row = {
        projectId,
        projectName,
        rubroId,
        lineItemId,
        costType,
        description: '',
        category: allocation.rubro_type,
      } as CanonicalMatrixRow;
      
      // Initialize all month fields to 0
      for (let m = 1; m <= monthsToShow; m++) {
        (row as any)[`month_${m}_planned`] = 0;
        (row as any)[`month_${m}_forecast`] = 0;
        (row as any)[`month_${m}_actual`] = 0;
      }
      
      rowMap.set(key, row);
    }
    
    const row = rowMap.get(key)!;
    
    // Parse month from allocation
    let month = 0;
    if (typeof allocation.month === 'number') {
      month = allocation.month;
    } else if (typeof allocation.month === 'string') {
      // Try to extract month from YYYY-MM format
      const match = allocation.month.match(/^(\d{4})-(\d{2})$/);
      month = match ? parseInt(match[2], 10) : 0;
    }
    
    if (month >= 1 && month <= monthsToShow) {
      // If planned is 0, use allocation amount as planned
      if ((row as any)[`month_${month}_planned`] === 0) {
        (row as any)[`month_${month}_planned`] = allocation.amount || 0;
      }
    }
  });
  
  // Step 5: Process line items for baseline data
  lineItems.forEach(item => {
    const itemData = item as any;
    const projectId = itemData.projectId || 'unknown';
    const project = projects.find(p => p.id === projectId);
    const projectName = project?.name || projectId;
    
    const rubroId = normalizeRubroId(itemData.rubroId || item.id);
    const lineItemId = item.id || rubroId;
    const costType = determineCostType(item.category, rubroId);
    
    const key = buildCanonicalKey(projectId, rubroId, lineItemId, costType);
    
    // Only add if not already present
    if (!rowMap.has(key)) {
      const row = {
        projectId,
        projectName,
        rubroId,
        lineItemId,
        costType,
        description: item.description,
        category: item.category,
      } as CanonicalMatrixRow;
      
      // Initialize all month fields to 0
      for (let m = 1; m <= monthsToShow; m++) {
        (row as any)[`month_${m}_planned`] = 0;
        (row as any)[`month_${m}_forecast`] = 0;
        (row as any)[`month_${m}_actual`] = 0;
      }
      
      // Spread line item cost across its duration
      if (item.start_month && item.end_month && item.unit_cost && item.qty) {
        const totalCost = item.unit_cost * item.qty;
        const durationMonths = item.end_month - item.start_month + 1;
        const monthlyAmount = totalCost / durationMonths;
        
        for (let m = item.start_month; m <= Math.min(item.end_month, monthsToShow); m++) {
          (row as any)[`month_${m}_planned`] = monthlyAmount;
        }
      }
      
      rowMap.set(key, row);
    }
  });
  
  // Step 6: Convert map to sorted array (deterministic order)
  const matrixRows = Array.from(rowMap.values()).sort((a, b) => {
    // Sort by: projectId, costType, rubroId, lineItemId
    if (a.projectId !== b.projectId) {
      return a.projectId.localeCompare(b.projectId);
    }
    if (a.costType !== b.costType) {
      return a.costType.localeCompare(b.costType);
    }
    if (a.rubroId !== b.rubroId) {
      return a.rubroId.localeCompare(b.rubroId);
    }
    return a.lineItemId.localeCompare(b.lineItemId);
  });
  
  // Step 7: Build project index
  const projectIndex: ProjectIndex = {};
  projects.forEach(project => {
    projectIndex[project.id] = {
      name: project.name,
      rows: matrixRows.filter(row => row.projectId === project.id),
    };
  });
  
  // Step 8: Compute totals
  const totals: CanonicalTotals = {
    byMonth: [],
    overall: {
      planned: 0,
      forecast: 0,
      actual: 0,
    },
  };
  
  // Initialize monthly totals
  for (let month = 1; month <= monthsToShow; month++) {
    totals.byMonth.push({
      month,
      planned: 0,
      forecast: 0,
      actual: 0,
    });
  }
  
  // Sum up all rows
  matrixRows.forEach(row => {
    for (let month = 1; month <= monthsToShow; month++) {
      const planned = (row as any)[`month_${month}_planned`] || 0;
      const forecast = (row as any)[`month_${month}_forecast`] || 0;
      const actual = (row as any)[`month_${month}_actual`] || 0;
      
      totals.byMonth[month - 1].planned += planned;
      totals.byMonth[month - 1].forecast += forecast;
      totals.byMonth[month - 1].actual += actual;
      
      totals.overall.planned += planned;
      totals.overall.forecast += forecast;
      totals.overall.actual += actual;
    }
  });
  
  return {
    matrixRows,
    projectIndex,
    totals,
  };
}

/**
 * Derive KPIs from canonical matrix rows
 * 
 * Computes summary KPIs:
 * - presupuesto: total planned budget
 * - pronostico: total forecast
 * - real: total actual spend
 * - consumo: consumption percentage (real/presupuesto * 100)
 * - varianza: variance (pronostico - presupuesto)
 */
export function deriveKpisFromMatrix(
  matrixRows: CanonicalMatrixRow[],
  monthsToShow: number
): DerivedKpis {
  let presupuesto = 0;
  let pronostico = 0;
  let real = 0;
  
  matrixRows.forEach(row => {
    for (let month = 1; month <= monthsToShow; month++) {
      presupuesto += (row as any)[`month_${month}_planned`] || 0;
      pronostico += (row as any)[`month_${month}_forecast`] || 0;
      real += (row as any)[`month_${month}_actual`] || 0;
    }
  });
  
  const consumo = presupuesto > 0 ? (real / presupuesto) * 100 : 0;
  const varianza = pronostico - presupuesto;
  
  return {
    presupuesto,
    pronostico,
    real,
    consumo,
    varianza,
  };
}
