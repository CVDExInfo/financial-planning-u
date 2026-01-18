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
 * Check if category already indicates labor
 * Used to make ensureCategory idempotent
 * 
 * @param category - The category string to check
 * @returns true if the category indicates labor, false otherwise
 * 
 * @example
 * isLaborCategory("Mano de Obra Directa") // true
 * isLaborCategory("Labor") // true
 * isLaborCategory("MOD") // true
 * isLaborCategory("Non-Labor") // false
 * isLaborCategory("Equipos y Tecnología") // false
 */
function isLaborCategory(category?: string): boolean {
  if (!category) return false;
  
  const normalized = category.trim().toLowerCase();
  
  // Explicitly exclude "Non-Labor" category and any category starting with "non-"
  if (normalized === 'non-labor' || normalized.startsWith('non-')) {
    return false;
  }
  
  // Check for exact match with canonical labor category
  if (normalized === LABOR_CATEGORY.toLowerCase()) {
    return true;
  }
  
  // Check for canonical "Labor" category (from API normalization)
  if (normalized === 'labor') {
    return true;
  }
  
  // Check for exact "MOD" abbreviation (Mano de Obra Directa)
  if (normalized === 'mod') {
    return true;
  }
  
  // Check for any labor-related keywords in category
  const laborPatterns = [
    /\blabor\b/i,
    /mano\s*de\s*obra/i,
  ];
  
  return laborPatterns.some(pattern => pattern.test(category));
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
 * 1. If role matches labor patterns (case-insensitive), AND
 * 2. category is NOT already labor-like
 * 3. THEN set category='Mano de Obra Directa'
 * 
 * This fixes the issue where labor roles (PM, SDM, Ingeniero) appear under
 * non-labor categories like 'Equipos y Tecnología' in the rubros grid.
 * 
 * This function is idempotent - safe to call multiple times.
 * 
 * @param lineItem - The line item to check/fix
 * @returns The line item with corrected category (new object if changed, same object if unchanged)
 */
export function ensureCategory(lineItem: LineItem): LineItem {
  const role = extractRole(lineItem);
  
  // Force labor category when role indicates labor and category is not already labor
  if (isLaborRole(role) && !isLaborCategory(lineItem.category)) {
    return {
      ...lineItem,
      category: LABOR_CATEGORY,
    };
  }
  
  // Return unchanged if not a labor role or already has labor category
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
  if (!category) {
    // Fallback: if no category, check role
    if (role) {
      return isLaborRole(role);
    }
    return false;
  }
  
  const normalized = category.trim().toLowerCase();
  
  // Check for canonical "Labor" category (from API normalization)
  if (normalized === 'labor') {
    return true;
  }
  
  // Check for Spanish "Mano de Obra Directa" category
  if (normalized === LABOR_CATEGORY.toLowerCase()) {
    return true;
  }
  
  // Check for any labor-related keywords in category
  const laborPatterns = [
    /\blabor\b/i,
    /mano\s*de\s*obra/i,
    /\bmod\b/i,
  ];
  
  return laborPatterns.some(pattern => pattern.test(category));
}

/**
 * Normalize category string for consistent matching
 * Trims whitespace and converts to lowercase
 */
export function normalizeCategory(category?: string): string {
  return category ? category.trim().toLowerCase() : '';
}
