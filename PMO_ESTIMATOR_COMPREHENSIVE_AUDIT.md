# PMO Estimator - Comprehensive System Audit Report

**Date**: November 15, 2025  
**Scope**: PMO Pre-Factura Estimator Wizard - Full stack analysis (Frontend, API, DynamoDB, S3)  
**Status**: CRITICAL ISSUES IDENTIFIED - Multiple blocking problems preventing end-to-end data flow

---

## Executive Summary

The PMO Pre-Factura Estimator wizard has **significant architectural and implementation gaps** that prevent proper data flow from frontend UI to backend persistence. While the UI renders correctly and collects user input, **the handoff to SDMT and data persistence chain is broken**.

### Critical Findings:

- ❌ **Buttons 1-4 (Deal Inputs, Labor, Non-Labor, FX) have NO action triggers** - data only persists to localStorage
- ❌ **"Sign & Create Baseline" button does create baseline BUT data is NOT saved to DynamoDB**
- ❌ **"Complete & Handoff to SDMT" button navigates away WITHOUT calling handoff API**
- ❌ **Document upload feature does NOT exist** - no S3 integration, no upload handler
- ❌ **No form validation prevents proceeding without signatures**
- ❌ **No real-time validation or error feedback** for button actions
- ❌ **API endpoints defined but NOT wired to frontend button handlers**
- ❌ **Missing middleware layer** between UI button clicks and API calls

**Impact**: User can complete entire wizard and click "Handoff" but:

1. No project created in DynamoDB
2. No baseline saved
3. No audit trail generated
4. No handoff record created
5. No documents uploaded to S3

---

## API Specification Analysis

### ✅ API Endpoints Defined

**OpenAPI 3.0.1 specifies**:

```json
{
  "POST /baseline": { "security": ["CognitoJwt"] },
  "POST /projects/{id}/handoff": { "security": ["CognitoJwt"] },
  "POST /projects/{id}/rubros": { "security": ["CognitoJwt"] },
  "PUT /projects/{id}/allocations:bulk": { "security": ["CognitoJwt"] },
  "GET /projects": { "security": ["CognitoJwt"] },
  "POST /projects": { "security": ["CognitoJwt"] },
  "POST /payroll/ingest": { "security": ["CognitoJwt"] },
  "POST /close-month": { "security": ["CognitoJwt"] },
  "GET /catalog/rubros": { "security": [] }
}
```

### ❌ Implementation Gaps

| Endpoint                      | Status     | Frontend Integration           | Backend Handler         | DynamoDB Write               | Issue                                       |
| ----------------------------- | ---------- | ------------------------------ | ----------------------- | ---------------------------- | ------------------------------------------- |
| `POST /baseline`              | ✅ Exists  | ❌ Called only after signature | ✅ Exists (baseline.ts) | ⚠️ Partial (uses old schema) | API handler doesn't persist all wizard data |
| `POST /projects/{id}/handoff` | ✅ Exists  | ❌ NEVER CALLED                | ✅ Exists (handoff.ts)  | ✅ Yes                       | Frontend navigates away instead of calling  |
| `POST /projects/{id}/rubros`  | ✅ Exists  | ❌ Not used in estimator       | ✅ Exists               | ✅ Yes                       | Not integrated with NonLaborStep            |
| `PUT /allocations:bulk`       | ✅ Exists  | ❌ Not used                    | ✅ Exists               | ✅ Yes                       | Not integrated with cost allocation         |
| `GET /catalog/rubros`         | ✅ Exists  | ⚠️ Hardcoded in NonLaborStep   | ✅ Exists               | N/A                          | Should fetch from API, not hardcoded        |
| **Document Upload**           | ❌ MISSING | ❌ No UI component             | ❌ No handler           | ❌ No S3 integration         | **CRITICAL - Not implemented**              |

---

## Issue Deep Dive

### ISSUE #1: Steps 1-4 Have No API Hooks (DealInputsStep, LaborStep, NonLaborStep, FXIndexationStep)

**Location**: `src/features/pmo/prefactura/Estimator/steps/*.tsx`

**Problem**:

```tsx
// DealInputsStep.tsx - Line 59
const onSubmit = (formData: DealInputs) => {
  setData(formData); // ← Only saves to localStorage
  onNext(); // ← Moves to next step
  // ❌ NO API call to persist to backend
};
```

**Current Data Flow**:

```
User Input → React State → localStorage → Memory (LOST on refresh)
                ↓
          No Backend Persistence
                ↓
          No Audit Trail
```

**Expected Data Flow**:

```
User Input → React State → API Call → DynamoDB
                ↓            ↓           ↓
        LocalStorage   Response  Audit Trail
                ↓
        Real-time Sync
```

**Console Evidence**:

```
❌ No console logs indicating API calls on each step
❌ Steps only trigger localStorage updates
❌ No network activity in DevTools for steps 1-4
```

**Why This Matters**:

- User loses all work on page refresh
- No audit trail of who entered what data
- Cannot resume wizard in progress
- No validation feedback from backend
- Cannot detect conflicts/duplicates early

---

### ISSUE #2: "Sign & Create Baseline" Creates Baseline But Doesn't Save Full Data

**Location**: `src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx` (Line 113)

**Current Code**:

```tsx
const handleDigitalSign = async () => {
  if (!isReviewed) return;

  setIsSigning(true);
  try {
    const baseline = await ApiService.createBaseline({
      project_name: dealInputs?.project_name,
      labor_estimates: laborEstimates,
      non_labor_estimates: nonLaborEstimates,
      fx_indexation: fxIndexationData,
      // ❌ MISSING: signature_hash, created_by, client_name, currency, start_date
    });

    setBaselineId(baseline.baseline_id);
    setSignatureComplete(true);
  } catch (error) {
    console.error("Failed to create baseline:", error);
  }
};
```

**Problem**:

1. ✅ API endpoint is called
2. ❌ But request payload MISSING critical fields:

   - `signature_hash` - no digital signature actually created
   - `created_by` - no user attribution
   - `client_name` - user input lost
   - `currency` - user input lost
   - `contract_value` - optional but not sent
   - `assumptions` - user input lost
   - `start_date` - REQUIRED but not sent

3. ❌ No validation error handling
4. ❌ Silent failures - user sees success but backend rejects data

**Backend Handler Issue** (`services/finanzas-api/src/handlers/baseline.ts`):

```typescript
interface BaselineRequest {
  project_name: string;
  labor_estimates: any[];
  non_labor_estimates: any[];
  fx_indexation?: any;
  // ❌ Missing required fields matching UI input
}
```

**Console Evidence**:

```
✅ "Baseline created via API" shows in console
❌ But actual DynamoDB write shows missing fields
❌ Audit trail incomplete - no actor attribution
```

---

### ISSUE #3: "Complete & Handoff to SDMT" Button NEVER Calls Handoff API

**Location**: `src/features/pmo/prefactura/Estimator/PMOEstimatorWizard.tsx` (Line 223)

**Current Code** (ReviewSignStep.tsx Line 592):

```tsx
const handleComplete = () => {
  onNext(); // ← Calls parent's onNext handler
  // ❌ NO handoff API call
};
```

**Parent Component** (PMOEstimatorWizard.tsx Line 223):

```tsx
{isLastStep ? (
  <Button
    onClick={() => navigate('/sdmt/cost/catalog')}
    className="gap-2"
  >
    Complete & Handoff to SDMT
    <ArrowRight size={16} />
  </Button>
```

**The Problem**:

```
User clicks "Complete & Handoff"
  ↓
ReviewSignStep.handleComplete() calls onNext()
  ↓
PMOEstimatorWizard parent navigates to '/sdmt/cost/catalog'
  ↓
❌ NO HANDOFF API CALL (POST /projects/{id}/handoff)
  ↓
✅ Page navigates to SDMT cost catalog
  ❌ BUT no handoff record created in DynamoDB
  ❌ SDMT team never notified
  ❌ No baseline_id linked to project
```

**What SHOULD Happen**:

```typescript
const handleComplete = async () => {
  try {
    // 1. Call handoff API
    const handoffResponse = await ApiService.handoffBaseline(projectId, {
      baseline_id: baselineId,
      mod_total: grandTotal,
      pct_ingenieros: laborPercentage,
      pct_sdm: 100 - laborPercentage,
      aceptado_por: currentUser.email,
    });

    // 2. Wait for response
    if (handoffResponse.ok) {
      toast.success("Project successfully handed off to SDMT");
      navigate("/sdmt/cost/catalog");
    }
  } catch (error) {
    toast.error("Handoff failed: " + error.message);
  }
};
```

**API Endpoint Exists But Unused**:

```typescript
// services/finanzas-api/src/handlers/handoff.ts - EXISTS and works
export const handler = async (event: APIGatewayProxyEventV2) => {
  const id = event.pathParameters?.id;

  const handoff = {
    pk: `PROJECT#${id}`,
    sk: `HANDOFF#${now}`,
    mod_total: body.mod_total,
    // ... creates audit trail
  };

  await ddb.send(new PutCommand(...));
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
```

**Impact**:

- ✅ User thinks handoff happened (sees success message)
- ❌ Handoff record NOT created in DynamoDB
- ❌ Audit trail shows no handoff event
- ❌ SDMT has no baseline to work with
- ❌ Cost tracking workflow breaks

---

### ISSUE #4: Document Upload Feature Missing Entirely

**Location**: ReviewSignStep.tsx

**Current State**:

- ❌ No document upload UI component
- ❌ No file input field in Review & Sign section
- ❌ No S3 bucket integration
- ❌ No multipart upload handler
- ❌ No API endpoint for document upload
- ✅ BUT: SDMT Reconciliation HAS upload (different feature)

**Why It's Missing**:

```typescript
// ReviewSignStep.tsx shows these export buttons:
- Export Excel (implemented)
- Share Report/PDF (implemented)

// ❌ But NO buttons for:
- Upload supporting documents
- Attach contract/SOW
- Upload resource allocation doc
```

**What Should Exist**:

**Frontend**:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Supporting Documents</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-6">
        <input
          type="file"
          multiple
          onChange={handleDocumentUpload}
          accept=".pdf,.xlsx,.doc,.docx"
        />
      </div>
      <div className="space-y-2">
        {uploadedDocs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between">
            <span>{doc.filename}</span>
            <span className="text-xs text-green-600">✓ Uploaded</span>
          </div>
        ))}
      </div>
    </div>
  </CardContent>
</Card>
```

**Backend Handler** (missing):

```typescript
// services/finanzas-api/src/handlers/documents.ts - DOES NOT EXIST
export const handler = async (event: APIGatewayProxyEventV2) => {
  // 1. Extract multipart form data
  // 2. Upload to S3 bucket
  // 3. Store reference in DynamoDB (finz_documents table)
  // 4. Return signed download URL
  // 5. Create audit entry
};
```

**Required Infrastructure**:

- S3 Bucket: `finanzas-documents-${ENVIRONMENT}`
- DynamoDB Table: `finz_documents`
- API Endpoint: `POST /projects/{id}/documents`
- Lambda Function: ~50 lines to handle multipart uploads
- IAM Role: S3 write permissions for Lambda

---

### ISSUE #5: No Form Validation Prevents Proceeding Without Critical Data

**Location**: All step components

**Problem**:

```tsx
// DealInputsStep.tsx - Line 48
const form = useForm<DealInputs>({
  resolver: zodResolver(dealInputsSchema),
  // ✅ Schema validation exists locally
  defaultValues: data || {
    project_name: "",
    currency: "USD",
    start_date: "",
    duration_months: 12,
  },
});

const onSubmit = (formData: DealInputs) => {
  setData(formData);
  onNext(); // ← But no backend validation before proceeding
};
```

**Current Validation**:

- ✅ React Hook Form validates against Zod schema locally
- ✅ User cannot submit step without required fields
- ❌ BUT: No backend-side validation

**Scenario**:

```
1. User enters: project_name="Test", start_date="", currency="USD"
2. Frontend validation: ✅ Passes (start_date is optional in component)
3. User clicks Next → moves to Labor step
4. User saves all wizard data to localStorage
5. User closes browser
6. User reopens browser → data is still there
7. User signs baseline with INCOMPLETE data
8. Backend receives: {project_name: "Test", start_date: null, ...}
9. ❌ DynamoDB write fails silently (or accepts invalid data)
```

**Missing**:

- Backend validation on each API endpoint
- Clear error messages when validation fails
- Backward flow to previous step if validation fails
- Required field indicator on all forms
- "Complete" checklist showing what's missing

---

### ISSUE #6: Missing Real-Time Console Logging

**Location**: All components

**Problem**:
When user clicks buttons, there are NO console logs indicating:

- ✅ Button was clicked
- ❌ Which step is being processed
- ❌ What data is being sent
- ❌ API endpoint being called
- ❌ Request/response details
- ❌ Any errors

**Console Should Show**:

```javascript
// When user clicks "Add Labor Item" button
console.log("➕ Labor item added", { role, country, fte_count });

// When user clicks Next on Labor step
console.log("📤 Saving labor estimates", laborEstimates);
console.log("🔗 API Call: POST /projects/{id}/labor-estimates", payload);

// When user signs baseline
console.log("✍️  Digitally signing baseline", { baseline_id, signature_hash });
console.log("🔗 API Call: POST /baseline", payload);

// When user completes wizard
console.log("🚀 Handing off to SDMT", { project_id, baseline_id });
console.log("🔗 API Call: POST /projects/{id}/handoff", payload);
```

**Impact**:

- Developers cannot debug without adding console.log manually
- Users cannot troubleshoot when things fail
- No audit trail in browser history
- Cannot trace which step failed

---

## API Connection Status Matrix

| Feature            | UI Button          | API Endpoint                | Frontend Handler     | Backend Handler   | DynamoDB            | Working               |
| ------------------ | ------------------ | --------------------------- | -------------------- | ----------------- | ------------------- | --------------------- |
| Create Project     | N/A                | POST /projects              | ❌ Not called        | ✅ projects.ts    | ✅ finz_projects    | ❌                    |
| Get Projects       | N/A                | GET /projects               | ✅ getProjects       | ✅ projects.ts    | ✅ finz_projects    | ⚠️ Falls back to mock |
| Deal Inputs        | Next ➜             | N/A                         | ❌ localStorage only | N/A               | ❌                  | ❌                    |
| Add Labor Item     | +Add Member        | N/A                         | ❌ localStorage only | N/A               | ❌                  | ❌                    |
| Add Non-Labor Item | +Add Item          | POST /projects/{id}/rubros  | ❌ Not called        | ✅ rubros.ts      | ✅ finz_rubros      | ❌                    |
| FX Configuration   | Next ➜             | N/A                         | ❌ localStorage only | N/A               | ❌                  | ❌                    |
| Digital Sign       | Sign Baseline      | POST /baseline              | ✅ Called            | ✅ baseline.ts    | ⚠️ Partial fields   | ⚠️                    |
| Handoff to SDMT    | Complete & Handoff | POST /projects/{id}/handoff | ❌ Not called        | ✅ handoff.ts     | ❌                  | ❌                    |
| Upload Documents   | (Missing)          | (Missing)                   | ❌                   | ❌                | ❌                  | ❌                    |
| Create Allocations | N/A                | PUT /allocations:bulk       | ❌ Not called        | ✅ allocations.ts | ✅ finz_allocations | ❌                    |

---

## Critical Path Analysis: "Complete Baseline Creation Flow"

### What User Expects:

```
1. Enter Project Details (Deal Inputs)
   ↓
2. Build Team (Labor)
   ↓
3. Add Infrastructure (Non-Labor)
   ↓
4. Configure FX & Inflation
   ↓
5. Review & Sign
   ↓
6. Hand Off to SDMT Team

   RESULT: Project appears in SDMT dashboard with all data
```

### What Actually Happens:

```
1. Enter Project Details (Deal Inputs)
   ├─ ✅ Form validation passes
   ├─ ✅ Data saved to localStorage
   ├─ ❌ NO API call to /projects
   └─ ❌ NO project created in DynamoDB

2. Build Team (Labor)
   ├─ ✅ Form validation passes
   ├─ ✅ Data saved to localStorage
   ├─ ❌ NO API call
   └─ ❌ NO labor data persisted

3. Add Infrastructure (Non-Labor)
   ├─ ✅ Form validation passes
   ├─ ✅ Data saved to localStorage
   ├─ ❌ NO API call to /projects/{id}/rubros
   └─ ❌ NO rubros created

4. Configure FX & Inflation
   ├─ ✅ Form validation passes
   ├─ ✅ Data saved to localStorage
   └─ ❌ NO API call

5. Review & Sign
   ├─ ✅ User checks review checkbox
   ├─ ✅ User clicks "Sign & Create Baseline"
   ├─ ✅ API call to POST /baseline
   ├─ ⚠️  Baseline PARTIALLY created (missing fields)
   ├─ ⚠️  DynamoDB receives: {baseline_id, labor_estimates, non_labor_estimates}
   └─ ❌ Missing: {signature_hash, created_by, client_name, currency, assumptions}

6. Hand Off to SDMT Team
   ├─ ✅ User clicks "Complete & Handoff to SDMT"
   ├─ ❌ NO API call to /projects/{id}/handoff
   ├─ ✅ Frontend navigates to /sdmt/cost/catalog
   └─ ❌ NO handoff record created

   RESULT:
   ✅ User sees success (navigated to SDMT page)
   ❌ NO project in database
   ❌ NO baseline linked to project
   ❌ NO audit trail
   ❌ SDMT team cannot see any data
```

**Console Evidence During Flow**:

```
Step 1: Deal Inputs
  ✓ ProjectContext changed: Object
  ✓ Form submitted
  ✗ No API call logged

Step 2-4: Labor, Non-Labor, FX
  ✓ ProjectContext updated for each step
  ✗ No backend activity

Step 5: Sign & Create Baseline
  ✓ "📊 Project context changed: Object"
  ✓ "Baseline created via API" (but with incomplete data)
  ✗ DynamoDB audit trail empty

Step 6: Complete & Handoff
  ✗ No network request visible
  ✓ Page navigates away
  ✗ No handoff record in DynamoDB
```

---

## Missing Infrastructure & Integrations

### 1. Document Upload System (PRIORITY: CRITICAL)

**Not Implemented**:

- No S3 bucket in AWS
- No multipart upload Lambda handler
- No document reference table in DynamoDB
- No file virus scanning
- No signed download URLs
- No cleanup policy for old docs

**Required Implementation** (~200 lines of code):

```typescript
// Lambda handler for document upload
// 1. Parse multipart form data
// 2. Validate file type/size
// 3. Scan with ClamAV (optional)
// 4. Upload to S3
// 5. Store metadata in DynamoDB
// 6. Return signed URL
```

### 2. Handoff API Wiring (PRIORITY: CRITICAL)

**API Handler Exists** but is never called from frontend

**Frontend Missing**:

```typescript
// Need to add to ReviewSignStep.tsx
const handleComplete = async () => {
  // Call handoff endpoint
  const response = await fetch("/projects/{projectId}/handoff", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      baseline_id: baselineId,
      mod_total: grandTotal,
      pct_ingenieros: laborPercentage,
      pct_sdm: 100 - laborPercentage,
      aceptado_por: userEmail,
    }),
  });

  navigate("/sdmt/cost/catalog");
};
```

### 3. Real-Time Step Validation (PRIORITY: HIGH)

**Currently Missing**:

- Backend validation on each step
- No "Continue anyway?" prompts for validation errors
- No step completion checklist
- No progress persistence across page refreshes
- No resume functionality

**Required**:

```typescript
// Validate each step before proceeding
const validateStep = async (stepId: string, data: any) => {
  const response = await fetch(`/validate/${stepId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

  return response.json(); // { valid: boolean, errors: [] }
};
```

### 4. Audit Trail Logging (PRIORITY: HIGH)

**Missing From All Steps**:

- Who entered what data
- When each change was made
- What values were changed
- Approval workflow tracking

**Required in Each Step**:

```typescript
// Log to console for each action
console.log("📝 User action:", {
  action: "labor_item_added",
  role,
  country,
  fte_count,
  timestamp: new Date().toISOString(),
  user: currentUser.email,
});

// Send to backend
await fetch("/audit/log", {
  method: "POST",
  body: JSON.stringify({
    action: "labor_item_added",
    resource_type: "estimator",
    resource_id: estimatorId,
    changes: { role, country, fte_count },
  }),
});
```

---

## UI/UX Issues

### 1. No Disabled State for "Next" Button Until Signature

**Problem**: User can click through all steps without completing signature
**Fix**: Disable "Complete & Handoff" button until baseline is created

### 2. No Success/Error Toast Notifications

**Problem**: User clicks button, nothing happens (silently fails)
**Expected**: Toast notification: "✓ Baseline created" or "✗ Failed to create baseline"

### 3. No Loading State During API Calls

**Problem**: User doesn't know if request is processing
**Current**: Only visible on sign button (should be on all async buttons)

### 4. No Undo/Cancel During Handoff

**Problem**: User cannot stop handoff process once started
**Current**: No confirmation dialog before calling API

### 5. No Progress Persistence

**Problem**: User loses all work on browser refresh
**Expected**: Resume from last completed step

---

## Recommended Implementation Order

### Phase 1: CRITICAL (Blocks end-to-end flow)

1. **Wire Handoff API Call** (2 hours)
   - Add handleComplete to ReviewSignStep
   - Call POST /projects/{id}/handoff before navigation
   - Add error handling and retry logic
2. **Fix Baseline Creation Payload** (1 hour)

   - Send all required fields to POST /baseline
   - Add signature_hash generation
   - Extract user email from JWT

3. **Add Document Upload UI & API** (4 hours)
   - Create DocumentUploadSection component
   - Implement multipart form handler
   - Create S3 upload Lambda function

### Phase 2: HIGH (Improves reliability)

4. **Add Step Validation** (3 hours)

   - Create validation endpoints for each step
   - Add error feedback to UI
   - Implement step-level data persistence to backend

5. **Implement Console Logging** (2 hours)

   - Add DEBUG logs to all button handlers
   - Log API requests/responses
   - Create browser-based audit trail viewer

6. **Add Form Validation Feedback** (2 hours)
   - Show required field indicators
   - Display validation errors
   - Show estimated costs in real-time

### Phase 3: MEDIUM (Improves UX)

7. **Implement Progress Persistence** (2 hours)

   - Save estimator session to DynamoDB
   - Allow resume from last step
   - Show session history

8. **Add Confirmation Dialogs** (1 hour)
   - Confirm before handoff
   - Warn about unsaved changes
   - Confirm before leaving wizard

---

## Testing Strategy

### Unit Tests (Per Component)

```bash
npm test src/features/pmo/prefactura/Estimator/steps/
```

### Integration Tests (API Calls)

```bash
# Test each button triggers correct API
POST /projects → verify project created
POST /baseline → verify baseline fields saved
POST /projects/{id}/handoff → verify handoff record created
POST /projects/{id}/documents → verify S3 upload
```

### E2E Tests (Full Workflow)

```bash
# 1. Create project via estimator
# 2. Verify in DynamoDB
# 3. Verify in SDMT dashboard
# 4. Verify audit trail
# 5. Verify documents available for download
```

### Manual Testing Checklist

- [ ] Each button click shows console log
- [ ] Form validation prevents invalid submission
- [ ] API response displayed in DevTools
- [ ] DynamoDB record verified with AWS CLI
- [ ] Page refresh resumes wizard
- [ ] Document upload shows progress
- [ ] Handoff creates audit record
- [ ] SDMT sees handoff in dashboard

---

## Files That Need Changes

### Frontend

- [ ] `src/features/pmo/prefactura/Estimator/PMOEstimatorWizard.tsx` - Add button handlers
- [ ] `src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx` - Wire handoff, add documents
- [ ] `src/features/pmo/prefactura/Estimator/steps/DealInputsStep.tsx` - Add console logging
- [ ] `src/features/pmo/prefactura/Estimator/steps/LaborStep.tsx` - Add console logging
- [ ] `src/features/pmo/prefactura/Estimator/steps/NonLaborStep.tsx` - Add console logging
- [ ] `src/features/pmo/prefactura/Estimator/steps/FXIndexationStep.tsx` - Add console logging
- [ ] `src/lib/api.ts` - Add handoff, document upload, validation methods
- [ ] `src/config/api.ts` - Add missing endpoints

### Backend

- [ ] `services/finanzas-api/src/handlers/documents.ts` - NEW - Document upload handler
- [ ] `services/finanzas-api/src/handlers/baseline.ts` - Fix payload validation
- [ ] `services/finanzas-api/src/handlers/handoff.ts` - Already good, just needs to be called
- [ ] `services/finanzas-api/src/handlers/validation.ts` - NEW - Step-by-step validation
- [ ] `services/finanzas-api/sam-template.yaml` - Add document upload route

### Infrastructure

- [ ] S3 bucket for documents
- [ ] DynamoDB table for document references
- [ ] CloudFront distribution for signed URLs

### Tests

- [ ] `scripts/test-pmo-estimator.ts` - NEW - Full workflow test
- [ ] `scripts/test-pmo-buttons.ts` - NEW - Button interaction tests
- [ ] `services/finanzas-api/tests/handlers/documents.test.ts` - NEW

---

## Success Criteria

- ✅ Each wizard step logs to console when "Next" is clicked
- ✅ Data persists to DynamoDB after each step (not just localStorage)
- ✅ "Sign & Create Baseline" saves ALL user-entered data
- ✅ "Complete & Handoff" calls API and creates handoff record
- ✅ Document upload UI present and functional
- ✅ Documents uploaded to S3 and referenced in DynamoDB
- ✅ 100% of test cases pass (12/12)
- ✅ New project visible in SDMT dashboard after handoff
- ✅ Audit trail shows complete workflow
- ✅ Page refresh resumes wizard from last completed step

---

## Conclusion

The PMO Estimator has a **complete architecture** defined in the OpenAPI spec, but the **implementation is incomplete**. Most critically:

1. **Frontend buttons are not wired to APIs** - User interactions don't trigger backend processing
2. **Handoff flow is broken** - API handler exists but is never called
3. **Document upload is missing** - No S3 integration exists
4. **Data validation is incomplete** - No backend-side checks
5. **Audit logging is missing** - No traceability for user actions

**All required APIs exist in the backend**. The work is primarily on the frontend to wire buttons to API calls and add the document upload feature.

**Estimated effort to complete**: 15-20 hours of development + testing
