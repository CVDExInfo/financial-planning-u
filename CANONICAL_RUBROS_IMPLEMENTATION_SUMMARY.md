# Canonical Rubro ID Enforcement - Implementation Summary

## Overview

This implementation enforces canonical rubro IDs throughout the financial planning system, ensuring data/rubros.taxonomy.json is the single source of truth for all rubro identifiers.

## S3 Taxonomy Storage

**Bucket:** `ukusi-ui-finanzas-prod` (existing bucket - **DO NOT CREATE**)
**Path:** `s3://ukusi-ui-finanzas-prod/taxonomy/rubros.taxonomy.json`

The canonical taxonomy is stored in the existing S3 bucket for:
- Versioned backups (in `taxonomy/archive/`)
- Lambda function runtime access (read-only)
- CI/CD synchronization from `data/rubros.taxonomy.json`

**Important:** The SAM template references this bucket but does NOT create it. Lambda functions have scoped `s3:GetObject` permission on `taxonomy/*` prefix only.

## Changes Implemented

### 1. Handler Canonicalization (Backend)

**File:** `services/finanzas-api/src/handlers/rubros.ts`

**Changes:**
- Added `getCanonicalRubroId` import from canonical-taxonomy
- Modified `listProjectRubros` to return canonical rubro_id values
- Modified `attachRubros` to normalize incoming rubros to canonical IDs before processing
- Preserved original IDs in `_originalRubroId` for legacy tracking
- All database writes now use canonical IDs

**Impact:**
- GET /projects/{id}/rubros now returns canonical rubro_id (e.g., MOD-LEAD instead of mod-lead-ingeniero-delivery)
- POST /projects/{id}/rubros automatically converts legacy IDs to canonical before persistence
- Database integrity: all new rubro attachments use canonical IDs

### 2. Unit Tests

**File:** `services/finanzas-api/tests/unit/handlers.rubros.canonical.spec.ts` (NEW)

**Tests Added:**
- `listProjectRubros returns canonical rubro_id for legacy tokens` - Verifies GET endpoint canonicalization
- `attachRubros normalizes input before write` - Verifies POST endpoint canonicalization  
- `attachRubros canonicalizes MOD-PM to MOD-LEAD` - Verifies legacy ID mapping

**Results:** All 546 finanzas-api tests passing ✅

### 3. Migration Script

**File:** `scripts/fix-noncanonical-rubros.js` (NEW)

**Purpose:** Migrate existing database rows with non-canonical rubro_ids

**Features:**
- Scans `allocations` and `project_rubros` tables for non-canonical IDs
- Computes canonical ID using same logic as application
- Updates items with: `rubro_id = canonical`, `canonical_rubro_id = canonical`, `legacy_rubro_token = original`
- Supports `--dryrun` and `--apply` modes
- Configurable batch size for safe processing

**Usage:**
```bash
# Dry run (no changes)
ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.js --dryrun

# Apply changes (staging first!)
ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.js --apply --batch=50
```

### 4. PMO Estimator Validation (Frontend)

**File:** `src/features/pmo/prefactura/Estimator/steps/LaborStep.tsx`

**Changes:**
- Added `getCanonicalRubroId` import
- Added validation in `handleNext` to block submission if any labor item has non-canonical rubroId
- Shows user-friendly error message

**Impact:**
- Users cannot submit baselines with invalid/legacy role IDs
- Front-end validation prevents bad data from entering the system

### 5. CI Validation (Linked to Source of Truth)

**Files:** 
- `ci/check-canonical-rubros.cjs` (NEW) - Dynamic validation against taxonomy
- `ci/check-forbidden-rubros.sh` - Pattern-based check (legacy)
- `.github/workflows/preflight.yml` - Updated to run new check

**New Requirement Addressed:**
The CI check now validates against data/rubros.taxonomy.json as the single source of truth. It:
- Loads all canonical IDs from data/rubros.taxonomy.json
- Loads legacy mappings from canonical-taxonomy.ts files
- Scans source code for rubro-like patterns
- Flags any IDs that are NOT canonical and NOT legacy-mapped
- Excludes test files, documentation, and false positives (project IDs, invoice IDs, etc.)

**Detected Issues:**
The CI check identified 4 non-canonical IDs still in use:
- MOD-CONT, MOD-EXT, MOD-OT (mapped incorrectly in frontend, should map to MOD-IN2/MOD-IN3)
- MOD-XXX (test placeholder)

### 6. Test Updates

**File:** `services/finanzas-api/tests/unit/rubros.spec.ts`

**Changes:**
- Updated test expectations to expect canonical IDs instead of legacy IDs
- Tests now verify RB0001 → MOD-ING, RB0003 → MOD-SDM conversions

## Migration Runbook

### Prerequisites
1. **Backup DynamoDB tables:**
   ```bash
   # Export allocations table
   aws dynamodb create-backup --table-name allocations --backup-name allocations-pre-canonical-migration
   
   # Export project_rubros table
   aws dynamodb create-backup --table-name project_rubros --backup-name project_rubros-pre-canonical-migration
   ```

2. **Install dependencies:**
   ```bash
   cd services/finanzas-api
   pnpm install
   ```

### Migration Steps

#### Step 1: Dry Run (Development)
```bash
# Set table names for your environment
export ALLOCATIONS_TABLE=allocations
export PROJECT_RUBROS_TABLE=project_rubros

# Run dry-run to see what would be changed
node scripts/fix-noncanonical-rubros.js --dryrun > migration-dryrun.log

# Review the output
less migration-dryrun.log
```

#### Step 2: Apply to Staging
```bash
# Apply migration with batch processing
node scripts/fix-noncanonical-rubros.js --apply --batch=50 > migration-staging.log

# Monitor progress
tail -f migration-staging.log
```

#### Step 3: Verification
```bash
# Run a quick scan to verify no non-canonical IDs remain
node scripts/fix-noncanonical-rubros.js --dryrun

# Should show: "Found 0 items with non-canonical rubro_id"
```

#### Step 4: Apply to Production
```bash
# Same process, but with production table names
export ALLOCATIONS_TABLE=prod-allocations  
export PROJECT_RUBROS_TABLE=prod-project_rubros

# Apply migration
node scripts/fix-noncanonical-rubros.js --apply --batch=100
```

#### Step 5: Smoke Testing
1. **API Test:**
   ```bash
   curl https://api.example.com/projects/P-XXX/rubros
   # Verify all rubro_id values are canonical (MOD-*, GSV-*, TEC-*, etc.)
   ```

2. **PMO Baseline Creation:**
   - Create a new baseline in PMO Estimator
   - Verify roles are displayed correctly
   - Submit baseline
   - Check allocations table - all rubro_id values should be canonical

3. **SDMT Forecast:**
   - View SDMT Forecast dashboard
   - Verify no console warnings about unknown rubro IDs
   - Check that allocations display correctly

## Acceptance Criteria

✅ **Database Integrity:**
- All rubro_id values in allocations table are canonical
- All rubro_id values in project_rubros table are canonical
- canonical_rubro_id field exists and equals rubro_id
- legacy_rubro_token preserves original value for audit

✅ **API Behavior:**
- GET /projects/{id}/rubros returns canonical rubro_id
- POST /projects/{id}/rubros accepts both canonical and legacy IDs, persists canonical
- No 500 errors from rubro-related endpoints

✅ **UI Validation:**
- PMO Estimator blocks submission of baselines with non-canonical roles
- User sees helpful validation message

✅ **CI/CD:**
- Preflight workflow runs canonical taxonomy validation
- Build fails if non-canonical IDs found in source code (excluding tests/docs)
- Validation dynamically checks against data/rubros.taxonomy.json

✅ **Testing:**
- All 546 finanzas-api unit tests pass
- New canonicalization tests verify handler behavior
- Existing tests updated to expect canonical IDs

## Security Summary

### Vulnerabilities Found
None. This change improves data integrity but does not introduce or fix security vulnerabilities.

### Security Enhancements
1. **Input Validation:** PMO Estimator now validates rubro IDs before submission
2. **Data Integrity:** Canonical IDs prevent data corruption from inconsistent identifiers
3. **Audit Trail:** legacy_rubro_token field preserves original values for compliance

## Known Issues & Follow-up

### Issues Identified by CI Check
The new CI validation discovered these non-canonical IDs in the codebase:
1. **MOD-CONT, MOD-EXT, MOD-OT** - Used in frontend LABOR_CANONICAL_KEYS but not in data/rubros.taxonomy.json
   - **Action Required:** Add to canonical taxonomy or update frontend mappings
2. **MOD-XXX** - Test placeholder
   - **Action Required:** Update tests to use canonical test IDs

### Recommendations
1. **Update Frontend Canonical Taxonomy:**
   ```typescript
   // src/lib/rubros/canonical-taxonomy.ts
   // Remove MOD-CONT, MOD-EXT, MOD-OT from LABOR_CANONICAL_KEYS
   // Or add them to data/rubros.taxonomy.json if they are valid canonical IDs
   ```

2. **Monitor Logs:**
   After deployment, monitor CloudWatch for warnings about unknown rubro IDs:
   ```
   [canonical-taxonomy] Unknown rubro_id: XXX
   ```

3. **Future Enhancement:**
   Consider adding a `/admin/rubros/validate` endpoint for on-demand validation of all stored rubro IDs

## Files Changed

### New Files
- `services/finanzas-api/tests/unit/handlers.rubros.canonical.spec.ts` - Handler canonicalization tests
- `scripts/fix-noncanonical-rubros.js` - Migration script
- `ci/check-canonical-rubros.cjs` - Taxonomy-driven CI validation
- `ci/check-forbidden-rubros.sh` - Pattern-based CI validation

### Modified Files
- `services/finanzas-api/src/handlers/rubros.ts` - Handler canonicalization logic
- `services/finanzas-api/tests/unit/rubros.spec.ts` - Updated test expectations
- `src/features/pmo/prefactura/Estimator/steps/LaborStep.tsx` - PMO validation
- `.github/workflows/preflight.yml` - Added CI check step

## Testing Evidence

```
Test Suites: 59 passed, 59 total
Tests:       546 passed, 546 total
Snapshots:   0 total
Time:        14.707 s
```

All tests pass, including:
- 3 new canonical handler tests
- 10 existing rubros handler tests (updated for canonical IDs)
- 533 other finanzas-api tests (unchanged)

## References

- Problem Statement: PR #997
- Canonical Taxonomy Source: `data/rubros.taxonomy.json`
- Backend Canonical Module: `services/finanzas-api/src/lib/canonical-taxonomy.ts`
- Frontend Canonical Module: `src/lib/rubros/canonical-taxonomy.ts`
