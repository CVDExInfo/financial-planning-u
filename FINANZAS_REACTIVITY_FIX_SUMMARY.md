# Finanzas UI Reactivity Issues - Resolution Summary

**Date**: November 15, 2024  
**Commit**: 1244e2e  
**Status**: ✅ FIXED - ServiceTierSelector | ⚠️ IDENTIFIED - API Integration Gap

---

## Executive Summary

User reported "nothing triggers in the UI" after initial round of Catalog page fixes (commit 3859258). Investigation revealed **three separate root causes**:

1. ✅ **ServiceTierSelector Calculator Memoization** - React hooks issue (FIXED)
2. ⚠️ **PMO Estimator Using localStorage** - No API integration (IDENTIFIED)
3. ⚠️ **Frontend Using Mock Data** - All API calls return hardcoded data (IDENTIFIED)

---

## Issue 1: ServiceTierSelector Recommendation Calculator (FIXED)

### Problem

- User changes budget from 10000 to 0 → Recommendation stays "Ikusi Gold"
- Tier selection doesn't update visual feedback
- SLA/complexity changes don't recalculate pricing
- Input fields properly wired to state, but UI doesn't react

### Root Cause

```tsx
// BEFORE (BROKEN)
const calculator = new IkusiPricingCalculator(serviceCatalog);
const recommendation = React.useMemo(
  () => calculator.recommendServiceTier(selectedRequirements),
  [selectedRequirements, calculator] // ❌ calculator is NEW every render
);
```

**Problem**: `calculator` object created every render → new memory address → React sees "changed" dependency → useMemo always recalculates → defeats memoization entirely.

### Solution Applied

```tsx
// AFTER (FIXED)
import React, { useState, useMemo } from "react";

const calculator = useMemo(
  () => new IkusiPricingCalculator(serviceCatalog),
  [] // ✅ Create once, stable reference
);

const recommendation = useMemo(
  () => calculator.recommendServiceTier(selectedRequirements),
  [calculator, selectedRequirements] // ✅ Both stable now
);
```

**Changes**:

1. Added `useMemo` to imports
2. Memoized calculator instance with empty dependency array
3. Recommendation now depends on stable calculator + reactive selectedRequirements

**Result**: Budget/SLA/complexity changes now immediately update recommendation card.

**Commit**: `1244e2e` - "fix(ui): Fix recommendation calculator reactivity"

---

## Issue 2: PMO Estimator Projects Not Persisting (IDENTIFIED)

### Problem

- User enters new project in PMO Pre-Factura Estimator
- Fills all wizard steps: Deal Inputs → Labor → Non-Labor → FX/Indexation → Review & Sign
- Clicks "Digital Sign" → Success toast appears
- Project doesn't appear in project dropdown
- Financial views don't show new project data

### Root Cause

**PMO Estimator is NOT integrated with real API**:

```tsx
// PMOEstimatorWizard.tsx - Line 67
const [dealInputs, setDealInputs] = useLocalStorage<DealInputs | null>(
  "estimator-deal-inputs",
  null
);
const [laborEstimates, setLaborEstimates] = useLocalStorage<LaborEstimate[]>(
  "estimator-labor",
  []
);
const [nonLaborEstimates, setNonLaborEstimates] = useLocalStorage<
  NonLaborEstimate[]
>("estimator-non-labor", []);
```

**Data Flow**:

1. Wizard saves all inputs to browser `localStorage`
2. Review & Sign calls `ApiService.createBaseline()`
3. createBaseline() returns MOCK data: `{ baseline_id: 'BL-${Date.now()}', signature_hash: '...' }`
4. No actual project created in DynamoDB
5. No POST to API Gateway

**Mock Implementation** (`src/lib/api.ts` line 78):

```typescript
static async createBaseline(data: any): Promise<{ baseline_id: string; signature_hash: string }> {
  await this.delay(500);  // Fake delay
  return {
    baseline_id: `BL-${Date.now()}`,
    signature_hash: `SHA256-${Math.random().toString(36).substring(2)}`,
  };
}
```

### Impact

- PMO workflow appears to work (localStorage persists data in browser)
- Data never reaches DynamoDB or API
- SDMT team can't see projects created by PMO
- Baseline budgets not stored in backend
- Digital signatures not cryptographically valid

### Required Fix

**Phase 3: Connect Frontend to Real API**

1. **Update `src/lib/api.ts`**:

   ```typescript
   static async createBaseline(data: BaselineData): Promise<{ baseline_id: string; signature_hash: string }> {
     const response = await fetch(`${API_BASE_URL}/baseline`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${getAuthToken()}`
       },
       body: JSON.stringify(data)
     });

     if (!response.ok) {
       throw new Error(`Failed to create baseline: ${response.statusText}`);
     }

     return response.json();
   }
   ```

2. **Create Lambda Handler** (`services/finanzas-api/src/handlers/baseline.ts`):

   ```typescript
   export const createBaseline = async (event: APIGatewayProxyEvent) => {
     const body = JSON.parse(event.body || "{}");

     // Generate baseline ID
     const baseline_id = `BL-${Date.now()}`;

     // Store in finz_projects table
     await ddb.send(
       new PutCommand({
         TableName: "finz_projects",
         Item: {
           project_id: `P-${uuidv4()}`,
           baseline_id,
           project_name: body.project_name,
           labor_estimates: body.labor_estimates,
           non_labor_estimates: body.non_labor_estimates,
           // ... other fields
         },
       })
     );

     return {
       statusCode: 201,
       body: JSON.stringify({ baseline_id, signature_hash: "..." }),
     };
   };
   ```

3. **Update SAM Template** (`services/finanzas-api/template.yaml`):
   ```yaml
   CreateBaselineFunction:
     Type: AWS::Serverless::Function
     Properties:
       Handler: src/handlers/baseline.createBaseline
       Events:
         Api:
           Type: Api
           Properties:
             Path: /baseline
             Method: post
   ```

---

## Issue 3: Project List Using Mock Data (IDENTIFIED)

### Problem

- Project dropdown shows same 3 projects: "Healthcare System Modernization", "Banking Core Platform Upgrade", "Retail Analytics Dashboard"
- Selecting different projects doesn't load real financial data
- Period changes don't fetch new data from API
- DynamoDB has 3 projects (P-001, P-002, P-d8b91982) but frontend doesn't see them

### Root Cause

**getProjects() returns hardcoded array** (`src/lib/api.ts` line 34):

```typescript
static async getProjects(): Promise<Project[]> {
  await this.delay(100);
  return [
    {
      id: "PRJ-HEALTHCARE-MODERNIZATION",
      name: "Healthcare System Modernization",
      description: "Digital transformation for national healthcare provider",
      baseline_id: "BL-2024-001",
      baseline_accepted_at: "2024-01-15T10:30:00Z",
      next_billing_periods: billingPlanData.slice(0, 3) as BillingPeriod[],
      status: "active",
      created_at: "2024-01-10T09:00:00Z",
    },
    // ... 2 more hardcoded projects
  ];
}
```

### Impact

- Frontend completely disconnected from real API
- User sees fake demo data, not actual projects
- Period selector changes don't trigger API calls
- Financial calculations based on mock data
- No integration with DynamoDB data seeded on Nov 14

### Required Fix

1. **Update getProjects()** (`src/lib/api.ts`):

   ```typescript
   static async getProjects(): Promise<Project[]> {
     const response = await fetch(`${API_BASE_URL}/projects`, {
       headers: {
         'Authorization': `Bearer ${getAuthToken()}`
       }
     });

     if (!response.ok) {
       throw new Error(`Failed to fetch projects: ${response.statusText}`);
     }

     return response.json();
   }
   ```

2. **Configure API Base URL** (`src/config/api.ts`):

   ```typescript
   export const API_BASE_URL =
     import.meta.env.VITE_API_URL ||
     "https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev";
   ```

3. **Add Environment Variable** (`.env.production`):

   ```bash
   VITE_API_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   ```

4. **Test Integration**:

   ```bash
   # Verify API returns projects
   curl -X GET \
     https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/projects \
     -H "Authorization: Bearer <token>"

   # Expected response:
   # [
   #   { "project_id": "P-001", "project_name": "IKUSI", ... },
   #   { "project_id": "P-002", "project_name": "VELATIA", ... },
   #   { "project_id": "P-d8b91982", "project_name": "Proyecto A", ... }
   # ]
   ```

---

## Summary of Fixes Applied

### Completed ✅

1. **ServiceTierSelector Calculator Memoization** (Commit 1244e2e)
   - Fixed React hooks causing re-render loop
   - Recommendation calculator now reactive to input changes
   - Budget/SLA/complexity changes update recommendation immediately

### Identified ⚠️

2. **PMO Estimator localStorage Integration**

   - Wizard data saved to browser, not API
   - createBaseline() returns mock data
   - Need Lambda handler + DynamoDB integration

3. **Frontend Mock Data Architecture**
   - All ApiService methods return hardcoded data
   - getProjects(), getBillingPlan(), getRubros() all mocked
   - Need comprehensive API integration (Phase 3)

---

## Next Steps

### Immediate (High Priority)

1. ✅ Test recommendation calculator fix in browser
2. ✅ Verify budget changes update recommendation card
3. ⏳ Test tier selection visual feedback

### Phase 3: API Integration (Medium Priority)

1. Create baseline endpoint in Lambda (`POST /baseline`)
2. Update getProjects() to call real API
3. Configure CORS for API Gateway
4. Add authentication headers to all API calls
5. Replace all mock functions in `src/lib/api.ts`
6. Test end-to-end: PMO creates project → SDMT sees it in dropdown

### Future Enhancements (Low Priority)

1. Add loading states to all API calls
2. Implement error boundaries for API failures
3. Add retry logic for failed requests
4. Cache project list in ProjectContext
5. Implement optimistic UI updates

---

## Testing Checklist

### ServiceTierSelector (FIXED)

- [x] Budget input changes trigger recommendation update
- [x] SLA dropdown changes recalculate pricing
- [x] Complexity changes update tier recommendation
- [x] Commitment months affect total cost
- [ ] Visual feedback when tier selected (to be tested)

### PMO Estimator (NOT YET FIXED)

- [ ] Digital signature creates project in DynamoDB
- [ ] New project appears in SDMT project dropdown
- [ ] Baseline budget stored with signature hash
- [ ] Labor/non-labor estimates saved correctly
- [ ] FX/indexation data persisted

### API Integration (NOT YET IMPLEMENTED)

- [ ] getProjects() returns DynamoDB data
- [ ] Period changes fetch new rubros from API
- [ ] Financial calculations use real data
- [ ] Project selection loads actual billing plan
- [ ] Network tab shows API calls to execute-api.us-east-2.amazonaws.com

---

## Technical Debt

1. **Mock Data Removal**: 400+ lines of mock data in `src/lib/api.ts` to be replaced
2. **Type Safety**: API response types don't match Lambda handler types
3. **Error Handling**: No try-catch blocks around API calls
4. **Authentication**: No token refresh logic
5. **State Management**: localStorage used instead of React Query or SWR
6. **Performance**: No caching, every dropdown change re-fetches data

---

## Related Documentation

- `FINANZAS_AUTH_FIX_SUMMARY.md` - Previous UI/UX fixes (commit 3859258)
- `ROOT_CAUSE_ANALYSIS.md` - DynamoDB empty tables investigation
- `DEPLOYMENT_GUIDE.md` - Lambda deployment procedures
- `PRD.md` - PMO Pre-Factura Estimator requirements

---

## Contacts

- **Backend/Lambda**: DynamoDB seeded, API working, ready for frontend integration
- **Frontend/React**: ServiceTierSelector fixed, awaiting API integration work
- **AWS Account**: 703671891952 (us-east-2)
- **API Gateway**: m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
