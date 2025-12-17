# PMO Baseline Visibility Implementation

## Overview
This implementation enables PMO and PM users to view baseline status and acceptance/rejection details for their projects in a read-only mode, without granting them access to SDMT cost management routes.

## Key Changes

### 1. Route Permissions (`src/lib/auth.ts`)
Added `/pmo/projects/**` to PM and PMO role permissions:
```typescript
PM: {
  routes: ["/", "/profile", "/pmo/**", "/pmo/prefactura/**", "/pmo/projects/**"],
  actions: ["read"],
}
PMO: {
  routes: ["/", "/profile", "/pmo/**", "/pmo/prefactura/**", "/pmo/projects/**"],
  actions: ["create", "read", "update", "delete", "approve"],
}
```

### 2. BaselineStatusPanel Hardening (`src/components/baseline/BaselineStatusPanel.tsx`)
Added explicit role-based visibility:
```typescript
const canViewStatus = isSDMT || isPMO || isPM || isExecRO || isVendor;
const canActOnBaseline = isSDMT; // Only SDMT can accept/reject

if (!canViewStatus) {
  return null;
}

const showActions = canActOnBaseline && (status === "pending" || status === "handed_off");
```

### 3. PMO Project Details Page (`src/features/pmo/projects/PMOProjectDetailsPage.tsx`)
New page at `/pmo/projects/:projectId` that:
- Reads projectId from route params
- Uses existing `useProject()` hook to fetch project data
- Displays project information (name, code, client, status, SDM manager)
- Embeds `BaselineStatusPanel` for baseline status
- Shows "No Baseline" message if project lacks baseline
- Provides back navigation to PMO estimator

### 4. Route Wiring (`src/App.tsx`)
```typescript
<Route path="/pmo/projects/:projectId" element={<PMOProjectDetailsPage />} />
```

## Access Control Matrix

| Role | Route | Access | Actions |
|------|-------|--------|---------|
| PMO | `/pmo/projects/:projectId` | ✅ Allowed | View only |
| PMO | `/sdmt/cost/catalog` | ❌ Blocked | None |
| PMO | `/sdmt/cost/forecast` | ❌ Blocked | None |
| SDMT | `/pmo/projects/:projectId` | ✅ Allowed | View only |
| SDMT | `/sdmt/cost/catalog` | ✅ Allowed | Full access |
| PM | `/pmo/projects/:projectId` | ✅ Allowed | View only |

## Baseline Status Panel Behavior by Role

### PMO/PM View (Read-Only)
- ✅ Sees baseline status badge (Accepted, Rejected, Pending)
- ✅ Sees accepted_by/rejected_by metadata
- ✅ Sees rejection comments
- ✅ Sees informational banners
- ❌ Cannot accept baseline
- ❌ Cannot reject baseline

### SDMT View (Full Control)
- ✅ All of the above
- ✅ Can accept baseline (when status is pending/handed_off)
- ✅ Can reject baseline with comment

## Testing

### Auth Route Tests
All tests passing (9/9):
```bash
npm run test:unit
# ✔ PM role route visibility (allows /pmo/projects/123)
# ✔ PMO role route visibility (allows /pmo/projects/123, blocks /sdmt/*)
# ✔ SDMT role route visibility (unchanged)
```

### Security Scan
CodeQL scan: **0 vulnerabilities found** ✅

## Usage Example

After a PMO user creates a baseline via the estimator:

1. PMO user creates baseline in `/pmo/prefactura/estimator`
2. Baseline is handed off to SDMT
3. PMO can now navigate to `/pmo/projects/P-abc123` to check status
4. PMO sees:
   - "Pending Review" badge
   - Message: "La baseline fue entregada a SDMT. En espera de aprobación."
   - No action buttons
5. SDMT reviews on `/sdmt/cost/forecast` and accepts/rejects
6. PMO refreshes `/pmo/projects/P-abc123` and sees:
   - "Accepted" badge (green) or "Rejected" badge (red)
   - Accepted by: email@example.com on Dec 17, 2025
   - Or: Rejection reason with contact link

## Data Flow

```
PMO Estimator
    ↓
Create Baseline → Backend API
    ↓
Handoff to SDMT
    ↓
PMO views /pmo/projects/:projectId
    ↓
useProject() hook → getProjects() API
    ↓
normalizeProjectForUI() maps baseline fields
    ↓
BaselineStatusPanel renders (read-only for PMO)
```

## No Backend Changes Required

All baseline metadata is already present in the project API responses:
- `baseline_id`
- `baseline_status`
- `accepted_by`
- `baseline_accepted_at`
- `rejected_by`
- `baseline_rejected_at`
- `rejection_comment`

These fields are mapped by `normalizeProjectForUI()` in `src/modules/finanzas/projects/normalizeProject.ts`.

## Future Enhancements (Optional)

1. Add link from PMO Estimator to project details after handoff
2. Show list of all projects for PMO with their baseline statuses
3. Add filtering/search for projects by baseline status
4. Email notifications when baseline is accepted/rejected

## Related Documentation

- `docs/baseline-acceptance-flow.md` - Original baseline flow design
- `docs/baseline-acceptance-integration.md` - Integration details
- `src/lib/__tests__/auth-routes.test.ts` - Route permission tests
