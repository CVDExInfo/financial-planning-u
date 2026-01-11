/**
 * Utility functions for ensuring proper category assignment on line items.
 * 
 * Fixes issue where labor roles (Ingeniero, SDM, PM) appear in non-labor categories
 * due to missing or incorrect category metadata.
 */

import type { LineItem } from '@/types/domain';

/**
 * Labor role patterns that should be categorized as 'Mano de Obra Directa'
 * Case-insensitive matching
 */
const LABOR_ROLE_PATTERNS = [
  'ingeniero',
  'ingeniero lider',
  'service delivery manager',
  'project manager',
  'labor',
  'laborer',
  'pm',
  'sdm',
] as const;

/**
 * Category name for labor/MOD
 */
const LABOR_CATEGORY = 'Mano de Obra Directa';

/**
 * Categories that indicate missing or invalid assignment
 */
const INVALID_CATEGORIES = ['sin categoría', 'sin categoria', '', undefined, null] as const;

/**
 * Check if a role name matches any labor role pattern
 */
function isLaborRole(role?: string): boolean {
  if (!role) return false;
  
  const normalized = role.trim().toLowerCase();
  if (!normalized) return false;
  
  return LABOR_ROLE_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Check if category is missing or invalid
 */
function isInvalidCategory(category?: string): boolean {
  if (!category) return true;
  
  const normalized = category.trim().toLowerCase();
  return INVALID_CATEGORIES.some(invalid => {
    if (invalid === undefined || invalid === null || invalid === '') {
      return normalized === '';
    }
    return normalized === invalid;
  });
}

/**
 * Extract role from line item metadata
 * Looks in common fields where role information might be stored
 * Returns the first field that contains a recognizable labor role pattern
 */
function extractRole(lineItem: LineItem): string | undefined {
  // Check explicit role field first
  const explicitRole = (lineItem as any).role as string | undefined;
  if (explicitRole && isLaborRole(explicitRole)) {
    return explicitRole;
  }
  
  // Check subtype field (often contains role information)
  if (lineItem.subtype && isLaborRole(lineItem.subtype)) {
    return lineItem.subtype;
  }
  
  // Check description field (may contain role information)
  if (lineItem.description && isLaborRole(lineItem.description)) {
    return lineItem.description;
  }
  
  // Return first non-empty field even if it doesn't match labor patterns
  // (for caller to check with isLaborRole)
  return explicitRole || lineItem.subtype || lineItem.description;
}

/**
 * Ensure line item has correct category based on its role.
 * 
 * Rules:
 * 1. If category is empty/undefined or equals 'Sin categoría', AND
 * 2. role matches labor patterns (case-insensitive)
 * 3. THEN set category='Mano de Obra Directa'
 * 
 * This function is idempotent - safe to call multiple times.
 * 
 * @param lineItem - The line item to check/fix
 * @returns The line item with corrected category (new object if changed, same object if unchanged)
 */
export function ensureCategory(lineItem: LineItem): LineItem {
  const role = extractRole(lineItem);
  
  // Only fix if category is invalid AND role is labor
  if (isInvalidCategory(lineItem.category) && isLaborRole(role)) {
    return {
      ...lineItem,
      category: LABOR_CATEGORY,
    };
  }
  
  // Return unchanged if category is valid or role is not labor
  return lineItem;
}

/**
 * Helper function for filtering/checking if an item is labor.
 * Used in UI components like ForecastRubrosTable.
 * 
 * @param category - The category string to check
 * @param role - Optional role string for fallback detection
 * @returns true if item should be classified as labor
 */
export function isLabor(category?: string, role?: string): boolean {
  // Primary check: category matches labor category (case-insensitive, trimmed)
  if (category && category.trim().toLowerCase() === LABOR_CATEGORY.toLowerCase()) {
    return true;
  }
  
  // Fallback: if no category, check role
  if (!category && role) {
    return isLaborRole(role);
  }
  
  return false;
}

/**
 * Normalize category string for consistent matching
 * Trims whitespace and converts to lowercase
 */
export function normalizeCategory(category?: string): string {
  return category ? category.trim().toLowerCase() : '';
}
