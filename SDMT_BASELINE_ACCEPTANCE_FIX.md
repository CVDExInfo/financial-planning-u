# SDMT Baseline Acceptance Flow & Rubros Loading Fix

## Overview

This document describes the fixes implemented for the SDMT baseline acceptance flow and rubros loading issues discovered in production.

## Production Symptoms

### Issue 1: Baseline Acceptance Failing with 400 Error

**Symptom:**
```
PATCH /dev/projects/{projectId}/accept-baseline -> 400 {"error":"baseline_id is required"}
```

**Root Cause:**
- Frontend `BaselineStatusPanel` was calling `acceptBaseline(projectId)` without passing `baseline_id`
- API client `acceptBaseline()` function was only sending `accepted_by` in request body, omitting `baseline_id`
- Backend handler strictly required `baseline_id` in request body and rejected requests without it

**Impact:**
- SDMT users unable to accept baselines
- Materialization of rubros/allocations never occurred (handler failed before reaching materialization code)
- Projects stuck in "handed_off" status

### Issue 2: SDMT Catálogo Screen Showing Empty

**Symptom:**
```
GET /rubros?project_id=... -> 200 {"data":[], "total":0}
```

**Root Cause:**
- Rubros were not being materialized because baseline acceptance was failing (see Issue 1)
- The `queryProjectRubros` function was already correctly filtering by `baseline_id`
- Once acceptance succeeds, materialization creates the rubros properly

**Impact:**
- SDMT cost structure screens showed empty even though baseline was handed off
- Users couldn't see line items/rubros from accepted baselines

## Solutions Implemented

### Fix 1: Frontend - Pass baseline_id in Payload

**File:** `src/components/baseline/BaselineStatusPanel.tsx`

**Before:**
```typescript
return acceptBaseline(currentProject.id);
```

**After:**
```typescript
return acceptBaseline(currentProject.id, {
  baseline_id: currentProject.baselineId,
});
```

**Rationale:**
- Ensures `baseline_id` is explicitly passed to the API client
- Aligns with backend contract expectations

### Fix 2: API Client - Send baseline_id in Request Body

**File:** `src/api/finanzas.ts`

**Before:**
```typescript
body: payload?.accepted_by
  ? JSON.stringify({ accepted_by: payload.accepted_by })
  : undefined,
```

**After:**
```typescript
body: payload ? JSON.stringify({
  baseline_id: payload.baseline_id,
  ...(payload.accepted_by && { accepted_by: payload.accepted_by }),
}) : undefined,
```

**Rationale:**
- Includes `baseline_id` in request body when provided
- Maintains optional `accepted_by` field for audit purposes

### Fix 3: Backend - Add Resilient Fallback Logic

**File:** `services/finanzas-api/src/handlers/acceptBaseline.ts`

**Implementation:**
```typescript
// Get baseline_id from request body or fall back to project metadata
const requestBaselineId = body.baseline_id as string | undefined;
const projectBaselineId = projectResult.Item.baseline_id as string | undefined;

// Determine which baseline_id to use with explicit logic
let baselineId: string;
if (requestBaselineId) {
  // Request provides baseline_id - validate it matches project if project has one
  if (projectBaselineId && requestBaselineId !== projectBaselineId) {
    return bad(event, `baseline_id mismatch: ...`, 400);
  }
  baselineId = requestBaselineId;
} else if (projectBaselineId) {
  // Fall back to project's baseline_id
  baselineId = projectBaselineId;
} else {
  // Neither request nor project has baseline_id
  return bad(event, "baseline_id is required ...");
}
```

**Rationale:**
- **Primary Path:** Use request `baseline_id` when provided (normal case)
- **Fallback:** Use project's `baseline_id` if request omits it (resilience)
- **Validation:** Always verify consistency if both exist
- **Safety:** Reject if neither has `baseline_id`

**Edge Cases Handled:**
1. ✅ Request with baseline_id, project with matching baseline_id → Accept
2. ✅ Request with baseline_id, project without baseline_id → Accept (first-time scenario)
3. ✅ Request without baseline_id, project with baseline_id → Accept (fallback)
4. ❌ Request without baseline_id, project without baseline_id → Reject (400)
5. ❌ Request with baseline_id, project with different baseline_id → Reject (400 mismatch)

## Test Coverage

### Backend Tests (9 total in acceptBaseline.spec.ts)

1. ✅ `should accept a baseline and update project metadata`
2. ✅ `should return 404 if project does not exist`
3. ✅ `should return 400 if baseline_id does not match project`
4. ✅ `should use project baseline_id as fallback when not in request body`
5. ✅ `should require baseline_id when not in request body and not in project`
6. ✅ `should allow acceptance with request baseline_id when project has no baseline_id`
7. ✅ `should materialize allocations and rubros during baseline acceptance`
8. ✅ `should prevent re-acceptance of already accepted baseline`
9. ✅ `should only accept from handed_off or pending status`

### Frontend Tests (3 updated in finanzas.acceptBaseline.test.ts)

1. ✅ `includes baseline_id in the payload when provided`
2. ✅ `sends only baseline_id when accepted_by is not provided`
3. ✅ `sends no body when no payload is provided`

### All Tests Status

- **Backend:** 435/435 tests passing
- **Frontend:** Lint ✅, Build ✅

## Rubros Loading Architecture

### Data Flow

```
1. PMO creates baseline → stored with baseline_id
2. PMO hands off baseline → project.baseline_id = baseline_id, baseline_status = "handed_off"
3. SDMT accepts baseline → handler calls:
   - materializeAllocationsForBaseline()
   - materializeRubrosForBaseline()
4. Rubros created with metadata.baseline_id = baseline_id
5. SDMT views catalog → queryProjectRubros():
   - Reads project.baseline_id
   - Filters rubros where metadata.baseline_id matches
   - Returns only rubros from active baseline
```

### Baseline Filtering Logic

**File:** `services/finanzas-api/src/lib/baseline-sdmt.ts`

```typescript
export function filterRubrosByBaseline(rubros, baselineId) {
  if (!baselineId) return rubros; // No filtering if no baseline
  
  const matched = rubros.filter(rubro => 
    rubro.metadata?.baseline_id === baselineId || 
    rubro.baselineId === baselineId
  );
  
  // Lenient fallback for migration: show untagged rubros if no matches
  if (matched.length === 0 && rubros.length > 0) {
    return rubros.filter(rubro => !rubro.metadata?.baseline_id && !rubro.baselineId);
  }
  
  return matched;
}
```

**Why It's Safe:**
- Prevents mixing rubros from different baselines
- Handles legacy data (rubros without baseline_id tags)
- Fails gracefully (shows empty state only when truly empty)

## Verification Checklist

### Before Deployment

- [x] No auto-acceptance on page load (onClick handlers use function references)
- [x] baseline_id sent in request body
- [x] Backend validates baseline_id consistency
- [x] Materialization runs after successful acceptance
- [x] Rubros filtered by active baseline_id
- [x] All unit tests passing (435/435 backend, frontend lint/build OK)
- [x] Code review completed and addressed

### After Deployment - Manual Testing

1. **SDMT Forecast Screen Load:**
   - [ ] Verify no PATCH calls on page load
   - [ ] Verify BaselineStatusPanel shows correct status

2. **Accept Baseline:**
   - [ ] Click "Accept Baseline" button
   - [ ] Verify network request includes `baseline_id` in body
   - [ ] Verify response is 200 OK
   - [ ] Verify UI updates to "Accepted" status
   - [ ] Verify baseline_status in database is "accepted"

3. **Reject Baseline:**
   - [ ] Click "Reject" button
   - [ ] Enter rejection comment
   - [ ] Verify request includes `baseline_id` and `comment`
   - [ ] Verify response is 200 OK
   - [ ] Verify UI updates to "Rejected" status

4. **SDMT Catálogo (Estructura de Costos):**
   - [ ] Open catalog for project with accepted baseline
   - [ ] Verify GET /rubros returns non-empty data
   - [ ] Verify rubros match baseline estimates
   - [ ] Verify totals are correct

5. **PMO/PM Read-Only View:**
   - [ ] Login as PMO user
   - [ ] Verify baseline status is visible
   - [ ] Verify no Accept/Reject buttons appear
   - [ ] Verify status banner shows correct message

## Security Considerations

### RBAC Enforcement

- ✅ Only SDMT role can accept/reject baselines (backend validates via `ensureSDMT()`)
- ✅ PMO/PM see read-only status
- ✅ AVP policies enforce action permissions

### Data Integrity

- ✅ Validates baseline_id matches project's current baseline
- ✅ Prevents acceptance of already-accepted baselines (409 conflict)
- ✅ Only allows acceptance from "handed_off" or "pending" status
- ✅ Audit trail logged for all acceptance/rejection events

### Input Validation

- ✅ JSON parsing errors handled gracefully (400 bad request)
- ✅ Missing baseline_id rejected with clear error message
- ✅ Baseline_id mismatch rejected with diagnostic message

## Rollback Plan

If issues occur in production:

1. **Quick Rollback:**
   - Revert to previous deployment
   - Frontend will send baseline_id in payload (backward compatible)
   - Old backend may accept without fallback (requires baseline_id in request)

2. **Data Cleanup (if needed):**
   - Identify projects stuck in "handed_off" status
   - Manually accept via AWS CLI or direct DynamoDB update
   - Re-run materialization script for affected projects

3. **Emergency Bypass:**
   - Temporarily disable baseline_id validation
   - Allow SDMT to manually set baseline_status via admin panel

## Related Files

### Frontend
- `src/components/baseline/BaselineStatusPanel.tsx` - UI component with Accept/Reject actions
- `src/api/finanzas.ts` - API client with acceptBaseline/rejectBaseline functions
- `src/api/__tests__/finanzas.acceptBaseline.test.ts` - API client contract tests

### Backend
- `services/finanzas-api/src/handlers/acceptBaseline.ts` - PATCH handler
- `services/finanzas-api/src/handlers/rubros.ts` - GET/POST/DELETE handler
- `services/finanzas-api/src/lib/baseline-sdmt.ts` - Filtering utilities
- `services/finanzas-api/src/lib/materializers.ts` - Rubros/allocations materialization
- `services/finanzas-api/tests/unit/acceptBaseline.spec.ts` - Handler tests

## Timeline

- **Issue Reported:** 2025-12-22
- **Investigation:** 2025-12-22 (same day)
- **Fix Implemented:** 2025-12-22 (same day)
- **Tests Passing:** 2025-12-22 (435/435)
- **Ready for Deployment:** 2025-12-22

## Next Steps

1. [ ] Deploy to dev environment
2. [ ] Run manual verification checklist
3. [ ] Deploy to staging
4. [ ] Final smoke tests
5. [ ] Deploy to production
6. [ ] Monitor CloudWatch logs for errors
7. [ ] Update runbook with lessons learned
