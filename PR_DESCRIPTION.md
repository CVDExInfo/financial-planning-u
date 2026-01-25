# Fix backfill.yml + SDMT Forecast Grid (single-project mode)

## Problem Statement

Two critical issues needed to be addressed:

1. **Backfill Workflow Issues**: 
   - Incorrect AWS region default (us-east-1 instead of us-east-2)
   - Broken sanity check using invalid nested `pnpm exec`
   - Script path validation needed

2. **SDMT Forecast Grid Blank in Single-Project Mode**:
   - Root cause: `ForecastRubrosTable` grouping was gated by `isPortfolioView`
   - Single-project mode returned empty Maps → blank grid despite having allocation data
   - PR-930 materializer writes allocations, but UI couldn't display them in single-project view

## Solution

### Part A: Backfill Workflow Fix

**File**: `.github/workflows/backfill.yml`

Changes made:
1. Changed default AWS region from `us-east-1` to `us-east-2` (2 occurrences: lines 54 and 104)
2. Fixed Sanity step (lines 84-97):
   - **Before**: `pnpm exec -c 'pnpm exec ts-node --version >/dev/null 2>&1'` (invalid)
   - **After**: `pnpm exec ts-node --version >/dev/null 2>&1` (direct test)
   - Now exits with code 1 if ts-node unavailable (prevents silent failures)
3. Verified script path is correct: `./scripts/backfill-baseline-materialization.ts` relative to `working-directory: ./services/finanzas-api`

### Part B: SDMT Forecast Grid Fix

**Files Modified**:
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
- `src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts`

**Files Added**:
- `src/features/sdmt/cost/Forecast/buildGroupingMaps.ts`
- `src/features/sdmt/cost/Forecast/__tests__/buildGroupingMaps.spec.ts`
- `src/features/sdmt/cost/Forecast/__tests__/ForecastRubrosTable.singleProject.spec.tsx`

#### Key Changes:

1. **SDMTForecast.tsx** (lines 2018-2072):
   - Removed `isPortfolioView` guard from grouping computations
   - Now computes `categoryTotals`, `categoryRubros`, `projectTotals`, `projectRubros` for both modes
   - In single-project mode: filters `forecastData` to `selectedProjectId` before grouping
   - Uses appropriate line items: `safeLineItems` (single) vs `portfolioLineItems` (portfolio)

2. **computeForecastFromAllocations.ts**:
   - Added `normalizeRubroKey` export for defensive matching
   - Improved substring matching with 70% overlap requirement (prevents false positives like 'ABC' matching 'ABCDEF')
   - Maintains backward compatibility with legacy normalization

3. **buildGroupingMaps.ts** (new helper):
   - Universal grouping logic for both portfolio and single-project views
   - Normalizes rubro keys for taxonomy lookup
   - Handles UNMAPPED category for missing taxonomy entries
   - Available for future refactoring (not actively used yet)

## Testing

### Unit Tests Created

1. **buildGroupingMaps.spec.ts** (4 tests, all passing):
   - ✅ Group forecast rows by category for single project
   - ✅ Handle portfolio mode with multiple projects
   - ✅ Normalize rubro keys for matching
   - ✅ Handle UNMAPPED category for missing taxonomy entries

2. **ForecastRubrosTable.singleProject.spec.tsx** (2 tests, all passing):
   - ✅ Build category grouping for single project with MOD and equipment rubros
   - ✅ Filter forecast data to single project when multiple projects present

### Test Results

```
✅ Backend: 519/519 tests passing (services/finanzas-api)
✅ Frontend: 9/9 forecast fallback tests passing
✅ New Tests: 6/6 tests passing (buildGroupingMaps + singleProject)
✅ All code review feedback addressed
```

## Validation Checklist

### Automated (Completed)
- [x] Backend unit tests pass
- [x] Frontend unit tests pass
- [x] New unit tests pass
- [x] Code builds without errors
- [x] Code review comments addressed

### Manual Testing (Requires User)

#### Backfill Workflow
```bash
# Trigger workflow in GitHub Actions UI:
# 1. Go to Actions → Backfill Baseline Materialization
# 2. Click "Run workflow"
# 3. Select environment: dev
# 4. Verify in logs:
#    - Node/pnpm/ts-node versions print
#    - Sanity check passes (no errors)
#    - Dry-run executes and prints baseline counts
```

**Expected logs**:
```
node: v18.x.x
pnpm: 9.15.9
Checking ts-node availability via pnpm exec...
ts-node is available via pnpm exec
vXX.X.X
---------------------------------------------------------
Running backfill materialization in DRY-RUN mode...
Environment: dev
[Script output showing baselines and planned allocations]
```

#### Frontend Single-Project View
```bash
# Start backend (requires AWS credentials)
cd services/finanzas-api
# Follow dev setup instructions in repo

# Start frontend
cd ../..
pnpm run dev

# Navigate to:
# 1. Select a single project (not "TODOS")
# 2. Go to Forecast tab
# 3. Verify Forecast Rubros Table displays:
#    - Labor rows (MOD-LEAD, etc.) with P/F/A columns
#    - Non-labor rows (Equipment, etc.)
#    - Category subtotals
#    - Grand total row
```

**Expected behavior**:
- Grid shows rows grouped by category
- Monthly P/F/A values display
- Can toggle between "Por Categoría" and "Por Proyecto" views
- Can filter "Mano de Obra (MOD)" / "Todo" / "No Mano de Obra"

#### Portfolio Mode (Regression Check)
```bash
# Navigate to:
# 1. Select "TODOS" in project dropdown
# 2. Go to Forecast tab
# 3. Verify no changes in behavior:
#    - All project data aggregates correctly
#    - Category grouping still works
#    - Project grouping view available
```

## Related Work

- **PR-930**: materializer-from-seeded-rubros (already merged)
  - Validated implementation includes:
    - Rubros query from taxonomy table
    - `unit_cost` writing to allocations
    - Idempotent writes with `forceRewriteZeros` flag

## Breaking Changes

None. This is a bug fix that enables existing functionality (single-project forecast grid) without changing any APIs or data structures.

## Rollback Plan

If regressions occur in portfolio mode:
1. Revert this PR
2. Single-project mode will return to blank grid (existing bug)
3. Portfolio mode will continue to work as before

## Security Notes

- ✅ No new dependencies added
- ✅ No changes to authentication/authorization
- ✅ No changes to data persistence semantics
- ✅ Defensive normalization only (read-time, not write-time)

## Deployment Notes

- No database migrations required
- No environment variable changes required
- Safe to deploy to dev → staging → production
- Backfill workflow changes take effect immediately (uses workflow YAML from branch)

---

**Validation Summary**: All automated tests pass. Manual testing requires:
1. Trigger backfill workflow in GitHub Actions to verify Part A
2. Run dev server with materialized baseline to verify Part B (single-project grid)
3. Verify portfolio mode still works (regression check)
