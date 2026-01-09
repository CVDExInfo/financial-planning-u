/**
 * Transform LineItems into ForecastCells
 * 
 * Used as fallback when server forecast is empty but we have line items.
 * Creates individual ForecastCell entries for each line item and month combination.
 */

import type { LineItem, ForecastCell } from '@/types/domain';

/**
 * ForecastRow extends ForecastCell with optional project metadata
 * This type is also used in SDMTForecast.tsx and PortfolioSummaryView.tsx
 * TODO: Consider extracting to shared types file if more components need it
 */
export type ForecastRow = ForecastCell & { 
  projectId?: string; 
  projectName?: string;
  rubroId?: string;
  description?: string;
  category?: string;
};

/**
 * Transform line items into forecast cells with monthly distribution
 * 
 * @param lineItems - Array of line items from baseline/rubros
 * @param months - Number of months to generate (default 12)
 * @returns Array of forecast cells (one per line item per active month)
 */
export function transformLineItemsToForecast(
  lineItems: LineItem[], 
  months = 12,
  projectId?: string,
  projectName?: string
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
    const unitCost = Number(
      (item as any).unit_cost || (item as any).unitCost || (item as any).costo_unitario || 0
    );
    const qty = Number((item as any).qty || (item as any).cantidad || (item as any).quantity || 1);
    const totalFromItem = Number(
      (item as any).total_cost ||
        (item as any).totalCost ||
        (item as any).total ||
        (item as any).monto_total ||
        (item as any).amount ||
        (item as any).monto ||
        0
    );
    const totalCost = totalFromItem || unitCost * qty;
    
    // Calculate number of active months
    const activeMonths = Math.max(1, Math.min(endMonth, months) - Math.max(startMonth, 1) + 1);
    const monthlyAmount = totalCost / activeMonths;

    const monthlySeries = Array.isArray((item as any).monthly)
      ? (item as any).monthly
      : null;
    const lineItemId =
      (item as any).id ||
      (item as any).rubroId ||
      (item as any).rubro_id ||
      (item as any).linea_codigo ||
      (item as any).linea_id ||
      '';
    
    // Create forecast cells for each active month
    for (let month = 1; month <= months; month++) {
      if (month >= startMonth && month <= endMonth) {
        const monthValue = monthlySeries?.[month - 1];
        const amount = Number(monthValue ?? monthlyAmount ?? 0);
        forecastCells.push({
          line_item_id: lineItemId,
          rubroId: lineItemId,
          description: (item as any).description || (item as any).descripcion,
          category: (item as any).category || (item as any).categoria,
          month,
          planned: amount,
          forecast: amount,
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
