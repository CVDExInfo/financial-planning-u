# SDMT Forecast "No Data" Fix - Technical Summary

## Problem Statement

The SDMT Forecast view in the Ikusi "Finanzas SD" app was showing 0 data points and 0 line items for all projects, even for projects with baselines, rubros, and payroll seeded. The API endpoint `/plan/forecast` was returning empty datasets.

**URL Pattern**: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/sdmt/cost/forecast`  
**Backend API**: `https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev`

## Root Cause Analysis

### Investigation Steps

1. **Examined Forecast Handler** (`services/finanzas-api/src/handlers/forecast.ts`)
   - Handler correctly calls `queryProjectRubros(projectId)` to get baseline-filtered rubros
   - Properly falls back to generating forecast from rubros when allocations are empty
   - All unit tests were passing (6/6 tests)

2. **Examined Baseline Filtering Logic** (`services/finanzas-api/src/lib/baseline-sdmt.ts`)
   - `queryProjectRubros()` queries all rubros for a project
   - `filterRubrosByBaseline()` filters by `rubro.metadata?.baseline_id`
   - Function expects rubros to have `metadata.baseline_id` set

3. **Examined Seed Data Structure** (`services/finanzas-api/src/seed/seed_canonical_projects.ts`)
   - Seed script creates rubro attachments with `baselineId` at the **top level**
   - Does NOT set `metadata.baseline_id`
   - Example structure:
     ```typescript
     {
       pk: `PROJECT#${projectId}`,
       sk: `RUBRO#${rubroId}`,
       projectId: projectId,
       rubroId: rubroId,
       baselineId: project.baselineId,  // ← Top level only!
       attachedAt: now,
       attachedBy: "pm.lead@ikusi.com",
     }
     ```

4. **Compared with Handler-Created Rubros** (`services/finanzas-api/src/handlers/projects.ts`)
   - `buildSeedLineItems()` correctly creates rubros with `metadata.baseline_id`
   - Example structure:
     ```typescript
     {
       rubroId,
       nombre: estimate.role || "Labor",
       // ... other fields
       metadata: {
         source: "baseline",
         baseline_id: baselineId,  // ← Correct location!
         project_id: projectId,
       },
     }
     ```

### The Mismatch

**Seed Script**: Creates rubros with `baselineId` at top level  
**Filter Function**: Looks for `metadata.baseline_id`  
**Result**: All seed data rubros were being filtered out → Empty datasets → 0 data points in UI

## Solution

### Minimal Changes Approach

Instead of breaking existing data or requiring a data migration, we implemented **backward compatibility** by updating the filter function to check both locations:

1. **Primary**: Check `rubro.metadata?.baseline_id` (new standard)
2. **Fallback**: Check `rubro.baselineId` (legacy seed data)

### Files Changed

#### 1. `services/finanzas-api/src/lib/baseline-sdmt.ts`

**Updated Interface:**
```typescript
export interface BaselineRubro {
  // ... existing fields
  baselineId?: string; // Legacy: top-level baseline_id (seed data)
  metadata?: {
    source?: string;
    baseline_id?: string; // Preferred: metadata baseline_id (handler-created)
    project_id?: string;
    [key: string]: unknown;
  };
}
```

**Updated Filter Function:**
```typescript
export function filterRubrosByBaseline<
  T extends { metadata?: { baseline_id?: string }; baselineId?: string }
>(rubros: T[], baselineId: string | null): T[] {
  if (!baselineId) {
    return rubros;
  }

  return rubros.filter((rubro) => {
    // Check both metadata.baseline_id (preferred) and top-level baselineId (legacy)
    const rubroBaselineId = rubro.metadata?.baseline_id || rubro.baselineId;

    if (rubroBaselineId === baselineId) {
      return true;
    }

    return false;
  });
}
```

**Key Feature**: Prefers `metadata.baseline_id` if present, falls back to `baselineId`

#### 2. `services/finanzas-api/src/seed/seed_canonical_projects.ts`

**Updated Seed Structure** (for new projects):
```typescript
for (const rubroId of project.rubros) {
  const attachmentItem = {
    pk: `PROJECT#${project.projectId}`,
    sk: `RUBRO#${rubroId}`,
    projectId: project.projectId,
    rubroId: rubroId,
    baselineId: project.baselineId,
    metadata: {
      source: "seed",
      baseline_id: project.baselineId,  // ← Now includes metadata!
      project_id: project.projectId,
    },
    attachedAt: now,
    attachedBy: "pm.lead@ikusi.com",
  };

  await putItem(TABLE_PROJECTS, attachmentItem);
}
```

### Test Coverage

Added comprehensive test cases to verify both structures work:

#### `tests/unit/baseline-sdmt.spec.ts`

1. **New Test**: "should support rubros with top-level baselineId (legacy seed data)"
   - Verifies filtering works with `baselineId` at top level
   - Ensures backward compatibility

2. **New Test**: "should prefer metadata.baseline_id over top-level baselineId"
   - Verifies the preference order when both are present
   - Ensures new structure takes precedence

#### `tests/unit/forecast.spec.ts`

3. **New Test**: "derives forecast from rubros with top-level baselineId (legacy seed data)"
   - End-to-end test from forecast handler perspective
   - Verifies forecast data generation works with legacy structure

**All Tests Passing**: 257/257 unit tests ✅

## Validation

### Unit Tests
```bash
cd services/finanzas-api
npm test
```
**Result**: All 257 tests passing

### Specific Test Files
```bash
npm test -- baseline-sdmt.spec.ts  # 13 tests passing
npm test -- forecast.spec.ts       # 7 tests passing
```

## Impact Analysis

### ✅ Benefits

1. **Backward Compatible**: Existing seed data continues to work
2. **Forward Compatible**: New handler-created rubros use correct structure
3. **Zero Downtime**: No data migration required
4. **Baseline Isolation Maintained**: No risk of mixing baselines
5. **Minimal Code Changes**: Only 4 files modified

### 🔒 Guarantees

- **Baseline Isolation**: Filter still enforces single-baseline view
- **No Mixing**: Rubros from different baselines never appear together
- **Data Integrity**: All existing tests continue to pass
- **API Contract**: No changes to API response structure

## Deployment Steps

1. **Deploy to Dev**:
   ```bash
   cd services/finanzas-api
   sam build
   sam deploy --stack-name finanzas-sd-api-dev
   ```

2. **Verify in Dev Environment**:
   - Test canonical projects: `P-NOC-CLARO-BOG`, `P-SOC-BANCOL-MED`, etc.
   - Hit API directly:
     ```bash
     curl "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/plan/forecast?projectId=P-NOC-CLARO-BOG&months=12"
     ```
   - Expected: Non-empty `data` array with forecast cells

3. **Verify in UI**:
   - Login as SDMT user
   - Navigate to: `.../finanzas/sdmt/cost/forecast`
   - Expected: Projects show non-zero "Data points" and "line items"

4. **Deploy to Production** (after dev validation):
   ```bash
   sam deploy --stack-name finanzas-sd-api-prod
   ```

## API Response Examples

### Before Fix
```json
{
  "data": [],
  "projectId": "P-NOC-CLARO-BOG",
  "months": 12,
  "generated_at": "2025-12-10T22:00:00Z"
}
```

### After Fix
```json
{
  "data": [
    {
      "line_item_id": "RB0001",
      "month": 1,
      "planned": 600000,
      "forecast": 600000,
      "actual": 0,
      "variance": 0,
      "last_updated": "2025-12-10T22:00:00Z",
      "updated_by": "pm.lead@ikusi.com"
    },
    // ... more months and rubros
  ],
  "projectId": "P-NOC-CLARO-BOG",
  "months": 12,
  "generated_at": "2025-12-10T22:00:00Z"
}
```

## Future Considerations

### Data Migration (Optional)

While not required due to backward compatibility, we could optionally migrate existing seed data to the new structure:

```typescript
// Migration script (optional)
for (const rubro of existingRubros) {
  if (rubro.baselineId && !rubro.metadata?.baseline_id) {
    await updateItem({
      ...rubro,
      metadata: {
        ...rubro.metadata,
        baseline_id: rubro.baselineId,
        source: "migration",
      }
    });
  }
}
```

### Monitoring

Add CloudWatch metrics to track:
- Forecast requests per project
- Average data points returned
- Empty vs. non-empty responses

### Documentation

Update the following docs:
- API contract tests (Postman collection)
- SDMT user guide
- Baseline creation flow documentation

## Related Files

- `services/finanzas-api/src/handlers/forecast.ts` - Forecast endpoint handler
- `services/finanzas-api/src/lib/baseline-sdmt.ts` - Baseline filtering utilities
- `services/finanzas-api/src/handlers/projects.ts` - Project creation with rubros
- `services/finanzas-api/src/seed/seed_canonical_projects.ts` - Seed data script
- `services/finanzas-api/tests/unit/forecast.spec.ts` - Forecast handler tests
- `services/finanzas-api/tests/unit/baseline-sdmt.spec.ts` - Baseline filtering tests

## Postman/Newman Contract Tests

The existing contract tests should continue to pass:
```bash
newman run postman/finanzas-api.postman_collection.json \
  --environment postman/dev.postman_environment.json
```

## Summary

This fix resolves the "no data" issue in SDMT Forecast by:
1. Supporting both `metadata.baseline_id` and top-level `baselineId` structures
2. Maintaining baseline isolation to prevent data mixing
3. Ensuring backward compatibility with existing seed data
4. Adding comprehensive test coverage for both structures

**All changes are minimal, targeted, and fully tested with 257 passing unit tests.**
