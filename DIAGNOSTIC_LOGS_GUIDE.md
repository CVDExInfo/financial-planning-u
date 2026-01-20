# Diagnostic Logs Guide - Invoice Matching & Portfolio Loading

This document explains the diagnostic logs added to help debug "Real = $0" and blank Monitoreo issues.

## Overview

All diagnostic logs are gated behind `import.meta.env.DEV` to ensure zero production impact. They provide detailed visibility into:
1. Invoice fetching and matching
2. Portfolio loading and project aggregation
3. Monthly snapshot data aggregation

## How to Use These Logs

1. **Run the app in DEV mode** (`npm run dev`)
2. **Open browser DevTools console**
3. **Navigate to a project with invoices**
4. **Look for the log patterns below**

## Log Patterns and What They Mean

### 1. Invoice Fetching (`useSDMTForecastData.ts`)

```
[useSDMTForecastData] invoices fetched for project PROJECT-123: 45
[useSDMTForecastData] valid invoices: 42
```

**What this means:**
- First line: Total invoices returned from API for the project
- Second line: Invoices with valid status (matched/paid/approved/posted/received/validated)

**If you see:**
- `invoices fetched: 0` → No invoices returned from API (check invoice data in DynamoDB)
- `valid invoices: 0` but invoices fetched > 0 → Status filtering issue (invoices have invalid statuses)

### 2. Invoice Matching Results

```
[useSDMTForecastData] matchedInvoices: 38, unmatchedSample: [{"line_item_id":"MOD-DEV","rubroId":"MOD-DEV","month":1,"project_id":"P-123","status":"posted","amount":1500}]
```

**What this means:**
- `matchedInvoices`: Number of invoices successfully matched to forecast rows
- `unmatchedSample`: First 5 unmatched invoices with their fields

**If you see:**
- `matchedInvoices: 0` → Open `unmatchedSample` and check:
  - Does `line_item_id` match a forecast row?
  - Does `month` parse correctly (should be 1-12)?
  - Does `project_id` match the selected project?
  - Is `rubroId` using canonical ID or legacy alias?

### 3. Invalid Month Invoices

```
[useSDMTForecastData] invalidMonthInvoiceSample: [{"line_item_id":"MOD-QA","rubroId":"MOD-QA","amount":2000,"rawMonth":"invalid-date","project_id":"P-123","status":"posted"}]
```

**What this means:**
- Invoices that couldn't be matched because their `month` field couldn't be parsed

**If you see this:**
- Check `rawMonth` field - what format is it?
- Add parsing logic to `normalizeInvoiceMonth()` if needed
- Common formats supported: `YYYY-MM-DD`, `YYYY-MM`, `M01`, `1`, ISO datetimes

### 4. DEV Fallback Matching (Diagnostic Only)

```
[useSDMTForecastData] Fallback match: inv.rubroId=MOD-PM → MOD-LEAD, row.rubroId=MOD-LEAD → MOD-LEAD, amount=3000
[useSDMTForecastData] 5 invoices matched using DEV fallback logic (canonical/description matching)
```

**What this means:**
- Primary matching failed but relaxed matching succeeded
- Indicates minor formatting differences or taxonomy gaps

**Action:**
- If canonical IDs match in fallback but not primary → Update legacy map
- If description matching worked → Update canonical taxonomy

### 5. Portfolio Loading (`SDMTForecast.tsx`)

```
[loadPortfolioForecast] projects loaded: 5, ids: ["P-001","P-002","P-003","P-004","P-005"]
[loadPortfolioForecast] project P-001 forecastRows=120 invoices=85
[loadPortfolioForecast] project P-002 forecastRows=95 invoices=62
...
```

**What this means:**
- First line: Total projects loaded (should be > 1 for portfolio view)
- Following lines: Per-project forecast rows and invoices counts

**If you see:**
- `projects loaded: 1` with id `["ALL_PROJECTS"]` → Real projects haven't loaded yet
- `forecastRows=0` for a project → Baseline not materialized or forecast generation failed
- `invoices=0` but you expect invoices → Check invoice fetching for that project

### 6. Monthly Snapshot Aggregation (`useMonthlySnapshotData.ts`)

```
[useMonthlySnapshotData] monthDataLen=45, totalActual=125000, totalForecast=130000, month=1
```

**What this means:**
- `monthDataLen`: Number of forecast cells for the selected month
- `totalActual`: Sum of all actuals for that month
- `totalForecast`: Sum of all forecasts for that month
- `month`: The month index being aggregated

**If you see:**
- `totalActual=0` but you expect actuals → Invoices didn't match (check invoice matching logs above)
- `monthDataLen=0` → No forecast data for that month (check forecast generation)

## Common Diagnostic Flows

### Problem: "Real shows $0 in UI"

1. Check invoice fetching:
   ```
   [useSDMTForecastData] invoices fetched for project PROJECT-123: ?
   ```
   - If 0 → No invoices in database
   - If > 0 → Continue to next step

2. Check valid invoices:
   ```
   [useSDMTForecastData] valid invoices: ?
   ```
   - If 0 → Status issue, check invoice statuses in DB
   - If > 0 → Continue to next step

3. Check matched invoices:
   ```
   [useSDMTForecastData] matchedInvoices: ?
   ```
   - If 0 → Open `unmatchedSample`, inspect fields
   - If > 0 but UI still shows 0 → Check monthly aggregation logs

4. Check monthly aggregation:
   ```
   [useMonthlySnapshotData] totalActual=?
   ```
   - Should match sum of matched invoices
   - If 0 → Month filter issue or wrong month selected

### Problem: "Monitoreo shows 'No hay datos para TODOS'"

1. Check projects loaded:
   ```
   [loadPortfolioForecast] projects loaded: ?
   ```
   - If 1 with only `ALL_PROJECTS` → Real projects haven't loaded
   - If > 1 → Continue to next step

2. Check per-project data:
   ```
   [loadPortfolioForecast] project P-XXX forecastRows=? invoices=?
   ```
   - If all projects have `forecastRows=0` → Baseline/forecast issue
   - If some projects have data → Aggregation should work

## DEV-Only Fallback Matching

The fallback matching is a **diagnostic tool only** - it helps identify why primary matching failed:

```typescript
// After primary matching fails, try:
1. Canonical rubro ID comparison
2. Normalized description comparison
```

If fallback matches succeed, it means:
- The data CAN match with relaxed rules
- You should update the canonical taxonomy or legacy map
- The primary matching logic may need adjustment

## Safety Notes

- All logs are wrapped in `if (import.meta.env.DEV)` checks
- Zero production overhead
- Logs include only necessary diagnostic data
- No sensitive information is logged

## Next Steps After Reviewing Logs

1. **If invoices aren't fetched:** Check DynamoDB invoice data
2. **If invoices don't match:** Update canonical taxonomy or legacy map
3. **If months are invalid:** Add new parsing logic to `normalizeInvoiceMonth()`
4. **If projects don't load:** Check project loading sequence and API
5. **If fallback matches work:** Merge fallback logic into primary matching

## Files Modified

- `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts` - Invoice matching logs
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Portfolio loading logs
- `src/features/sdmt/cost/Forecast/components/hooks/useMonthlySnapshotData.ts` - Monthly aggregation logs
- `src/hooks/useProjectLineItems.ts` - ALL_PROJECTS guard log

## Testing

Run integration tests to verify behavior:
```bash
npx tsx --test src/features/sdmt/cost/Forecast/__tests__/invoiceMatching.integration.test.ts
npx tsx --test src/features/sdmt/cost/Forecast/__tests__/useSDMTForecastData.integration.test.ts
```
