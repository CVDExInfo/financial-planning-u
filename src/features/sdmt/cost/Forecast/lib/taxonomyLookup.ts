/**
 * Taxonomy Lookup with Canonical Labor Classification
 * 
 * Provides robust lookup of rubros taxonomy with explicit labor key detection.
 * Ensures the canonical MOD (Mano de Obra Directa) items are always classified as Labor.
 * 
 * Lookup chain:
 * 1. Strict map lookup (O(1) performance)
 * 2. Canonical labor key heuristic (fast Set lookup)
 * 3. Tolerant fallback (substring/fuzzy matching)
 */

/**
 * Normalize key for consistent matching
 * Preserves the actual rubro token at the end of allocation SKs
 * E.g., "ALLOCATION#base_xxx#2025-06#MOD-LEAD" -> "mod-lead"
 */
export const normalizeKey = (s?: string): string => {
  if (!s) return '';
  const raw = s.toString();
  // Preserve the actual rubro token at the end of allocation SKs:
  // e.g. "ALLOCATION#base_xxx#2025-06#MOD-LEAD" -> "mod-lead"
  const last = raw.includes('#') ? raw.split('#').pop() || '' : raw;
  return last
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // keep letters, numbers and hyphen
    .replace(/-+/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');     // trim leading/trailing hyphens
};

/**
 * Canonical labor keys - all known MOD (Mano de Obra Directa) identifiers
 * These are normalized variants that should always be treated as Labor
 * Exported as array for compatibility and Set for fast lookup
 */
export const LABOR_CANONICAL_KEYS = [
  'LINEA#MOD-EXT', 'MOD-EXT', 
  'LINEA#MOD-OT', 'MOD-OT', 
  'LINEA#MOD-ING', 'MOD-ING',
  'LINEA#MOD-LEAD', 'MOD-LEAD', 
  'LINEA#MOD-CONT', 'MOD-CONT', 
  'LINEA#MOD-SDM', 'MOD-SDM',
  'LINEA#MOD-PM', 'MOD-PM',
  'LINEA#MOD-PMO', 'MOD-PMO',
  'MOD-IN1', 'MOD-IN2', 'MOD-IN3',
  'MOD', 'CATEGORIA#MOD', 
  'Mano de Obra Directa',
  'Ingeniero Soporte N1', 'Ingeniero Soporte N2', 'Ingeniero Soporte N3',
  'Ingeniero Lider', 'Project Manager', 'Service Delivery Manager'
].map(normalizeKey);

/**
 * Normalized canonical labor keys set for O(1) lookup
 * Exported for use in performance-critical lookups
 */
export const LABOR_CANONICAL_KEYS_SET = new Set(LABOR_CANONICAL_KEYS);

/**
 * Check if a key matches any canonical labor identifier
 * 
 * @param key - The key to check (will be normalized internally)
 * @returns true if the key matches a canonical labor identifier
 */
export function isLaborByKey(key?: string): boolean {
  if (!key) return false;
  const normalized = normalizeKey(key);
  if (!normalized) return false;
  
  return LABOR_CANONICAL_KEYS_SET.has(normalized);
}

/**
 * Taxonomy entry interface
 */
export interface TaxonomyEntry {
  rubroId?: string;
  rubro_id?: string;
  line_item_id?: string;
  description?: string;
  category?: string;
  isLabor?: boolean;
  name?: string;
  slug?: string;
  [key: string]: any;
}

/**
 * Rubro row interface (generic allocation/forecast row)
 */
export interface RubroRow {
  rubroId?: string;
  rubro_id?: string;
  line_item_id?: string;
  lineItemId?: string;
  name?: string;
  description?: string;
  category?: string;
  [key: string]: any;
}

/**
 * Tolerant rubro lookup - substring and fuzzy matching fallback
 * 
 * This implements the tolerant matching logic from PR #921
 * Used as a fallback when strict map lookup and labor key heuristic fail
 */
export function tolerantRubroLookup(
  rubroRow: RubroRow,
  taxonomyMap: Map<string, TaxonomyEntry>
): TaxonomyEntry | null {
  // Extract all candidate keys from the rubro row
  const candidates = [
    rubroRow.rubroId,
    rubroRow.rubro_id,
    rubroRow.line_item_id,
    rubroRow.lineItemId,
    rubroRow.name,
    rubroRow.description,
  ].filter(Boolean).map(k => normalizeKey(k as string));
  
  if (candidates.length === 0) return null;
  
  // Try substring matching for each candidate
  const allTaxonomyKeys = Array.from(taxonomyMap.keys());
  
  for (const candidate of candidates) {
    if (!candidate || candidate.length < 3) continue;
    
    // Look for partial matches
    for (const taxKey of allTaxonomyKeys) {
      if (!taxKey || taxKey.length < 3) continue;
      
      const minLength = Math.min(candidate.length, taxKey.length);
      const maxLength = Math.max(candidate.length, taxKey.length);
      
      // Check if one contains the other and similarity ratio is good
      if ((candidate.includes(taxKey) || taxKey.includes(candidate)) && 
          minLength / maxLength >= 0.6) {
        const match = taxonomyMap.get(taxKey);
        if (match) {
          return match;
        }
      }
    }
  }
  
  return null;
}

/**
 * Lookup taxonomy entry for a rubro row with robust fallback chain
 * 
 * Lookup order:
 * 1. Strict map lookup by exact keys (O(1))
 * 2. Canonical labor key heuristic (O(1) Set lookup) → returns synthetic labor taxonomy
 * 3. Tolerant fallback (substring/fuzzy matching) → O(n) but cached
 * 
 * @param taxonomyMap - Pre-built taxonomy map (indexed by normalized keys)
 * @param rubroRow - The rubro/allocation row to look up
 * @param cache - Cache map to store lookup results (for performance)
 * @returns Taxonomy entry or null if not found
 */
export function lookupTaxonomy(
  taxonomyMap: Map<string, TaxonomyEntry>,
  rubroRow: RubroRow,
  cache: Map<string, TaxonomyEntry | null>
): TaxonomyEntry | null {
  // Extract candidate keys from rubro row
  const candidates = [
    rubroRow.rubroId,
    rubroRow.rubro_id,
    rubroRow.line_item_id,
    rubroRow.lineItemId,
    rubroRow.name,
    rubroRow.description,
  ].filter(Boolean).map(k => normalizeKey(k as string));
  
  if (candidates.length === 0) return null;
  
  const primaryKey = candidates[0];
  
  // Step 1: Check cache first
  for (const candidateKey of candidates) {
    if (cache.has(candidateKey)) {
      const cached = cache.get(candidateKey);
      return cached ?? null;
    }
  }
  
  // Step 2: Try strict map lookup
  for (const candidateKey of candidates) {
    const tax = taxonomyMap.get(candidateKey);
    if (tax) {
      cache.set(primaryKey, tax);
      return tax;
    }
  }
  
  // Step 3: Try canonical labor key heuristic
  // If any candidate matches a canonical labor key, return synthetic labor taxonomy
  for (const candidateKey of candidates) {
    if (isLaborByKey(candidateKey)) {
      const syntheticLabor: TaxonomyEntry = {
        rubroId: 'MOD',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        name: 'Mano de Obra (MOD)',
        description: rubroRow.description || 'Mano de Obra Directa',
      };
      cache.set(primaryKey, syntheticLabor);
      
      // Debug log (dev only)
      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[lookupTaxonomy] Labor key match: "${candidateKey}" → synthetic MOD taxonomy`
        );
      }
      
      return syntheticLabor;
    }
  }
  
  // Step 4: Tolerant fallback (substring/fuzzy matching)
  const tolerantMatch = tolerantRubroLookup(rubroRow, taxonomyMap);
  cache.set(primaryKey, tolerantMatch);
  
  if (tolerantMatch && process.env.NODE_ENV !== 'production') {
    console.debug(
      `[lookupTaxonomy] Tolerant match: "${primaryKey}" → ${tolerantMatch.rubroId || tolerantMatch.name}`
    );
  }
  
  return tolerantMatch;
}

/**
 * Build a taxonomy map from a taxonomy dictionary
 * Seeds the map with multiple keys per entry for fast lookup
 * 
 * @param taxonomyByRubroId - Dictionary of taxonomy entries indexed by rubroId
 * @returns Map with normalized keys for O(1) lookups
 */
export function buildTaxonomyMap(
  taxonomyByRubroId: Record<string, TaxonomyEntry>
): Map<string, TaxonomyEntry> {
  const map = new Map<string, TaxonomyEntry>();
  
  for (const [rubroId, taxonomy] of Object.entries(taxonomyByRubroId)) {
    if (!taxonomy) continue;
    
    // Index by rubroId variants
    if (taxonomy.rubroId) {
      map.set(normalizeKey(taxonomy.rubroId), taxonomy);
    }
    if (taxonomy.rubro_id) {
      map.set(normalizeKey(taxonomy.rubro_id), taxonomy);
    }
    if (taxonomy.line_item_id) {
      map.set(normalizeKey(taxonomy.line_item_id), taxonomy);
    }
    
    // Index by name/slug
    if (taxonomy.name) {
      const slug = normalizeKey(taxonomy.name);
      if (slug && !map.has(slug)) {
        map.set(slug, taxonomy);
      }
    }
    if (taxonomy.slug) {
      const slug = normalizeKey(taxonomy.slug);
      if (slug && !map.has(slug)) {
        map.set(slug, taxonomy);
      }
    }
    
    // Index by original key
    const normalizedRubroId = normalizeKey(rubroId);
    if (normalizedRubroId && !map.has(normalizedRubroId)) {
      map.set(normalizedRubroId, taxonomy);
    }
  }
  
  // Seed canonical labor keys if they don't already have taxonomy entries
  // Map them to a canonical MOD entry if one exists
  const modCandidate = 
    map.get('mod') || 
    map.get('mod-lead') || 
    map.get('mod-sdm') ||
    map.get('categoria-mod');
  
  if (modCandidate) {
    // Iterate Set directly - ES2020 supports this
    for (const laborKey of LABOR_CANONICAL_KEYS) {
      if (!map.has(laborKey)) {
        // Create a variant of the MOD entry with isLabor flag
        map.set(laborKey, {
          ...modCandidate,
          isLabor: true,
        });
      }
    }
  }
  
  return map;
}
