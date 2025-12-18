# PMO/SDMT Baseline Visibility & Notifications - Implementation Summary

## Overview

This implementation adds end-to-end support for SDM manager email propagation, baseline visibility queues, and PM notifications for baseline acceptance/rejection events.

## Changes Implemented

### Backend Changes

#### 1. AcceptBaseline Handler Enhancement (`services/finanzas-api/src/handlers/acceptBaseline.ts`)

**Robustness Improvements:**
- Modified to accept baseline acceptance without requiring `baseline_id` in the request body
- If `baseline_id` is omitted, the handler reads it from project metadata (`project.METADATA.baseline_id`)
- Returns clear error message if project metadata is missing `baseline_id`: "project metadata missing baseline_id: run handoff first"
- Validates that provided `baseline_id` matches project metadata to prevent accepting wrong baseline

**Notification System:**
- After successful acceptance, writes a notification entry to `project_notifications` table
- Notification includes:
  - `type`: "baseline_accepted"
  - `recipient`: SDM manager email or PM email from project metadata
  - `message`: Descriptive message about the acceptance
  - `baseline_id`: The accepted baseline ID
  - `actioned_by`: Email of the user who accepted
  - `timestamp`: ISO timestamp
  - `read`: false (initially unread)

#### 2. RejectBaseline Handler Enhancement (`services/finanzas-api/src/handlers/rejectBaseline.ts`)

**Notification System:**
- After successful rejection, writes a notification entry to `project_notifications` table
- Notification includes:
  - `type`: "baseline_rejected"
  - `recipient`: SDM manager email or PM email from project metadata
  - `message`: Descriptive message about the rejection
  - `comment`: Rejection reason provided by SDMT user
  - `baseline_id`: The rejected baseline ID
  - `actioned_by`: Email of the user who rejected
  - `timestamp`: ISO timestamp
  - `read`: false (initially unread)

#### 3. Notifications Handler (NEW: `services/finanzas-api/src/handlers/notifications.ts`)

**New Endpoint:** `GET /projects/{projectId}/notifications`
- Returns project-specific notifications (baseline acceptance/rejection events)
- Supports optional `?unread=true` query parameter to filter to unread notifications only
- Returns most recent notifications first (up to 50)

#### 4. Baseline List Enhancement (`services/finanzas-api/src/handlers/baseline.ts`)

**Improvement:**
- Modified `listBaselines` function to include `sdm_manager_email` in the response
- Extracts email from both top-level item and nested payload

#### 5. Infrastructure (`services/finanzas-api/template.yaml`)

**New DynamoDB Table:**
- `ProjectNotificationsTable` with pk/sk pattern for efficient querying

**Updated Lambda Permissions:**
- `AcceptBaselineFn`: Added DynamoDB access to `ProjectNotificationsTable`
- `RejectBaselineFn`: Added DynamoDB access to `ProjectNotificationsTable`
- `NotificationsFn`: New function with GET /projects/{projectId}/notifications endpoint

### Frontend Changes

#### 1. BaselineVisibilityQueue Component (NEW)

**Purpose:** Displays a queue of pending baselines for PMO and SDMT users

**Features:**
- Calls `GET /baseline?status=PendingSDMT` to fetch pending baselines
- Shows table with columns: Project Name, SDM Email (mailto link), Amount, Date, Actions
- Configurable via props for different use cases
- Auto-refreshes every 60 seconds

#### 2. NotificationsBanner Component (NEW)

**Purpose:** Displays inline notifications for baseline acceptance/rejection on project pages

**Features:**
- Calls `GET /projects/{projectId}/notifications` to fetch notifications
- Shows acceptance notifications with green styling and checkmark icon
- Shows rejection notifications with red styling and X icon
- Auto-refreshes every 30 seconds

#### 3. PMO Project Details Page Enhancement

**Modified:** `src/features/pmo/projects/PMOProjectDetailsPage.tsx`
- Integrated NotificationsBanner below page header
- Automatically shows notifications when project has baseline activity

#### 4. Frontend Data Flow Verification

- ✅ DealInputsStep.tsx captures `sdm_manager_email` in form
- ✅ ReviewSignStep.tsx includes `sdm_manager_email` in handoff payload
- ✅ BaselineStatusPanel.tsx calls `acceptBaseline` without `baseline_id` parameter

## Verification Steps

### 1. Backend Verification

```bash
# Test accept baseline without baseline_id in body
curl -X PATCH "https://api.example.com/projects/P-123/accept-baseline" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: Success if project has baseline_id in metadata

# Test notifications endpoint
curl -X GET "https://api.example.com/projects/P-123/notifications" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of notifications

# Test baseline list includes sdm_manager_email
curl -X GET "https://api.example.com/baseline?status=PendingSDMT" \
  -H "Authorization: Bearer $TOKEN"
```

### 2. DynamoDB Verification

```bash
# Check project metadata
aws dynamodb get-item \
  --table-name finz_projects \
  --key '{"pk":{"S":"PROJECT#P-xxx"},"sk":{"S":"METADATA"}}' \
  --query 'Item.{baseline_id:baseline_id.S,sdm_manager_email:sdm_manager_email.S}'

# Check notification was created
aws dynamodb query \
  --table-name finz_project_notifications \
  --key-condition-expression 'pk = :pk' \
  --expression-attribute-values '{":pk":{"S":"PROJECT#P-xxx"}}'
```

### 3. End-to-End Flow

1. Create Baseline → Verify sdm_manager_email in baseline record
2. Handoff to SDMT → Verify project METADATA has baseline_id and sdm_manager_email
3. View Pending Baselines → Verify baseline in queue with SDM email mailto
4. Accept Baseline → Verify notification created
5. View Notification → Verify green banner shows acceptance

## Deployment Checklist

- [x] Backend changes committed
- [x] Frontend changes committed
- [x] DynamoDB table added to template.yaml
- [x] Lambda permissions updated in template.yaml
- [ ] Backend unit tests added
- [ ] Frontend unit tests added
- [ ] SAM build and deploy to staging
- [ ] Run backfill script in staging
- [ ] Manual QA in staging
- [ ] Deploy to production

## Known Limitations

1. **Notification Read Status:** No endpoint to mark notifications as read (future enhancement)
2. **BaselineVisibilityQueue Placement:** Component created but needs product decision on landing page placement
3. **Email Notifications:** System writes in-app notifications only (no email alerts)

## Future Enhancements

1. Mark notifications as read endpoint
2. Email notification integration
3. Real-time notification updates
4. Notification history page
5. BaselineVisibilityQueue integration on dedicated dashboards
