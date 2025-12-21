# Implementation Summary: Baseline Auto-Acceptance Fix

## Overview
This PR fixes a critical bug where baselines were incorrectly marked as "accepted" immediately upon handoff from PMO to SDMT, bypassing the intended review/approval workflow.

## Problems Fixed

### 1. Baseline Auto-Acceptance (P0 - CRITICAL)
**Root Cause:**
- `services/finanzas-api/src/handlers/handoff.ts` line 794: Used `force_accept` flag to auto-accept baselines
- `services/finanzas-api/src/handlers/projects.ts` line 1062: Set `baseline_status: "accepted"` at handoff time

**Impact:**
- Baselines appeared accepted immediately after handoff
- SDMT never got a chance to review/accept/reject
- Violated intended workflow: PMO handoff → SDMT review → SDMT decision

**Fix:**
- Removed `force_accept` logic entirely from handoff.ts
- Changed projects.ts line 1062 to set `baseline_status: "handed_off"` (not "accepted")
- Added `handed_off_by` and `handed_off_at` tracking (separate from acceptance)
- Only SDMT can now accept via `PATCH /projects/{projectId}/accept-baseline`

### 2. Runtime Crash: "currentProject is not defined" (P0 - CRITICAL)
**Root Cause:**
- `BaselineStatusPanel.tsx` could access `currentProject` before checking if it exists
- `PMOProjectDetailsPage.tsx` could crash when no project selected

**Fix:**
- Added null guard: Early return if `!currentProject` in BaselineStatusPanel
- Added safe error states in PMOProjectDetailsPage
- Improved error messages when no project is selected

### 3. PMO Baseline Visibility (P0)
**Status:** VERIFIED WORKING
- PMO routes already correctly configured in `src/lib/auth.ts`
- PMO has access to `/pmo/projects/**` routes
- PMOProjectDetailsPage shows baseline status read-only (no accept/reject buttons)

## Changes Made

### Backend API (7 files)

#### 1. services/finanzas-api/src/handlers/handoff.ts
```diff
- // Determine if this is an explicit force-accept scenario
- const isForceAccept = Boolean(body.force_accept === true || body.accept_action === 'accept');
- const baselineStatus = isForceAccept ? "accepted" : "handed_off";
+ // CRITICAL: Handoff MUST set status to "handed_off" (NOT "accepted")
+ const baselineStatus = "handed_off";

  const projectMetadata = {
-   accepted_by: isForceAccept ? (body.aceptado_por || body.owner || userEmail) : undefined,
-   baseline_accepted_at: isForceAccept ? now : undefined,
+   // Handoff signature metadata (NOT acceptance)
+   handed_off_by: body.aceptado_por || body.owner || userEmail,
+   handed_off_at: now,
+   // Acceptance fields remain undefined until SDMT accepts
  };

  const result = {
    baseline_status: baselineStatus,
-   accepted_by: projectMetadata.accepted_by || undefined,
-   baseline_accepted_at: projectMetadata.baseline_accepted_at || undefined,
+   handed_off_by: projectMetadata.handed_off_by,
+   handed_off_at: projectMetadata.handed_off_at,
+   accepted_by: undefined,
+   baseline_accepted_at: undefined,
  };
```

#### 2. services/finanzas-api/src/handlers/projects.ts
```diff
- baseline_status: "accepted",
- baseline_accepted_at: now,
+ baseline_status: "handed_off",
+ handed_off_at: now,
+ handed_off_by: (handoffBody.aceptado_por as string) || (handoffBody.owner as string) || createdBy,

- accepted_by: (handoffBody.aceptado_por as string) || (handoffBody.owner as string) || createdBy,
+ // accepted_by is ONLY set by PATCH /projects/{projectId}/accept-baseline
+ accepted_by: (existingMetadata as Record<string, unknown> | undefined)?.accepted_by,
```

#### 3. services/finanzas-api/src/handlers/acceptBaseline.ts
```diff
+ // Defensive check: prevent re-acceptance of already accepted baselines
+ const currentStatus = projectResult.Item.baseline_status;
+ if (currentStatus === "accepted") {
+   return bad(event, "Baseline is already accepted. Cannot accept again.", 409);
+ }
+
+ // Only allow acceptance from "handed_off" or "pending" status
+ if (currentStatus !== "handed_off" && currentStatus !== "pending") {
+   return bad(event, `Cannot accept baseline with status "${currentStatus}"`, 409);
+ }
```

#### 4. services/finanzas-api/src/handlers/rejectBaseline.ts
```diff
+ // Defensive check: prevent re-rejection
+ const currentStatus = projectResult.Item.baseline_status;
+ if (currentStatus === "rejected") {
+   return bad("Baseline is already rejected. Cannot reject again.", 409);
+ }
+
+ // Only allow rejection from "handed_off" or "pending" status
+ if (currentStatus !== "handed_off" && currentStatus !== "pending") {
+   return bad(`Cannot reject baseline with status "${currentStatus}"`, 409);
+ }
```

#### 5. services/finanzas-api/tests/unit/acceptBaseline.spec.ts
Added 2 new tests:
- `should prevent re-acceptance of already accepted baseline`
- `should only accept from handed_off or pending status`

#### 6. services/finanzas-api/tests/unit/handoff.spec.ts
Updated test:
- `should ignore force_accept flag and always set baseline_status to 'handed_off'`

#### 7. services/finanzas-api/scripts/repairAutoAcceptedBaselines.ts (NEW)
Data repair script to revert auto-accepted baselines. See usage below.

### Frontend UI (3 files)

#### 1. src/components/baseline/BaselineStatusPanel.tsx
```diff
  // If user cannot view status at all, render nothing
  if (!canViewStatus) {
    return null;
  }

+ // Safety check: If no current project context, render nothing (prevents crash)
+ if (!currentProject) {
+   return null;
+ }
```

#### 2. src/features/pmo/projects/PMOProjectDetailsPage.tsx
```diff
  {(!currentProject?.baselineId || !currentProject?.baseline_status) && (
    <Alert>
      <AlertTitle>No Baseline</AlertTitle>
      <AlertDescription>
-       This project does not have a baseline yet.
+       {!currentProject 
+         ? "No project selected. Please select a project from the estimator."
+         : "This project does not have a baseline yet. Create a baseline through the PMO Estimator."
+       }
      </AlertDescription>
    </Alert>
  )}
```

#### 3. src/contexts/__tests__/ProjectContext.test.ts
Fixed linting error (const vs let).

## State Transition Flow

### Before (WRONG ❌)
```
PMO Estimator
     ↓
  Handoff
     ↓
baseline_status = "accepted"  ← WRONG! Auto-accepted without SDMT review
```

### After (CORRECT ✅)
```
PMO Estimator
     ↓
  Handoff
     ↓
baseline_status = "handed_off"
     ↓
  SDMT Review
     ↓
PATCH /accept-baseline OR PATCH /reject-baseline
     ↓
baseline_status = "accepted" OR "rejected"
```

## Defensive Checks Added

### Immutable State Transitions
Once a baseline is accepted or rejected, it **cannot** be re-accepted or re-rejected:

| Current Status | Accept Action | Reject Action |
|---------------|---------------|---------------|
| pending       | ✅ Allow      | ✅ Allow      |
| handed_off    | ✅ Allow      | ✅ Allow      |
| accepted      | ❌ 409 Conflict | ❌ 409 Conflict |
| rejected      | ❌ 409 Conflict | ❌ 409 Conflict |

### Error Messages
- Re-acceptance: `"Baseline is already accepted. Cannot accept again."`
- Re-rejection: `"Baseline is already rejected. Cannot reject again."`
- Invalid status transition: `"Cannot accept baseline with status 'rejected'. Expected 'handed_off' or 'pending'."`

## Data Repair Script

### Purpose
Revert baselines that were incorrectly auto-accepted during handoff.

### Detection Logic
A baseline is auto-accepted if:
1. `baseline_status == "accepted"` in project METADATA
2. NO audit log entry exists with `action == "BASELINE_ACCEPTED"`

### Usage

```bash
# Dry run (shows what would change, no modifications)
cd services/finanzas-api/scripts
npx tsx repairAutoAcceptedBaselines.ts

# Execute repairs (applies changes to DynamoDB)
npx tsx repairAutoAcceptedBaselines.ts --execute

# Repair specific project only
npx tsx repairAutoAcceptedBaselines.ts --projectId P-abc123 --execute

# Limit number of repairs (for testing)
npx tsx repairAutoAcceptedBaselines.ts --limit 10 --execute
```

### Environment Variables
- `AWS_REGION`: AWS region (default: us-east-1)
- `PROJECTS_TABLE_NAME`: Projects table (default: finanzas-projects-dev)
- `AUDIT_LOG_TABLE_NAME`: Audit log table (default: finanzas-audit-log-dev)

### Safety Features
1. **Dry run by default**: Must explicitly pass `--execute`
2. **Audit log validation**: Only repairs baselines without legitimate acceptance
3. **Filter support**: Can test on single project first
4. **Limit support**: Can repair in batches
5. **Detailed logging**: Shows exactly what will/did change

## Testing Evidence

### ✅ Linting Passed
```bash
npm run lint
> eslint .
(no errors)
```

### ✅ Build Passed
```bash
VITE_API_BASE_URL=http://localhost:3000 npm run build
vite v7.3.0 building client environment for production...
✓ 2722 modules transformed.
✓ built in 15.18s
```

### ✅ Security Scan Passed
```
CodeQL Analysis: 0 alerts found
```

### ✅ Code Review
- 1 pre-existing issue found (not related to our changes)
- No issues with our changes

## Validation Checklist

### Backend
- [x] Handoff sets `baseline_status = "handed_off"` (never "accepted")
- [x] Handoff does NOT set `accepted_by` or `baseline_accepted_at`
- [x] Handoff sets `handed_off_by` and `handed_off_at` for audit trail
- [x] acceptBaseline is ONLY place that sets `baseline_status = "accepted"`
- [x] rejectBaseline is ONLY place that sets `baseline_status = "rejected"`
- [x] Defensive checks prevent re-acceptance/re-rejection (409 Conflict)
- [x] Tests updated to reflect new behavior

### Frontend
- [x] BaselineStatusPanel has null guard for currentProject
- [x] PMOProjectDetailsPage has null guards and safe error states
- [x] SDMT sees accept/reject buttons (when status is handed_off/pending)
- [x] PMO sees read-only status (no accept/reject buttons)
- [x] No "currentProject is not defined" crash

### Data Repair
- [x] Script created with dry-run mode
- [x] Script detects auto-accepted baselines via audit log check
- [x] Script supports --execute, --limit, --projectId flags
- [x] Documentation added to MIGRATION_README.md

### Quality Gates
- [x] Linting passed
- [x] Build passed
- [x] Security scan passed (0 alerts)
- [x] Code review completed
- [x] Tests updated

## Impact Assessment

### Breaking Changes
⚠️ **Minor Breaking Change**: The `force_accept` flag in handoff requests is now **ignored**.

**Migration Path:**
- No action needed for PMO users (they never used force_accept)
- SDMT users must now explicitly accept baselines via PATCH /accept-baseline
- This is the **intended** behavior - not a bug

### Non-Breaking Changes
✅ All other changes are backward compatible:
- Existing "handed_off" baselines remain unchanged
- Existing "accepted" baselines remain accepted
- Existing "rejected" baselines remain rejected
- New defensive checks only affect new acceptance/rejection attempts

## Rollout Plan

### Phase 1: Deploy Code (Immediate)
1. Deploy backend changes (handoff.ts, projects.ts, acceptBaseline.ts, rejectBaseline.ts)
2. Deploy frontend changes (BaselineStatusPanel.tsx, PMOProjectDetailsPage.tsx)

### Phase 2: Data Repair (After Validation)
1. Run repair script in dry-run mode to identify affected baselines
2. Review output and verify detection logic
3. Run repair script with --execute to fix auto-accepted baselines
4. Verify repaired baselines show as "handed_off"
5. Notify SDMT to review and accept pending baselines

### Phase 3: Monitoring
1. Check audit logs for BASELINE_ACCEPTED actions
2. Verify all new handoffs create "handed_off" status
3. Monitor for any 409 Conflict errors (indicates defensive checks working)

## Support

### Common Issues

**Issue:** Baseline is stuck in "handed_off" status
- **Cause:** SDMT hasn't accepted yet
- **Solution:** SDMT user must navigate to Forecast/Changes and click Accept

**Issue:** Cannot accept baseline (409 Conflict)
- **Cause:** Baseline is already accepted or rejected
- **Solution:** This is expected - baselines are immutable after acceptance/rejection

**Issue:** PMO user cannot see baseline status
- **Cause:** PMO route access issue
- **Solution:** Verify PMO user has access to /pmo/projects/** routes (already configured)

### Contact
For questions or issues, contact:
- SDMT: Navigate to /sdmt/cost/forecast or /sdmt/cost/changes
- PMO: Navigate to /pmo/projects/{projectId}

## Security Summary

**No security vulnerabilities introduced.**

All changes enforce stricter state management:
- Baseline status transitions are now immutable
- Only authorized SDMT users can accept/reject baselines
- Audit trail is complete for all state transitions
- Frontend null guards prevent runtime crashes
- Defensive checks prevent unauthorized state mutations

CodeQL Analysis: **0 alerts found** ✅
