# SDMTForecast Data Pipeline Debugging Guide

## Overview

This guide helps debug data flow issues in the SDMTForecast feature, particularly related to invoice matching, ID mapping, and month handling.

## DEV-Only Logging

Most diagnostic logging is enabled automatically in DEV mode (`import.meta.env.DEV`). To get detailed logs:

1. **Run in development mode**: `npm run dev`
2. **Open browser console** to see detailed logs
3. **Look for these log prefixes**:
   - `[useSDMTForecastData]` - Main data loading flow
   - `[matchInvoiceToCell]` - Invoice matching logic
   - `[normalizeInvoiceMonth]` - Month parsing diagnostics
   - `[normalizeForecastCells]` - Cell normalization summary
   - `[computeForecastFromAllocations]` - Allocation processing

## Common Issues and Solutions

### Issue 1: Invoices Not Matching Forecast Cells

**Symptoms**: 
- `matchedInvoicesCount = 0` in console
- `actual` values remain 0 in forecast grid
- Warnings about unmatched invoices

**Debug Steps**:

1. **Check the unmatchedInvoicesSample log**:
   ```javascript
   // Console log example:
   [useSDMTForecastData] Unmatched invoices sample: [
     {
       line_item_id: "INVOICE-123",
       rubroId: "MOD-ING",
       month: 1,
       amount: 5000
     }
   ]
   ```

2. **Verify ID mapping**:
   - Check if `matchingIds` array in forecast cells contains the invoice ID
   - Look for `[matchInvoiceToCell]` logs showing match attempts
   - Common cause: ID normalization differences (e.g., `RUBRO#MOD-ING` vs `MOD-ING`)

3. **Verify month alignment**:
   - Invoice month must match forecast cell month exactly
   - Check `[normalizeInvoiceMonth]` logs for parsing issues
   - Common formats: numeric (1-60), YYYY-MM, YYYY-MM-DD, M01, M1

4. **Check matchingIds array**:
   ```javascript
   // In console, inspect forecast cells:
   forecastRows[0].matchingIds
   // Should show: ["CANONICAL-ID", "SYNTHETIC-ID", "BACKEND-ID", ...]
   ```

**Solutions**:
- **Add missing aliases**: Update `normalizeForecastCells` or `computeForecastFromAllocations` to include the missing ID variant in `matchingIds`
- **Fix month format**: Ensure invoices use supported month formats (see Month Handling section)
- **Check taxonomy**: Verify canonical taxonomy includes the rubro ID

### Issue 2: Extended Month Range Not Working

**Symptoms**:
- Warnings about invalid months
- Months > 12 showing as invalid
- Multi-year forecasts not loading

**Debug Steps**:

1. **Check month normalization logs**:
   ```javascript
   [normalizeInvoiceMonth] Parsed YYYY-MM: { input: "2026-06", monthNum: 6 }
   ```

2. **Verify cell month values**:
   - Extended range should support months 1-60
   - Calendar months (1-12) auto-generate `monthLabel` in YYYY-MM format

**Solutions**:
- Ensure raw data uses `month_index` or `monthIndex` for project-relative months
- For calendar alignment, provide `monthLabel` or `calendar_month` in YYYY-MM format

### Issue 3: Stale Responses Dropping Valid Data

**Symptoms**:
- Data appears to load then disappears
- Intermittent empty states
- DEV warnings about dropped responses

**Debug Steps**:

1. **Look for stale request warnings**:
   ```javascript
   [useSDMTForecastData] Dropping rubros response (stale request): {
     requestKey: 5,
     latestRequestKey: 6,
     rubrosCount: 150
   }
   ```

2. **Check request timing**:
   - Multiple rapid calls can cause earlier responses to be dropped
   - This is expected behavior when projectId changes frequently

**Solutions**:
- Usually safe to ignore if data eventually loads
- If data never loads, check if requests are completing
- Temporarily disable abort guards for debugging (see Advanced Debugging)

### Issue 4: Materialized Rubros Not Matching

**Symptoms**:
- Allocations generate forecast cells but invoices don't match
- `materialized` source rubros showing in data
- High `taxonomyFallbackCount`

**Debug Steps**:

1. **Check allocation processing logs**:
   ```javascript
   [computeForecastFromAllocations] Processed 50 allocations → 25 forecast cells
   {
     exactMatches: 15,
     tolerantMatches: 5,
     taxonomyFallbacks: 5
   }
   ```

2. **Inspect materialized cell structure**:
   ```javascript
   // Cells from allocations should have:
   {
     line_item_id: "ALLOCATION-ID",
     matchingIds: ["ALLOCATION-ID", "BACKEND-ID", "CANONICAL-ID"],
     updated_by: "system-allocations"
   }
   ```

**Solutions**:
- Ensure `rubrosFromAllocations` includes canonical IDs in `matchingIds`
- Add taxonomy entries for custom allocation IDs
- Verify backend rubros have consistent ID format

## ID Mapping Strategy

### Matching Hierarchy (in order)

1. **Exact line_item_id match** (normalized, case-insensitive)
2. **matchingIds array check** (all variants, exact and normalized)
3. **Canonical rubroId** (via `getCanonicalRubroId`)
4. **Taxonomy lookup** (canonical taxonomy resolution)
5. **Normalized description** (case-insensitive, whitespace-normalized)

### Building matchingIds Array

When creating forecast cells, include:
- Primary line_item_id (normalized)
- Original line_item_id (before normalization)
- rubroId and rubro_id variants
- linea_codigo
- Backend canonical IDs
- Synthetic/materialized IDs
- Taxonomy canonical ID

Example:
```javascript
matchingIds: [
  "MOD-ING",              // Normalized primary
  "RUBRO#MOD-ING",        // Original with prefix
  "LINEITEM#MOD-ING",     // Alternative prefix
  "linea-mod-ing",        // Backend variant
  "CANONICAL-MOD-ING"     // Taxonomy canonical
]
```

## Month Handling Conventions

### Supported Month Formats

| Format | Example | Result | Use Case |
|--------|---------|--------|----------|
| Numeric | `6` | 6 | Simple calendar month |
| Extended | `13`, `24`, `60` | 13, 24, 60 | Multi-year project months |
| YYYY-MM | `"2026-06"` | 6 | Calendar month |
| YYYY-MM-DD | `"2026-06-15"` | 6 | Full date |
| ISO datetime | `"2026-06-15T12:00:00Z"` | 6 | Timestamp |
| M format | `"M6"`, `"M06"` | 6 | Month label |
| Extended M | `"M13"`, `"M24"` | 13, 24 | Multi-year label |

### Month Alignment Rules

- **Invoice month** must match **forecast cell month** exactly
- Valid range: 1-60 (supports up to 5-year forecasts)
- `monthLabel` provides YYYY-MM for calendar alignment
- Project-relative months use `month_index` or `monthIndex` field

## Advanced Debugging

### Temporarily Disable Stale Request Guard

**⚠️ DEV ONLY - Never in production**

In `useSDMTForecastData.ts`, comment out the stale checks:
```typescript
// if (latestRequestKey.current !== requestKey) return; // DISABLED FOR DEBUG
```

This allows all responses to complete, helping identify timing issues.

### Force Allocations Override

Add `?forceAllocations=true` to URL to bypass server forecast and use allocations:
```
http://localhost:5173/sdmt/forecast?forceAllocations=true
```

### Enable Debug Mode for Normalization

```javascript
// In browser console:
localStorage.setItem('DEBUG_NORMALIZATION', 'true');
```

Then check console for detailed normalization logs.

## Logging Reference

### Key Log Messages

#### Success Indicators
```javascript
✅ Using server forecast data (150 cells with critical data)
✅ Retrieved 50 allocations from DynamoDB
✅ Generated 25 forecast cells from allocations
matchedInvoicesCount: 18
```

#### Warning Indicators
```javascript
⚠️ Server forecast empty or missing critical cells — trying fallback
⚠️ No allocations found — using rubros only
⚠️ Dropping rubros response (stale request)
```

#### Error Indicators
```javascript
❌ No forecast, allocations, or rubros available
❌ All fallback options exhausted
Cell has no valid line_item_id
Failed to parse month: { input: "invalid" }
```

## Testing

### Unit Test Coverage

- `matchingIds.test.ts` - matchingIds array functionality
- `normalizeForecastCells.enhancement.test.ts` - Enhanced normalization
- `invoiceMatching.test.ts` - Invoice matching logic
- `normalizeInvoiceMonth.test.ts` - Month parsing

### Run Tests

```bash
npm run test:unit
```

## Related Files

- `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts` - Main data hook
- `src/features/sdmt/cost/utils/dataAdapters.ts` - Normalization logic
- `src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts` - Allocation processing
- `src/types/domain.d.ts` - Type definitions
- `src/lib/rubros/canonical-taxonomy.ts` - Canonical rubro taxonomy

## Support

For additional help:
1. Check existing unit tests for usage examples
2. Review `IMPLEMENTATION_SUMMARY.md` for architectural overview
3. Enable DEV logging and share console output
4. Provide sample data (anonymized) showing the issue
