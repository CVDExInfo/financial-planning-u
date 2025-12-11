# Baseline Acceptance Flow

## Overview

This document describes the baseline acceptance lifecycle in the Financial Planning system, focusing on the SDMT approval workflow and PM notification integration.

## Architecture

### Components

1. **Backend Handlers**
   - `acceptBaseline.ts` - Handles baseline acceptance
   - `rejectBaseline.ts` - Handles baseline rejection with optional comments
   - Both handlers update project metadata and write audit logs

2. **Frontend Components**
   - `BaselineStatusPanel.tsx` - UI component showing baseline status and action buttons
   - Located in SDMT Forecast and Changes screens

3. **API Integration**
   - `acceptBaseline()` - API client function for acceptance
   - `rejectBaseline()` - API client function for rejection
   - Both integrate with authentication and error handling

## Workflow Sequence

### 1. Baseline Handoff (PMO → SDMT)

```
PMO creates baseline → Handoff to SDMT → baseline_status: "handed_off"
```

### 2. SDMT Review

When SDMT users view projects in Forecast or Changes screens:

1. `BaselineStatusPanel` displays if baseline exists
2. Shows current status: PENDING, ACCEPTED, or REJECTED
3. If status is PENDING or HANDED_OFF:
   - SDMT sees "Accept" and "Reject" buttons
   - PM and other roles see read-only status

### 3. Acceptance Flow

```
SDMT clicks "Accept Baseline"
  ↓
Frontend: POST /projects/{projectId}/accept-baseline
  ↓
Backend: acceptBaseline handler
  ↓
Updates DynamoDB:
  - baseline_status: "accepted"
  - accepted_by: <user_email>
  - baseline_accepted_at: <timestamp>
  ↓
Writes audit log entry
  ↓
Returns updated project metadata
  ↓
Frontend: Refreshes project context
  ↓
Panel updates to show "Accepted" badge
```

### 4. Rejection Flow

```
SDMT clicks "Reject"
  ↓
Modal dialog appears for optional comment
  ↓
SDMT enters reason and confirms
  ↓
Frontend: POST /projects/{projectId}/reject-baseline
  ↓
Backend: rejectBaseline handler
  ↓
Updates DynamoDB:
  - baseline_status: "rejected"
  - rejected_by: <user_email>
  - baseline_rejected_at: <timestamp>
  - rejection_comment: <optional_comment>
  ↓
Writes audit log entry
  ↓
Returns updated project metadata
  ↓
Frontend: Refreshes project context
  ↓
Panel updates to show "Rejected" badge with reason
```

## Data Model

### Project Metadata (DynamoDB)

```typescript
{
  pk: "PROJECT#<projectId>",
  sk: "METADATA",
  baseline_id: string,
  baseline_status: "pending" | "handed_off" | "accepted" | "rejected",
  
  // Acceptance fields
  accepted_by?: string,
  baseline_accepted_at?: string,
  
  // Rejection fields
  rejected_by?: string,
  baseline_rejected_at?: string,
  rejection_comment?: string,
  
  updated_at: string
}
```

### Audit Log Entry

```typescript
{
  pk: "ENTITY#PROJECT#<projectId>",
  sk: "TS#<timestamp>",
  action: "BASELINE_ACCEPTED" | "BASELINE_REJECTED",
  resource_type: "project",
  resource_id: string,
  user: string,
  timestamp: string,
  before: {
    baseline_status: string,
    // ... previous values
  },
  after: {
    baseline_status: string,
    // ... new values
  },
  source: "API",
  ip_address: string,
  user_agent: string
}
```

## PM Notifications (Extension Point)

### Current Implementation

Both acceptance and rejection handlers include a **TODO** section for PM notification:

```typescript
// TODO: PM Notification Extension Point
// When a baseline is accepted/rejected, notify the PM via:
// 1. Email lambda (if configured)
// 2. Notifications table entry (for in-app notifications)
```

### Future Implementation Plan

#### Option 1: Email Notifications

Create a Lambda function that:
1. Reads project metadata to get PM email
2. Sends formatted email with baseline status
3. Includes project details and action timestamp

```typescript
// Example email notification
await sendEmail({
  to: project.pm_email,
  subject: `Baseline ${status} for ${project.name}`,
  body: `
    SDMT has ${status} the baseline for project ${project.name}.
    
    Baseline ID: ${baselineId}
    ${status === 'rejected' ? `Reason: ${comment}` : ''}
    Action by: ${user}
    Timestamp: ${timestamp}
  `
});
```

#### Option 2: In-App Notifications

Create a `project_notifications` DynamoDB table:

```typescript
{
  pk: "PROJECT#<projectId>",
  sk: "NOTIFICATION#<timestamp>",
  type: "baseline_accepted" | "baseline_rejected",
  recipient: string, // PM email
  message: string,
  comment?: string,
  actioned_by: string,
  timestamp: string,
  read: boolean,
  dismissed: boolean
}
```

Frontend banner in PMO views:

```typescript
// Display when PM views their projects
if (isPM && hasUnreadNotifications) {
  <NotificationBanner>
    SDMT has {action} your baseline for {projectName}.
    {comment && `Reason: ${comment}`}
  </NotificationBanner>
}
```

## Role-Based Access Control

### SDMT Role
- **Can**: Accept, Reject baselines
- **Sees**: Action buttons when status is PENDING or HANDED_OFF
- **Cannot**: Edit accepted/rejected baselines (status is immutable)

### PM Role
- **Can**: View baseline status
- **Sees**: Read-only status panel with acceptance/rejection details
- **Cannot**: Accept or reject (PMO creates, SDMT approves)

### PMO Role
- **Can**: View baseline status
- **Sees**: Read-only status panel
- **Cannot**: Accept or reject (handoff creates initial state)

### EXEC_RO / VENDOR
- **Can**: View baseline status (read-only)
- **Sees**: Status information only
- **Cannot**: Perform any actions

## UI Components

### BaselineStatusPanel

**Location**: 
- `src/components/baseline/BaselineStatusPanel.tsx`
- Displayed in SDMT Forecast and Changes screens

**Props**:
```typescript
interface BaselineStatusPanelProps {
  className?: string;
}
```

**Features**:
- Shows baseline ID and current status
- Color-coded status badges:
  - 🟡 Pending/Handed Off (amber)
  - 🟢 Accepted (green)
  - 🔴 Rejected (red)
- Displays acceptance/rejection metadata (who, when)
- Shows rejection comment if present
- SDMT-only action buttons
- Accept confirmation with mutation
- Reject modal with optional comment field
- Automatic refresh on success

### Integration Points

**SDMT Forecast Screen**:
```tsx
<BaselineStatusPanel />
```

**SDMT Changes Screen**:
```tsx
<BaselineStatusPanel />
```

Both panels:
- Appear below the header and project context bar
- Only show if baseline exists
- Auto-hide for projects without baselines
- Refresh on project context changes

## API Endpoints

### Accept Baseline

```
PATCH /projects/{projectId}/accept-baseline

Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body:
{
  "baseline_id": "base_abc123",
  "accepted_by": "optional@email.com"  // defaults to JWT user
}

Response: 200 OK
{
  "projectId": "P-123",
  "baselineId": "base_abc123",
  "baseline_status": "accepted",
  "accepted_by": "sdmt@example.com",
  "baseline_accepted_at": "2025-12-11T01:00:00.000Z",
  "id": "P-123",
  "name": "Project Name",
  "code": "P-123",
  ...
}

Errors:
  400 - Missing baseline_id or mismatch
  404 - Project not found
  401 - Unauthorized
  403 - Forbidden (not SDMT role)
```

### Reject Baseline

```
PATCH /projects/{projectId}/reject-baseline

Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body:
{
  "baseline_id": "base_abc123",
  "rejected_by": "optional@email.com",  // defaults to JWT user
  "comment": "Optional rejection reason"
}

Response: 200 OK
{
  "projectId": "P-123",
  "baselineId": "base_abc123",
  "baseline_status": "rejected",
  "rejected_by": "sdmt@example.com",
  "baseline_rejected_at": "2025-12-11T01:00:00.000Z",
  "rejection_comment": "Budget exceeds approved limits",
  "id": "P-123",
  "name": "Project Name",
  ...
}

Errors:
  400 - Missing baseline_id or mismatch
  404 - Project not found
  401 - Unauthorized
  403 - Forbidden (not SDMT role)
```

## Testing

### Backend Unit Tests

**Location**: 
- `services/finanzas-api/tests/unit/acceptBaseline.spec.ts`
- `services/finanzas-api/tests/unit/rejectBaseline.spec.ts`

**Coverage**:
- ✅ Successful acceptance with metadata update
- ✅ Successful rejection with comment
- ✅ Rejection without comment
- ✅ 404 when project not found
- ✅ 400 when baseline_id mismatches
- ✅ 400 when baseline_id missing
- ✅ Audit log creation

### Frontend Tests (Recommended)

```typescript
describe('BaselineStatusPanel', () => {
  it('shows pending status for handed_off baseline', () => {});
  it('shows accept and reject buttons for SDMT role', () => {});
  it('hides action buttons for PM role', () => {});
  it('calls acceptBaseline API on accept click', () => {});
  it('opens reject modal on reject click', () => {});
  it('calls rejectBaseline API with comment', () => {});
  it('refreshes project context after success', () => {});
  it('displays error toast on API failure', () => {});
});
```

## Deployment

### SAM Template Changes

The SAM template (`services/finanzas-api/template.yaml`) includes:

1. **AcceptBaselineFn** Lambda function
   - Handler: `acceptBaseline.handler`
   - Route: `PATCH /projects/{projectId}/accept-baseline`
   - Policies: DynamoDB access to projects and audit tables

2. **RejectBaselineFn** Lambda function
   - Handler: `rejectBaseline.handler`
   - Route: `PATCH /projects/{projectId}/reject-baseline`
   - Policies: DynamoDB access to projects and audit tables

### Deployment Steps

```bash
cd services/finanzas-api
sam build
sam deploy --guided
```

## Security Considerations

1. **Authentication**: Both endpoints require valid JWT token from Cognito
2. **Authorization**: Only SDMT role can accept/reject (enforced by `ensureCanWrite`)
3. **Validation**: Baseline ID must match project's current baseline
4. **Audit Trail**: All actions logged with user, timestamp, and IP
5. **Immutability**: Accepted/rejected baselines cannot be modified again

## Future Enhancements

1. **PM Notification Email**
   - Integrate with SES or SNS
   - Template-based emails with branding
   - Configurable notification preferences

2. **In-App Notification Center**
   - Notification badge in header
   - Dismissible notifications list
   - Mark as read/unread functionality

3. **Approval Chain**
   - Multi-level approval (e.g., SDMT → Finance → Executive)
   - Configurable approval flows per project type
   - Parallel or sequential approvals

4. **Re-submission Flow**
   - Allow PMO to revise and resubmit rejected baselines
   - Track revision history
   - Compare versions

5. **Status Transitions**
   - Support additional states (e.g., "under_review", "pending_revision")
   - Workflow state machine
   - Timeout/escalation rules

## Related Documentation

- `baseline-acceptance-discovery.md` - Initial discovery and requirements
- `BASELINE_SDMT_ALIGNMENT_FIX.md` - Historical alignment work
- API Documentation (OpenAPI spec)
- Authentication & Authorization Guide

## Support

For issues or questions:
1. Check audit logs for detailed action history
2. Review CloudWatch logs for Lambda execution errors
3. Verify DynamoDB table permissions
4. Confirm user has SDMT role in Cognito groups
