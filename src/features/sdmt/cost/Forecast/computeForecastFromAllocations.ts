/**
 * Allocation type definition for forecast fallback logic
 */
export interface Allocation {
  month: string | number; // "YYYY-MM" format or numeric 1-12
  amount: number;
  rubroId?: string;
  rubro_id?: string;
  line_item_id?: string;
  rubro_type?: string;
  projectId?: string;
}

/**
 * Taxonomy metadata for fallback enrichment
 */
export interface TaxonomyEntry {
  description?: string;
  category?: string;
}

/**
 * Compute minimal forecast from allocations data
 * 
 * When server forecast is empty but allocations exist, this creates a basic
 * forecast grid showing month totals from allocation data.
 * 
 * @param allocations - Allocation records from /allocations endpoint
 * @param rubros - Line items from /rubros endpoint (for enrichment)
 * @param months - Number of months to generate
 * @param projectId - Project identifier
 * @param taxonomyByRubroId - Optional taxonomy lookup for description/category fallback
 * @returns Array of forecast cells with month totals
 */
import type { LineItem } from '@/types/domain';

/**
 * Normalize ID for tolerant matching (case-insensitive, whitespace/underscore normalization)
 */
function normalizeId(s: string | null | undefined): string {
  return (s || "").toString().trim().toLowerCase().replace(/[_\s]+/g, "-");
}

/**
 * Normalize rubro key for defensive allocation→rubro matching
 * Strips hash suffix, lowercases, removes non-alphanumeric chars
 */
export const normalizeRubroKey = (s?: string): string => {
  if (!s) return '';
  return s
    .toString()
    .split('#')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
};

/**
 * Extended LineItem type that may have alternative ID fields
 */
export interface ExtendedLineItem extends LineItem {
  line_item_id?: string;
  rubroId?: string;
  projectId?: string;
}

/**
 * Helper to extract month number from YYYY-MM format string
 * @param dateStr - Date string in YYYY-MM format (e.g., "2025-06")
 * @returns Month number (1-12) or 0 if invalid
 */
function extractMonthFromYYYYMM(dateStr: string): number {
  const match = dateStr.match(/^(\d{4})-(\d{2})$/);
  return match ? parseInt(match[2], 10) : 0;
}

export interface ForecastRow {
  line_item_id: string;
  rubroId?: string;
  description?: string;
  category?: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  last_updated: string;
  updated_by: string;
  projectId?: string;
  projectName?: string;
}

export function computeForecastFromAllocations(
  allocations: Allocation[],
  rubros: LineItem[],
  months: number,
  projectId?: string,
  taxonomyByRubroId?: Record<string, TaxonomyEntry>
): ForecastRow[] {
  if (!allocations || allocations.length === 0) {
    return [];
  }

  const rubroWithProject = rubros.find(
    (rubro) => (rubro as ExtendedLineItem).projectId
  ) as ExtendedLineItem | undefined;
  const resolvedProjectId =
    projectId ||
    allocations.find((alloc) => alloc.projectId)?.projectId ||
    rubroWithProject?.projectId;

  if (!resolvedProjectId) {
    console.warn(
      "[computeForecastFromAllocations] Missing projectId; cannot build fallback forecast rows."
    );
    return [];
  }

  // Group allocations by month and rubroId
  const allocationMap = new Map<string, { month: number; amount: number; rubroId?: string }[]>();
  
  allocations.forEach(alloc => {
    // Determine contract month index. Tolerant parsing to accept all common allocation field shapes.
    // Priority:
    //  1) month_index (underscore) - authoritative, written by materializer
    //  2) monthIndex (camelCase) - common in labor allocations
    //  3) month if numeric (legacy)
    //  4) month as 'YYYY-MM' or numeric string (legacy/older rows)
    //  5) calendar_month / calendarMonthKey as 'YYYY-MM'
    let monthNum = 0;
    const a: any = alloc;

    // 1) explicit (underscore)
    if (a.month_index != null) {
      monthNum = Number(a.month_index);
    }
    // 2) explicit (camelCase)
    else if (a.monthIndex != null) {
      monthNum = Number(a.monthIndex);
    }
    // 3) numeric month (legacy)
    else if (typeof a.month === 'number') {
      monthNum = a.month;
    }
    // 4) string month: "YYYY-MM" or numeric string "6" or "06"
    else if (typeof a.month === 'string') {
      monthNum = extractMonthFromYYYYMM(a.month);
      if (monthNum === 0) {
        const parsed = parseInt(a.month, 10);
        if (!isNaN(parsed)) monthNum = parsed;
      }
    }
    // 5) calendar_month or calendarMonthKey as "YYYY-MM"
    else if (typeof a.calendar_month === 'string') {
      monthNum = extractMonthFromYYYYMM(a.calendar_month);
    } else if (typeof a.calendarMonthKey === 'string') {
      monthNum = extractMonthFromYYYYMM(a.calendarMonthKey);
    }

    // defensive: coerce and sanity
    if (!Number.isFinite(monthNum) || monthNum < 0) monthNum = 0;

    if (monthNum >= 1 && monthNum <= 60) { // Support up to 60 months
      const rubroId = alloc.rubroId || alloc.rubro_id || alloc.line_item_id || 'UNKNOWN';
      const key = `${rubroId}-${monthNum}`;
      
      if (!allocationMap.has(key)) {
        allocationMap.set(key, []);
      }
      
      allocationMap.get(key)!.push({
        month: monthNum,
        amount: Number(alloc.amount || 0),
        rubroId,
      });
    } else if (monthNum === 0) {
      // Debug: log when allocation is skipped due to month parsing failure
      console.warn(
        '[computeForecastFromAllocations] Skipping allocation with unparseable month:',
        { 
          rubroId: alloc.rubroId || alloc.rubro_id || alloc.line_item_id,
          month_index: (alloc as any).month_index,
          monthIndex: (alloc as any).monthIndex,
          month: alloc.month,
          calendar_month: (alloc as any).calendar_month,
          calendarMonthKey: (alloc as any).calendarMonthKey,
        }
      );
    }
  });

  // Performance optimization: Pre-index rubros for O(1) lookups instead of O(n) finds
  const rubrosByNormalizedKey = new Map<string, ExtendedLineItem>();
  const rubrosByExactId = new Map<string, ExtendedLineItem>();
  const rubrosBySubstring = new Map<string, ExtendedLineItem[]>();
  
  rubros.forEach(r => {
    const extended = r as ExtendedLineItem;
    const id = extended.id || extended.line_item_id || extended.rubroId;
    if (!id) return;
    
    // Index by exact normalized key
    const normalizedKey = normalizeRubroKey(id);
    if (normalizedKey && !rubrosByNormalizedKey.has(normalizedKey)) {
      rubrosByNormalizedKey.set(normalizedKey, extended);
    }
    
    // Index by exact ID
    const exactKey = normalizeId(id);
    if (exactKey && !rubrosByExactId.has(exactKey)) {
      rubrosByExactId.set(exactKey, extended);
    }
    if (extended.line_item_id) {
      const lineKey = normalizeId(extended.line_item_id);
      if (lineKey && !rubrosByExactId.has(lineKey)) {
        rubrosByExactId.set(lineKey, extended);
      }
    }
    if (extended.rubroId) {
      const rubroKey = normalizeId(extended.rubroId);
      if (rubroKey && !rubrosByExactId.has(rubroKey)) {
        rubrosByExactId.set(rubroKey, extended);
      }
    }
    
    // Index by substring for fuzzy matching (only for keys >= 3 chars)
    if (normalizedKey && normalizedKey.length >= 3) {
      const substringArray = rubrosBySubstring.get(normalizedKey);
      if (!substringArray) {
        rubrosBySubstring.set(normalizedKey, [extended]);
      } else {
        substringArray.push(extended);
      }
    }
  });

  // Create forecast cells from aggregated allocations
  const forecastCells: ForecastRow[] = [];
  
  let tolerantMatchCount = 0;
  let taxonomyFallbackCount = 0;
  let exactMatchCount = 0;
  
  allocationMap.forEach((allocList, key) => {
    if (allocList.length === 0) return;
    
    const firstAlloc = allocList[0];
    const totalAmount = allocList.reduce((sum, a) => sum + a.amount, 0);
    const rubroId = firstAlloc.rubroId || 'UNKNOWN';
    
    // Try to find matching rubro for metadata using indexed lookups
    const allocKey = normalizeRubroKey(rubroId);
    let matchingRubro = rubrosByNormalizedKey.get(allocKey);
    
    if (matchingRubro) {
      exactMatchCount++;
    } else {
      // Try substring matching with pre-indexed data
      if (allocKey.length >= 3) {
        for (const [key, candidates] of rubrosBySubstring.entries()) {
          if (key === allocKey) continue; // Already checked exact match
          const minLength = Math.min(allocKey.length, key.length);
          const maxLength = Math.max(allocKey.length, key.length);
          if ((allocKey.includes(key) || key.includes(allocKey)) && minLength / maxLength >= 0.7) {
            matchingRubro = candidates[0]; // Take first match
            break;
          }
        }
      }
      
      if (!matchingRubro) {
        // Try legacy normalized comparison
        const nRubroId = normalizeId(rubroId);
        matchingRubro = rubrosByExactId.get(nRubroId);
        
        if (matchingRubro) {
          tolerantMatchCount++;
        }
      }
    }
    
    // Description and category fallback chain
    const taxonomyEntry = taxonomyByRubroId?.[rubroId] ?? taxonomyByRubroId?.[matchingRubro?.id ?? ""];
    const description = matchingRubro?.description ?? taxonomyEntry?.description ?? `Allocation ${rubroId}`;
    const category = matchingRubro?.category ?? taxonomyEntry?.category ?? 'Allocations';
    
    if (!matchingRubro && taxonomyEntry) {
      taxonomyFallbackCount++;
    }
    
    forecastCells.push({
      line_item_id: rubroId,
      rubroId: rubroId,
      description,
      category,
      month: firstAlloc.month,
      planned: totalAmount,
      forecast: totalAmount,
      actual: 0,
      variance: 0,
      last_updated: new Date().toISOString(),
      updated_by: 'system-allocations',
      projectId: resolvedProjectId,
    });
  });
  
  // Debug logging (DEV only)
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.info(
      `[computeForecastFromAllocations] Processed ${allocations.length} allocations → ${forecastCells.length} forecast cells`,
      {
        exactMatches: exactMatchCount,
        tolerantMatches: tolerantMatchCount,
        taxonomyFallbacks: taxonomyFallbackCount,
        projectId: resolvedProjectId,
      }
    );
  }

  return forecastCells;
}
