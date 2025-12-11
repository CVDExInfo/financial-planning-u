# Dev Environment Fix: Portfolio Graphs, Forecast Grid, and Baseline Reject

## Overview

This document describes the fixes implemented to resolve three issues in the financial-planning-u dev environment:

1. **PayRoll Dashboard / Portfolio Graphs** - 404 errors when loading portfolio visualizations
2. **Forecast Grid Returns Empty** - No data displayed for P-CLOUD-ECOPETROL project
3. **Baseline Reject Mismatch** - PATCH /projects/P-SOC-BANCOL-MED/reject-baseline fails

## Root Causes

### 1. PayRoll Dashboard
- **Cause**: API route `/payroll/dashboard` exists in template.yaml but may not be deployed or dev environment lacks seed data
- **Handler**: `services/finanzas-api/src/handlers/payroll.ts` - `handleGetDashboard()`
- **API Gateway**: Configured at line 1092 in template.yaml with proper CORS

### 2. Forecast Grid Empty
- **Cause**: Project P-CLOUD-ECOPETROL either doesn't exist in dev or lacks rubros with proper baseline_id metadata
- **Handler**: `services/finanzas-api/src/handlers/forecast.ts`
- **Requirements**:
  - Project must have METADATA record with baselineId
  - Rubros must have `metadata.baseline_id` matching the project's baseline
  - Allocations or payroll data (optional, uses fallback)

### 3. Baseline Reject Mismatch
- **Cause**: Project P-SOC-BANCOL-MED missing or has incorrect baseline_id field
- **Handler**: `services/finanzas-api/src/handlers/rejectBaseline.ts`
- **Expectation**: Project should have `baseline_id = "BL-SOC-BANCOL-001"`

## Fixes Implemented

### 1. CORS Headers Consistency
- **File**: `services/finanzas-api/src/handlers/payroll.ts`
- **Change**: Replaced manual CORS header construction with http helper functions from `lib/http.ts`
- **Impact**: Ensures consistent CORS headers across all responses (success and error)

```typescript
// Before:
return {
  statusCode: 500,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '...',
    'Access-Control-Allow-Credentials': 'true',
  },
  body: JSON.stringify({ error: '...' }),
};

// After:
return bad({ error: 'Internal server error', message: errorMessage }, 500);
```

### 2. Integration Test
- **File**: `services/finanzas-api/tests/integration/dev-environment-validation.spec.ts`
- **Purpose**: Validates that seed data is correctly structured for all three endpoints
- **Checks**:
  - P-CLOUD-ECOPETROL has project metadata with baselineId
  - P-CLOUD-ECOPETROL has rubros with metadata.baseline_id
  - P-CLOUD-ECOPETROL has allocations and payroll (optional)
  - P-SOC-BANCOL-MED has correct baseline_id = "BL-SOC-BANCOL-001"
  - Payroll dashboard has projects with start dates and payroll records

### 3. Verification Script
- **File**: `services/finanzas-api/scripts/verify-dev-environment.ts`
- **Purpose**: Command-line tool to verify dev environment is properly configured
- **Usage**:
  ```bash
  cd services/finanzas-api
  npm run verify:dev-environment
  ```
- **Output**: Detailed report showing which data is present/missing

## Seed Data Structure

The canonical projects seed script (`services/finanzas-api/src/seed/seed_canonical_projects.ts`) creates:

### Project Record
```typescript
{
  pk: "PROJECT#P-CLOUD-ECOPETROL",
  sk: "METADATA",
  projectId: "P-CLOUD-ECOPETROL",
  baselineId: "BL-CLOUD-ECOPETROL-001",
  name: "Cloud Ops Ecopetrol",
  // ... other fields
}
```

### Rubro Attachments
```typescript
{
  pk: "PROJECT#P-CLOUD-ECOPETROL",
  sk: "RUBRO#RB0001",
  projectId: "P-CLOUD-ECOPETROL",
  rubroId: "RB0001",
  baselineId: "BL-CLOUD-ECOPETROL-001",
  metadata: {
    source: "seed",
    baseline_id: "BL-CLOUD-ECOPETROL-001",  // Required!
    project_id: "P-CLOUD-ECOPETROL",
  },
  // ... other fields
}
```

### Allocations (optional)
```typescript
{
  pk: "PROJECT#P-CLOUD-ECOPETROL",
  sk: "ALLOC#2024-12#alloc_...",
  projectId: "P-CLOUD-ECOPETROL",
  rubroId: "RB0001",
  month: "2024-12",
  planned: 1000000,
  forecast: 1000000,
  actual: 0,
  // ... other fields
}
```

### Payroll Records (optional)
```typescript
{
  pk: "PROJECT#P-CLOUD-ECOPETROL",
  sk: "PAYROLL#2024-12#payroll_...",
  projectId: "P-CLOUD-ECOPETROL",
  rubroId: "RB0001",
  month: "2024-12",
  period: "2024-12",
  amount: 950000,
  kind: "actual",
  // ... other fields
}
```

## Deployment Steps

### Step 1: Verify Current State
```bash
cd services/finanzas-api
npm run verify:dev-environment
```

If verification fails, proceed to Step 2.

### Step 2: Seed Canonical Projects
```bash
cd services/finanzas-api
AWS_REGION=us-east-2 TABLE_PREFIX=finz_ npm run seed:canonical-projects
```

This creates 7 canonical projects including:
- P-CLOUD-ECOPETROL (challenged margin)
- P-SOC-BANCOL-MED (on-target margin)
- Plus 5 others for comprehensive testing

### Step 3: Re-verify Environment
```bash
npm run verify:dev-environment
```

All checks should now pass.

### Step 4: Deploy API Changes (if needed)
```bash
cd services/finanzas-api
sam build
sam deploy --config-env dev
```

### Step 5: Test Frontend
1. Open the Finanzas app in dev: https://d7t9x3j66yd8k.cloudfront.net
2. Navigate to Projects Dashboard (PayRoll Dashboard)
3. Verify portfolio donut chart and "MOD vs Meta Objetivo" chart display data
4. Navigate to P-CLOUD-ECOPETROL > Forecast
5. Verify forecast grid displays data for at least the first 3 months
6. Try rejecting the baseline for P-SOC-BANCOL-MED
7. Verify PATCH request succeeds

## API Endpoints

### 1. GET /payroll/dashboard
- **Purpose**: Aggregated MOD projections by project start month
- **Response**:
  ```json
  [
    {
      "month": "2024-12",
      "totalPlanMOD": 1200000,
      "totalForecastMOD": 1150000,
      "totalActualMOD": 1140000,
      "payrollTarget": 1320000,
      "projectCount": 2
    }
  ]
  ```

### 2. GET /plan/forecast?projectId=P-CLOUD-ECOPETROL&months=12
- **Purpose**: Forecast grid data for a project
- **Response**:
  ```json
  {
    "projectId": "P-CLOUD-ECOPETROL",
    "months": 12,
    "data": [
      {
        "line_item_id": "RB0001",
        "month": 1,
        "planned": 1000000,
        "forecast": 1000000,
        "actual": 950000,
        "variance": -50000,
        "last_updated": "2024-12-11T10:00:00Z",
        "updated_by": "finance@ikusi.com"
      }
    ],
    "generated_at": "2024-12-11T23:00:00Z"
  }
  ```

### 3. PATCH /projects/P-SOC-BANCOL-MED/reject-baseline
- **Body**:
  ```json
  {
    "baseline_id": "BL-SOC-BANCOL-001",
    "comment": "Budget too high"
  }
  ```
- **Response**:
  ```json
  {
    "projectId": "P-SOC-BANCOL-MED",
    "baselineId": "BL-SOC-BANCOL-001",
    "baseline_status": "rejected",
    "rejected_by": "sdmt@example.com",
    "baseline_rejected_at": "2024-12-11T23:00:00Z",
    "rejection_comment": "Budget too high"
  }
  ```

## Testing

### Unit Tests
```bash
cd services/finanzas-api
npm test -- payroll.handler.spec.ts
npm test -- forecast.spec.ts
npm test -- rejectBaseline.spec.ts
```

### Integration Tests
```bash
cd services/finanzas-api
npm test -- dev-environment-validation.spec.ts
```

## Troubleshooting

### Issue: Verification script fails with "Project not found"
**Solution**: Run the seed script:
```bash
npm run seed:canonical-projects
```

### Issue: Forecast returns empty data array
**Cause**: Rubros exist but don't have `metadata.baseline_id`
**Solution**: 
1. Re-run seed script to create rubros with correct structure
2. Or manually update rubros to include metadata field

### Issue: Payroll dashboard returns 404
**Cause**: API Gateway route not deployed
**Solution**: 
1. Verify route exists in template.yaml (line 1092)
2. Deploy API: `sam deploy --config-env dev`
3. Check AWS Console > API Gateway > Routes

### Issue: CORS errors in browser
**Cause**: CORS headers not properly configured
**Solution**: 
1. Verify ALLOWED_ORIGIN environment variable is set correctly
2. Check template.yaml CorsConfiguration (line 370)
3. Redeploy API

## References

- Seed Script: `services/finanzas-api/src/seed/seed_canonical_projects.ts`
- Payroll Handler: `services/finanzas-api/src/handlers/payroll.ts`
- Forecast Handler: `services/finanzas-api/src/handlers/forecast.ts`
- Reject Baseline Handler: `services/finanzas-api/src/handlers/rejectBaseline.ts`
- API Template: `services/finanzas-api/template.yaml`
- HTTP Helpers: `services/finanzas-api/src/lib/http.ts`

## Validation Checklist

- [ ] Verification script passes all checks
- [ ] Payroll dashboard displays portfolio graphs
- [ ] Forecast grid shows data for P-CLOUD-ECOPETROL
- [ ] Baseline reject succeeds for P-SOC-BANCOL-MED with matching baseline_id
- [ ] All CORS headers are present in responses
- [ ] Unit tests pass
- [ ] Integration tests pass
