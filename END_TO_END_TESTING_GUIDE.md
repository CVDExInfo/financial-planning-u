# End-to-End Testing & Debugging Guide

**Last Updated:** November 17, 2025  
**Purpose:** Comprehensive guide for testing and debugging all UI, API, and infrastructure components working together  
**Status:** ACTIVE - Use this to verify system functionality

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Component-Level Testing](#component-level-testing)
4. [API Response Format Verification](#api-response-format-verification)
5. [Data Flow Validation](#data-flow-validation)
6. [Database & Lambda Testing](#database--lambda-testing)
7. [Known Issues & Fixes](#known-issues--fixes)
8. [Test Checklist](#test-checklist)
9. [Debugging Commands](#debugging-commands)

---

## Executive Summary

### Current State (November 17, 2025)

**✅ What's Working:**

- Project selector dropdown functional (redesigned in commit 5e54dcd)
- API integration layer established with fallback to mock data
- Dialog state management for approval workflows
- Basic routing between SDMT modules (Catalog, Changes, Reconciliation, Forecast)
- Authentication context and role-based access control

**⚠️ Known Issues to Address:**

1. **Project Selector Visual Improvements** - Redesigned but needs UI testing
2. **Service Tier Selector** - Component exists but interaction testing needed
3. **Changes Approval Workflow** - Dialog structure correct but state handling needs verification
4. **API Response Formats** - Mock data works but production API shape must match
5. **DynamoDB Schema** - Tables need verification for proper response formats
6. **Lambda Handlers** - Output format consistency critical for UI parsing

**🔴 Critical Blockers (None Currently):**

- Build passes successfully with 0 errors
- No blocking TypeScript issues
- All major components render

---

## System Architecture Overview

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ProjectContextBar           ServiceTierSelector                 │
│  ├─ Project Selection        ├─ Tier Display                    │
│  └─ Period Selection         └─ Selection Callback              │
│                                                                   │
│  SDMTCatalog  →  SDMTChanges  →  SDMTReconciliation            │
│  ├─ Line Items  ├─ Change Req  ├─ Invoices                    │
│  └─ Display     └─ Approval    └─ Reconciliation               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                       CONTEXT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ProjectContext (useProject hook)                               │
│  ├─ selectedProjectId                                            │
│  ├─ selectedPeriod                                               │
│  ├─ currentProject (full object)                                 │
│  ├─ projects (array)                                             │
│  └─ Event callbacks: setSelectedProjectId, setSelectedPeriod    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVICE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ApiService (static methods with fallback)                      │
│  ├─ getLineItems(projectId)                                      │
│  ├─ getChangeRequests(projectId)                                │
│  ├─ getInvoices(projectId)                                       │
│  ├─ getForecastData(projectId)                                   │
│  └─ [All with fallback to mock data]                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                     AWS LAMBDA LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  API Endpoints (Lambda):                                        │
│  ├─ GET /projects/{id}/rubros                                   │
│  ├─ GET /projects/{id}/changes                                  │
│  ├─ GET /projects/{id}/invoices                                 │
│  └─ GET /projects/{id}/plan (forecast)                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                    DynamoDB TABLES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Projects, LineItems, Changes, Invoices, Forecast              │
│  └─ PK: project_id, SK: entity_id                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component-Level Testing

### 1. ProjectContextBar (Project Selector)

**Location:** `src/components/ProjectContextBar.tsx`

**What It Does:**

- Displays list of available projects
- Allows selection of active project
- Shows period selector
- Displays project metadata (budget, timeline, team)

**Key Features (Implemented):**
✅ Project list display with popover
✅ Project selection updates context
✅ Period selection (months dropdown)
✅ Visual hierarchy improved
✅ Placeholder text and descriptions

**Test Steps:**

```typescript
// 1. Verify component renders
- Load app dashboard
- Look for project selector in top bar
- Should show current project name

// 2. Test project selection
- Click dropdown to open popover
- Verify all projects display
- Click different project
- Verify context updates (use React DevTools)
- Verify page content changes based on new project

// 3. Verify styling
- Check dropdown width (should be 500px after redesign)
- Check spacing between items
- Check hover states (background change)
- Check selected state (checkmark visible)

// 4. Test period selection
- Click period dropdown
- Select different month range
- Verify data refreshes for new period
```

**Console Verification:**

```bash
# Look for these logs:
📂 Project selected: [project_name] ([project_id])
📊 Period updated: Month [start] - Month [end]
```

**Common Issues & Fixes:**

| Issue                    | Cause                                 | Fix                                                            |
| ------------------------ | ------------------------------------- | -------------------------------------------------------------- |
| Dropdown doesn't open    | Popover trigger not working           | Check Radix UI Popover import and props                        |
| Projects don't show      | useProject() hook returns empty       | Check ProjectContext provides data                             |
| Selection doesn't update | setSelectedProjectId callback missing | Verify context hook implementation                             |
| Style looks wrong        | CSS classes not applied               | Check Tailwind build includes components/ProjectContextBar.tsx |

---

### 2. ServiceTierSelector (Service Tier Display)

**Location:** `src/components/ServiceTierSelector.tsx`

**What It Does:**

- Displays available service tiers
- Shows pricing for each tier
- Allows selection of recommended tier
- Displays tier features and benefits

**Key Features (Should Verify):**

- Service tier cards render correctly
- Pricing calculations correct
- Selection callback fires
- Recommended tier highlighted

**Test Steps:**

```typescript
// 1. Verify rendering
- Navigate to service selection page/component
- Should see 5 tier cards (Essential, Professional, Enterprise, Premium, Strategic)
- Each should show pricing range

// 2. Test tier selection
- Click on tier card button "Select Tier"
- Check browser console for callback log
- Verify parent component receives selection

// 3. Verify pricing display
- Check pricing matches serviceCatalog mock data
- Test pricing range calculation (min-max)
- Verify formatting (currency, no decimals)

// 4. Test recommended tier
- Verify "Recommended" badge shows on appropriate tier
- Check styling (ring-2 shadow effects)
```

**Console Verification:**

```bash
# Look for these logs:
🎯 Tier selected - [tier_name]
💰 Pricing: $[price] - $[price]
⭐ Recommended: [true/false]
```

**Expected Flow:**

1. User sees tier options
2. User clicks "Select Tier" button
3. onSelect callback fires with tier ID
4. Parent component updates state
5. UI shows selection confirmation

---

### 3. SDMTChanges (Change Management)

**Location:** `src/features/sdmt/cost/Changes/SDMTChanges.tsx`

**What It Does:**

- Displays list of change requests
- Shows approval status per change
- Opens approval workflow dialog
- Displays change request details

**Key Structure:**
✅ Table rows render correctly
✅ View Workflow button triggers dialog
✅ Dialog opens with selected change
✅ ApprovalWorkflow component displays inside dialog

**Test Steps:**

```typescript
// 1. Verify data loads
- Select a project in ProjectContextBar
- Navigate to Changes tab
- Should see list of changes load
- Check console for loading log

// 2. Test View Workflow button
- Click "View Workflow" button on any change
- Dialog should open with:
  - Change title in header
  - Change details (description, impact, justification)
  - Approval steps list
  - Approve/Reject buttons (if applicable)

// 3. Verify dialog state
- Open dialog for one change
- Close dialog
- Open dialog for different change
- Verify correct change displays (not cached from previous)

// 4. Test approval action (if user has permission)
- Click "Approve" or "Reject" button
- Enter comments
- Click submit
- Dialog should close
- Should see success message
- Change status should update
```

**Data Structure (What API Should Return):**

```typescript
interface ChangeRequest {
  id: string; // e.g., "CHG-2024-001"
  title: string; // e.g., "Additional Senior Developer"
  description: string; // Detailed description
  impact_amount: number; // Budget impact ($)
  status: "pending" | "approved" | "rejected";
  approvals: ApprovalStep[]; // Array of approval steps
}

interface ApprovalStep {
  id: string;
  role: string; // e.g., "Technical Lead"
  approverName?: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
  decidedAt?: string;
}
```

**Console Verification:**

```bash
# Look for these logs:
✅ Change requests loaded for project: [project_id]
👁️ Viewing workflow for change: [change_id]
✅ Change Management: approve/reject request [id]
```

---

### 4. SDMTReconciliation (Invoice Matching)

**Location:** `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx`

**What It Does:**

- Displays list of uploaded invoices
- Shows line item associations
- Allows invoice status updates
- Matches invoices to forecasted spending

**Test Steps:**

```typescript
// 1. Verify invoices load
- Navigate to Reconciliation tab
- Should see table with invoices
- Each invoice shows: id, line item, month, amount, status

// 2. Test invoice upload
- Click "Upload Invoice" button
- Select file (CSV or PDF)
- Map to line item
- Submit
- New invoice should appear in table

// 3. Test status updates
- Click invoice status dropdown
- Change from "Pending" to "Matched" or "Disputed"
- Add comment (optional)
- Submit
- Status should update and persist

// 4. Verify data linking
- Each invoice should link to correct line item
- Invoice amounts should match or be flagged if different
- Monthly totals should rollup correctly
```

**Data Structure (What API Should Return):**

```typescript
interface InvoiceDoc {
  id: string; // e.g., "INV-001"
  line_item_id: string; // Links to LineItem
  month: number; // 1-12
  amount: number; // Invoice amount
  status: "Pending" | "Matched" | "Disputed";
  vendor: string;
  file_url: string;
  uploaded_at: string; // ISO timestamp
}
```

---

### 5. ApprovalWorkflow (Dialog Content)

**Location:** `src/features/sdmt/cost/Changes/ApprovalWorkflow.tsx`

**What It Does:**

- Displays change request details
- Shows approval step timeline
- Provides approve/reject form
- Handles approval submission

**Test Steps:**

```typescript
// 1. Verify change details display
- Dialog opens
- Change title, description, impact visible
- Justification displayed
- Affected line items listed

// 2. Test approval steps rendering
- Timeline shows all approval steps
- Each step shows: role, approver name (if decided), status, comments
- Status icons display correctly (✓, ✗, ⏳)

// 3. Test approval form (if user can approve)
- Comments textarea appears
- Can type comments
- Action buttons visible (Approve/Reject)
- Required field validation works

// 4. Test approval submission
- Enter comment
- Click "Approve" or "Reject"
- Request submits to API
- Dialog closes
- Parent component updates
```

---

## API Response Format Verification

### Critical: API Must Match UI Expectations

The **most common cause of "UI not working"** is API response format mismatch. Let's verify:

### 1. getLineItems Response Format

**API Endpoint:** `GET /projects/{projectId}/rubros`

**Expected Response Format:**

```json
{
  "data": [
    {
      "id": "LI-001",
      "category": "Labor",
      "description": "Senior Developer",
      "qty": 1,
      "unit_cost": 8500,
      "currency": "USD",
      "...": "other fields"
    }
  ],
  "total": 25
}
```

**UI Component Expects:**

```typescript
const [items, setItems] = useState<LineItem[]>([]);
// Should be array of LineItem objects, NOT wrapped

// In component:
items.map(item => ...)  // ← Direct iteration
item.filter(...)        // ← Direct filter
```

**Critical Fix (Already Applied):**

```typescript
// src/lib/api.ts - getLineItems method
static async getLineItems(project_id: string): Promise<LineItem[]> {
  const data = await response.json();
  // MUST extract array properly:
  const items = Array.isArray(data) ? data : data.data || [];
  return items; // Return clean array
}
```

**Verification Steps:**

```bash
# 1. Check network response in browser DevTools
- Open Network tab
- Go to Catalog page
- Look for request to /projects/*/rubros
- Check Response tab
- Verify format matches above

# 2. Check console logs
- Should see: "✅ Line items loaded - XX items"
- NOT: "Failed to load"

# 3. Test array operations in console
const items = ... // Get from DevTools
items.map(i => i.id)  // Should work
items.length          // Should return number
```

### 2. getChangeRequests Response Format

**API Endpoint:** `GET /projects/{projectId}/changes`

**Expected Response Format:**

```json
[
  {
    "id": "CHG-2024-001",
    "title": "...",
    "status": "pending",
    "impact_amount": 25500,
    "approvals": []
  }
]
```

**Verification:**

```bash
# Check in Network tab:
- Response should be JSON array (starts with [)
- NOT wrapped in {"data": [...]}
```

### 3. getInvoices Response Format

**API Endpoint:** `GET /projects/{projectId}/invoices`

**Expected Response Format:**

```json
[
  {
    "id": "INV-001",
    "line_item_id": "LI-001",
    "month": 1,
    "amount": 10000,
    "status": "Pending"
  }
]
```

---

## Data Flow Validation

### End-to-End Flow: User Selects Project → Views Changes → Approves Change

```
1. USER ACTION: Click project in ProjectContextBar
   └─ setSelectedProjectId(projectId)

2. CONTEXT UPDATE: useProject hook updates
   └─ selectedProjectId → [projectId]
   └─ currentProject → [full project object]
   └─ projectChangeCount increments

3. COMPONENT EFFECT: SDMTChanges useEffect detects change
   └─ Depends on: [selectedProjectId, projectChangeCount]
   └─ Calls: loadChangeRequests()

4. API CALL: ApiService.getChangeRequests(selectedProjectId)
   └─ Try: GET /projects/{id}/changes
   └─ Fallback: Mock data
   └─ Returns: ChangeRequest[]

5. STATE UPDATE: setChangeRequests(data)
   └─ Table re-renders with change list

6. USER ACTION: Click "View Workflow" for change
   └─ setSelectedChange(change)
   └─ setIsWorkflowDialogOpen(true)

7. DIALOG OPENS: Shows ApprovalWorkflow component
   └─ Displays: Change details + approval steps

8. USER ACTION: Click "Approve" button
   └─ handleApprovalAction(changeId, "approve", comments)

9. API CALL: Update change request
   └─ Try: POST /projects/{id}/changes/{changeId}/approve
   └─ Fallback: Update local state

10. SUCCESS: Toast notification + dialog closes
    └─ Parent component optionally refreshes
```

**Debugging Each Step:**

```javascript
// Step 1: Verify project selection
const { selectedProjectId } = useProject();
console.log("Current project ID:", selectedProjectId);
// Expected: "PRJ-HEALTHCARE-MODERNIZATION" or similar

// Step 3: Verify effect triggers
useEffect(() => {
  console.log("Effect triggered! Project:", selectedProjectId);
  loadChangeRequests();
}, [selectedProjectId]);

// Step 4: Verify API response
const response = await fetch(...);
const data = await response.json();
console.log("API response:", data);
console.log("Array?", Array.isArray(data));
console.log("Has .data?", data.data ? "yes" : "no");

// Step 5: Verify state update
setChangeRequests(data);
console.log("State updated, changes:", data.length);

// Step 8: Verify approval action
console.log("Approving change:", changeId, "Status:", comments);
```

---

## Database & Lambda Testing

### DynamoDB Tables Structure

**Table: projects**

```
PK: project_id (string)
SK: (none - simple key)
Attributes:
  ├─ name: string
  ├─ description: string
  ├─ budget: number
  ├─ status: string
  └─ created_at: string
```

**Table: line_items**

```
PK: project_id (string)
SK: line_item_id (string)
Attributes:
  ├─ category: string
  ├─ description: string
  ├─ qty: number
  ├─ unit_cost: number
  ├─ currency: string
  └─ other fields...
```

**Table: changes**

```
PK: project_id (string)
SK: change_id (string)
Attributes:
  ├─ title: string
  ├─ status: string
  ├─ impact_amount: number
  ├─ approvals: list
  └─ ...
```

### Lambda Handler Response Format

**Handler: /projects/{id}/rubros**

```typescript
export async function handler(event: APIGatewayProxyEvent) {
  const projectId = event.pathParameters?.project_id;

  // Query DynamoDB
  const items = await queryLineItems(projectId);

  // CRITICAL: Return with proper wrapper
  return {
    statusCode: 200,
    body: JSON.stringify({
      data: items, // ← Array wrapped in 'data'
      total: items.length,
    }),
  };
}
```

**Handler: /projects/{id}/changes**

```typescript
export async function handler(event: APIGatewayProxyEvent) {
  const projectId = event.pathParameters?.project_id;

  // Query DynamoDB
  const changes = await queryChanges(projectId);

  // CRITICAL: Return as direct array (NOT wrapped)
  return {
    statusCode: 200,
    body: JSON.stringify(changes), // ← Direct array
  };
}
```

### Testing Lambda Output

```bash
# 1. Invoke Lambda via AWS CLI
aws lambda invoke --function-name finanzas-api-rubros \
  --payload '{"projectId":"PRJ-HEALTHCARE-MODERNIZATION"}' \
  response.json
cat response.json

# 2. Check CloudWatch logs
aws logs tail /aws/lambda/finanzas-api --follow

# 3. Test via curl (if API Gateway)
curl -X GET \
  https://[api-id].execute-api.[region].amazonaws.com/prod/projects/PRJ-HEALTHCARE-MODERNIZATION/rubros \
  -H "Authorization: Bearer [token]"
```

---

## Known Issues & Fixes

### Issue 1: "View Workflow" Button Doesn't Open Dialog

**Symptom:** Clicking "View Workflow" doesn't open the dialog

**Root Cause:** Dialog state not managed correctly or selectedChange not being set

**Fix Applied:**

```typescript
// Before (BROKEN):
<TableRow key={change.id}>
  {/* Dialog inside loop - causes issues */}
  <Dialog>
    <DialogTrigger>View Workflow</DialogTrigger>
    <DialogContent>
      <ApprovalWorkflow change={change} />
    </DialogContent>
  </Dialog>
</TableRow>

// After (FIXED):
<TableRow key={change.id}>
  <TableCell>
    <Button onClick={() => {
      setSelectedChange(change);      // ← Set state FIRST
      setIsWorkflowDialogOpen(true);  // ← Then open
    }}>View Workflow</Button>
  </TableCell>
</TableRow>

{/* Dialog OUTSIDE loop */}
<Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
  <DialogContent>
    {selectedChange && <ApprovalWorkflow change={selectedChange} />}
  </DialogContent>
</Dialog>
```

**Verification:**

```bash
# Check browser console
# Should see: "👁️ Viewing workflow for change: CHG-2024-001"
```

---

### Issue 2: API Response Format Mismatch

**Symptom:** "Cannot read property 'map' of undefined" or "filter is not a function"

**Root Cause:** API returns `{data: [...]}` but code expects array directly

**Fix Applied (src/lib/api.ts):**

```typescript
static async getLineItems(projectId: string): Promise<LineItem[]> {
  const data = await response.json();
  // Handle both formats
  const items = Array.isArray(data) ? data : data.data || [];
  return items;
}
```

**Verification:**

```bash
# In browser console:
const response = await fetch('/api/...');
const data = await response.json();
console.log(Array.isArray(data), data.data !== undefined);
# Should see: [true, true] or [false, true]
```

---

### Issue 3: Project Selector Doesn't Update Page

**Symptom:** Clicking different project doesn't change data

**Root Cause:** useEffect dependency array incomplete or context not triggering updates

**Fix:** Verify dependencies:

```typescript
useEffect(() => {
  if (selectedProjectId) {
    loadData();
  }
}, [selectedProjectId]); // ← Must include this
```

---

### Issue 4: Approval Workflow Form Doesn't Submit

**Symptom:** Click Approve/Reject does nothing

**Root Cause:** Missing onClick handler or validation preventing submission

**Fix:**

```typescript
const handleApprovalSubmit = () => {
  if (!actionType || !comments.trim()) {
    toast.error("Please provide comments");
    return;
  }

  // Call parent callback
  onApprovalAction(changeRequest.id, actionType, comments);

  // Close dialog
  setIsDialogOpen(false);
};
```

---

## Test Checklist

Use this checklist to verify end-to-end functionality:

### Pre-Testing Setup

- [ ] Run `npm run build` - should pass with 0 errors
- [ ] Open DevTools (F12) - Console tab ready
- [ ] Open Network tab - monitor API calls
- [ ] Open React DevTools extension - inspect context

### Project Selector Testing

- [ ] Dropdown opens when clicked
- [ ] All projects display in list
- [ ] Projects have descriptions visible
- [ ] Can select different project
- [ ] Page content updates for new project
- [ ] Console shows "📂 Project selected: [name]"
- [ ] Network tab shows new API calls for project data

### Catalog Page Testing

- [ ] Page loads line items for selected project
- [ ] Line items display in table/grid
- [ ] Can see: category, description, qty, cost, total
- [ ] Console shows "✅ Line items loaded - X items"
- [ ] No "filter is not a function" errors
- [ ] Data correct for different projects

### Changes Page Testing

- [ ] Change requests list loads
- [ ] Status badges display correctly (pending/approved/rejected)
- [ ] Impact amounts show with proper colors (red for increase)
- [ ] "View Workflow" button visible
- [ ] Clicking "View Workflow" opens dialog
- [ ] Dialog shows correct change (not cached)
- [ ] Dialog has approval steps list
- [ ] Can see comments and approver names

### Approval Workflow Testing

- [ ] Dialog opens with change details
- [ ] All approval steps visible in timeline
- [ ] Status icons correct (✓, ✗, ⏳)
- [ ] If current user can approve:
  - [ ] Comments textarea visible
  - [ ] Can type comments
  - [ ] Approve button clickable
  - [ ] Reject button clickable
  - [ ] Clicking approve sends request
  - [ ] Success toast appears
  - [ ] Dialog closes automatically
  - [ ] Parent page updates

### Reconciliation Page Testing

- [ ] Invoices list loads
- [ ] Each invoice shows: ID, line item, month, amount, status
- [ ] Can upload new invoice
- [ ] Upload form accepts file
- [ ] Can change invoice status
- [ ] Status updates persist

### API Integration Testing

- [ ] All network requests successful (200 status)
- [ ] Response payloads correctly formatted
- [ ] No 404 or 500 errors
- [ ] Mock data used as fallback (if API fails)
- [ ] Correct data for each project/period

### Error Handling Testing

- [ ] Network error handled gracefully
- [ ] Error messages displayed to user
- [ ] Can retry failed operations
- [ ] Console shows error logs with context

---

## Debugging Commands

### Browser Console Commands

```javascript
// 1. Check project context
const { selectedProjectId, projects, currentProject } = useProject();
console.log({ selectedProjectId, projects, currentProject });

// 2. Check API response format
const response = await fetch(
  "/api/projects/PRJ-HEALTHCARE-MODERNIZATION/rubros"
);
const data = await response.json();
console.log("Format check:", {
  isArray: Array.isArray(data),
  hasData: !!data.data,
  structure: Object.keys(data),
});

// 3. Test array operations
data.map((item) => item.id); // Should work

// 4. Simulate component lifecycle
useEffect(() => {
  console.log("Effect running");
  return () => console.log("Cleanup");
}, [dependency]);
```

### Terminal Commands

```bash
# Build verification
npm run build  # Should show 0 errors

# Type checking
npx tsc --noEmit  # Should show 0 errors

# Linting
npm run lint  # Should show clean or only warnings

# Check git status
git status  # Should be clean or show only uncommitted changes

# View recent commits
git log --oneline -5  # Verify all fixes deployed

# Run in dev mode with logging
npm run dev  # Watch for console errors
```

### Network Debugging

```javascript
// Add request/response interceptor
const originalFetch = window.fetch;
window.fetch = function (...args) {
  console.log("📡 Request:", args[0]);
  return originalFetch.apply(this, args).then((response) => {
    console.log("📡 Response:", response.status);
    return response
      .clone()
      .text()
      .then((text) => {
        console.log("📡 Body:", text.substring(0, 200));
        return new Response(text, response);
      });
  });
};
```

---

## Next Steps for Validation

### Immediate Actions (This Week)

1. ✅ Read this guide completely
2. ✅ Run all test checklist items
3. ⏳ Document any failures with:
   - Screenshot/video of issue
   - Console log output
   - Network request/response
   - Steps to reproduce
4. ⏳ Create focused fix for each issue

### Documentation Updates Needed

- [ ] API response format spec (sync with Lambda)
- [ ] Component prop interfaces (TypeScript)
- [ ] Error handling patterns
- [ ] State management flow diagrams
- [ ] Testing best practices guide

### Code Quality Improvements

- [ ] Add error boundaries around all dialogs
- [ ] Add loading states to all data fetches
- [ ] Add retry mechanisms for API failures
- [ ] Add logging to all state transitions
- [ ] Add JSDoc comments to all components

---

## References

- **Commits:** 5e54dcd (Project Selector Redesign), 17c6962 (API Fix), 769215d (Error Fixes)
- **Architecture Review:** See `ARCHITECTURE_REVIEW_COMPREHENSIVE.md`
- **Best Practices:** See `CODE_ARCHITECTURE_BEST_PRACTICES.md`
- **API Reference:** See `src/lib/api.ts` and `src/types/domain.d.ts`

---

**Status:** Active  
**Last Review:** November 17, 2025  
**Next Review:** After end-to-end testing complete
