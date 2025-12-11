# Baseline Acceptance Flow - Integration with Existing Code

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (DynamoDB)                        │
│  Project METADATA with baseline fields:                         │
│  - baseline_id, baseline_status                                 │
│  - accepted_by, baseline_accepted_at                            │
│  - rejected_by, baseline_rejected_at, rejection_comment         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (/api/finanzas.ts)                │
│  Functions:                                                      │
│  - getProjects() → ProjectsResponse                             │
│  - acceptBaseline(projectId, payload)                           │
│  - rejectBaseline(projectId, payload)                           │
└────────┬────────────────────────────┬───────────────────────────┘
         │                            │
         ▼                            ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│   useProjects Hook     │   │      ProjectContext               │
│   (PMO Screens)        │   │      (SDMT Screens)               │
│                        │   │                                    │
│ - ProjectForUI type    │   │ - ProjectSummary type             │
│ - normalizeProjectForUI│   │ - mapProject()                    │
│                        │   │ - refreshProject()                │
└────────┬───────────────┘   └────────┬───────────────────────────┘
         │                            │
         ▼                            ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│ ProjectDetailsPanel    │   │   BaselineStatusPanel             │
│ (PMO Projects Screen)  │   │   (SDMT Forecast/Changes)         │
│                        │   │                                    │
│ Shows:                 │   │ Shows:                             │
│ - Baseline ID          │   │ - Baseline status badge           │
│ - Baseline status      │   │ - Accept/Reject buttons (SDMT)    │
│ - Accepted by/date     │   │ - Rejection comment               │
│ - Rejected by/date     │   │                                    │
│ - Rejection comment    │   │ Actions:                           │
│                        │   │ - Accept → calls acceptBaseline()  │
│ (Read-only display)    │   │ - Reject → shows modal, calls      │
│                        │   │   rejectBaseline()                 │
└────────────────────────┘   └────────────────────────────────────┘
```

## Integration Points

### 1. PMO Projects Screen (`src/modules/finanzas/projects/`)

**Files Modified:**
- `useProjects.ts` - Extended `ProjectForUI` type with rejection fields
- `normalizeProject.ts` - Maps rejection data from API to UI format
- `ProjectDetailsPanel.tsx` - Displays baseline acceptance/rejection info

**Data Flow:**
```typescript
API → getProjects() 
    → normalizeProjectsPayload() 
    → normalizeProjectForUI() 
    → ProjectForUI with rejection fields
    → ProjectDetailsPanel displays all fields
```

**Visual Display in ProjectDetailsPanel:**

When baseline is **accepted**:
```
┌─────────────────────────────────────────┐
│ Baseline ID:           base_abc123      │
│ Estatus de baseline:   accepted         │
│ Aceptado por:          sdmt@example.com │
│ Aceptado el:           Dec 10, 2025     │
└─────────────────────────────────────────┘
```

When baseline is **rejected**:
```
┌─────────────────────────────────────────┐
│ Baseline ID:           base_abc123      │
│ Estatus de baseline:   rejected         │
│ Rechazado por:         sdmt@example.com │
│ Rechazado el:          Dec 10, 2025     │
│ Motivo de rechazo:     Budget exceeds   │
│                        approved limits   │
└─────────────────────────────────────────┘
```

### 2. SDMT Screens (`src/features/sdmt/cost/`)

**Files Modified:**
- `Forecast/SDMTForecast.tsx` - Added BaselineStatusPanel
- `Changes/SDMTChanges.tsx` - Added BaselineStatusPanel

**Component Location:**
The `BaselineStatusPanel` appears directly below the header:

```
┌────────────────────────────────────────────────────┐
│ [Header] SDMT Forecast | Project: XYZ              │
├────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐ │
│ │ Baseline Status  [🟡 Pending Review]          │ │
│ │ ID: base_abc123                                │ │
│ │                                                │ │
│ │           [Reject]  [Accept Baseline]          │ │
│ └────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────┤
│ [Summary Cards]                                    │
│ [Charts and Data]                                  │
└────────────────────────────────────────────────────┘
```

**Data Flow:**
```typescript
ProjectContext 
    → currentProject with baseline fields
    → BaselineStatusPanel reads fields
    → User clicks Accept/Reject
    → Calls acceptBaseline() or rejectBaseline()
    → Updates DynamoDB
    → refreshProject() called
    → Panel updates with new status
```

### 3. Type Compatibility

Both systems use compatible types:

**ProjectForUI (useProjects)**:
```typescript
{
  baseline_id?: string;
  baseline_status?: string | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string | null;
  rejected_by?: string | null;
  baseline_rejected_at?: string | null;
  rejection_comment?: string | null;
}
```

**ProjectSummary (ProjectContext)**:
```typescript
{
  baselineId?: string;
  baseline_status?: string;
  accepted_by?: string;
  baselineAcceptedAt?: string;
  rejected_by?: string;
  baseline_rejected_at?: string;
  rejection_comment?: string;
}
```

Both normalize from the same `Project` domain type in `src/types/domain.d.ts`.

## Status Flow

```
1. PMO creates baseline
   └─> baseline_status: "handed_off"

2. SDMT views in Forecast/Changes
   └─> BaselineStatusPanel shows "Pending Review"
   └─> Shows Accept/Reject buttons (SDMT only)

3a. SDMT accepts
    └─> POST /projects/{id}/accept-baseline
    └─> baseline_status: "accepted"
    └─> accepted_by + baseline_accepted_at updated
    └─> Panel shows green "Accepted" badge

3b. SDMT rejects
    └─> Opens modal for optional comment
    └─> POST /projects/{id}/reject-baseline
    └─> baseline_status: "rejected"
    └─> rejected_by + baseline_rejected_at + rejection_comment updated
    └─> Panel shows red "Rejected" badge with comment

4. PMO views project details
   └─> ProjectDetailsPanel shows acceptance/rejection info
   └─> Read-only display with all metadata
```

## Visual State Examples

### State 1: Pending (SDMT View)
```
┌────────────────────────────────────────────────────┐
│ Baseline Status  [🟡 Pending Review]              │
│ ID: base_abc123                                    │
│                                                    │
│                 [Reject]  [Accept Baseline]        │
└────────────────────────────────────────────────────┘
```

### State 2: Accepted (All Users)
```
┌────────────────────────────────────────────────────┐
│ Baseline Status  [🟢 Accepted]                    │
│ ID: base_abc123                                    │
│ Accepted by sdmt@example.com on Dec 10, 2025      │
└────────────────────────────────────────────────────┘
```

### State 3: Rejected with Comment (All Users)
```
┌────────────────────────────────────────────────────┐
│ Baseline Status  [🔴 Rejected]                    │
│ ID: base_abc123                                    │
│ Rejected by sdmt@example.com on Dec 10, 2025      │
│                                                    │
│ ⚠️ Rejection reason: Budget exceeds approved      │
│    limits. Please revise MOD allocation.          │
└────────────────────────────────────────────────────┘
```

### State 4: PM View (Read-Only)
```
┌────────────────────────────────────────────────────┐
│ Baseline Status  [🟡 Pending Review]              │
│ ID: base_abc123                                    │
│                                                    │
│ (No action buttons - PM role is read-only)        │
└────────────────────────────────────────────────────┘
```

## Role-Based Access

| Role     | Can Accept | Can Reject | Can View Status |
|----------|------------|------------|-----------------|
| SDMT     | ✅         | ✅         | ✅              |
| PMO      | ❌         | ❌         | ✅              |
| PM       | ❌         | ❌         | ✅              |
| EXEC_RO  | ❌         | ❌         | ✅              |
| VENDOR   | ❌         | ❌         | ✅              |

Enforced by `usePermissions()` hook checking `isSDMT` flag.

## Testing Checklist

### Unit Tests (Backend)
- [x] Accept baseline updates status and metadata
- [x] Reject baseline with comment
- [x] Reject baseline without comment
- [x] Baseline ID validation
- [x] Audit log creation

### Integration Tests (Recommended)
- [ ] PMO creates baseline → status shows "handed_off"
- [ ] SDMT sees pending status in Forecast screen
- [ ] SDMT accepts → status updates to "accepted"
- [ ] SDMT rejects with comment → comment visible
- [ ] PM views ProjectDetailsPanel → sees rejection info
- [ ] PMO views same data in projects screen
- [ ] Non-SDMT users don't see action buttons

### Visual Tests (Recommended)
- [ ] BaselineStatusPanel renders in Forecast
- [ ] BaselineStatusPanel renders in Changes
- [ ] Accept button works and shows success
- [ ] Reject modal opens and accepts input
- [ ] Status badges have correct colors
- [ ] ProjectDetailsPanel shows conditional fields
- [ ] Mobile responsive layout works

## Error Scenarios

### Build Error (Fixed)
**Issue**: Duplicate `modChartData` variable declaration
**Location**: `src/modules/finanzas/ProjectsManager.tsx:232`
**Fix**: Removed duplicate declaration (lines 197-229)
**Status**: ✅ Resolved

### Missing Fields (Fixed)
**Issue**: ProjectForUI type didn't include rejection fields
**Location**: `src/modules/finanzas/projects/useProjects.ts`
**Fix**: Added `rejected_by`, `baseline_rejected_at`, `rejection_comment`
**Status**: ✅ Resolved

### Data Normalization (Fixed)
**Issue**: normalizeProjectForUI didn't map rejection fields
**Location**: `src/modules/finanzas/projects/normalizeProject.ts`
**Fix**: Added mapping for rejection fields from API response
**Status**: ✅ Resolved
