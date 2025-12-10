/**
 * Cost utilities for MOD vs Indirect cost handling
 */

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
export function getCostTypeBadgeVariant(categoryCode: string): "default" | "secondary" {
  return isMODCategory(categoryCode) ? "default" : "secondary";
}

/**
 * Gets a display label for cost type
 */
export function getCostTypeLabel(categoryCode: string): string {
  return isMODCategory(categoryCode) ? "MOD" : "Indirecto";
}
