/**
 * Normalize Key Utility
 * 
 * Shared utility for normalizing rubro keys across the application.
 * Ensures consistent key matching in taxonomy lookups and caching.
 */

/**
 * Normalize key for consistent matching
 * Preserves the actual rubro token at the end of allocation SKs
 * 
 * @param s - The string to normalize (rubro ID, allocation SK, etc.)
 * @returns Normalized lowercase string with hyphens
 * 
 * @example
 * normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD') // 'mod-lead'
 * normalizeKey('LINEA#MOD-ING') // 'mod-ing'
 * normalizeKey('Mano de Obra') // 'mano-de-obra'
 */
export function normalizeKey(s?: string): string {
  if (!s) return '';
  const raw = String(s);
  // Preserve last token if SK (ALLOCATION#...#MOD-LEAD)
  const last = raw.includes('#') ? raw.split('#').pop() || '' : raw;
  return last
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}
