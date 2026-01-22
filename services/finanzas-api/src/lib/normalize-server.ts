/**
 * Server-Specific Normalization Utilities
 * 
 * These normalization functions are used by the server materializers and differ
 * from the client's normalize-key.ts in important ways:
 * 
 * - Server: Preserves spaces and underscores (backward compatibility)
 * - Client: Converts spaces to hyphens (UI/display consistency)
 * 
 * Examples:
 *   Server: "Service Delivery Manager" → "service delivery manager"
 *   Client: "Service Delivery Manager" → "service-delivery-manager"
 */

/**
 * Normalize a string to a stable key (server version - preserves spaces/underscores):
 *  - normalize Unicode
 *  - remove diacritics
 *  - remove punctuation (except hyphen/underscore/space)
 *  - collapse whitespace
 *  - lowercase
 */
export function normalizeKey(input: any): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  // Normalize and remove diacritics (Unicode)
  // NFD = Canonical Decomposition (splits accented chars into base + combining marks)
  // \p{Diacritic} matches Unicode diacritical marks (requires 'u' flag for Unicode property escapes)
  s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  // Remove punctuation except hyphen/underscore, keep letters/numbers/space
  // \p{L} = all Unicode letters, \p{N} = all Unicode numbers (requires 'u' flag)
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, "");
  // Collapse whitespace, trim, lowercase
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}

/**
 * Normalize shorter key parts (linea_gasto or descripcion)
 * Keep as abstraction in case we want slightly different rules later.
 */
export function normalizeKeyPart(input: any): string {
  return normalizeKey(input);
}

/**
 * Legacy normalizeKeyPart for backward compatibility with existing code
 * that expects simple whitespace normalization only.
 */
export function normalizeKeyPartLegacy(value?: string | null): string {
  return (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}
