/**
 * Normalize Key Utility
 * 
 * Single normalization utility for the entire application.
 * Ensures consistent key matching in taxonomy lookups, invoice matching, and caching.
 * 
 * Implementation:
 * - NFKD normalization (decompose accented characters)
 * - Remove diacritics (combining marks)
 * - Remove parenthetical content (e.g., "SDM (Service)" → "sdm")
 * - Lowercase conversion
 * - Replace non-alphanumeric with single hyphen
 * - Trim leading/trailing hyphens
 */

/**
 * Normalize key for consistent matching across the application
 * 
 * @param s - The string to normalize (can be null/undefined)
 * @returns Normalized lowercase string with hyphens, diacritics removed, or null if input is null/undefined
 * 
 * @example
 * normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD') // 'mod-lead'
 * normalizeKey('Service Delivery Manager (SDM)') // 'service-delivery-manager'
 * normalizeKey('Mano de Obra') // 'mano-de-obra'
 * normalizeKey('Mañana de Obra') // 'manana-de-obra'
 * normalizeKey('café') // 'cafe'
 * normalizeKey(null) // null
 * normalizeKey(undefined) // null
 */
export function normalizeKey(s?: string | null): string | null {
  if (s === null || s === undefined) return null;
  
  const raw = String(s).trim();
  if (!raw) return null;
  
  // If the value is an ALLOCATION SK with '#', prefer last segment
  const last = raw.includes('#') ? raw.split('#').pop() || raw : raw;
  
  return last
    .normalize('NFKD')                      // Decompose characters with diacritics
    .replace(/[\u0300-\u036f]/g, '')        // Remove combining diacritical marks
    .replace(/\([^)]*\)/g, ' ')             // Remove parenthetical content, replace with space
    .toLowerCase()                          // Convert to lowercase
    .replace(/[^a-z0-9-]+/g, '-')           // Replace non-alphanumeric with hyphen
    .replace(/-+/g, '-')                    // Collapse multiple hyphens
    .replace(/^-|-$/g, '');                 // Trim leading/trailing hyphens
}
