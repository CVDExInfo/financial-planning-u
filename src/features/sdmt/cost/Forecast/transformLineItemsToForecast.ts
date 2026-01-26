/**
 * Transform LineItems into ForecastCells
 * 
 * Used as fallback when server forecast is empty but we have line items.
 * Creates individual ForecastCell entries for each line item and month combination.
 */

import type { LineItem, ForecastCell } from '@/types/domain';
import { isLaborByKey } from './lib/taxonomyLookup';
import { getTaxonomyEntry } from '@/lib/rubros';

/**
 * ForecastRow extends ForecastCell with optional project metadata and budget data
 * This type is also used in SDMTForecast.tsx and PortfolioSummaryView.tsx
 * TODO: Consider extracting to shared types file if more components need it
 */
export type ForecastRow = ForecastCell & { 
  projectId?: string; 
  projectName?: string;
  rubroId?: string;
  description?: string;
  category?: string;
  isLabor?: boolean;
  budget?: number; // Monthly budget allocation for this row's month
};

/**
 * Transform line items into forecast cells with monthly distribution
 * 
 * @param lineItems - Array of line items from baseline/rubros
 * @param months - Number of months to generate (default 12)
 * @param projectId - Optional project ID
 * @param projectName - Optional project name
 * @param taxonomyByRubroId - Optional taxonomy lookup for descriptions
 * @returns Array of forecast cells (one per line item per active month)
 */
export function transformLineItemsToForecast(
  lineItems: LineItem[], 
  months = 12,
  projectId?: string,
  projectName?: string,
  taxonomyByRubroId?: Record<string, { description?: string; category?: string; isLabor?: boolean }>
): ForecastRow[] {
  if (!lineItems || lineItems.length === 0) {
    return [];
  }
  
  const forecastCells: ForecastRow[] = [];
  
  lineItems.forEach(item => {
    // Extract start and end months, defaulting to full year
    const startMonth = item.start_month || 1;
    const endMonth = item.end_month || 12;
    
    // Calculate monthly amount from line item
    // Use unit_cost * qty as the total, distributed across active months
    const unitCost = Number(item.unit_cost || 0);
    const qty = Number(item.qty || 1);
    const totalCost = unitCost * qty;
    
    // Calculate number of active months
    const activeMonths = Math.max(1, Math.min(endMonth, months) - Math.max(startMonth, 1) + 1);
    const monthlyAmount = totalCost / activeMonths;
    
    // Try to resolve from canonical taxonomy first, then fallback to taxonomyByRubroId
    const canonicalTaxonomy = getTaxonomyEntry(item.id);
    const taxonomyEntry = taxonomyByRubroId?.[item.id];
    
    // Priority chain for description: item.description -> canonical taxonomy -> taxonomyByRubroId -> item.id
    const description = item.description || 
                       (canonicalTaxonomy ? canonicalTaxonomy.linea_gasto || canonicalTaxonomy.descripcion : undefined) ||
                       taxonomyEntry?.description || 
                       item.id;
    
    // Priority chain for category: item.category -> canonical taxonomy -> taxonomyByRubroId
    const category = item.category || 
                    canonicalTaxonomy?.categoria ||
                    taxonomyEntry?.category;
    
    // Determine isLabor: canonical taxonomy (MOD check) -> taxonomyByRubroId -> canonical key check -> category check
    const isLabor = (canonicalTaxonomy?.categoria_codigo === 'MOD' ? true : undefined) ??
                   taxonomyEntry?.isLabor ??
                   isLaborByKey(item.id) ??
                   ((category?.toLowerCase().includes('mano de obra') || category?.toLowerCase() === 'mod') ? true : undefined) ??
                   false;
    
    // Create forecast cells for each active month
    for (let month = 1; month <= months; month++) {
      if (month >= startMonth && month <= endMonth) {
        forecastCells.push({
          line_item_id: item.id,
          rubroId: item.id,
          description,
          category,
          isLabor,
          month,
          planned: monthlyAmount,
          forecast: monthlyAmount,
          actual: 0,
          variance: 0,
          last_updated: new Date().toISOString(),
          updated_by: '',
          projectId,
          projectName,
        });
      }
    }
  });
  
  return forecastCells;
}
