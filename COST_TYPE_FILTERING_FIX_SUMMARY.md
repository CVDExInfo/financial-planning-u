# Cost Type Filtering Fix Summary

## Problem Statement

The Monthly Snapshot Grid (Position #3: "Matriz del Mes — Vista Ejecutiva") was experiencing issues where:

1. **Cost type was often `undefined`** - When forecast cells didn't include a `category` field and `lineItemCategoryMap` lacked that line item
2. **Labor/No-Labor filters returned no rows** - The `filterRowByCostType` function dropped rows with `costType === undefined`
3. **Partial data display in TODOS mode** - Many rows were filtered out because cost type couldn't be determined

## Root Causes

### 1. Missing Category Information
- Forecast cells often don't include a `category` field
- `lineItemCategoryMap` built from `lineItems` may not include all rubro/line_item metadata
- Portfolio mode aggregates forecast cells but may drop category fields

### 2. Strict Filtering Logic
- `filterRowByCostType` returned `null` for rows where `row.costType === undefined`
- This was intentionally conservative but brittle when category metadata is missing

## Implemented Fixes

### Fix A: Tolerant Cost Type Derivation

**Changes to `monthlySnapshotTypes.ts`:**
```typescript
export const deriveCostType = (category?: string, fallbackText?: string): CostType | undefined => {
  if (!category && !fallbackText) return undefined;
  
  // If category exists, use it for classification
  if (category) {
    return isLabor(category) ? 'labor' : 'non-labor';
  }
  
  // If no category, try to infer from fallbackText using role patterns
  return isLabor(undefined, fallbackText) ? 'labor' : 'non-labor';
};
```

**Changes to `useMonthlySnapshotData.ts` (project branch):**
```typescript
const resolvedCategory = cell.category || lineItemCategoryMap.get(cell.line_item_id) || lineItemCategoryMap.get(rubroId);

// Fallback to descriptive fields when category is missing
const fallbackText = cell.description || rubroName || cell.projectName || '';
const costType = deriveCostType(resolvedCategory, fallbackText);
```

**Changes to `useMonthlySnapshotData.ts` (rubro branch):**
```typescript
const resolvedCategory = cell.category || lineItemCategoryMap.get(cell.line_item_id) || lineItemCategoryMap.get(rubroId);

// Fallback to descriptive fields when category is missing
const fallbackText = cell.description || projectName || rubroName || '';
const costType = deriveCostType(resolvedCategory, fallbackText);
```

**How it works:**
- First tries to resolve category from `cell.category`, `lineItemCategoryMap`, etc.
- If no category found, uses description/name fields as fallback
- `deriveCostType` now accepts a second `fallbackText` parameter
- When category is missing, it calls `isLabor(undefined, fallbackText)` which checks for labor role keywords like "ingeniero", "pm", "sdm"

### Fix B: Tolerant Filtering

**Changes to `filterRowByCostType` function:**
```typescript
if (row.costType === undefined) {
  // Try to infer from name/code using same labor heuristics
  const inferredLabor = isLabor(undefined, row.name) || isLabor(undefined, row.code);
  if (costTypeFilter === 'labor' && inferredLabor) return row;
  if (costTypeFilter === 'non-labor' && !inferredLabor) return row;
  return costTypeFilter === 'all' ? row : null;
}
```

**How it works:**
- When `row.costType === undefined`, attempts to infer from `row.name` or `row.code`
- Uses the same `isLabor()` heuristics that check for labor keywords
- Only includes the row if inference matches the filter (labor/non-labor)
- Conservative approach: returns `null` if no match found

### Diagnostic Logging

**Changes to `buildSnapshotRows`:**
```typescript
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  const totalActual = monthData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
  const totalForecast = monthData.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
  const missingCategoryCount = monthData.filter(
    (c) =>
      !c.category &&
      !lineItemCategoryMap.get(c.line_item_id) &&
      !lineItemCategoryMap.get(c.rubroId || c.line_item_id)
  ).length;
  console.log(
    `[useMonthlySnapshotData] monthDataLen=${monthData.length}, totalActual=${totalActual}, totalForecast=${totalForecast}, month=${actualMonthIndex}, missingCategoryCount=${missingCategoryCount}`
  );
}
```

**Benefits:**
- Logs how many cells are missing category information (DEV mode only)
- Helps diagnose portfolio loader issues
- Added safe guard for `import.meta.env` to support Node.js test environment

## Test Coverage

Created comprehensive unit tests in `useMonthlySnapshotData.costType.spec.ts`:

1. ✅ Derive labor cost type from description when category is missing
2. ✅ Derive labor cost type from role keywords (PM, SDM, Ingeniero)
3. ✅ Derive non-labor cost type from description
4. ✅ Prefer category over description when both are present
5. ✅ Use lineItemCategoryMap when available
6. ✅ Work with rubro grouping mode
7. ✅ Include rows with labor keywords in name when filtering
8. ✅ Handle mixed labor and non-labor items
9. ✅ Handle empty description gracefully
10. ✅ Follow category resolution order correctly

**All 10 tests pass.**

## Why These Fixes Are Safe

1. **Only widen classification ability** - Don't change how rows are budgeted, aggregated, or saved
2. **Reuse existing heuristics** - `rubros-category-utils.isLabor()` already implements robust text-based classification
3. **Conservative filtering** - Filter fallback is gated only when `costType` is undefined; normal rows unchanged
4. **Backward compatible** - Rows with explicit `category` remain unchanged
5. **Minimal changes** - Only touched the specific functions causing the issue

## Expected Impact

### Before Fix:
- Labor/No-Labor filters often showed 0 results
- Many rows missing from TODOS/portfolio view
- Cost breakdown bar showed incomplete data

### After Fix:
- Labor/No-Labor filters now work even when category metadata is missing
- Rows with descriptions like "Ingeniero Delivery", "Project Manager", "SDM" correctly classified as labor
- Infrastructure, equipment items correctly classified as non-labor
- More complete data display in portfolio mode
- Diagnostic logs help identify remaining category issues

## Manual QA Checklist

1. ✅ Open `/finanzas/sdmt/cost/forecast` with TODOS / Matriz del Mes
2. ✅ Select `Tipo de costo: Labor` → confirm expected rows appear (PM/SDM/Ingeniero)
3. ✅ Select `Tipo de costo: No Labor` → confirm equipment/infrastructure rows appear
4. ✅ Toggle `Agrupar por` and `Período` to ensure counts update
5. ✅ Check DEV console: confirm `missingCategoryCount` is logged
6. ✅ Verify no regressions: expand groups, check child rows, verify budget/forecast/actual values

## Next Steps (Optional Improvements)

1. **Upstream fix**: Ensure `SDMTForecast`'s portfolio loader populates `portfolioLineItems` with normalized `category` for each line item using `ensureCategory`
2. **Audit report**: Add DEV-only UI showing how many rows were classified by category vs. inferred
3. **Backend repair job**: Fill missing categories for portfolio line items if taxonomy migration left holes

## Files Changed

1. `src/features/sdmt/cost/Forecast/components/hooks/useMonthlySnapshotData.ts` - Main implementation
2. `src/features/sdmt/cost/Forecast/components/monthlySnapshotTypes.ts` - Updated deriveCostType signature
3. `src/features/sdmt/cost/Forecast/components/hooks/__tests__/useMonthlySnapshotData.costType.spec.ts` - New test file

**Total Lines Changed:** +408 insertions, -7 deletions
