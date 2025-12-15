# MOD Dashboard Resiliency Implementation Summary

## Overview
This implementation adds graceful degradation to the MOD dashboard, ensuring charts and tables render using any available data without erroring when endpoints are missing or unimplemented. Additionally, allocations are now derived from baseline MOD values when allocations data is unavailable.

## Changes Implemented

### A. Hardened List Parsing in `src/api/finanzas.ts`

#### 1. Updated `validateArrayResponse()` function
**Before:** Threw error for non-array responses
```typescript
const validateArrayResponse = (value: unknown, label: string): any[] => {
  if (Array.isArray(value)) return value;
  throw new FinanzasApiError(`${label} did not return an array response.`);
};
```

**After:** Handles multiple envelope formats gracefully
```typescript
const validateArrayResponse = (value: unknown, label: string): any[] => {
  // Direct array response
  if (Array.isArray(value)) return value;
  
  // Envelope with data array
  if (value && typeof value === 'object' && Array.isArray((value as any).data)) {
    return (value as any).data;
  }
  
  // Envelope with items array
  if (value && typeof value === 'object' && Array.isArray((value as any).items)) {
    return (value as any).items;
  }
  
  // Return empty array for other shapes to avoid crashes
  logApiDebug(`${label} returned unexpected shape, using empty array`);
  return [];
};
```

#### 2. Enhanced `fetchArraySource()` error handling
**Key improvements:**
- Returns empty array `[]` silently for 404/405/501 status codes
- No toast notifications for expected unavailable endpoints
- Distinguishes between network errors and API unavailability
- Downgrades severity for network errors (console.warn instead of error + toast)

**Error categories:**
1. **Expected unavailable (404/405/501):** Silent, returns `[]`
2. **Network errors (TypeError/Failed to fetch):** Console warning, returns `[]`
3. **Unexpected errors:** Console error + toast, returns `[]`

### B. Derive Allocations from Baseline in `src/modules/finanzas/ProjectsManager.tsx`

#### 1. Added allocation derivation logic
When allocations are empty and baseline has data:
```typescript
if (normalizedAllocations.length === 0 && normalizedBaseline.length > 0) {
  logApiDebug("Deriving allocations from baseline", { 
    baselineRows: normalizedBaseline.length 
  });
  
  normalizedAllocations = normalizedBaseline
    .filter(isModRow)
    .map((baselineRow) => {
      const derivedAllocation = {
        month: baselineRow.month,
        amount: baselineRow.totalPlanMOD || 0,
        rubro_type: "MOD",
        projectId: projectId || baselineRow.projectId,
        totalPlanMOD: baselineRow.totalPlanMOD || 0,
        kind: "derived_allocation",
      };
      return normalizeApiRowForMod(derivedAllocation);
    });
}
```

#### 2. Improved error handling
**Before:** All failures tracked and reported
```typescript
settled.forEach((result, idx) => {
  if (result.status === "fulfilled") {
    rawSources[key] = result.value ?? [];
    return;
  }
  // All failures added to failures array
  failures.push(`${loaders[idx].name}: ${reason || "error"}`);
});
```

**After:** Only auth failures and unexpected errors reported
```typescript
settled.forEach((result, idx) => {
  if (result.status === "fulfilled") {
    rawSources[key] = result.value ?? [];
    return;
  }
  
  const status = reason?.status ?? reason?.response?.status;
  
  // Only track auth failures as real failures
  if (status === 401 || status === 403) {
    hadForbidden = hadForbidden || status === 403;
    hadUnauthorized = hadUnauthorized || status === 401;
    failures.push(`${loaders[idx].name}: ${reason || "error"}`);
  } else if (status && ![404, 405, 501].includes(status)) {
    // Track unexpected errors (not 404/405/501)
    failures.push(`${loaders[idx].name}: ${reason || "error"}`);
  }
  // 404/405/501 are silently ignored
});
```

### C. Comprehensive Test Coverage

Created `src/api/__tests__/finanzas.resiliency.test.ts` with tests for:

1. **Array response validation:**
   - Raw arrays
   - `{ data: [] }` envelope
   - `{ items: [] }` envelope
   - Unexpected shapes (returns empty array without throwing)

2. **Error handling:**
   - 404 responses (no toast)
   - 405 responses (no toast)
   - 501 responses (no toast)
   - Network errors (graceful handling)

3. **Adjustments endpoint:**
   - Empty `{ data: [] }` responses
   - Empty array responses
   - 501 Not Implemented responses

**Test Results:** All 50 tests passing ✅

## Behavioral Changes

### Before Implementation
❌ UI shows error: "did not return an array response. Received object"
❌ Toast notification: "No se pudo cargar los datos" for 404/405/501
❌ Dashboard crashes when allocations endpoint returns 501
❌ Empty DynamoDB tables cause UI errors

### After Implementation
✅ No console errors for envelope responses
✅ No toast notifications for expected missing endpoints (404/405/501)
✅ Dashboard renders using baseline data when allocations unavailable
✅ Charts display with partial data sources (e.g., payroll only)
✅ Graceful degradation across all MOD data sources

## API Compatibility

The implementation now supports multiple response formats:

1. **Raw array:** `[{...}, {...}]`
2. **Data envelope:** `{ data: [{...}, {...}] }`
3. **Items envelope:** `{ items: [{...}, {...}] }`
4. **Message response:** `{ message: "Not implemented" }` → returns `[]`
5. **Error states:** 404/405/501 → returns `[]` silently

## Security

- ✅ CodeQL scan: No alerts found
- ✅ No new security vulnerabilities introduced
- ✅ Proper error handling for auth failures (401/403)
- ✅ Session handling preserved (logout on 401)

## Impact

### UI Components Affected
- `ProjectsManager.tsx` - MOD dashboard
- MOD charts (DonutChart, LineChart)
- SDTM view
- Cost catalog

### API Endpoints Supported
- `/allocations` - Returns allocations or silently fails
- `/baseline` - Returns baseline or silently fails
- `/adjustments` - Returns adjustments or silently fails (includes `{ data: [] }`)
- `/payroll` - Returns payroll or silently fails

## Testing Verification

### Unit Tests
```bash
npm run test:unit
# Result: 50 tests pass, 0 fail
```

### Manual Verification Checklist
- [ ] Dashboard loads with all endpoints available
- [ ] Dashboard loads with allocations returning 501
- [ ] Dashboard loads with baseline missing
- [ ] Dashboard loads with adjustments returning `{ data: [] }`
- [ ] Dashboard loads with empty DynamoDB tables
- [ ] No console errors for any missing endpoints
- [ ] No toast notifications for 404/405/501
- [ ] Charts render with partial data
- [ ] Derived allocations show in MOD chart when baseline available

## Code Quality

- ✅ Code review completed and feedback addressed
- ✅ Proper logging with `logApiDebug` for debugging
- ✅ Consistent error handling patterns
- ✅ Clear comments explaining behavior
- ✅ No breaking changes to existing functionality

## Deployment Notes

This is a **non-breaking change** that improves resilience. Existing functionality remains unchanged when all endpoints are available and working.

### Rollback Plan
If issues arise, the changes can be safely reverted as they only add graceful degradation without modifying core logic.

### Monitoring
After deployment, monitor for:
- Console logs showing endpoint unavailability (should be INFO level)
- Dashboard performance with partial data
- User experience improvements (fewer error messages)
