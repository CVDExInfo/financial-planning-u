/**
 * Generate a deterministic, stable line item ID from canonical rubro ID and metadata.
 * 
 * This function ensures that the same inputs always produce the same output,
 * which is critical for:
 * - Consistent allocation keys across materializations
 * - Deterministic SK generation in DynamoDB
 * - Reliable joins between allocations, line items, and rubros
 * 
 * @param canonicalRubroId - The canonical taxonomy linea_codigo (e.g., "MOD-SDM")
 * @param role - Optional role description (e.g., "Service Delivery Manager")
 * @param category - Optional category (e.g., "MOD")
 * @returns Stable, normalized line item ID
 * 
 * @example
 * ```typescript
 * stableLineItemId("MOD-SDM", "Service Delivery Manager", "MOD")
 * // => "mod-sdm-service-delivery-manager-mod"
 * 
 * stableLineItemId("MOD-SDM")
 * // => "mod-sdm"
 * 
 * stableLineItemId("GSV-RPT", "Informes Mensuales")
 * // => "gsv-rpt-informes-mensuales"
 * ```
 */
export function stableLineItemId(
  canonicalRubroId: string | undefined | null,
  role?: string | undefined | null,
  category?: string | undefined | null
): string {
  const parts = [canonicalRubroId, role, category].filter(
    (part) => part !== undefined && part !== null && String(part).trim().length > 0
  );

  if (parts.length === 0) {
    throw new Error('[stableLineItemId] At least canonicalRubroId must be provided');
  }

  return parts
    .map((part) =>
      String(part)
        .trim()
        .toLowerCase()
        // Normalize accents and special characters
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Replace non-alphanumeric with hyphens
        .replace(/[^a-z0-9]+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/(^-|-$)/g, '')
    )
    .join('-');
}

/**
 * Alias for stableLineItemId for backward compatibility.
 * Used in materializers and other backend code.
 */
export const stableIdFromParts = stableLineItemId;
