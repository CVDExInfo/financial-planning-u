# Project Metadata SK Migration: META → METADATA

## Overview

This document describes the migration from `sk = "META"` to `sk = "METADATA"` for project metadata records in the Finanzas SD system.

## Problem Statement

Projects were invisible in the SDMT UI because:

1. **Seed scripts** created project metadata records with `sk = "META"`
2. **API handler** (`GET /projects`) filtered for `sk = "METADATA"`
3. This mismatch caused seeded demo projects to be invisible to the UI

### Root Cause Analysis

From DynamoDB export analysis:
- Only 1 project with `sk = "METADATA"` was visible in SDMT
- All canonical demo projects used `sk = "META"` and were invisible
- The projects API handler at `src/handlers/projects.ts` line 1084 filters specifically for `"METADATA"`

## Solution

Standardized on `sk = "METADATA"` as the canonical sort key for project metadata records.

### Changes Made

#### 1. Seed Scripts Updated

> Legacy note: Canonical seeding has been removed from the platform. The details below are retained for historical context only.

**File (legacy reference):** `src/seed/seed_canonical_projects.ts`

Changed project metadata records from:
```typescript
sk: "META"
```

To:
```typescript
sk: "METADATA"
```

This affects:
- Project records (line 327)
- Baseline records (line 369)

#### 2. Reset Script Enhanced

**File:** `scripts/reset-dev-projects.ts`

Updated the scan filter to accept both during transition:
```typescript
FilterExpression: "begins_with(pk, :project) AND (sk = :metadata OR sk = :meta)"
```

This allows the reset script to clean up both old and new format records.

#### 3. Test Fixtures Updated

**File:** `tests/fixtures/canonical-projects.ts`

Updated mock functions to use `sk: "METADATA"`:
- `mockCanonicalProjectRecord()` (line 223)
- `mockCanonicalBaselineRecord()` (line 252)

#### 4. Backward Compatibility Shim

**File:** `src/handlers/projects.ts`

Added backward compatibility in the GET /projects handler:

```typescript
FilterExpression: "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta)"
```

With warning logs when serving from legacy META records:
```typescript
if (item.sk === "META") {
  console.warn("[projects] Serving project from legacy META key", {
    projectId: normalized.project_id,
    sk: "META",
  });
}
```

This provides:
- **Safety net** during transition period
- **Visibility** into remaining legacy data via logs
- **Zero downtime** migration path

## Migration Path

### For Development/Test Environments

1. **Clear existing projects:**
   ```bash
   npm run reset:dev-projects
   ```

2. **Re-seed with corrected data:**
   ```bash
   # TODO: seed:canonical-projects script has been removed.
   # Create test projects through the application UI.
   ```

3. **Verify:**
   ```bash
   npm run verify:canonical-projects
   ```

### For Production Environments

**Option A: In-place update (recommended)**
1. Run a migration script that:
   - Queries all projects with `sk = "META"`
   - Creates new records with `sk = "METADATA"` and same data
   - Deletes old `META` records
   - Validates counts before/after

**Option B: Gradual migration**
1. Leave backward compatibility shim in place
2. Update projects one-by-one as they're edited
3. Monitor logs for `[projects] Serving project from legacy META key` warnings
4. Once all projects migrated, remove the shim

## Testing

All existing tests pass with the changes:
```bash
npm test
```

Results: 252 tests passed, 28 test suites passed

Key test coverage:
- Project normalization handles both META and METADATA
- Seed scripts create METADATA records
- API handler accepts both during transition
- Test fixtures use METADATA consistently

## Data Contract

### Standard Project Metadata Record

```typescript
{
  pk: "PROJECT#${projectId}",
  sk: "METADATA",              // ← Must be "METADATA" (not "META")
  projectId: string,
  name: string,
  client: string,
  status: "active" | "archived",
  baseline_id?: string,
  baseline_status?: string,
  // ... other fields
}
```

### Standard Baseline Metadata Record

```typescript
{
  pk: "BASELINE#${baselineId}",
  sk: "METADATA",              // ← Must be "METADATA" (not "META")
  baselineId: string,
  projectId: string,
  status: "active" | "draft",
  // ... other fields
}
```

## Rollback Plan

If issues arise:

1. **Revert code changes** (git revert)
2. **Or:** Keep backward compat shim and reseed with old `META` format temporarily
3. **Investigate** root cause
4. **Plan** proper migration

The backward compatibility shim ensures zero downtime during investigation.

## Future Work

1. **Remove backward compatibility shim** once all environments are migrated
   - Target: After Q1 2026 or when logs show zero legacy META records for 30 days
   - Update filter to only accept `METADATA`

2. **Add data validation** to prevent creation of new META records
   - Schema validation in API
   - Database trigger/stream validation

3. **Document** in API specifications that METADATA is the only supported SK

## References

- Original issue: Project visibility in SDMT UI
- DynamoDB export analysis confirming mismatch
- Projects API handler: `src/handlers/projects.ts`
- Canonical seed script: `src/seed/seed_canonical_projects.ts`

## Questions?

Contact the Finanzas SD team or refer to:
- API documentation in `README.md`
- Architecture docs in `/docs`
- Test suite in `/tests`
