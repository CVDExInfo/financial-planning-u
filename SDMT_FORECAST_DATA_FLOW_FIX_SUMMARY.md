# SDMTForecast Data Flow Restoration - Implementation Summary

## Problem Statement
The SDMTForecast portfolio view (TODOS/All Projects) was displaying incomplete data because allocations were only being fetched in the single-project fallback path, not in the portfolio aggregation flow.

## Root Cause Analysis

### Issue Identified
In `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`, the `loadPortfolioForecast` function (lines ~805-1000) was missing the allocations fetch:

**Before (Portfolio View):**
```typescript
const [payload, invoices, projectLineItems] = await Promise.all([
  getForecastPayload(project.id, months),
  getProjectInvoices(project.id),
  getProjectRubros(project.id).catch(() => []),
]);
// ❌ Missing: getAllocations() call
```

**Single Project View (Working):**
```typescript
// In useSDMTForecastData.ts - allocations were correctly fetched
const allocations = await getAllocations(projectId, baselineId);
if (allocations.length > 0) {
  normalized = computeForecastFromAllocations(...);
}
```

## Solution Implemented

### Changes Made

**1. Added Imports (lines 73-85)**
```typescript
import {
  // ... existing imports
  getAllocations,  // ✅ Added
} from "@/api/finanzas";
import { computeForecastFromAllocations, type Allocation } from "./computeForecastFromAllocations";  // ✅ Added
import { transformLineItemsToForecast } from "./transformLineItemsToForecast";  // ✅ Added
```

**2. Added Allocations to Parallel Fetch (line 853-858)**
```typescript
const [payload, invoices, projectLineItems, allocations] = await Promise.all([
  getForecastPayload(project.id, months),
  getProjectInvoices(project.id),
  getProjectRubros(project.id).catch(() => [] as LineItem[]),
  getAllocations(project.id, project.baselineId).catch(() => [] as Allocation[]),  // ✅ Added
]);
```

**3. Implemented Allocations-First Fallback (lines 880-917)**
```typescript
// Fallback hierarchy (matching single-project view in useSDMTForecastData):
// 1. Try allocations if forecast is empty and allocations exist
// 2. Else try lineItems if available
if ((!normalized || normalized.length === 0) && hasAcceptedBaseline) {
  if (allocations.length > 0) {
    // ✅ NEW: Allocations fallback
    normalized = computeForecastFromAllocations(
      allocations,
      projectLineItems,
      months,
      project.id
    );
    usedFallback = true;
  } else if (projectLineItems.length > 0) {
    // Existing lineItems fallback
    normalized = transformLineItemsToForecast(
      projectLineItems,
      months,
      project.id
    );
    usedFallback = true;
  }
}
```

**4. Added Comprehensive Tests**
Created `src/features/sdmt/cost/Forecast/__tests__/portfolioAllocations.test.ts`:
- Tests allocations preferred over lineItems when both exist
- Tests graceful handling when allocations empty
- Documents expected parallel fetch structure (4 endpoints per project)

## Impact & Benefits

✅ **Complete Data Flow**: Portfolio view now fetches allocations, ensuring complete P/F/A values
✅ **Data Parity**: Portfolio view now matches single-project view behavior
✅ **Backward Compatible**: Graceful fallback chain maintained
✅ **Preserves Improvements**: All existing features retained (materialization, taxonomy, dedupe)
✅ **Well Tested**: New test suite documents and validates behavior
✅ **Security**: CodeQL scan passed with 0 alerts
✅ **Code Quality**: Code review passed with no comments

## Verification

### Build Status
```bash
✓ BUILD_TARGET=finanzas pnpm build
✓ Built in 12.54s
✓ No TypeScript errors
```

### Test Status
```bash
✓ portfolioAllocations.test.ts - 3 tests passed
✓ All existing tests still pass
```

### Security Status
```bash
✓ CodeQL scan: 0 alerts
✓ No new vulnerabilities introduced
```

## Surgical Fix Approach

Instead of reverting to Jan-15 version, implemented targeted fix:
- **Minimal Changes**: Only 43 lines changed in main file
- **Preserved All Improvements**: Kept materialization, taxonomy canonicalization, dedupe logic
- **Feature Flags Intact**: VITE_FINZ_NEW_FORECAST_LAYOUT still works
- **Clear Documentation**: Tests document expected behavior

## Files Changed

1. `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` (43 lines modified)
   - Added imports for getAllocations and computeForecastFromAllocations
   - Added allocations to Promise.all parallel fetch
   - Implemented allocations-first fallback hierarchy
   - Added debug logging

2. `src/features/sdmt/cost/Forecast/__tests__/portfolioAllocations.test.ts` (120 lines added)
   - New test suite documenting portfolio allocations behavior
   - Validates allocations fallback logic
   - Documents parallel fetch structure

## Next Steps for Deployment

1. ✅ Code review completed
2. ✅ Security scan completed
3. ✅ Tests passing
4. ✅ Build succeeds
5. **Ready for staging deployment**

### Expected Runtime Behavior

When loading portfolio view (TODOS):
1. For each project, fetch 4 endpoints in parallel:
   - `/dev/projects/{id}/forecast` (server forecast)
   - `/dev/projects/{id}/invoices` (actuals)
   - `/dev/projects/{id}/rubros` (line items)
   - `/dev/projects/{id}/allocations` ← **NOW INCLUDED**

2. If server forecast empty:
   - First try: Use allocations → computeForecastFromAllocations
   - Second try: Use lineItems → transformLineItemsToForecast
   - Result: Complete data in grid (P, F, A values)

### Monitoring

Check console logs in DEV mode for:
```
[SDMTForecast] Using allocations fallback for {projectId}, baseline {baselineId}: {count} allocations
```

This confirms allocations are being used when server forecast is empty.

## Rollback Plan

If issues arise:
```bash
git revert 20934f2
```

This will remove the allocations fetch and restore previous behavior (lineItems-only fallback).

---

**Summary**: Successfully restored data flow by adding allocations fetch to portfolio view with minimal, surgical changes. All tests pass, build succeeds, security scan clean. Ready for deployment.
