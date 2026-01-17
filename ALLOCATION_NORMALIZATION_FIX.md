# Allocation Normalization Fix - Implementation Summary

## Problem Statement

After PR-913 successfully added SK filtering for allocations, the API correctly returns allocations scoped to the baseline, but the SDMT Forecast UI still displays blank/zero values for labour allocations. 

### Root Cause

1. **Labour allocations have zero amounts**: MOD (labour) rows in DynamoDB show `amount: 0` for every month
2. **Legacy field names**: Some allocations use legacy Spanish field names (`monto_planeado`, `monto_proyectado`) instead of the canonical `amount` field
3. **UI expects consistent format**: The frontend `computeForecastFromAllocations` function expects `alloc.amount` to be populated

From DynamoDB snapshots:
```
ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD  amount: 0  allocation_type: planned
ALLOCATION#base_bbf111163bb7#2025-06#MOD-SDM   amount: 0  allocation_type: planned
ALLOCATION#base_bbf111163bb7#2025-06#TEC-ITSM  amount: 1145.833333
```

## Solution

Implemented server-side normalization in the allocations handler (`services/finanzas-api/src/handlers/allocations.ts`) that:

1. **Normalizes field names** to provide a canonical `amount` field
2. **Derives labour amounts** from baseline metadata when amount is zero
3. **Ensures consistent month indexing** across different field naming conventions

## Implementation Details

### 1. Helper Functions

#### `coerceNumber(v: any): number`
Safely converts any value to a number, returning 0 for invalid/null values.

#### `parseMonthIndexFromCalendarKey(calKey?: string): number | undefined`
Extracts month index (1-12) from calendar keys in "YYYY-MM" format.

### 2. Main Normalization Function

#### `async normalizeAllocations(items: any[], baselineIdCandidate?: string): Promise<any[]>`

This function processes each allocation item and:

**a) Normalizes the `amount` field** by checking multiple sources in priority order:
```typescript
amount = coerceNumber(
  it.amount ?? 
  it.planned ?? 
  it.monto_planeado ?? 
  it.monto_proyectado ?? 
  it.monto_real ?? 
  it.forecast
);
```

**b) Derives labour amounts when zero** for MOD rubros:
- Identifies labour rubros using regex: `/^MOD/i.test(String(rubroId))`
- Loads baseline metadata using cached `getBaselineMetadata()`
- Attempts two derivation strategies:

   **Strategy 1: From total_cost**
   ```typescript
   amount = Math.round((total_cost / durationMonths) * 100) / 100
   ```
   
   **Strategy 2: From hourly rates**
   ```typescript
   monthly = hourly_rate × hours_per_month × fte_count × (1 + on_cost_percentage/100)
   amount = Math.round(monthly * 100) / 100
   ```

**c) Normalizes month indexing**:
- Ensures both `month_index` and `monthIndex` fields are populated
- Derives from calendar keys when direct values are missing

**d) Normalizes rubro identifiers**:
- Ensures `rubroId`, `rubro_id`, and `line_item_id` are all populated
- Uses fallback chain to handle different naming conventions

### 3. Integration Points

The `normalizeAllocations` function is called before every `return ok(event, items)` in the `getAllocations` handler:

- Line 366: Primary PROJECT# query results
- Line 392: Derived baseline query results  
- Line 416: Baseline→project resolution results
- Line 437: Legacy BASELINE# query results
- Line 464: Scan results (no projectId provided)

### 4. Projection Expression Update

Updated the DynamoDB ProjectionExpression to include all necessary fields:
```typescript
ProjectionExpression: "pk, sk, projectId, baselineId, baseline_id, rubroId, rubro_id, 
  line_item_id, #month, mes, monthIndex, month_index, calendarMonthKey, amount, 
  planned, forecast, actual, monto_planeado, monto_proyectado, monto_real"
```

## Test Coverage

### Unit Tests (28 total)
Added 7 new tests in `tests/unit/allocations.handler.spec.ts`:

1. ✅ Normalizes allocation with `monto_planeado` to `amount` field
2. ✅ Derives labour amount from baseline `total_cost` when amount is 0
3. ✅ Derives labour amount from hourly rate when amount is 0
4. ✅ Does not derive amount for non-labour rubros
5. ✅ Handles missing baseline gracefully for labour derivation
6. ✅ Normalizes `month_index` from various sources
7. ✅ Handles multiple labour rubros in single request

### Integration Tests
Updated 3 integration tests to use flexible matching (`toMatchObject`) instead of exact equality checks to accommodate the normalized fields.

### Test Results
- **487/487 tests passing** ✅
- **0 security vulnerabilities** (CodeQL) ✅
- **Code review feedback addressed** ✅

## Logging & Diagnostics

### Info-level Logs
When a labour amount is derived, an info log is emitted:
```
[allocations] Derived amount=10000 for labour rubro MOD-LEAD from baseline base_bbf111163bb7
```

### Warning Logs
When baseline lookup fails during derivation:
```
[allocations] Failed to derive labour amount for MOD-LEAD / baseline base_xxx: <error>
```

### Existing Query Logs
Existing diagnostic logs are preserved:
```
[allocations] Query: pk=PROJECT#P-123, skPrefix=ALLOCATION#base_001#, found=5 allocations
```

## Verification Steps

### 1. CloudWatch Logs
After deployment, check Lambda logs:
```bash
aws logs tail /aws/lambda/finanzas-sd-api-dev-AllocationsFn-pvCp3t5nZLzx --since 1h --follow
```

Look for:
- `[allocations] Derived amount=...` messages confirming derivations
- `[allocations] Query: pk=..., skPrefix=..., found=...` showing allocation retrieval

### 2. API Testing
Test the allocations endpoint directly:
```bash
curl -H "Authorization: Bearer <token>" \
  "https://<api-domain>/allocations?projectId=<project>&baseline=<baseline>"
```

Verify response contains:
- `amount` field populated for all allocations (including MOD rows)
- `month_index` and `monthIndex` fields present
- Non-zero values for labour allocations

### 3. UI Verification
1. Open SDMT Forecast page
2. Open browser Network tab
3. Verify GET `/allocations?projectId=...&baseline=...` returns allocations with `amount > 0`
4. Verify forecast grid populates correctly with labour costs

## Safety & Backward Compatibility

### Non-Destructive
- Only normalizes API output
- Does NOT modify DynamoDB data
- Original allocation records unchanged

### Conservative
- Only derives labour amounts when `amount === 0`
- Only for rubros matching `/^MOD/i` pattern
- Requires matching labour estimate in baseline

### Backward Compatible
- Preserves all original fields in response
- Adds new normalized fields alongside legacy ones
- Existing consumers unaffected by extra fields

### Error Handling
- Gracefully handles missing baselines (returns amount=0)
- Catches and logs derivation errors without failing the request
- Fallback chain ensures robust field name resolution

## Code Changes Summary

### Modified Files
1. `services/finanzas-api/src/handlers/allocations.ts` (+153 lines)
   - Added helper functions
   - Added `normalizeAllocations` function
   - Integrated normalization into all return paths
   - Updated ProjectionExpression

2. `services/finanzas-api/tests/unit/allocations.handler.spec.ts` (+229 lines)
   - Added 7 comprehensive unit tests
   - Tests cover all derivation scenarios

3. `services/finanzas-api/tests/integration/allocations.spec.ts` (+35 lines)
   - Updated assertions for normalized response format
   - Changed to flexible matching

### No Breaking Changes
- API contract unchanged
- Response includes all original fields
- Additional normalized fields are additive only

## Performance Considerations

### Caching
- Baseline metadata is cached per request
- Multiple allocations from same baseline only fetch metadata once
- Cache scope: single API request (does not persist across requests)

### Database Queries
- No additional DynamoDB queries for non-labour allocations
- Baseline lookup only when `amount === 0` AND rubro is MOD-*
- Uses existing `getBaselineMetadata()` function

### Overhead
- Minimal: normalization is in-memory transformation
- Async/await properly handles Promise.all for parallel processing
- No noticeable latency impact expected

## Production Deployment Checklist

- [x] All tests passing (487/487)
- [x] Security scan clean (0 vulnerabilities)
- [x] Code review completed
- [ ] Deploy Lambda to dev environment
- [ ] Verify CloudWatch logs in dev
- [ ] Test API endpoint in dev
- [ ] Verify UI in dev environment
- [ ] Deploy to production
- [ ] Monitor CloudWatch logs
- [ ] Verify UI in production

## Rollback Plan

If issues arise in production:

1. **Quick rollback**: Revert the Lambda deployment to previous version
2. **No data cleanup needed**: No DynamoDB changes were made
3. **Frontend compatible**: UI works with both normalized and non-normalized responses

## Future Improvements

This implementation is a surgical fix for the immediate issue. Future enhancements could include:

1. **Materializer fix**: Investigate why materializer didn't write amounts for labour allocations
2. **Backfill script**: Create admin tool to backfill historical allocation amounts
3. **Field standardization**: Migrate all allocations to use canonical field names
4. **Performance monitoring**: Add CloudWatch metrics for derivation frequency

## Known Limitations

### Month Semantics for Multi-Year Baselines

The `parseMonthIndexFromCalendarKey()` function extracts calendar month number (1-12) from "YYYY-MM" format, NOT contract month index (M1-M60). This is a fallback that's only used when explicit `month_index`/`monthIndex` fields are missing.

**Impact**: For multi-year baselines without explicit month_index:
- Month 1 (May 2025) with `calendarMonthKey = "2025-05"` → `monthIndex = 5` (should be 1)
- Month 13 (May 2026) with `calendarMonthKey = "2026-05"` → `monthIndex = 5` (should be 13)

**Mitigation**: Properly materialized allocations should have explicit `month_index` set. The calendar month extraction is a last-resort fallback for legacy data. For multi-year baselines, consider a follow-up enhancement to compute contract month_index from baseline start date and calendarMonthKey.

### Labour Rubro Detection

The implementation uses `/^MOD/i` regex to identify labour rubros, which matches standard patterns like MOD-LEAD, MOD-SDM, MOD-ING.

**Limitation**: Labour rubros that don't start with "MOD" won't trigger automatic derivation.

**Future enhancement**: Consider checking against a canonical labour category taxonomy instead of pattern matching.

### Derivation Requirements

Labour amount derivation requires baseline `labor_estimates` to contain either:
- `total_cost` (preferred), OR
- `hourly_rate` + `hours_per_month` (fallback)

If neither is available, derivation is skipped and `amount` remains 0. Ensure your materializer/baseline creation process populates at least one of these fields for all labour estimates.

## Related Documentation

- Original problem report: See problem statement at top of this document
- PR-913: SK filtering implementation (already merged)
- Frontend code: `src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts`
- Baseline metadata: `services/finanzas-api/src/handlers/allocations.ts:getBaselineMetadata()`

## Contact

For questions or issues related to this implementation:
- Check CloudWatch logs first
- Review test cases for expected behavior
- Reference this document for implementation details
