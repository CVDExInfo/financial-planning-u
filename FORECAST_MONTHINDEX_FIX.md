# Forecast Month Index Fix - Complete

## Summary

Fixed the forecast builder to properly use `month_index` from allocations, completing the end-to-end M13+ contract month mapping.

## Problem

PR #867 fixed the materializer to write allocations with `month_index`, but the forecast builder (`computeForecastFromAllocations.ts`) was still parsing calendar months from the `month` field (YYYY-MM format), causing M13+ allocations to map to wrong months (e.g., M13 → month 1).

## Solution

Updated `computeForecastFromAllocations.ts` to prioritize `month_index` field:

1. **First**: Use `month_index` if present (authoritative, written by materializer)
2. **Second**: Use `month` if numeric (legacy)
3. **Third**: Parse `month` as YYYY-MM calendar date (legacy fallback)

## Changes

### File: src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts

**Before**:
```typescript
let monthNum = 0;
if (typeof alloc.month === 'number') {
  monthNum = alloc.month;
} else if (typeof alloc.month === 'string') {
  const match = alloc.month.match(/\d{4}-(\d{2})/);
  if (match) {
    monthNum = parseInt(match[1], 10);  // Calendar month only (1-12)
  }
}
```

**After**:
```typescript
let monthNum = 0;
if ((alloc as any).month_index !== undefined && (alloc as any).month_index !== null) {
  monthNum = Number((alloc as any).month_index);  // Contract month (1-60)
} else if (typeof alloc.month === 'number') {
  monthNum = alloc.month;
} else if (typeof alloc.month === 'string') {
  const match = alloc.month.match(/^(\d{4})-(\d{2})$/);
  if (match) monthNum = parseInt(match[2], 10);
  else {
    const parsed = parseInt(alloc.month as any, 10);
    if (!isNaN(parsed)) monthNum = parsed;
  }
}
```

### File: src/features/sdmt/cost/Forecast/__tests__/forecastFallback.test.ts

**Added test**:
```typescript
it('uses month_index when present (M13 -> month 13)', () => {
  const allocations = [{
    month: "2026-01",
    month_index: 13,
    amount: 1000,
    rubro_id: "R-1",
    projectId: "P-1",
  }];
  const rubros = [{ id: "R-1", projectId: "P-1", description: "Dev" }];
  const rows = computeForecastFromAllocations(allocations as any, rubros as any, 36, "P-1");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].month, 13);
  assert.strictEqual(rows[0].forecast, 1000);
});
```

**Fixed test**: Changed "month 13 is invalid" to "month 99 is invalid" (month 13 is now valid for M13+)

## Test Results

### Frontend Tests
```
✔ Forecast Fallback Logic (5.136392ms)
  ✔ computeForecastFromAllocations
    ✔ should create forecast cells from allocation data (1.714969ms)
    ✔ should resolve projectId from allocations when not provided (0.205736ms)
    ✔ should handle numeric month format (0.190957ms)
    ✔ should aggregate multiple allocations for same rubro/month (0.239889ms)
    ✔ should handle allocations without matching rubros (0.175077ms)
    ✔ should return empty array when allocations are empty (0.136074ms)
    ✔ should filter out invalid months (0.271017ms)
    ✔ uses month_index when present (M13 -> month 13) (0.199564ms)
  ✔ Grid display with allocations fallback (0.505997ms)

Tests: 9 passed, 9 total
```

### Backend Tests
```
✓ Allocations Materializer (5/5 PASS)
  ✓ materializes allocations for 36-month baseline
  ✓ ensures idempotency: second run skips existing allocations
  ✓ uses deterministic SKs for idempotency
  ✓ handles M13+ calendar month computation correctly
  ✓ supports up to M60 (5 years)

✓ AcceptBaseline Materialization (4/4 PASS)
  ✓ acceptBaseline calls both rubros and allocations materializers
  ✓ materialization summary includes correct counts for duration > 12 months
  ✓ forecast integration: allocations appear as forecast (F) values
  ✓ logs materialization summary with baselineId
```

## Impact

This completes the end-to-end fix for M13+ forecast values:

1. ✅ **PR #867**: Admin backfill materializes allocations with `month_index` (1-based contract month)
2. ✅ **This fix**: Forecast builder uses `month_index` for correct contract month mapping
3. ✅ **Result**: UI correctly displays F values in M13+ cells for multi-year projects

## Verification

```bash
# Branch
git rev-parse --abbrev-ref HEAD
# copilot/fix-216492260-1063445104-94dd9e51-35b9-4936-83a2-54c8c51cbe68

# Latest commit
git log -n 1 --pretty=oneline
# f72c712eb5be5b41a0fcdf1c35ac398a6b0c1092 fix(forecast): prefer month_index from allocations for correct M13+ contract month mapping
```

## Ready to Merge

All tests pass. The forecast builder now correctly maps M13+ allocations using the authoritative `month_index` field written by the materializer.
