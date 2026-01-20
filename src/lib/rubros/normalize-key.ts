/**
 * Normalize Key Utility
 * 
 * Shared utility for normalizing rubro keys across the application.
 * Ensures consistent key matching in taxonomy lookups and caching.
 */

/**
 * Normalize key for consistent matching
 * Preserves the actual rubro token at the end of allocation SKs
 * Handles diacritics by normalizing to NFKD and removing combining marks
 * 
 * @param s - The string to normalize (rubro ID, allocation SK, etc.)
 * @returns Normalized lowercase string with hyphens, diacritics removed
 * 
 * @example
 * normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD') // 'mod-lead'
 * normalizeKey('LINEA#MOD-ING') // 'mod-ing'
 * normalizeKey('Mano de Obra') // 'mano-de-obra'
 * normalizeKey('Mañana de Obra') // 'manana-de-obra'
 * normalizeKey('café') // 'cafe'
 */
export function normalizeKey(s?: string): string {
  if (!s) return '';
  const raw = String(s).trim();
  // If the value is an ALLOCATION SK with '#', prefer last segment
  const last = raw.includes('#') ? raw.split('#').pop() || raw : raw;
  return last
    .toLowerCase()
    .normalize('NFKD')                   // Decompose characters with diacritics
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics (combining marks)
    .replace(/[^a-z0-9-]+/g, '-')        // Keep only alnum and hyphen
    .replace(/-+/g, '-')                 // Collapse multiple hyphens
    .replace(/(^-|-$)/g, '');            // Trim leading/trailing hyphens
}
