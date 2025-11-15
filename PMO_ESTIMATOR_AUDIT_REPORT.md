# PMO Estimator Comprehensive Audit Report

**Date**: November 15, 2025  
**Component**: PMO Pre-Factura Estimator Wizard  
**Status**: 🔴 CRITICAL - Multiple missing controls, API integrations, and data pipeline issues

---

## EXECUTIVE SUMMARY

The PMO Pre-Factura Estimator has **severe architectural gaps** preventing proper data flow from UI to DynamoDB. Issues identified:

1. ✅ **UI Components exist** - All 5 wizard steps created with nice UI
2. ❌ **Buttons don't validate inputs** - No required field enforcement on progression
3. ❌ **No console logging for debugging** - Cannot track data flow
4. ❌ **No signature validation** - Baseline created without signature confirmation
5. ❌ **No document upload feature** - S3 integration missing entirely
6. ❌ **No handoff validation** - Data passed to handoff but not stored properly
7. ❌ **API calls fail silently** - Try/catch returns fallback mock data
8. ❌ **DynamoDB writes incomplete** - Only audit trail partially working

---

## DETAILED FINDINGS

### 1. UI Button Issues & Missing Controls

#### Issue 1.1: No Input Validation on Step Progression

**Location**: `src/features/pmo/prefactura/Estimator/PMOEstimatorWizard.tsx`

**Problem**:

```tsx
const handleNext = () => {
  if (!isLastStep) {
    setCurrentStepIndex(currentStepIndex + 1); // ❌ No validation!
  }
};
```

**Impact**: User can click "Next" without filling ANY required fields:

- Deal Inputs step: Can skip project name, start date, duration
- Labor step: Can proceed with 0 team members
- Non-Labor step: Can skip cost items
- FX step: Can skip entirely

**Test**: Click "Next" on Deal Inputs without entering project name → **advances to Labor step** ❌

---

#### Issue 1.2: No Signature Required Before Baseline Creation

**Location**: `src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx` (lines 380-410)

**Current Code**:

```tsx
const handleDigitalSign = async () => {
  if (!isReviewed) return;  // Only checks checkbox!

  // Creates baseline immediately
  const baseline = await ApiService.createBaseline({...});
};
```

**Problem**:

- User CAN check "I have reviewed..." FALSELY
- No actual digital signature mechanism
- Button responds to checkbox state, not cryptographic validation
- You report: "page allows proceeding without signature" ✅ **CONFIRMED**

**Current UI State**: Shows "Sign & Create Baseline" button but:

- Takes effect only when checkbox is checked
- No pop-up, no signature pad, no verification
- Treats checkbox as legal authority

---

#### Issue 1.3: Missing Step Completion Guards

**Location**: All step files - `DealInputsStep.tsx`, `LaborStep.tsx`, etc.

**Problem**: Each step's `onSubmit` directly calls `onNext()` without validating:

- DealInputsStep saves data but doesn't check if required fields are populated
- LaborStep allows proceeding with empty labor list
- NonLaborStep allows proceeding with zero cost items
- FXIndexationStep has no validation

---

### 2. Console Logging Issues - Data Flow Visibility

#### Issue 2.1: No Diagnostic Console Output

**Location**: All step components

**Current State**:

```tsx
const onSubmit = (formData: DealInputs) => {
  setData(formData); // ❌ No console.log
  onNext(); // ❌ No logging
};
```

**Missing Logs**:

```typescript
// Should log:
console.log("📊 Deal Inputs submitted:", formData);
console.log("💾 Persisting to localStorage:", {
  key: "estimator-deal-inputs",
  data,
});
console.log("🔄 Moving to step 2: Labor");
```

**Impact**:

- Your report: "lot of actions not showing in dev tools counsel" ✅ **ROOT CAUSE IDENTIFIED**
- Cannot debug data pipeline
- Cannot see which buttons actually trigger handlers
- Cannot verify localStorage persistence

---

### 3. API Integration Failures

#### Issue 3.1: Missing API Calls for Data Persistence

**Location**: Each wizard step

**Current Code**:

```tsx
// DealInputsStep.tsx
const onSubmit = (formData: DealInputs) => {
  setData(formData); // ❌ Only saves to local state
  onNext();
  // ❌ NO API CALL!
};
```

**Expected Flow** (MISSING):

```typescript
const onSubmit = async (formData: DealInputs) => {
  console.log("📊 Submitting deal inputs...", formData);

  try {
    // Should call API to persist progressively
    const response = await fetch("/api/projects/draft-estimate", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        step: "deal-inputs",
        data: formData,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("❌ Failed to save deal inputs:", response.status);
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Deal inputs saved:", result);
    setData(formData);
    onNext();
  } catch (error) {
    console.error("🔴 Error saving deal inputs:", error);
    toast.error("Failed to save. Please try again.");
  }
};
```

**Your Report**: "nothing goes to backend nor console" ✅ **CONFIRMED - NO API CALLS AT ALL**

---

#### Issue 3.2: Wrong API Endpoint Used

**Location**: `src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx` (line 97)

**Current Code**:

```tsx
const baseline = await ApiService.createBaseline({
  project_name: dealInputs?.project_name,
  labor_estimates: laborEstimates,
  non_labor_estimates: nonLaborEstimates,
  fx_indexation: fxIndexationData,
});
```

**Problem**:

- Only calls API at FINAL step (Review & Sign)
- All previous wizard steps have ZERO API calls
- Only 1 API endpoint used: `POST /baseline`
- Should be calling multiple endpoints:
  - `POST /projects` - Create project
  - `POST /projects/{id}/rubros` - Add labor items
  - `POST /projects/{id}/rubros` - Add non-labor items
  - `POST /projects/{id}/baseline` - Create baseline

---

#### Issue 3.3: API Error Handling Falls Back to Mock Data

**Location**: `src/lib/api.ts` (lines 42-51)

**Current Code**:

```tsx
static async createBaseline(data: any): Promise<...> {
  try {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.baseline), {...});

    if (!response.ok) {
      console.warn("API call failed, returning mock baseline");  // ❌ FALLBACK
      await this.delay(500);
      return {
        baseline_id: `BL-${Date.now()}`,
        signature_hash: `SHA256-${Math.random().toString(36).substring(2)}`
      };
    }
    // ...
  } catch (error) {
    console.error("Failed to create baseline via API:", error);
    return { baseline_id: `BL-${Date.now()}`, ... };  // ❌ FALLBACK
  }
}
```

**Your Report**: "API calls falling back to mock" ✅ **CONFIRMED - GRACEFUL FALLBACK PREVENTS DATA WRITES**

---

### 4. DynamoDB Write Issues

#### Issue 4.1: Data Never Reaches DynamoDB

**Location**: Lambda handler mismatch

**Current Status**:

- Baseline handler (`services/finanzas-api/src/handlers/baseline.ts`) exists
- Handoff handler exists
- BUT: No Lambda for intermediate steps (labor, non-labor, fx)
- OpenAPI shows: `POST /baseline` - exists ✅
- Missing: `POST /projects/{id}/rubros` - for adding items

**Your Report**: "No new project appears in Dynamo" ✅ **CONFIRMED - API CALL FAILS, NO DATA WRITTEN**

#### Issue 4.2: No Draft Estimate Tracking

**Location**: No handler exists

**Missing**: API endpoint to save draft estimates between steps

- Should save progress after each step
- Should allow resume from where user left off
- Should track incomplete estimates

---

### 5. Document Upload - MISSING ENTIRELY

#### Issue 5.1: No Upload Feature in UI

**Location**: `ReviewSignStep.tsx` - No file input

**Current Code**:

```tsx
// ❌ NO FILE UPLOAD COMPONENT!
return (
  <div className="space-y-8">
    {/* Executive Summary */}
    {/* Detailed Breakdown */}
    {/* Review & Sign Section */}
  </div>
);
```

**Expected**:

```tsx
<div className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Supporting Documents</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="border-2 border-dashed rounded-lg p-6">
        <input type="file" multiple onChange={handleDocumentUpload} />
      </div>
      <div>
        {uploadedDocuments.map((doc) => (
          <div key={doc.id}>{doc.name}</div>
        ))}
      </div>
    </CardContent>
  </Card>
</div>
```

#### Issue 5.2: No S3 Integration

**Location**: Backend handlers

**Missing**:

- No Lambda handler for `POST /uploads`
- No S3 bucket configuration
- No pre-signed URL generation
- No file type validation
- No storage location tracking

**Your Report**: "document upload function while it does permit in front end, nothing goes to S3" ✅ **CONFIRMED - NO UPLOAD UI EXISTS**

---

### 6. Handoff Process Issues

#### Issue 6.1: Handoff Data Not Validated

**Location**: `PMOEstimatorWizard.tsx` (line 221)

**Current Code**:

```tsx
{isLastStep ? (
  <Button
    onClick={() => navigate('/sdmt/cost/catalog')}  // ❌ Just navigates!
    className="gap-2"
  >
    Complete & Handoff to SDMT
    <ArrowRight size={16} />
  </Button>
)}
```

**Problems**:

1. No validation that baseline was created
2. No API call to trigger handoff
3. No data passed to SDMT
4. Just redirects to SDMT page
5. Review & Sign step has SEPARATE "Complete & Handoff" button (line 594)
6. **Two different completion flows** - confusing UX

#### Issue 6.2: Missing Handoff Endpoint

**Location**: OpenAPI spec

**What exists**: `POST /projects/{id}/handoff` ✅
**What's missing**: No call from frontend to trigger it

**Current Flow** (Broken):

```
User clicks "Sign & Create Baseline"
  → Calls API createBaseline()
  → Returns mock baseline_id
  → Shows "Complete & Handoff" button
  → User clicks it
  → ❌ navigates to SDMT WITHOUT calling /projects/{id}/handoff
  → No data recorded in DynamoDB
  → SDMT sees no new baseline
```

---

### 7. Missing Console Logging Throughout

#### Issue 7.1: No Debug Output

**Current State**:

```typescript
// DealInputsStep.tsx
const onSubmit = (formData: DealInputs) => {
  setData(formData);
  onNext();
  // ❌ Zero console.log statements
};
```

**Should Include**:

```typescript
const onSubmit = (formData: DealInputs) => {
  console.log("📊 Step 1 - Deal Inputs Submitted:", {
    timestamp: new Date().toISOString(),
    data: formData,
    validated: form.formState.isValid,
  });

  console.log("💾 Persisting to localStorage:", {
    key: "estimator-deal-inputs",
    size: JSON.stringify(formData).length,
  });

  setData(formData);

  console.log("🔄 Advancing to Step 2 - Labor");
  onNext();
};
```

**Your Report**: "Dev tools show only activity when signature box is signed" ✅ **ROOT CAUSE: Minimal logging, no step-by-step console output**

---

## OpenAPI Specification Analysis

### ✅ Endpoints That Exist:

```
POST   /baseline
POST   /projects
GET    /projects
GET    /projects/{id}/plan
GET    /projects/{id}/rubros
POST   /projects/{id}/rubros
POST   /projects/{id}/handoff
PUT    /projects/{id}/allocations:bulk
GET    /baseline/{baseline_id}
```

### ❌ Endpoints That Are Missing:

```
POST   /draft-estimates              (step-by-step persistence)
POST   /draft-estimates/{id}/labor   (save labor step progress)
POST   /draft-estimates/{id}/non-labor
POST   /draft-estimates/{id}/fx
POST   /uploads                      (document upload)
GET    /uploads/{upload_id}
DELETE /uploads/{upload_id}
```

---

## Root Cause Analysis

### Primary Issues (In Order of Impact):

1. **❌ NO DATA PERSISTENCE BETWEEN STEPS**

   - Wizard only saves to localStorage (frontend only)
   - No API calls until final step
   - If user closes browser, data lost
   - No draft recovery

2. **❌ API CALL FAILS SILENTLY**

   - No auth token sent (we fixed this in last commit)
   - Falls back to mock data
   - User thinks baseline was created
   - Nothing written to DynamoDB

3. **❌ NO INPUT VALIDATION ON PROGRESSION**

   - User can skip required steps
   - Can reach Review with empty data
   - Signature doesn't block invalid data

4. **❌ NO CONSOLE LOGGING FOR DEBUG**

   - Cannot see which buttons work
   - Cannot trace data flow
   - Cannot identify failures

5. **❌ DOCUMENT UPLOAD NOT IMPLEMENTED**

   - No UI for file selection
   - No backend handler
   - No S3 integration

6. **❌ HANDOFF NOT INTEGRATED**
   - Frontend just redirects, doesn't call handoff endpoint
   - No validation that baseline exists
   - SDMT receives no data

---

## Testing Evidence

### Your Report Quotes (Verified):

| Issue                   | Quote                                        | Status                            |
| ----------------------- | -------------------------------------------- | --------------------------------- |
| No frontend updates     | "most buttons do not work as expected"       | ✅ CONFIRMED - No data binding    |
| Console silent          | "only activity when signature box is signed" | ✅ CONFIRMED - Minimal logging    |
| No controls             | "page allows proceeding without signature"   | ✅ CONFIRMED - No validation      |
| No documents            | "upload docs feature... nothing to S3"       | ✅ CONFIRMED - Feature missing    |
| No DynamoDB             | "not feeding into dynamoDB tables"           | ✅ CONFIRMED - API fails silently |
| No dev console activity | "not showing in dev tools counsel"           | ✅ CONFIRMED - No logging         |

---

## RECOMMENDATIONS & ACTION ITEMS

### IMMEDIATE FIXES (Critical):

1. **Add Input Validation & Guards**

   - Validate required fields before step progression
   - Block "Next" if step incomplete
   - Show validation errors

2. **Add Comprehensive Console Logging**

   - Log every button click
   - Log form validation results
   - Log API calls and responses
   - Log localStorage persistence

3. **Fix API Call Failure Handling**

   - Don't fall back to mock silently
   - Show error toast to user
   - Log exact error to console
   - Prevent baseline creation on failure

4. **Create Intermediate API Endpoints**

   - `POST /draft-estimates` - Create draft
   - `PATCH /draft-estimates/{id}/steps/{step}` - Save step progress
   - Save after each wizard step

5. **Implement Document Upload**

   - Add file input UI to Review step
   - Create `POST /uploads` Lambda handler
   - Generate pre-signed S3 URLs
   - Attach documents to baseline

6. **Implement Proper Handoff**

   - Call `POST /projects/{id}/handoff` from frontend
   - Validate baseline exists before handoff
   - Pass complete data structure
   - Clear localStorage on success

7. **Add Digital Signature**
   - Real signature mechanism (not just checkbox)
   - Sign actual data (not just confirm)
   - Store signature in DynamoDB
   - Validate on retrieval

### MEDIUM Priority:

8. **Create Resume Functionality**

   - Load draft if exists
   - Continue from last saved step
   - Show recovery prompt

9. **Add Data Validation**

   - Cost calculations validation
   - Date range validation
   - Contract value vs estimate variance

10. **Create Test Suite**
    - Unit tests for each step
    - Integration tests for full flow
    - E2E tests with real API

---

## AFFECTED CODE LOCATIONS

### Frontend (UI/UX):

| File                     | Issue                                                          | Priority |
| ------------------------ | -------------------------------------------------------------- | -------- |
| `PMOEstimatorWizard.tsx` | No validation on step progression, no logging                  | P0       |
| `DealInputsStep.tsx`     | No API call, no logging, no error handling                     | P0       |
| `LaborStep.tsx`          | No API call, allows empty labor list                           | P0       |
| `NonLaborStep.tsx`       | No API call, no validation                                     | P0       |
| `FXIndexationStep.tsx`   | No API call                                                    | P1       |
| `ReviewSignStep.tsx`     | No document upload UI, no real signature, missing handoff call | P0       |

### Backend (Lambda/API):

| Handler       | Issue                                                               | Priority |
| ------------- | ------------------------------------------------------------------- | -------- |
| `baseline.ts` | Works but only called once at end, should be called multiple times  | P1       |
| `projects.ts` | Should be called in Deal Inputs step, not just at end               | P1       |
| `rubros.ts`   | Should be called in Labor/Non-Labor steps for real-time persistence | P1       |
| MISSING       | `draft-estimates` handlers                                          | P0       |
| MISSING       | `uploads` handlers                                                  | P0       |
| `handoff.ts`  | Exists but frontend never calls it                                  | P0       |

---

## Next Steps

This audit identifies the "missing links" you mentioned. The system is **architecturally incomplete**:

1. **UI exists but doesn't wire to backend properly**
2. **Backend endpoints exist but frontend doesn't call them**
3. **Data flow broken at multiple points**
4. **No visibility into what's happening (logging gap)**

Recommendation: Implement fixes in this order:

1. Add validation + console logging (debugging aid)
2. Add API calls for each step (data persistence)
3. Implement document upload
4. Implement proper handoff
5. Add digital signature
6. Create end-to-end tests

---

## Appendix: Console Output Roadmap

### What Console SHOULD Show:

```
🎯 PMO Estimator Session Started: 2025-11-15T10:30:00Z
Auth Token: ✅ Present (cv.jwt: eyJ...)

📊 Step 1 - Deal Inputs
  Input Validation: ✅ project_name="Test Project"
  Input Validation: ✅ start_date="2025-11-20"
  Input Validation: ✅ duration_months=12
  → Submitting to API: POST /projects
  ← Response: ✅ 200 OK, project_id="P-abc123"
  💾 Saved to localStorage: estimator-deal-inputs
  🔄 Advancing to Step 2

💼 Step 2 - Labor
  → Added: Frontend Developer, 2 FTE, $6000/hr
  → Added: Backend Developer, 1 FTE, $6000/hr
  → Submitting labor: POST /projects/P-abc123/rubros
  ← Response: ✅ 200 OK, 2 items saved
  🔄 Advancing to Step 3

📦 Step 3 - Non-Labor
  → Added: AWS Infrastructure, $10000/month
  → Submitting: POST /projects/P-abc123/rubros
  ← Response: ✅ 200 OK, 1 item saved
  🔄 Advancing to Step 4

💱 Step 4 - FX & Indexation
  → Submitted FX rates
  → Submitting: PATCH /projects/P-abc123/fx-indexation
  ← Response: ✅ 200 OK
  🔄 Advancing to Step 5

✍️ Step 5 - Review & Sign
  📄 Baseline Summary:
    - Total Cost: $1,234,567
    - Labor: 70%
    - Non-Labor: 30%
  🔑 Digital Signature: [Sign with crypto]
  → Submitting baseline: POST /baseline
  ← Response: ✅ 200 OK, baseline_id="BL-xyz789"
  ✅ Documents uploaded: 2 files
  ← Response: ✅ 200 OK, docs stored in S3
  → Triggering handoff: POST /projects/P-abc123/handoff
  ← Response: ✅ 200 OK
  🎉 Handoff Complete! Navigating to SDMT...
```

This is what SHOULD appear in the console but currently shows nothing.

---
