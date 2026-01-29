# Fix Missing Canonical Rubro Aliases - Implementation Summary

## Overview
Fixed repeated console warnings where canonical lookup reports unknown rubro_ids by adding safe canonical aliases and legacy map entries, throttling warnings, adding comprehensive tests, and producing evidence that warnings are eliminated.

## Changes Made

### 1. Canonical Taxonomy Updates (`src/lib/rubros/canonical-taxonomy.ts`)

#### Added Aliases to LEGACY_RUBRO_ID_MAP
- `mod-lead-ingeniero-delivery` → MOD-LEAD
- `mod-lead-ingeniero` → MOD-LEAD
- `ingeniero-delivery` → MOD-LEAD
- `Ingeniero Delivery` → MOD-LEAD
- `mod-sdm-service-delivery-manager` → MOD-SDM
- `mod-sdm-sdm` → MOD-SDM

#### Extended LABOR_CANONICAL_KEYS
Added human-readable and allocation token forms:
- Additional MOD-LEAD aliases: 'mod-lead-ingeniero-delivery', 'ingeniero delivery', 'ingeniero-delivery', 'mod-lead-ingeniero', 'Ingeniero Delivery'
- Additional MOD-SDM aliases: 'mod-sdm-service-delivery-manager', 'service delivery manager', 'service-delivery-manager', 'mod-sdm-sdm'

#### Implemented Warning Throttling
- Created `_rubrosWarned` Set to track warned keys
- Implemented `warnUnknownRubro()` function that warns only once per normalized key
- Uses consistent `normalizeKey()` function for normalization
- Provides clearer guidance in warning messages

### 2. Unit Tests (`src/features/sdmt/cost/Forecast/__tests__/canonicalAliases.test.ts`)

Created comprehensive test suite with 8 test cases:
1. ✅ MOD-LEAD canonical aliases map to MOD-LEAD
2. ✅ MOD-SDM canonical aliases map to MOD-SDM
3. ✅ LEGACY_RUBRO_ID_MAP contains all new aliases
4. ✅ LABOR_CANONICAL_KEYS_SET includes normalized aliases
5. ✅ lookupTaxonomyCanonical recognizes new aliases as labor
6. ✅ Allocation SK patterns with new aliases
7. ✅ Throttled warnings do not repeat for same normalized key
8. ✅ Human-readable names map to labor

**All tests pass successfully!**

### 3. Diagnostic Script (`scripts/find-missing-rubros.ts`)

Created diagnostic tool to:
- Validate all canonical aliases
- List taxonomy coverage statistics
- Analyze allocation files for missing keys (when provided)
- Display newly added aliases with validation status

Output:
```
Total Canonical Rubros: 71
Legacy Mappings: 88
Labor Canonical Keys: 37

MOD-LEAD aliases:
  mod-lead-ingeniero-delivery → MOD-LEAD (valid: true)
  mod-lead-ingeniero → MOD-LEAD (valid: true)
  ingeniero-delivery → MOD-LEAD (valid: true)
  Ingeniero Delivery → MOD-LEAD (valid: true)

MOD-SDM aliases:
  mod-sdm-service-delivery-manager → MOD-SDM (valid: true)
  mod-sdm-sdm → MOD-SDM (valid: true)

✅ All aliases validated successfully!
```

### 4. E2E Smoke Test (`tests/e2e/finanzas/forecast-rubros-warnings.spec.ts`)

Created Playwright test suite with 3 test cases:
1. Forecast page does not log unknown rubros taxonomy warnings
2. Forecast page loads allocation data without errors
3. Canonical aliases are recognized in labor classification

Features:
- Captures all console messages during page load
- Filters for rubros-taxonomy warnings
- Validates no taxonomy-related errors
- Uses reliable network idle detection

### 5. Code Review Feedback Addressed

✅ Use `normalizeKey()` function for consistent throttling
✅ Update e2e tests to use reliable path navigation
✅ Reduce hard-coded timeouts, rely on network idle states

## Root Cause Explanation

Previously, the canonical taxonomy did **not** contain aliases for some normalized keys emitted by allocations (e.g., `mod-lead-ingeniero-delivery` vs canonical `mod-lead`). Because canonical-first logic is strict, those keys were not found and the tolerant fallback either didn't match them or was not triggered consistently. 

Tests added previously validated tolerant fallback but did not include the specific alias forms coming from allocation SKs. The fix is to add canonical aliases + legacy mappings and tests that assert these normalized tokens map to canonical MOD entries. We also throttled warnings so remaining unknowns are visible but not spammy.

## Test Results

### Unit Tests
```
✔ MOD-LEAD canonical aliases map to MOD-LEAD
✔ MOD-SDM canonical aliases map to MOD-SDM
✔ LEGACY_RUBRO_ID_MAP contains all new aliases
✔ LABOR_CANONICAL_KEYS_SET includes normalized aliases
✔ lookupTaxonomyCanonical recognizes new aliases as labor
✔ allocation SK patterns with new aliases
✔ throttled warnings do not repeat for same normalized key
✔ human-readable names map to labor
ℹ tests 8
ℹ pass 8
ℹ fail 0
```

### Existing Tests
All existing taxonomy lookup tests continue to pass (6 tests):
```
✔ labor canonical override
✔ canonical lookup from map
✔ cache-all-candidates strategy
✔ labor keys have priority over map
✔ returns null for unknown entries
✔ uses cache on subsequent lookups
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

### Security Scan
CodeQL analysis: **0 security vulnerabilities found**

## Files Changed

1. `src/lib/rubros/canonical-taxonomy.ts` - Added aliases and throttling
2. `src/features/sdmt/cost/Forecast/__tests__/canonicalAliases.test.ts` - New unit tests
3. `scripts/find-missing-rubros.ts` - New diagnostic script
4. `tests/e2e/finanzas/forecast-rubros-warnings.spec.ts` - New e2e test

## QA & Validation Steps

### Manual Testing
1. Run diagnostic script: `npx tsx scripts/find-missing-rubros.ts`
2. Run unit tests: `npx tsx --test src/features/sdmt/cost/Forecast/__tests__/canonicalAliases.test.ts`
3. Run existing tests: `npx tsx --test src/features/sdmt/cost/Forecast/__tests__/lookupTaxonomyCanonical.test.ts`
4. Start dev server and navigate to forecast page
5. Open browser console and verify no "[rubros-taxonomy] Unknown rubro_id" warnings appear
6. Run e2e test: `npx playwright test tests/e2e/finanzas/forecast-rubros-warnings.spec.ts`

### Production Validation
After deployment:
1. Navigate to SDMT forecast page
2. Open browser console (F12)
3. Verify no repeated "[rubros-taxonomy] Unknown rubro_id" warnings
4. If warnings appear for new keys, add them to taxonomy following this pattern
5. Monitor CloudWatch logs for any remaining taxonomy warnings

## Impact

✅ **No Breaking Changes** - All existing tests pass
✅ **Backward Compatible** - Legacy IDs still work via LEGACY_RUBRO_ID_MAP
✅ **Performance** - O(1) lookups maintained via Set-based checking
✅ **Maintainability** - Clear pattern for adding new aliases in the future
✅ **User Experience** - Cleaner console output, no warning spam

## Future Improvements

1. Monitor console warnings in production for any new missing keys
2. Consider adding automated alerts if unknown rubro_ids exceed threshold
3. Document the alias addition process in contribution guidelines
4. Consider creating a validation step in CI/CD to catch missing aliases early
