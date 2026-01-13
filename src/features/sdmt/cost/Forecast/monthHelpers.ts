/**
 * Month support helper functions
 * Extracted for testing isolation (no heavy dependencies)
 */

/**
 * Get baseline duration in months from baseline detail
 * Falls back to 60 months if not specified
 */
export function getBaselineDuration(baselineDetail: any): number {
  // Try payload.duration_months then duration_months, fall back to 60
  const raw =
    (baselineDetail?.payload?.duration_months ?? baselineDetail?.duration_months);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, parsed) : 60;
}

/**
 * Clamp month index to valid range [1..baseline.duration_months]
 * Falls back to [1..60] if baseline not available
 */
export function clampMonthIndex(monthsElapsed: number, baselineDetail: any): number {
  const maxMonths = Math.max(1, getBaselineDuration(baselineDetail) || 60);
  return Math.max(1, Math.min(maxMonths, Math.floor(Number(monthsElapsed) || 1)));
}
