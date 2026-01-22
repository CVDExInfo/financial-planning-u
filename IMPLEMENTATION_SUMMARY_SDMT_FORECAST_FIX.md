# SDMT Forecast Production Failure Fix - Implementation Summary

## Overview
This PR implements surgical fixes to address SDMT Forecast production failures related to portfolio loading race conditions, taxonomy drift, and UI visibility issues.

## Problem Statement
The SDMT Forecast module experienced three interacting failures:
1. **Portfolio loader race condition**: `loadPortfolioForecast()` early-exits when projects list is initially empty
2. **Frontend layout gating**: Feature flag `VITE_FINZ_NEW_FORECAST_LAYOUT` hides canonical grids without clear visibility
3. **Taxonomy drift**: Backend and frontend canonical taxonomies can diverge, causing "Sin descripción" issues

## Changes Implemented

### 1. Portfolio Loader Race Condition Fix
**File**: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

- Added 500ms wait in `loadPortfolioForecast()` when candidate projects are initially empty
- Changed `candidateProjects` from `const` to `let` to allow re-evaluation after wait
- Improved logic flow to distinguish between "projects still loading" vs "truly no projects"
- **Impact**: Prevents empty TODOS grid when projects data is delayed

### 2. Debug Banner for Feature Flags
**File**: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

- Added development-only debug banner showing `NEW_FORECAST_LAYOUT` flag value
- Positioned in header for easy visibility during debugging
- Only renders in `import.meta.env.DEV` mode
- **Impact**: Makes feature flag status transparent during development and staging

### 3. Rubro Normalization Helper
**File**: `src/api/finanzasClient.ts`

- Added `normalizeRubroItem()` export function
- Handles multiple backend response field variations: `rubro_id`, `linea_codigo`, `id`, `code`, `linea_id`
- Ensures canonical fields (`rubro_id`, `linea_codigo`, `description`, `descripcion`) are always present
- **Impact**: Defensive normalization reduces "missing field" errors

### 4. ESLint Guard Against Backend Imports
**File**: `eslint.config.js`

- Added `no-restricted-imports` rule with pattern matching `services/finanzas-api/*`
- Prevents frontend code from directly importing backend code
- Provides helpful error message directing to proper abstractions
- **Impact**: Prevents taxonomy drift at build time

### 5. Taxonomy Sync Validation Script
**File**: `scripts/validate-taxonomy-sync.cjs`

- Compares canonical taxonomy IDs between frontend and backend
- Extracts IDs using regex pattern matching
- Exits with error code 2 if mismatches found
- Can be integrated into CI/CD pipeline
- **Impact**: Detects taxonomy drift before deployment

### 6. Materialization Debug Script
**File**: `scripts/materialize-debug.cjs`

- Provides programmatic interface to trigger baseline materialization
- Functions: `acceptBaseline()`, `getBaseline()`
- Requires `API_BASE` and `AUTH_TOKEN` env vars
- Can be used for ops/debugging materialization issues
- **Impact**: Enables manual materialization retries in production

## Test Coverage

### Unit Tests for normalizeRubroItem
**File**: `src/api/__tests__/normalizeRubroItem.test.ts`
- 7 tests covering all normalization scenarios
- Tests field fallback chains
- Tests preservation of original fields
- **Status**: ✅ All passing

### Unit Tests for Portfolio Loader Race Condition
**File**: `src/features/sdmt/cost/Forecast/__tests__/portfolioLoaderRaceCondition.test.ts`
- 5 tests covering race condition scenarios
- Tests wait mechanism with simulated delays
- Tests early return when no projects
- Tests immediate success when projects already loaded
- **Status**: ✅ All passing

**Total Test Coverage**: 12 new tests, 100% passing

## Validation Results

### Linting
```bash
npm run lint
```
✅ **PASS** - No new linting errors introduced

### Type Checking
```bash
npm run typecheck
```
✅ **PASS** - No new type errors in modified files (pre-existing errors in other files remain)

### ESLint Rule Testing
Verified the `no-restricted-imports` rule correctly catches violations:
```
src/test.ts
  2:1  error  'services/finanzas-api/...' import is restricted
```
✅ **PASS** - Rule working as expected

### Taxonomy Sync Validation
```bash
node scripts/validate-taxonomy-sync.cjs
```
Result: Detected legitimate drift (69 IDs in frontend only)
✅ **PASS** - Script correctly identifies mismatches

## Files Changed

| File | Lines Added | Lines Removed | Purpose |
|------|-------------|---------------|---------|
| eslint.config.js | 9 | 0 | Add import restriction rule |
| scripts/materialize-debug.cjs | 111 | 0 | Ops debugging tool |
| scripts/validate-taxonomy-sync.cjs | 51 | 0 | CI validation script |
| src/api/__tests__/normalizeRubroItem.test.ts | 104 | 0 | Unit tests |
| src/api/finanzasClient.ts | 14 | 0 | Normalization helper |
| src/features/sdmt/cost/Forecast/SDMTForecast.tsx | 24 | 5 | Race fix + debug banner |
| src/features/sdmt/cost/Forecast/__tests__/portfolioLoaderRaceCondition.test.ts | 123 | 0 | Unit tests |
| **TOTAL** | **436** | **5** | **7 files** |

## Acceptance Criteria Status

- ✅ Portfolio loader waits for projects before failing
- ✅ Debug banner shows feature flag status in dev mode
- ✅ Rubro normalization handles field variations
- ✅ ESLint prevents backend imports in src/
- ✅ Taxonomy sync validation script operational
- ✅ Materialization debug tool available
- ✅ All new tests passing
- ✅ No new lint or type errors introduced

## Deployment Notes

### Pre-Deployment Checklist
1. Review feature flag value: `VITE_FINZ_NEW_FORECAST_LAYOUT`
2. Ensure taxonomy is synchronized if needed
3. Consider adding `validate-taxonomy-sync` to CI pipeline

### Post-Deployment Verification
1. Check debug banner appears in staging (dev mode)
2. Navigate to TODOS view and verify grid loads
3. Monitor console for portfolio loader debug messages
4. Verify no "Sin descripción" for standard rubros

### Rollback Plan
If issues occur:
1. Feature flag can be toggled via environment variables
2. Changes are minimal and surgical - can be reverted via git
3. Use materialization debug script if baseline issues persist

## Related PRs Referenced
- PR #768: Unmarshal + persist counts
- PR #824: Materialization improvements with fallback
- PR #928: Layout changes
- PR #953: Restore TODOS loading
- PR #963: Taxonomy fix

## Next Steps (Future Work)
1. Create shared `packages/taxonomy` for single source of truth
2. Add `validate-taxonomy-sync` to GitHub Actions CI
3. Add contract tests for forecast endpoints
4. Consider backend materialization improvements

## Security Summary
- ✅ No new security vulnerabilities introduced
- ✅ ESLint rule prevents architectural violations
- ✅ Scripts use environment variables for credentials (not hardcoded)
