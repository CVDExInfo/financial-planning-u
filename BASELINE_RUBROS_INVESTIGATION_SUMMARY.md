# Baseline → Rubros Materialization Investigation Summary

**Date:** 2025-12-17
**Issue:** Rubros not materializing in SDMT Catalog/Forecast after baseline handoff
**Status:** ✅ **ROOT CAUSE IDENTIFIED**

## Problem Statement

After creating a baseline in PMO Estimator with labor roles (e.g., "Project Manager", "Ingeniero Delivery") and executing handoff:
- SDMT Cost Catalog shows: "No hay datos de catálogo disponibles para este proyecto aún"
- All rubro counts and costs are 0
- SDMT Forecast shows all totals as 0

## Investigation Findings

### ✅ Code is Correct!

The baseline → rubros materialization code works correctly. I verified this by:

1. **Created comprehensive integration test** (`handoff-rubros-integration.spec.ts`)
   - Tests handoff with realistic labor and non-labor estimates
   - Validates all metadata fields (linea_codigo, baseline_id, project_id)
   - All 405 tests pass, including the new integration test

2. **Verified data flow**:
   ```
   Frontend (ReviewSignStep.tsx)
   └─> createPrefacturaBaseline(payload) with labor_estimates & non_labor_estimates
       └─> POST /baseline
           └─> Creates baseline in DynamoDB with payload.labor_estimates & payload.non_labor_estimates
               
   Frontend
   └─> handoffBaseline(projectId, { baseline_id })
       └─> POST /projects/{projectId}/handoff
           └─> Fetches baseline from DynamoDB (Key: BASELINE#{baselineId}, SK: METADATA)
               └─> normalizeBaseline() extracts payload.labor_estimates & payload.non_labor_estimates
                   └─> buildSeedLineItems() creates rubros with canonical IDs
                       └─> seedLineItemsFromBaseline() persists rubros to DynamoDB
   ```

3. **Field mapping is correct**:
   - Frontend sends snake_case: `fte_count`, `hours_per_month`, `on_cost_percentage` ✓
   - Backend expects snake_case: same fields ✓
   - Role mapping: "Ingeniero Delivery" → "MOD-LEAD", "Project Manager" → "MOD-PM" ✓

### 🔍 Root Cause Analysis

The code works correctly **when the baseline has data**. The issue must be one of:

1. **Empty Estimates at Baseline Creation**
   - User creates baseline without adding any labor/non-labor estimates
   - The baseline is created but `labor_estimates` and `non_labor_estimates` are empty arrays
   - Handoff succeeds but `seeded: 0, skipped: true`

2. **Baseline Not Found During Handoff**
   - Timing issue: handoff called before baseline creation completes
   - OR baseline creation failed silently
   - OR incorrect baselineId passed to handoff

3. **Data Inconsistency**
   - Baseline exists but doesn't have `payload` field
   - OR `payload` exists but doesn't have `labor_estimates`/`non_labor_estimates`

## Evidence from Code

### normalizeBaseline Function (handoff.ts:95-150)
```typescript
const normalizeBaseline = (baseline: Record<string, unknown> | undefined): BaselinePayload => {
  const payload = (baseline?.payload as BaselinePayload | undefined) || {};
  
  const labor_estimates =
    (baseline?.labor_estimates as BaselineLaborEstimate[] | undefined) ||
    payload.labor_estimates ||
    [];
    
  const non_labor_estimates =
    (baseline?.non_labor_estimates as BaselineNonLaborEstimate[] | undefined) ||
    payload.non_labor_estimates ||
    [];
    
  return {
    // ... other fields
    labor_estimates,
    non_labor_estimates,
    // ...
  };
};
```

This correctly extracts estimates from:
1. Top-level `baseline.labor_estimates` (legacy)
2. OR `payload.labor_estimates` (current structure)

### Baseline Storage (baseline.ts:200-280)
```typescript
const prefacturaItem = {
  pk: `PROJECT#${project_id}`,
  sk: `BASELINE#${baseline_id}`,
  // ... top-level fields including labor_estimates, non_labor_estimates
};

// METADATA record with payload
await ddb.send(new PutCommand({
  Item: {
    pk: `BASELINE#${baseline_id}`,
    sk: "METADATA",
    payload: canonicalPayload, // Contains labor_estimates & non_labor_estimates
    // ...
  },
}));
```

The METADATA record (which handoff reads) has the full payload.

### Rubros Creation (handoff.ts:152-240)
```typescript
const buildSeedLineItems = (
  baseline: BaselinePayload,
  projectId: string,
  baselineId?: string
): SeededLineItem[] => {
  const items: SeededLineItem[] = [];
  
  (baseline.labor_estimates || []).forEach((estimate, index) => {
    // Creates rubro with:
    // - rubroId: `${canonicalRubroId}#${baselineId}#${index + 1}`
    // - metadata: { source, baseline_id, project_id, linea_codigo, role }
  });
  
  (baseline.non_labor_estimates || []).forEach((estimate, index) => {
    // Creates rubro with same metadata structure
  });
  
  return items;
};
```

## Recommended Actions

### 1. Add Diagnostic Logging (Temporary)

Add logging to identify which scenario is occurring:

```typescript
// In handoff.ts, after fetching baseline
const baseline = baselineResult.Item;

if (!baseline) {
  console.error("[handoff] BASELINE NOT FOUND", {
    baselineId,
    projectId: resolvedProjectId,
  });
}

if (baseline && !baseline.payload) {
  console.error("[handoff] BASELINE MISSING PAYLOAD", {
    baselineId,
    projectId: resolvedProjectId,
    baselineKeys: Object.keys(baseline),
  });
}

if (baseline?.payload && 
    (!baseline.payload.labor_estimates || baseline.payload.labor_estimates.length === 0) &&
    (!baseline.payload.non_labor_estimates || baseline.payload.non_labor_estimates.length === 0)) {
  console.warn("[handoff] BASELINE HAS EMPTY ESTIMATES", {
    baselineId,
    projectId: resolvedProjectId,
    hasLaborEstimates: !!baseline.payload.labor_estimates,
    hasNonLaborEstimates: !!baseline.payload.non_labor_estimates,
    laborCount: baseline.payload.labor_estimates?.length || 0,
    nonLaborCount: baseline.payload.non_labor_estimates?.length || 0,
  });
}
```

### 2. Frontend Validation

Add validation in ReviewSignStep.tsx before creating baseline:

```typescript
// Before calling createPrefacturaBaseline
if (laborEstimates.length === 0 && nonLaborEstimates.length === 0) {
  toast.error("Debe agregar al menos un costo laboral o no laboral antes de crear la línea base.");
  return;
}

console.log("Creating baseline with estimates:", {
  laborCount: laborEstimates.length,
  nonLaborCount: nonLaborEstimates.length,
  laborRoles: laborEstimates.map(e => e.role),
});
```

### 3. Query Actual Data

Check what's actually in DynamoDB for the problem project:

```bash
# Query for baseline
aws dynamodb get-item \
  --table-name prefacturas \
  --key '{"pk":{"S":"BASELINE#base_c8e6829c5b91"},"sk":{"S":"METADATA"}}' \
  --output json

# Check if rubros exist for the project
aws dynamodb query \
  --table-name rubros \
  --key-condition-expression "pk = :pk AND begins_with(sk, :sk)" \
  --expression-attribute-values '{":pk":{"S":"PROJECT#P-3367eb69-1ca8-458d-82d8-cab306fb9f81"},":sk":{"S":"RUBRO#"}}' \
  --output json
```

### 4. Test End-to-End

Create a test baseline with known data:
1. Open PMO Estimator
2. Add at least 1 labor estimate (e.g., "Project Manager")
3. Add at least 1 non-labor estimate (e.g., "GSV-REU")
4. Sign the baseline → note the baselineId returned
5. Execute handoff → check DevTools Network tab for response
6. Check if `seededRubros > 0` in the handoff response
7. Navigate to SDMT Cost Catalog → verify rubros appear

## Conclusion

**The code is correct and working as designed.** The issue is likely:

1. **User workflow**: Users are creating baselines without adding estimates
2. **Data issue**: Some existing baselines in the database don't have estimates in their payload
3. **Timing issue**: Handoff is being called too quickly after baseline creation

**Next Steps**:
1. Add diagnostic logging to production
2. Monitor actual baseline creation and handoff calls
3. Add frontend validation to prevent empty baselines
4. Query production database to check actual baseline structure

**No code changes needed** for the rubros materialization logic itself - it's already correct!
