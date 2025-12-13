import type { LaborEstimate, NonLaborEstimate } from "@/types/domain";

/**
 * Determines if a cost category is MOD (Mano de Obra Directa)
 */
export function isMODCategory(categoryCode: string): boolean {
  return categoryCode === "MOD";
}

/**
 * Determines if a cost is indirect (all non-MOD costs)
 */
export function isIndirectCost(categoryCode: string): boolean {
  return !isMODCategory(categoryCode);
}

/**
 * Gets a badge variant based on whether the cost is MOD or indirect
 */
export function getCostTypeBadgeVariant(
  categoryCode: string,
): "default" | "secondary" {
  return isMODCategory(categoryCode) ? "default" : "secondary";
}

/**
 * Gets a display label for cost type
 */
export function getCostTypeLabel(categoryCode: string): string {
  return isMODCategory(categoryCode) ? "MOD" : "Indirecto";
}

/**
 * Cost utilities for Financial Planning & PMO estimator
 * All math is _monthly-based_ and intentionally avoids converting monthly -> yearly
 * except where explicitly required by caller.
 */
export function computeLaborTotal(labor: LaborEstimate[] = []): number {
  return labor.reduce((sum, item) => {
    const start = item.start_month || 1;
    const end = item.end_month || start;
    const months = Math.max(0, end - start + 1);

    const monthlyHours = (item.hours_per_month || 0) * (item.fte_count || 0);
    const baseMonthlyCost = monthlyHours * (item.hourly_rate || 0);
    const onCost = baseMonthlyCost * ((item.on_cost_percentage || 0) / 100);
    const monthlyTotal = baseMonthlyCost + onCost;

    return sum + monthlyTotal * months;
  }, 0);
}

export function computeNonLaborTotal(nonLabor: NonLaborEstimate[] = []): number {
  return nonLabor.reduce((sum, item) => {
    if (item.one_time) {
      return sum + (item.amount || 0);
    }
    const start = item.start_month || 1;
    const end = item.end_month || start;
    const months = Math.max(0, end - start + 1);
    return sum + (item.amount || 0) * months;
  }, 0);
}

export type MonthlyBreakdownRow = {
  month: number;
  Labor: number;
  "Non-Labor": number;
};

/**
 * Returns an array of monthly breakdown rows for the given duration.
 * Each row: { month, Labor, 'Non-Labor' }
 */
export function computeMonthlyBreakdown(
  durationMonths: number,
  labor: LaborEstimate[] = [],
  nonLabor: NonLaborEstimate[] = []
): MonthlyBreakdownRow[] {
  const months = Math.max(1, Math.floor(durationMonths || 12));
  const rows: MonthlyBreakdownRow[] = Array.from({ length: months }).map((_, i) => {
    const month = i + 1;

    const laborCost = labor.reduce((sum, item) => {
      const start = item.start_month || 1;
      const end = item.end_month || start;
      if (month < start || month > end) return sum;

      const monthlyHours = (item.hours_per_month || 0) * (item.fte_count || 0);
      const base = monthlyHours * (item.hourly_rate || 0);
      const onCost = base * ((item.on_cost_percentage || 0) / 100);
      return sum + base + onCost;
    }, 0);

    const nonLaborCost = nonLabor.reduce((sum, item) => {
      if (item.one_time) return month === 1 ? sum + (item.amount || 0) : sum;
      const start = item.start_month || 1;
      const end = item.end_month || start;
      if (month < start || month > end) return sum;
      return sum + (item.amount || 0);
    }, 0);

    return { month, Labor: laborCost, "Non-Labor": nonLaborCost };
  });

  return rows;
}

export function computeGrandTotal(labor: LaborEstimate[], nonLabor: NonLaborEstimate[]) {
  return computeLaborTotal(labor) + computeNonLaborTotal(nonLabor);
}

export function computeLaborPercentage(laborTotal: number, grandTotal: number) {
  return grandTotal > 0 ? (laborTotal / grandTotal) * 100 : 0;
}
