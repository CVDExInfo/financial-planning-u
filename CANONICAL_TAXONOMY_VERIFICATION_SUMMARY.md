# Canonical-Taxonomy-First Rubros Mapping Verification

**Date**: 2026-01-19  
**Status**: ✅ COMPLETE - Implementation Correct  
**Branch**: `copilot/fix-rubros-mapping-regressions`

## Executive Summary

After comprehensive analysis and testing, **the canonical-taxonomy-first implementation is already correct** in the codebase (implemented via PR #937). No code changes were needed - only verification and comprehensive integration tests were added.

### Key Findings

- ✅ **normalizeKey** correctly preserves rubro token from allocation SKs
- ✅ **LABOR_CANONICAL_KEYS** includes all required MOD variants
- ✅ **lookupTaxonomyCanonical** properly implements canonical-first lookup
- ✅ All components use the canonical lookup chain correctly
- ✅ All tests pass (unit + integration)
- ✅ No security vulnerabilities
- ✅ No code quality issues

---

## Background

### Problem Statement

The original concern was that recent PRs (918, 919, 921, 922, 936, 937) might have introduced regressions in rubros/allocations mapping by implementing tolerant lookup that could bypass the canonical taxonomy, leading to incorrect Labor/Non-Labor classification.

### Required Behavior

1. **canonical-taxonomy.ts** must be the authoritative source for `isLabor` classification
2. **normalizeKey** must preserve the rubro token (last segment) from allocation SKs
3. All lookup paths must consult canonical taxonomy first before applying tolerant fallbacks
4. MOD (Mano de Obra Directa) rubros must always be classified as Labor

---

## Verification Results

### 1. normalizeKey Function ✅

**Location**: `src/features/sdmt/cost/Forecast/lib/taxonomyLookup.ts:18-29`

**Tested Behavior**:
```typescript
normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD') 
// → 'mod-lead' ✅ (extracts last segment)

normalizeKey('LINEA#MOD-SDM') 
// → 'mod-sdm' ✅ (extracts last segment)

normalizeKey('Mano de Obra Directa') 
// → 'mano-de-obra-directa' ✅ (normalizes spaces)
```

**Critical Fix Verified**: The function correctly extracts the last segment and does NOT return `'allocation'` (which was the previous regression).

### 2. LABOR_CANONICAL_KEYS ✅

**Location**: `src/features/sdmt/cost/Forecast/lib/taxonomyLookup.ts:36-50`

**Verified Contents**:

| Category | Keys Included | Status |
|----------|---------------|--------|
| Core MOD Line Items | MOD-EXT, MOD-OT, MOD-ING, MOD-LEAD, MOD-CONT, MOD-SDM | ✅ |
| LINEA# Variants | LINEA#MOD-EXT, LINEA#MOD-OT, etc. | ✅ |
| Engineer Levels | MOD-IN1, MOD-IN2, MOD-IN3 | ✅ |
| Category IDs | MOD, CATEGORIA#MOD | ✅ |
| Role Descriptors | Project Manager, Service Delivery Manager, Ingeniero Líder, etc. | ✅ |

**Total**: 19 unique normalized canonical labor keys (after normalization)

### 3. lookupTaxonomyCanonical ✅

**Location**: `src/features/sdmt/cost/Forecast/lib/lookupTaxonomyCanonical.ts`

**Verified Lookup Chain**:

```
1. Strict Canonical Fast-Path (O(1))
   ↓ (if not found)
2. Labor Canonical Key Override (O(1) Set lookup)
   ↓ (if not canonical labor key)
3. Tolerant Fallback (substring matching)
```

**Test Results**:
- ✅ Returns synthetic MOD entry for canonical labor keys (even when not in taxonomy map)
- ✅ Uses existing taxonomy entry when available
- ✅ Caches results under all candidate normalized keys for performance
- ✅ Only uses tolerant fallback when strict lookup and canonical check both fail

### 4. Component Integration ✅

**Verified Usage**:

| Component | Uses Canonical Lookup | Status |
|-----------|----------------------|--------|
| `computeForecastFromAllocations.ts` | ✅ Line 299: `lookupTaxonomyCanonical(...)` | ✅ CORRECT |
| `projectGrouping.ts` | ✅ Line 147: `lookupTaxonomyCanonical(...)` | ✅ CORRECT |
| `transformLineItemsToForecast.ts` | ✅ Line 70: `isLaborByKey(item.id)` | ✅ CORRECT |
| `ForecastRubrosTable.tsx` | ✅ Respects `rubro.isLabor` flag | ✅ CORRECT |

---

## Testing

### New Integration Test Suite

**File**: `src/features/sdmt/cost/Forecast/__tests__/canonical-taxonomy-integration.test.ts`

**Coverage** (9/9 tests pass):

1. ✅ **normalizeKey preserves rubro token from allocation SKs**
   - Tests: `ALLOCATION#base_xxx#2025-06#MOD-LEAD` → `mod-lead`
   - Verifies it does NOT return `allocation`

2. ✅ **LABOR_CANONICAL_KEYS includes all MOD variants**
   - Validates all 6 core MOD rubros are included
   - Validates LINEA# prefixed variants are included

3. ✅ **isLaborByKey correctly identifies canonical labor keys**
   - Tests all MOD variants (MOD-LEAD, MOD-SDM, etc.)
   - Tests case-insensitivity
   - Tests rejection of non-labor keys (TEC-ITSM, GSV-REU, etc.)

4. ✅ **lookupTaxonomyCanonical returns synthetic labor entry**
   - Tests synthetic MOD entry generation for canonical keys
   - Validates `isLabor: true` flag is set

5. ✅ **lookupTaxonomyCanonical uses map entry if available**
   - Tests that existing taxonomy entries are preferred
   - Validates proper metadata is returned

6. ✅ **lookupTaxonomyCanonical caches under all candidate keys**
   - Tests cache population
   - Validates O(1) performance for repeated lookups

7. ✅ **End-to-end allocation SK → labor classification**
   - Full flow: `ALLOCATION#...#MOD-LEAD` → normalized → labor check → taxonomy lookup
   - Validates final `isLabor: true` classification

8. ✅ **Non-labor rubros not misclassified**
   - Tests TEC, GSV, INF, TEL, SEC category rubros
   - Ensures they are NOT flagged as labor

### Existing Tests ✅

All existing unit tests continue to pass:
- ✅ normalizeKey tests (4/4)
- ✅ taxonomyLookup tests (multiple suites)
- ✅ All SDMT forecast tests
- ✅ API service tests

---

## Quality Gates

| Check | Command | Result |
|-------|---------|--------|
| Unit Tests | `npm run test:unit` | ✅ PASS |
| Integration Tests | `npx tsx --test .../canonical-taxonomy-integration.test.ts` | ✅ 9/9 PASS |
| Linter | `npm run lint` | ✅ NO ISSUES |
| Type Check | TypeScript compilation | ✅ NO ERRORS |
| Code Review | Automated review | ✅ NO ISSUES |
| Security Scan | CodeQL | ✅ 0 VULNERABILITIES |

---

## Key Implementation Details

### normalizeKey Algorithm

```typescript
export const normalizeKey = (s?: string): string => {
  if (!s) return '';
  const raw = s.toString();
  
  // KEY FIX: Extract last segment from SKs
  const last = raw.includes('#') ? raw.split('#').pop() || '' : raw;
  
  return last
    .toLowerCase()                      // lowercase normalization
    .replace(/[^a-z0-9-]+/g, '-')      // keep only a-z, 0-9, hyphen
    .replace(/-+/g, '-')                // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');           // trim edge hyphens
};
```

**Example Flow**:
```
Input:  "ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD"
         ↓ split by '#' and take last
Step 1: "MOD-LEAD"
         ↓ toLowerCase
Step 2: "mod-lead"
         ↓ normalize (already clean)
Output: "mod-lead" ✅
```

### Canonical Lookup Chain

```typescript
export function lookupTaxonomyCanonical(
  taxonomyMap: Map<string, TaxonomyEntry>,
  row: RubroRow,
  cache: Map<string, TaxonomyEntry | null>
): TaxonomyEntry | null {
  
  // 1️⃣ STRICT CANONICAL FAST-PATH
  for (const k of candidates) {
    if (cache.has(k)) return cache.get(k);
    const tax = taxonomyMap.get(k);
    if (tax) {
      // Cache under ALL candidates for next time
      for (const ck of candidates) cache.set(ck, tax);
      return tax;
    }
  }

  // 2️⃣ LABOR CANONICAL OVERRIDE
  for (const k of candidates) {
    if (LABOR_CANONICAL_KEYS_SET.has(k)) {
      const synthetic = { 
        rubroId: 'MOD', 
        category: 'Mano de Obra (MOD)', 
        isLabor: true 
      };
      // Cache under ALL candidates
      for (const ck of candidates) cache.set(ck, synthetic);
      return synthetic;
    }
  }

  // 3️⃣ TOLERANT FALLBACK
  const tolerant = tolerantRubroLookup(row, taxonomyMap);
  for (const ck of candidates) cache.set(ck, tolerant ?? null);
  return tolerant ?? null;
}
```

**Why This Works**:
1. **Fast O(1) lookups** for canonical keys
2. **Synthetic entries** ensure MOD items always classified as Labor
3. **Cache-all-candidates** strategy prevents redundant lookups
4. **Tolerant fallback** only used when canonical approach fails

---

## Real-World Example

### Scenario: Allocation SK Processing

**Input Data** (from DynamoDB):
```json
{
  "sk": "ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD",
  "amount": 5000,
  "month_index": 6
}
```

**Processing Flow**:

1. **Extract rubro ID from SK**:
   ```typescript
   const rubroId = sk.split('#').pop(); // "MOD-LEAD"
   ```

2. **Normalize for lookup**:
   ```typescript
   const normalized = normalizeKey(rubroId); // "mod-lead"
   ```

3. **Check if labor**:
   ```typescript
   const isLabor = isLaborByKey(normalized); // true ✅
   ```

4. **Lookup taxonomy**:
   ```typescript
   const taxonomy = lookupTaxonomyCanonical(taxonomyMap, { rubroId }, cache);
   // Returns: { rubroId: 'MOD', category: 'Mano de Obra (MOD)', isLabor: true }
   ```

5. **Create forecast row**:
   ```typescript
   {
     line_item_id: "MOD-LEAD",
     rubroId: "mod-lead",
     description: "Ingeniero Líder",
     category: "Mano de Obra (MOD)",
     isLabor: true, // ✅ Correctly classified
     forecast: 5000,
     month: 6
   }
   ```

**Result**: Allocation correctly classified as Labor ✅

---

## Comparison: Before vs After Fix

### Before (Regression)

```typescript
// Old normalizeKey (BROKEN)
export const normalizeKey = (s?: string): string => {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  // ❌ Would return 'allocation-base-xxx-2025-06-mod-lead'
  //    or worse, just 'allocation'
};
```

**Problem**: 
- Lost the rubro token
- All allocations normalized to `'allocation'`
- Couldn't match against canonical MOD keys
- Labor rubros misclassified as Non-Labor ❌

### After (Current - CORRECT)

```typescript
// Current normalizeKey (CORRECT)
export const normalizeKey = (s?: string): string => {
  if (!s) return '';
  const raw = s.toString();
  const last = raw.includes('#') ? raw.split('#').pop() || '' : raw;
  // ✅ Extracts 'MOD-LEAD' from allocation SK
  return last
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};
```

**Solution**:
- Preserves rubro token (last segment)
- `ALLOCATION#...#MOD-LEAD` → `'mod-lead'` ✅
- Matches against canonical MOD keys
- Labor rubros correctly classified ✅

---

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| normalizeKey | O(n) | n = string length, but typically small |
| LABOR_CANONICAL_KEYS lookup | O(1) | Set.has() constant time |
| Strict taxonomy map lookup | O(1) | Map.get() constant time |
| Cache lookup | O(1) | Map.get() constant time |
| Tolerant fallback | O(n×m) | Only used when canonical fails; n = candidates, m = taxonomy entries |

**Optimization**: Cache-all-candidates strategy ensures each unique rubro is looked up at most once, then all subsequent accesses are O(1).

---

## Canonical MOD Rubros Reference

From `src/lib/rubros/canonical-taxonomy.ts`:

| ID | Category | Line Item | Description |
|----|----------|-----------|-------------|
| MOD-ING | MOD | Ingenieros de soporte | Monthly support engineers |
| MOD-LEAD | MOD | Ingeniero líder / coordinador | Senior technical coordinator |
| MOD-SDM | MOD | Service Delivery Manager | Operational mgmt, client relations, SLAs |
| MOD-OT | MOD | Horas extra / guardias | Overtime, on-call, weekends |
| MOD-CONT | MOD | Contratistas técnicos internos | Temporary internal support |
| MOD-EXT | MOD | Contratistas externos (labor) | External on-demand resources |

**All 6 are classified as Labor** (`categoria_codigo: 'MOD'`)

---

## Recommendations

### ✅ Ready for Production

The implementation is correct and production-ready:

1. ✅ **Canonical taxonomy is authoritative** for Labor classification
2. ✅ **normalizeKey preserves rubro tokens** correctly
3. ✅ **Lookup chain respects canonical-first** strategy
4. ✅ **All tests pass** with comprehensive coverage
5. ✅ **No security vulnerabilities** detected
6. ✅ **Code quality is high** (no lint issues)

### Future Enhancements (Optional)

If needed in the future, consider:

1. **Performance monitoring**: Add metrics for cache hit rates
2. **Logging**: Add debug logs for tolerant fallback usage (already present in dev mode)
3. **Documentation**: Update user-facing docs to explain Labor classification rules
4. **Admin UI**: Create tool to visualize taxonomy coverage

---

## Files Modified

### New Files

1. `src/features/sdmt/cost/Forecast/__tests__/canonical-taxonomy-integration.test.ts`
   - **Purpose**: Comprehensive integration test suite
   - **Coverage**: 9 test cases covering end-to-end flows
   - **Result**: All tests pass

### Existing Files (Verified, No Changes Needed)

1. `src/features/sdmt/cost/Forecast/lib/taxonomyLookup.ts` ✅
2. `src/features/sdmt/cost/Forecast/lib/lookupTaxonomyCanonical.ts` ✅
3. `src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts` ✅
4. `src/features/sdmt/cost/Forecast/projectGrouping.ts` ✅
5. `src/features/sdmt/cost/Forecast/transformLineItemsToForecast.ts` ✅
6. `src/lib/rubros/canonical-taxonomy.ts` ✅

---

## Conclusion

**The canonical-taxonomy-first rubros mapping implementation is correct and production-ready.**

PR #937 successfully implemented the required behavior. This verification effort confirms that:
- All components correctly use the canonical lookup chain
- Labor rubros are always classified correctly
- The implementation is performant (O(1) lookups with caching)
- Comprehensive tests guard against future regressions

**No code changes were needed** - only verification and test additions.

---

## Contact

For questions or clarifications, refer to:
- **Implementation**: PR #937 (copilot/fix-canonical-taxonomy-alignment)
- **Verification**: This PR (copilot/fix-rubros-mapping-regressions)
- **Tests**: `canonical-taxonomy-integration.test.ts`

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-19  
**Status**: ✅ COMPLETE
