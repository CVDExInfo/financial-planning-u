/**
 * Rubro Validation Module
 * 
 * Provides strict validation for rubro IDs against the canonical taxonomy.
 * Supports both audit mode (warnings) and strict mode (rejections) via feature flag.
 */

import { getCanonicalRubroId, CANONICAL_RUBROS_TAXONOMY, getAllCanonicalIds } from './canonical-taxonomy';

/**
 * Validate a rubro ID and return the canonical version or throw an error
 * 
 * @param rawRubro - Raw rubro ID input from client
 * @param strict - Whether to enforce strict validation (default: checks STRICT_RUBRO_VALIDATION env var)
 * @returns Canonical rubro ID
 * @throws Error with 400 status if validation fails in strict mode
 */
export function validateCanonicalRubro(rawRubro?: string, strict?: boolean): string {
  // Check if rubro is provided
  if (!rawRubro || rawRubro.trim() === '') {
    const error: any = new Error('Missing rubro: rubro_id is required');
    error.statusCode = 400;
    throw error;
  }

  // Get canonical ID (this handles legacy mappings)
  const canonical = getCanonicalRubroId(rawRubro);
  
  if (!canonical) {
    // Rubro is completely unknown - neither canonical nor legacy
    const sample = CANONICAL_RUBROS_TAXONOMY.slice(0, 8).map(t => t.linea_codigo).join(', ');
    const error: any = new Error(
      `Unknown rubro '${rawRubro}'. Not found in canonical taxonomy. ` +
      `Acceptable canonical examples: ${sample}. ` +
      `Please use a valid canonical rubro ID from /data/rubros.taxonomy.json`
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if strict mode is enabled (from parameter or environment variable)
  const isStrict = strict !== undefined 
    ? strict 
    : process.env.STRICT_RUBRO_VALIDATION === 'true';

  // In strict mode, enforce that the input matches the canonical ID exactly (case-insensitive)
  const normalizedInput = rawRubro.toString().trim().toUpperCase();
  const normalizedCanonical = canonical.toString().trim().toUpperCase();
  
  if (normalizedInput !== normalizedCanonical) {
    if (isStrict) {
      const error: any = new Error(
        `Rubro must be canonical ID. Use '${canonical}' instead of '${rawRubro}'. ` +
        `The system is in strict mode and only accepts canonical IDs.`
      );
      error.statusCode = 400;
      throw error;
    } else {
      // In audit mode, log warning but allow it
      console.warn(
        `[validateRubro] AUDIT: Non-canonical rubro '${rawRubro}' mapped to '${canonical}'. ` +
        `Consider updating client to use canonical ID.`
      );
    }
  }

  return canonical;
}

/**
 * Validate multiple rubro IDs at once
 * 
 * @param rubros - Array of rubro IDs to validate
 * @param strict - Whether to enforce strict validation
 * @returns Array of canonical rubro IDs
 * @throws Error if any rubro is invalid
 */
export function validateCanonicalRubros(rubros: string[], strict?: boolean): string[] {
  if (!Array.isArray(rubros) || rubros.length === 0) {
    const error: any = new Error('Missing rubros: at least one rubro_id is required');
    error.statusCode = 400;
    throw error;
  }

  return rubros.map(rubro => validateCanonicalRubro(rubro, strict));
}

/**
 * Check if a rubro ID is valid without throwing
 * 
 * @param rubroId - Rubro ID to check
 * @returns Object with validation result and canonical ID if valid
 */
export function checkRubroValidity(rubroId: string): {
  isValid: boolean;
  canonical: string | null;
  error?: string;
} {
  try {
    const canonical = validateCanonicalRubro(rubroId, false);
    return {
      isValid: true,
      canonical,
    };
  } catch (err) {
    return {
      isValid: false,
      canonical: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get all valid canonical rubro IDs
 * Useful for UI dropdowns and validation messages
 * 
 * @returns Array of all canonical rubro IDs
 */
export function getValidRubroIds(): string[] {
  return getAllCanonicalIds();
}

/**
 * Get validation error response object
 * Useful for consistent error responses across handlers
 * 
 * @param rubroId - The invalid rubro ID
 * @param message - Custom error message
 * @returns Error response object
 */
export function buildRubroValidationError(rubroId: string, message?: string): {
  error: string;
  rubroId: string;
  validExamples: string[];
  documentation: string;
} {
  const sample = CANONICAL_RUBROS_TAXONOMY.slice(0, 10).map(t => t.linea_codigo);
  
  return {
    error: message || `Invalid rubro_id: ${rubroId}`,
    rubroId,
    validExamples: sample,
    documentation: 'See /data/rubros.taxonomy.json for complete list of valid canonical rubro IDs',
  };
}
