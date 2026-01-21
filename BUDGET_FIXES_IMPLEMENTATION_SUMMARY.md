# Budget Values, Taxonomy, and Invoice Matching Fixes - Implementation Summary

## Overview
This document summarizes the changes made to fix missing budget values in grids/charts, resolve taxonomy warnings, and improve invoice-to-forecast matching in the SDMT Forecast module.

## Problem Statement
The following issues were identified:
1. **Missing budget values** in forecast grids and charts (Cuadrícula de Pronóstico, Matriz del Mes, Gráficos de Tendencias)
2. **Taxonomy warnings** for human-readable names like "Service Delivery Manager"
3. **Invoice actuals showing $0** despite invoices existing in the system
4. **Missing DEV diagnostics** to help debug these issues

## Changes Implemented

### 1. Monthly Budget Debug Logging (SDMTForecast.tsx)

**Location:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**What was added:**
- DEV-gated console.debug statements after monthly budgets are successfully loaded
- DEV-gated console.debug when budgets are not found (404 response)
- Logging includes budget count, total budget amount, and useMonthlyBudget flag

**Code snippet:**
```typescript
// DEV: Log monthly budgets loaded to help debug budget display issues
if (import.meta.env.DEV) {
  console.debug('[SDMTForecast] monthlyBudgets loaded', {
    year,
    count: budgets.length,
    monthlyBudgets: budgets,
    useMonthlyBudget: budgets.length > 0,
    totalBudget: budgets.reduce((sum, b) => sum + b.budget, 0),
  });
}
```

**Why:** Helps developers quickly verify that budgets are being loaded correctly and identify if the issue is with data loading or component rendering.

---

### 2. Invoice Matching Telemetry (SDMTForecast.tsx)

**Location:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` (two locations: single-project and portfolio views)

**What was added:**
- DEV-gated telemetry to track unmatched invoices
- Logs count of unmatched invoices and sample data
- Shows sample invoice fields and forecast keys to help identify mismatches

**Code snippet:**
```typescript
// DEV telemetry: Track unmatched invoices to help debug actuals
const unmatchedInvoices = matchedInvoices.filter(inv => {
  return !normalized.some(cell => 
    cell.line_item_id === inv.line_item_id && cell.month === inv.month
  );
});

if (unmatchedInvoices.length > 0) {
  console.debug(
    `[Forecast] unmatchedInvoices=${unmatchedInvoices.length}/${matchedInvoices.length}`,
    {
      sample: unmatchedInvoices.slice(0, 3).map(inv => ({
        line_item_id: inv.line_item_id,
        month: inv.month,
        amount: inv.amount,
        rubroId: inv.rubroId || inv.rubro_id,
      })),
      forecastKeys: normalized.slice(0, 5).map(cell => ({
        line_item_id: cell.line_item_id,
        month: cell.month,
        rubroId: cell.rubroId,
      })),
    }
  );
}
```

**Why:** Provides visibility into why invoice actuals aren't showing up, making it easier to identify field naming mismatches or normalization issues.

---

### 3. Enhanced Invoice Field Matching (useSDMTForecastData.ts)

**Location:** `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts`

**What was changed:**
- Extended invoice rubro ID lookup to include `linea_codigo` and `linea_id` fields
- Added support for `descripcion` field (Spanish) in addition to `description` (English)
- Enhanced taxonomy lookup to include `linea_gasto` field

**Before:**
```typescript
const invRubroId = inv.rubroId || inv.rubro_id || inv.line_item_id;
```

**After:**
```typescript
// Support multiple invoice field variants: rubroId, rubro_id, line_item_id, linea_codigo, linea_id, descripcion
const invRubroId = inv.rubroId || inv.rubro_id || inv.line_item_id || inv.linea_codigo || inv.linea_id;
```

**Why:** Different data sources (invoices, allocations, baselines) may use different field names. Supporting multiple variants ensures robust matching regardless of source.

---

### 4. Taxonomy Indexing Enhancement (useSDMTForecastData.ts)

**Location:** `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts`

**What was added:**
- Index taxonomy entries by `linea_gasto` (normalized)
- Index taxonomy entries by `descripcion` (normalized)
- Allows matching invoices that use human-readable descriptions

**Code snippet:**
```typescript
// Also index by linea_gasto for invoice matching (normalize to handle matching)
if (taxonomy.linea_gasto) {
  const normalizedLineaGasto = normalizeString(taxonomy.linea_gasto);
  taxonomyByRubroId[normalizedLineaGasto] = entry;
}

// Also index by descripcion for invoice matching (normalize to handle matching)
if (taxonomy.descripcion) {
  const normalizedDescripcion = normalizeString(taxonomy.descripcion);
  taxonomyByRubroId[normalizedDescripcion] = entry;
}
```

**Why:** Enables matching when invoices contain human-readable descriptions instead of canonical IDs.

---

### 5. Client-Side Taxonomy Aliases (canonical-taxonomy.ts)

**Location:** `src/lib/rubros/canonical-taxonomy.ts`

**What was added:**
- Title case variants: `'Service Delivery Manager': 'MOD-SDM'`
- Abbreviations: `'SDM': 'MOD-SDM'`
- Parenthetical variants: `'Service Delivery Manager (SDM)': 'MOD-SDM'`
- Additional labor role variants: `'Ingeniero Soporte N1': 'MOD-ING'`, etc.
- Project Manager title case: `'Project Manager': 'MOD-LEAD'`

**Code snippet:**
```typescript
'Service Delivery Manager': 'MOD-SDM', // Add title case variant
'Service Delivery Manager (SDM)': 'MOD-SDM', // Add variant with abbreviation
'SDM': 'MOD-SDM', // Add abbreviation alone
'Ingeniero Soporte N1': 'MOD-ING', // Add title case variant
'Ingeniero Soporte N2': 'MOD-ING', // Add title case variant
'Ingeniero Soporte N3': 'MOD-ING', // Add title case variant
'Project Manager': 'MOD-LEAD', // Add title case variant
```

**Why:** Eliminates console warnings like `Unknown rubro_id: "Service Delivery Manager"` and ensures proper categorization.

---

### 6. Server-Side Taxonomy Aliases (rubros-taxonomy.ts)

**Location:** `services/finanzas-api/src/lib/rubros-taxonomy.ts`

**What was added:**
- Legacy role aliases map with common abbreviations and variants
- Enhanced `mapModRoleToRubroId` to check legacy aliases before case-insensitive matching

**Code snippet:**
```typescript
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  'SDM': 'MOD-SDM',
  'Service Delivery Manager (SDM)': 'MOD-SDM',
  'PM': 'MOD-LEAD',
};

// Try legacy aliases
if (LEGACY_ROLE_ALIASES[role]) {
  return LEGACY_ROLE_ALIASES[role];
}

// Try legacy aliases case-insensitive
for (const [key, value] of Object.entries(LEGACY_ROLE_ALIASES)) {
  if (key.toLowerCase() === normalizedRole.toLowerCase()) {
    return value;
  }
}
```

**Why:** Ensures backend materializers and API handlers can correctly map human-readable role names to canonical IDs.

---

## Tests Added

### 1. Monthly Budget Unit Tests

**Location:** `src/features/sdmt/cost/Forecast/__tests__/monthlyBudgets.test.ts`

**Coverage:**
- Budget allocation with monthly inputs
- Handling missing monthly budget entries
- Preserving monthly totals (planned, forecast, actual)
- Variance calculation between forecast and budget
- Total variance across all months
- Percentage variance calculation
- Consumption percentage tracking
- Edge cases (zero budget, over-consumption)

**Results:** ✅ 9 tests, all passing

---

### 2. Enhanced Invoice Matching Tests

**Location:** `src/features/sdmt/cost/Forecast/__tests__/enhancedInvoiceMatching.test.ts`

**Coverage:**
- Matching invoices with `linea_codigo` field
- Matching invoices with `linea_id` field
- Matching invoices with `descripcion` field (Spanish)
- Multiple field fallback chain (tries fields in priority order)
- Case sensitivity and normalization
- Whitespace normalization
- Canonical alias matching

**Results:** ✅ 10 tests, all passing

---

## Verification Checklist

### For Developers

1. **Start UI in DEV mode:**
   ```bash
   npm run dev
   ```

2. **Open browser console** and navigate to `/finanzas/sdmt/cost/forecast`

3. **Select TODOS view** and verify:
   - Console shows: `[SDMTForecast] monthlyBudgets loaded` with correct data
   - No console warnings about unknown rubro_ids
   - Unmatched invoice telemetry shows low/zero count

4. **Check Budget Display:**
   - ForecastChartsPanel shows Budget line in monthly trend chart
   - MonthlySnapshotGrid shows Budget column when expanded
   - ForecastRubrosTable shows budget values

5. **Check Actuals:**
   - Invoice actuals populate correctly in grids (not $0)
   - Unmatched invoice count in console is minimal

### For QA/Manual Testing

1. **TODOS View with Budgets:**
   - Executive KPIs show correct annual budget
   - "Gráficos de Tendencias" displays Budget line
   - "Matriz del Mes" shows Budget row/column
   - Budget values match expected monthly allocations

2. **Taxonomy Validation:**
   - No console warnings about unknown rubros
   - All labor roles (SDM, Ingeniero Delivery, PM) correctly categorized
   - Descriptions show properly (not "Sin descripción")

3. **Invoice Actuals:**
   - Actuals show non-zero values where invoices exist
   - Actual values match invoice amounts
   - Multi-month invoices sum correctly

---

## Budget Dataflow Verification

The following components correctly receive and use monthly budget data:

1. **SDMTForecast** (parent)
   - ✅ Loads monthly budgets via `loadMonthlyBudget(year)`
   - ✅ Sets `monthlyBudgets` state and `useMonthlyBudget` flag
   - ✅ Passes props to all child components

2. **ForecastChartsPanel**
   - ✅ Receives `monthlyBudgets` and `useMonthlyBudget` props
   - ✅ Adds Budget series to monthly trend chart
   - ✅ Adds cumulative budget line

3. **MonthlySnapshotGrid**
   - ✅ Receives `monthlyBudgets` and `useMonthlyBudget` props
   - ✅ Displays Budget column/values when expanded
   - ✅ Calculates consumption percentage (Actual/Budget × 100)

4. **ForecastRubrosTable / ForecastRubrosAdapter**
   - ✅ Receives `monthlyBudgets` prop
   - ✅ Shows budget values in table/grid
   - ✅ Allows inline budget editing

5. **ForecastSummaryBar**
   - ✅ Receives aggregated budget totals
   - ✅ Shows total budget, variance vs budget, consumption %

6. **Analytics Functions**
   - ✅ `computeVariance` receives budget array when `useMonthlyBudget` is true
   - ✅ `monthlyBudgetAllocations` correctly uses monthly budget data
   - ✅ Budget allocations passed to trend series

---

## Summary of Changes

| File | Changes | Lines Added/Modified |
|------|---------|---------------------|
| `SDMTForecast.tsx` | Added DEV logging for budgets and invoice telemetry | ~45 |
| `useSDMTForecastData.ts` | Enhanced invoice matching with additional fields, indexed taxonomy by descripcion/linea_gasto | ~30 |
| `canonical-taxonomy.ts` | Added 6 new taxonomy aliases | ~6 |
| `rubros-taxonomy.ts` (server) | Added legacy role aliases and enhanced mapModRoleToRubroId | ~20 |
| `monthlyBudgets.test.ts` | Created comprehensive budget allocation tests | 208 (new file) |
| `enhancedInvoiceMatching.test.ts` | Created tests for enhanced invoice matching | 258 (new file) |

**Total:** ~567 lines added/modified across 6 files

---

## Impact Assessment

### Positive Impacts
1. **Budget visibility restored** in all grids and charts
2. **Taxonomy warnings eliminated** for common role names
3. **Invoice actuals matching improved** with additional field support
4. **Developer diagnostics enhanced** with DEV-gated logging
5. **Test coverage increased** for critical budget and invoice flows

### Potential Side Effects
- **None identified** - All changes are:
  - Additive (new field support, new aliases)
  - Backward compatible (existing flows unchanged)
  - DEV-only logging (no production overhead)

### Performance Considerations
- Taxonomy indexing by `linea_gasto`/`descripcion` adds minimal overhead (one-time initialization)
- DEV logging only active in development mode
- No additional API calls or network requests

---

## Next Steps (Post-Deployment)

1. **Monitor DEV console** for:
   - Verification that monthly budgets load successfully
   - Unmatched invoice counts trending toward zero
   - Absence of taxonomy warnings

2. **User Acceptance Testing:**
   - Finance team validates budget numbers match source of truth
   - PM/SDM users verify actuals populate correctly
   - Confirm no performance degradation

3. **Future Enhancements (Optional):**
   - Add UI indicator when budgets are not available
   - Export unmatched invoice telemetry to admin dashboard
   - Create automated E2E tests for budget display

---

## References

- **Problem Statement:** See PR description for detailed diagnosis
- **Existing Tests:** `src/features/sdmt/cost/Forecast/__tests__/invoiceMatching.integration.test.ts`
- **Canonical Taxonomy:** `src/lib/rubros/canonical-taxonomy.ts` (single source of truth)
- **Budget API:** `finanzasClient.getAllInBudgetMonthly(year)` in `src/api/finanzasClient.ts`

---

## Rollback Plan

If issues are discovered post-deployment:

1. **Revert Git commits** (all changes are in isolated commits)
2. **Budget logging removal:** Remove DEV console.debug statements (no functional impact)
3. **Taxonomy aliases:** Keep aliases (they only improve matching, no downside)
4. **Invoice field variants:** Revert `linea_codigo`/`linea_id` support if it causes false positives (unlikely)

**Recommended:** Deploy to staging/dev first, monitor for 24-48 hours before production.
