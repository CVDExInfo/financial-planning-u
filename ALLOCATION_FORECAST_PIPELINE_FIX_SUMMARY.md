# Allocations / Forecast / Portfolio Pipeline Fix - Summary

**Date**: December 11, 2025  
**Branch**: `copilot/update-allocations-forecast-pipeline`  
**Status**: ✅ Code Complete - Ready for Testing

---

## Problem Statement

The forecast, portfolio, and cost catalog screens were showing "all zeros" despite having seeded data in DynamoDB. Users reported:
- Gestión de Pronóstico: 0 for Total Plan, 0 for Forecast, 0 for Actual
- Estructura de Costos: "No hay datos de catálogo disponibles"
- Portafolio Financiero: Donut chart showing "No data available"

## Root Cause Analysis

**The Issue**: Partition key mismatch between seed scripts and API handlers

**Seed Scripts Created**:
```
pk: PROJECT#P-CLOUD-ECOPETROL#MONTH#2025-01
sk: ALLOC#alloc_xxx
```

**API Handlers Queried**:
```typescript
KeyConditionExpression: "pk = :pk"
ExpressionAttributeValues: { ":pk": "PROJECT#P-CLOUD-ECOPETROL" }
```

**Result**: DynamoDB query returned 0 items because the pk didn't match exactly.

## Solution Implemented

### 1. Fixed Seed Scripts

Updated both canonical and golden project seed scripts to use:
```
pk: PROJECT#P-CLOUD-ECOPETROL          (removed #MONTH# suffix)
sk: ALLOC#2025-01#alloc_xxx            (moved month to sk)
```

**Files Modified**:
- `services/finanzas-api/src/seed/seed_canonical_projects.ts`
- `services/finanzas-api/src/seed/seed_finanzas_golden_project.ts`

**Additional Enhancements**:
- Added `planned`, `forecast`, `actual` fields to allocations
- Added `kind` ("plan"/"forecast"/"actual") and `period` fields to payroll
- Added `baselineId` for proper baseline filtering

### 2. Created Validation Tools

**Three new validation scripts**:

1. **verify-allocations-vs-projects.ts**
   - Scans all allocations
   - Verifies projectId exists in projects table
   - Checks pk format is correct
   - Ensures month attributes are present

2. **verify-payroll-vs-projects.ts**
   - Scans all payroll records
   - Verifies projectId exists
   - Checks pk format
   - Validates month/period attributes

3. **verify-forecast-pipeline.ts**
   - End-to-end pipeline test
   - Verifies project exists
   - Queries allocations and payroll
   - Simulates forecast aggregation
   - Validates non-zero totals

**NPM Scripts Added**:
```bash
npm run verify:allocations
npm run verify:payroll
npm run verify:forecast-pipeline [PROJECT_ID]
```

### 3. Comprehensive Documentation

Created `docs/finanzas/testing/forecast-pipeline.md` with:
- Root cause explanation
- Step-by-step testing instructions
- Troubleshooting guide
- Expected outcomes for all 5 screens
- Test project specifications

Updated `UI_COMPONENT_VALIDATION_MATRIX.md` to reflect:
- Fixed status for forecast and portfolio endpoints
- Note about required reseeding

## Changes Summary

**Total Files Changed**: 8
- 2 seed scripts (fixed)
- 3 validation scripts (new)
- 1 package.json (updated)
- 2 documentation files (new/updated)

**Lines Changed**: +577, -10

**Commits**: 3
1. Initial plan
2. Fix: Update allocation/payroll seed scripts
3. Final: Add testing docs and update UI validation matrix

## Testing Instructions

### Step 1: Reset and Reseed

```bash
cd services/finanzas-api

# Remove old data with wrong pk format
npm run reset:dev-projects -- --force

# Seed with corrected data structure
npm run seed:canonical-projects
```

Expected output:
```
✓ Allocations (63 records)
✓ Payroll actuals (63 records)
✅ Canonical projects seed completed successfully!
```

### Step 2: Validate Data Structure

```bash
# All should pass with ✅
npm run verify:allocations
npm run verify:payroll
npm run verify:forecast-pipeline P-CLOUD-ECOPETROL
```

### Step 3: Test API Endpoints

```bash
export TOKEN="<your-jwt-token>"
export API_BASE="<your-api-base-url>"

# Should return non-zero amounts
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/plan/forecast?projectId=P-CLOUD-ECOPETROL&months=12"

# Should return MOD projections
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/payroll/dashboard"
```

### Step 4: Test UI Screens

Navigate to each screen and verify non-zero data:

1. **Gestión de Pronóstico** (`/sdmt/cost/forecast`)
   - Should show 12-month grid with data
   - Total Plan, Forecast, Actual all > 0

2. **Estructura de Costos** (`/sdmt/cost/catalog`)
   - Should show 3-6 rubros
   - Total Estimated Cost > 0

3. **Portafolio Financiero** (`/finanzas/projects`)
   - Donut chart shows distribution
   - Bar chart shows MOD comparison

4. **Conciliación de Facturas** (`/sdmt/cost/reconciliation`)
   - Line items dropdown populated

5. **Cambios y Ajustes** (`/sdmt/cost/changes`)
   - Multi-select line items works

## Test Projects

Use these canonical projects for testing:

| Project ID | Budget | Duration | Margin | Use For |
|------------|--------|----------|--------|---------|
| P-CLOUD-ECOPETROL | $22.5M | 48 months | Challenged | Over-budget scenarios |
| P-DATACENTER-ETB | $25.0M | 60 months | Favorable | Under-budget scenarios |
| P-NOC-CLARO-BOG | $18.5M | 60 months | Favorable | Long-term projects |
| P-WIFI-ELDORADO | $4.2M | 24 months | On-target | Short-term projects |

Each project has:
- 3 months of allocations (planned amounts)
- 3 months of payroll (actual with variance)
- 3-6 rubros from catalog
- Baseline and handoff records

## Validation Criteria

**Green Criteria** (Must all pass):
- ✅ All 3 validation scripts pass
- ✅ Forecast API returns non-zero data
- ✅ Forecast UI shows 12-month grid
- ✅ Cost Catalog displays rubros with costs
- ✅ Portfolio charts render (no "No data")
- ✅ No console errors in UI

## Impact Analysis

**No Handler Changes Required**: The API handlers already had the correct query logic. This was purely a seed data issue.

**No Frontend Changes Required**: The UI components are correctly wired. They were just receiving empty arrays from the API.

**No Schema Changes Required**: DynamoDB table structures are correct. Only the data format in seed scripts was wrong.

**Migration Not Required**: Old data will be replaced by reseeding. No production data exists yet.

## Regression Prevention

To prevent this issue in the future:

1. **Always run validation scripts** after seeding:
   ```bash
   npm run seed:canonical-projects
   npm run verify:allocations
   npm run verify:payroll
   npm run verify:forecast-pipeline P-CLOUD-ECOPETROL
   ```

2. **Document pk/sk patterns** in data-models.md:
   - Standard: `pk = PROJECT#{projectId}`, `sk = TYPE#{month}#{id}`
   - Never: `pk = PROJECT#{id}#MONTH#{month}`

3. **Add integration tests** that validate end-to-end:
   - Seed → Query → Assert non-zero

## Next Steps

1. ✅ Code changes complete
2. ⏳ Review PR
3. ⏳ Merge to feature branch
4. ⏳ Deploy to dev
5. ⏳ Run seed scripts in dev
6. ⏳ Test all 5 UI screens
7. ⏳ Capture screenshots
8. ⏳ Update validation matrix with results
9. ⏳ Document any additional issues
10. ⏳ Deploy to staging/production

## References

- **Testing Guide**: `docs/finanzas/testing/forecast-pipeline.md`
- **Data Models**: `docs/finanzas/data-models.md`
- **Seed Scripts**: `services/finanzas-api/src/seed/README.md`
- **UI Matrix**: `UI_COMPONENT_VALIDATION_MATRIX.md`
- **Original Issue**: Problem statement in PR description

---

**Status**: ✅ Code Complete - Ready for Testing & Validation  
**Contact**: Engineering Team  
**Last Updated**: December 11, 2025
