# Invoice and Budget Wiring Fix - Implementation Summary

## Problem Statement

Invoice (Real/actual) values and budget values weren't being properly wired into the SDMT forecast grids, preventing monthly totals and variances from reflecting invoices and budgets.

### Root Causes

1. **Invoices lacked canonical rubros**: `finz_prefacturas` records didn't have `rubro_canonical`, and the front-end didn't normalize them. Because grouping/dedupe uses canonical IDs, invoices failed to match rows → Real totals stayed 0.

2. **Budget mapping incomplete**: Backend returned `months: [{month:"2026-01", amount:1000000},...]` but didn't provide `monthlyMap` for easy frontend access to monthly budget values.

---

## Solution Overview

### Backend Changes

1. **invoices.ts** - Canonical Rubro Annotation
   - Annotate all invoices with `rubro_canonical` on read
   - Compute from: linea_codigo → rubroId → rubro → description using `getCanonicalRubroId`
   - Normalize month (extract from invoiceDate) and amount fields
   - Safe error handling with `logError` for consistency

2. **budgets.ts** - Monthly Budget Map
   - Add `monthlyMap` to GET /budgets/all-in/monthly response
   - Convert months array to object: `{"2026-01": 1000000, "2026-02": 6000000, ...}`
   - Improved type safety with explicit month object type

### Frontend Changes

3. **useSDMTForecastData.ts** - Enhanced Invoice Matching
   - Prioritize `rubro_canonical` from backend when available
   - Fallback to client-side `getCanonicalRubroId` computation
   - More reliable matching between invoices and forecast cells

### Testing

4. **New Test File**: `invoices.handler.spec.ts` (135 lines)
   - Test canonical rubro annotation with various field combinations
   - Test legacy RB#### ID mapping to canonical (RB0001 → MOD-ING)
   - Test unknown rubros with graceful fallback
   - Test error cases (missing params, empty results, wrong HTTP methods)

5. **Enhanced Test**: `budgets.handler.spec.ts` (+4 lines)
   - Verify `monthlyMap` is included in response payload
   - Verify correct month key to amount mapping

---

## Technical Flows

### Invoice Canonicalization Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. GET /invoices?project_id=XXX                              │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. DynamoDB Query → Raw Invoice Items                        │
│    [{linea_codigo: "MOD-ING", amount: 50000}, ...]           │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Annotate Each Invoice with rubro_canonical:               │
│    • Try linea_codigo (most reliable)                        │
│    • Try rubroId (may be legacy RB####)                      │
│    • Try rubro field                                         │
│    • Try description field                                   │
│    • Map legacy IDs → canonical (RB0001 → MOD-ING)           │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Return Annotated Invoices                                 │
│    [{rubro_canonical: "MOD-ING", month: "2026-01", ...}]     │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Frontend: matchInvoiceToCell() uses rubro_canonical       │
│    • Compare inv.rubro_canonical with cell.rubroId           │
│    • Match month index                                       │
│    • Aggregate amount into row.actual                        │
└──────────────────────────────────────────────────────────────┘
```

### Budget Integration Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. GET /budgets/all-in/monthly?year=2026                     │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Backend Returns:                                          │
│    {                                                         │
│      months: [                                               │
│        {month: "2026-01", amount: 1000000},                  │
│        {month: "2026-02", amount: 6000000}                   │
│      ],                                                      │
│      monthlyMap: {                                           │
│        "2026-01": 1000000,                                   │
│        "2026-02": 6000000                                    │
│      }                                                       │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Frontend: normalizeBudgetMonths()                         │
│    • Parse "YYYY-MM" → numeric month index (1-12)            │
│    • Build map: {1: 1000000, 2: 6000000, ...}                │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Merge into Forecast Rows                                  │
│    for (row of rows) {                                       │
│      row.budget = budgetMonthlyMap[row.month];               │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. UI Displays & Calculates Variance                         │
│    • Portfolio totals: sum(row.budget) per month             │
│    • Variance: row.actual - row.budget                       │
│    • % Consumption: (row.actual / row.forecast) * 100        │
└──────────────────────────────────────────────────────────────┘
```

---

## Files Changed (5 files, 182 lines)

### Backend
- `services/finanzas-api/src/handlers/invoices.ts` (+31 lines)
  - Added canonical rubro annotation logic
  - Normalize month and amount fields
  - Consistent error logging

- `services/finanzas-api/src/handlers/budgets.ts` (+7 lines)
  - Added monthlyMap field to response
  - Improved type safety

### Frontend
- `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts` (+5/-3 lines)
  - Prioritize rubro_canonical from backend
  - Enhanced invoice matching reliability

### Tests
- `services/finanzas-api/tests/unit/invoices.handler.spec.ts` (+135 lines, new file)
  - Comprehensive canonical rubro annotation tests
  - Legacy ID mapping tests
  - Error case coverage

- `services/finanzas-api/tests/unit/budgets.handler.spec.ts` (+4 lines)
  - monthlyMap verification tests

---

## Validation & Quality Assurance

### Test Results
- ✅ All 534 backend tests pass
- ✅ New invoice canonicalization tests (4 test cases)
- ✅ Enhanced budget tests verify monthlyMap
- ✅ CodeQL security scan: 0 alerts
- ✅ Code review: All feedback addressed

### Test Coverage
- Invoice annotation with linea_codigo
- Invoice annotation with legacy RB#### IDs  
- Invoice annotation with description fallback
- Unknown rubro graceful handling
- Budget monthlyMap structure
- Month key to amount mapping

### Security
- No new vulnerabilities introduced
- Safe NaN handling in Number conversions
- Defensive null/undefined checks
- Consistent error logging (no console.warn leaks)

---

## Deployment Notes

### Prerequisites
- No database migrations required
- No new dependencies
- Backward compatible (fields added, not removed)

### Rollback Plan
If issues arise, revert commits in reverse order:
```bash
git revert 8e747c9  # Refactor: type safety
git revert 56a8ebf  # Code review fixes
git revert 5364bbb  # Tests
git revert ac9510d  # Frontend changes
git revert 12916ce  # Backend changes
```

### Post-Deployment Validation
1. Check invoice endpoint returns `rubro_canonical`:
   ```bash
   curl /dev/invoices?project_id=P-123 | jq '.data[0].rubro_canonical'
   ```

2. Check budget endpoint returns `monthlyMap`:
   ```bash
   curl /dev/budgets/all-in/monthly?year=2026 | jq '.monthlyMap'
   ```

3. Verify UI:
   - Budget (P) column shows monthly totals
   - Real (A) column shows invoice values
   - Variance columns compute correctly

---

## Benefits

1. **Accurate Real/Actual Values**: Invoices now match forecast rows correctly via canonical rubros
2. **Budget Visibility**: Monthly budget values properly wired to forecast grids
3. **Better Variance Tracking**: Real vs Budget and Forecast vs Budget variances now accurate
4. **Improved Reliability**: Backend canonicalization reduces frontend computation errors
5. **Type Safety**: Explicit types improve maintainability
6. **Test Coverage**: Comprehensive tests prevent regressions

---

## Commits

1. `39885ab` - Initial plan
2. `12916ce` - Backend: Add canonical rubro annotation to invoices and monthlyMap to budgets
3. `ac9510d` - Frontend: Prioritize rubro_canonical from backend for invoice matching
4. `5364bbb` - Tests: Add invoice canonicalization and budget monthlyMap tests
5. `56a8ebf` - Code review: Use logError consistently and handle NaN
6. `8e747c9` - Refactor: Simplify Number conversion and improve type safety

---

## References

- Problem Statement: See PR description
- Canonical Taxonomy: `services/finanzas-api/src/lib/canonical-taxonomy.ts`
- Invoice Matching: `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts` (lines 291-463)
- Budget Normalization: `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts` (lines 36-68)

---

**Implementation Date**: 2026-01-23  
**Status**: ✅ Complete  
**Test Results**: 534/534 passing  
**Security Scan**: 0 alerts
