# Handoff Baseline Migration Script

## Overview

This migration script fixes the baseline collision problem where multiple different baselines ended up under the same `PROJECT#` with only one `METADATA` row. This caused the SDMT Portfolio UI to show only the last accepted baseline instead of separate projects per baseline.

## Problem

In production, when multiple baselines were handed off to SDMT, new handoffs overwrote an existing project instead of creating/using a distinct project. This resulted in:

- Multiple handoffs with different `baseline_id` values under a single `PROJECT#` partition key
- Only one `METADATA` row, which gets overwritten each time
- Projects "disappearing" from the UI when a new baseline is handed off to the same project ID

### Example Before Migration

```
pk = PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11
  sk = METADATA
    baseline_id = base_db057dd7daaa
    client = Banco Santander
    code = BL-IKU-BASA-0034
    
  sk = HANDOFF#handoff_046e93a461
    baselineId = base_a424ba351ba4
    client = Bancolombia
    
  sk = HANDOFF#handoff_0580f7e92a
    baselineId = base_9043fea599fd
    client = Bancolombia
    
  sk = HANDOFF#handoff_0ed0356712
    baselineId = base_47dc963af811
    client = Banco de Bogota del Exterior
```

## Solution

The migration script:

1. **Scans** `finz_projects` for projects with baseline collisions
2. **Identifies** handoffs that have a different `baseline_id` than the project's `METADATA`
3. **Creates** a new `PROJECT#<uuid>` for each mismatched handoff
4. **Moves** the handoff record to the new project
5. **Creates** a new `METADATA` record for the new project with the correct baseline
6. **Updates** any `IDEMPOTENCY#HANDOFF` records to point to the new project

### Example After Migration

```
pk = PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11
  sk = METADATA
    baseline_id = base_db057dd7daaa
    client = Banco Santander
    code = BL-IKU-BASA-0034
    
  sk = HANDOFF#handoff_e3b43abf49
    baselineId = base_db057dd7daaa  # Matches METADATA
    
pk = PROJECT#P-<new-uuid-1>
  sk = METADATA
    baseline_id = base_a424ba351ba4
    client = Bancolombia
    
  sk = HANDOFF#handoff_046e93a461
    baselineId = base_a424ba351ba4  # Matches METADATA
    
pk = PROJECT#P-<new-uuid-2>
  sk = METADATA
    baseline_id = base_9043fea599fd
    client = Bancolombia
    
  sk = HANDOFF#handoff_0580f7e92a
    baselineId = base_9043fea599fd  # Matches METADATA
```

## Usage

### Run in Every Stage (dev/qa/prod)

Historical collisions have appeared in multiple environments. Run this migration anywhere legacy data may exist: `dev`, `qa`, **and** `prod`. The script is idempotent; re-running it after code changes will not move already-corrected handoffs.

### Dry Run (Recommended First)

Test the migration without making any changes:

```bash
cd services/finanzas-api
npm run migrate:handoff-baselines -- --dry-run
```

Or with ts-node directly:

```bash
cd services/finanzas-api
ts-node scripts/migrate-handoff-baseline-projects.ts --dry-run
```

### Actual Migration

Run the migration for real:

```bash
cd services/finanzas-api
npm run migrate:handoff-baselines
```

### Specific Stage

Migrate a specific environment:

```bash
# Development
npm run migrate:handoff-baselines -- --stage dev

# Production
npm run migrate:handoff-baselines -- --stage prod
```

### Quick Diagnostics

Before or after a migration, you can surface any remaining collisions without making writes:

```bash
npm run diagnose:handoff-baselines -- --stage <stage>
```

If no issues are found, the command prints `No baseline collisions detected.`. Otherwise, it emits a JSON list of offending project IDs and their baseline sets.

## Environment Variables

The script uses these environment variables:

- `STAGE`: Environment stage (`dev`, `qa`, `prod`). Default: `dev`
- `TABLE_PROJECTS`: DynamoDB projects table name. Default: `finz_projects_${STAGE}`
- `AWS_REGION`: AWS region. Default: `us-east-2`

## Output

The script provides detailed output:

```
================================================================================
Handoff Baseline Migration Script
================================================================================
Stage: dev
Table: finz_projects_dev
Dry Run: YES (no changes will be made)
================================================================================

Scanning projects table for baseline collisions...
Scan complete. Found 127 projects.

Found collision in PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11:
  METADATA baseline: base_db057dd7daaa
  Total handoffs: 8
  Mismatched handoffs: 7
    - HANDOFF#handoff_046e93a461: base_a424ba351ba4
    - HANDOFF#handoff_0580f7e92a: base_9043fea599fd
    - HANDOFF#handoff_0ed0356712: base_47dc963af811
    ...

Migrating project PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11:
  Migrating HANDOFF#handoff_046e93a461 (baseline: base_a424ba351ba4)
    Old project: PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11
    New project: PROJECT#P-<new-uuid>
    ✓ Created new project METADATA
    ✓ Moved handoff record
    ✓ Updated idempotency record: key-123

================================================================================
Migration Summary
================================================================================
Projects scanned: 127
Projects with collisions: 1
New projects created: 7
Handoffs migrated: 7
Idempotency records updated: 5
Errors: 0

✓ Migration complete!
```

## Verification Steps

After running the migration:

### 1. Check DynamoDB

Query for projects and verify each has its own METADATA with matching baseline:

```bash
aws dynamodb query \
  --table-name finz_projects_dev \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"PROJECT#P-<project-id>"}}'
```

Verify:
- ✓ Each project has one METADATA record
- ✓ All HANDOFF records under that project have the same baseline as METADATA
- ✓ No handoffs are "orphaned" (missing from query results)

### 2. Check SDMT Portfolio UI

Navigate to the SDMT Portfolio view and verify:
- ✓ All baselines appear as separate projects
- ✓ No projects are missing
- ✓ Each project shows the correct baseline, client, and code

### 3. Test Handoff API

Try creating a new handoff for an existing baseline:

```bash
curl -X POST "https://api.example.com/projects/P-test/handoff" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-key-$(date +%s)" \
  -d '{
    "baseline_id": "base_existing123",
    "client_name": "Test Client",
    "project_name": "Test Project"
  }'
```

Verify:
- ✓ Returns the existing projectId for that baseline
- ✓ Does not create a duplicate project
- ✓ METADATA is not overwritten

## Rollback

If something goes wrong:

1. **Stop immediately** if you notice errors during execution
2. **Review the errors** in the output
3. **Do NOT re-run** the script until the issue is understood

The script does not delete the original project's METADATA, only moves handoff records. This means:
- ✓ Original projects remain in place
- ✓ New projects are created alongside them
- ✗ No automatic rollback mechanism (would require manual cleanup)

### Manual Rollback Steps

If you need to rollback:

1. Identify the new project IDs created during migration (check the output log)
2. For each new project:
   - Move the handoff record back to the original project
   - Delete the new METADATA record
   - Revert idempotency records

## Safety Features

- ✓ **Dry run mode**: Test without making changes
- ✓ **No deletions of METADATA**: Original projects remain intact
- ✓ **Detailed logging**: Every action is logged
- ✓ **Error handling**: Catches and reports errors without stopping
- ✓ **Iteration limits**: Prevents infinite loops

## Production Checklist

Before running in production:

- [ ] Run with `--dry-run` first
- [ ] Review the output carefully
- [ ] Verify the number of collisions matches expectations
- [ ] Take a DynamoDB backup (if not using PITR)
- [ ] Run during a maintenance window
- [ ] Have a rollback plan ready
- [ ] Monitor CloudWatch logs during execution
- [ ] Verify in UI after completion

## Performance

- Scan speed: ~100-200 items/second
- Migration speed: ~10-20 handoffs/second
- For 1000 projects with 100 collisions: ~5-10 minutes

## Support

If you encounter issues:

1. Check the error messages in the output
2. Verify AWS credentials and permissions
3. Check that the DynamoDB table name is correct
4. Review CloudWatch logs for the DynamoDB table
5. Contact the platform team for assistance

## Related Documentation

- [HANDOFF_API_CONTRACT_FIX.md](../../HANDOFF_API_CONTRACT_FIX.md)
- [IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md](../../IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md)
- [METADATA_SK_MIGRATION.md](../METADATA_SK_MIGRATION.md)

## New in PR #640+: Defensive Baseline Collision Prevention

After this migration script repairs existing collisions, the handoff API now includes **defensive measures** to prevent future collisions:

### Automatic Prevention in Code

1. **Pre-write METADATA check** in `projects.ts`:
   - Before writing `PROJECT#…/METADATA`, the handler reads the current record
   - If an existing baseline differs from the incoming baseline: **refuse with 409 Conflict**
   - This is a safety net even if routing logic has edge cases

2. **Enhanced resolution logic** in `projects-handoff.ts`:
   - QA projects (no baseline) can be assigned the **first** baseline only
   - Subsequent different baselines get new project IDs automatically
   - Idempotency keys are baseline-scoped: reusing a key with a different baseline throws 409

3. **Idempotency conflict detection**:
   - If an idempotency key was previously used with a different baseline: **409 Conflict**
   - Prevents accidental reuse of idempotency keys across baselines

### When to Run This Migration

Run the migration script in these scenarios:

1. **After upgrading to PR #640+**: Repair any historical collisions that occurred before the defensive checks were added
2. **After detecting collisions**: Use `diagnose:handoff-baselines` to check for issues
3. **Before major baseline imports**: Ensure a clean slate before importing SDMT baselines

### Example: Detecting and Repairing Collisions

```bash
# 1. Diagnose existing collisions in dev
cd services/finanzas-api
npm run diagnose:handoff-baselines -- --stage dev

# Output:
# [
#   {
#     "projectId": "P-1b6309be-bf75-4994-a332-097bdfc63ae4",
#     "metadataBaseline": "base_eac8ddf69dbb",
#     "handoffBaselines": [
#       "base_eac8ddf69dbb",
#       "base_b8566fa19c08",
#       "base_85894e2d29dd"
#     ]
#   }
# ]

# 2. Test migration in dry-run mode
npm run migrate:handoff-baselines -- --stage dev --dry-run

# 3. Run the actual migration
npm run migrate:handoff-baselines -- --stage dev

# 4. Verify repair
npm run diagnose:handoff-baselines -- --stage dev
# Expected: "No baseline collisions detected."
```

### What Happens After Migration

Once the migration completes and the new code is deployed:

- ✅ Future handoffs will **automatically** create new projects when needed
- ✅ Attempts to overwrite METADATA with a different baseline will **fail with 409**
- ✅ The SDMT Portfolio UI will show all baselines as separate projects
- ✅ No more "disappearing projects" when new baselines are handed off

### Migration + Prevention = Complete Fix

```
Historical Data (Before PR #640)
  └─ Migration script repairs collisions
     └─ Creates separate projects for each baseline
     
Future Handoffs (After PR #640)
  └─ Defensive checks prevent new collisions
     └─ 409 Conflict if baseline mismatch detected
     └─ Automatic new project creation for different baselines
```

---

## Data Repair Script: Auto-Accepted Baselines

### Overview

The `repairAutoAcceptedBaselines.ts` script fixes a critical bug where baselines were incorrectly marked as "accepted" during handoff instead of "handed_off".

### Problem

**Root Cause:** 
- `handoff.ts` was setting `baseline_status = "accepted"` during handoff (via `force_accept` flag)
- `projects.ts` was setting `baseline_status = "accepted"` at handoff time (line 1062)

**Impact:**
- Baselines appear accepted immediately after handoff
- SDMT never gets a chance to review/accept/reject
- Violates the intended workflow: PMO handoff → SDMT review → SDMT accept/reject

### Detection Logic

A baseline is considered auto-accepted if:
1. `baseline_status == "accepted"` in project METADATA
2. NO audit log entry exists with `action == "BASELINE_ACCEPTED"`

This indicates the baseline was marked accepted during handoff (wrong) rather than via the explicit accept endpoint (correct).

### Repair Action

For each auto-accepted baseline:
1. Set `baseline_status = "handed_off"`
2. Remove `accepted_by` field
3. Remove `baseline_accepted_at` field
4. Preserve `handed_off_by` and `handed_off_at` (handoff signature)

### Usage

```bash
# Dry run (default - shows what would change, no modifications)
cd services/finanzas-api/scripts
npx tsx repairAutoAcceptedBaselines.ts

# Execute repairs (applies changes to DynamoDB)
npx tsx repairAutoAcceptedBaselines.ts --execute

# Repair specific project only
npx tsx repairAutoAcceptedBaselines.ts --projectId P-abc123 --execute

# Limit number of repairs (useful for testing)
npx tsx repairAutoAcceptedBaselines.ts --limit 10 --execute
```

### Environment Variables

The script uses these environment variables (or defaults):

- `AWS_REGION`: AWS region (default: us-east-1)
- `PROJECTS_TABLE_NAME`: Projects table (default: finanzas-projects-dev)
- `AUDIT_LOG_TABLE_NAME`: Audit log table (default: finanzas-audit-log-dev)

### Prerequisites

```bash
# Install dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Set AWS credentials
export AWS_PROFILE=your-profile
# OR
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
```

### Safety Features

1. **Dry run by default**: Must explicitly pass `--execute` to make changes
2. **Audit log validation**: Only repairs baselines without legitimate acceptance records
3. **Filter support**: Can test on single project before running on all
4. **Limit support**: Can repair in batches
5. **Detailed logging**: Shows what will/did change

### Example Output

```
================================================================================
Data Repair Script: Revert Auto-Accepted Baselines
================================================================================
Mode: DRY RUN (no changes will be made)
Projects Table: finanzas-projects-dev
Audit Log Table: finanzas-audit-log-dev
================================================================================

Scanning projects table for auto-accepted baselines...

Found auto-accepted baseline: P-abc123 (baseline: base_xyz789)
Found auto-accepted baseline: P-def456 (baseline: base_uvw456)

Scanned 15 accepted baselines, found 2 auto-accepted

Summary of auto-accepted baselines:
--------------------------------------------------------------------------------
Project ID: P-abc123
  Baseline ID: base_xyz789
  Accepted By: pmo-user@example.com
  Accepted At: 2024-12-20T10:30:00Z
  Handed Off By: pmo-user@example.com
  Handed Off At: 2024-12-20T10:30:00Z

Project ID: P-def456
  Baseline ID: base_uvw456
  Accepted By: pmo-user@example.com
  Accepted At: 2024-12-20T11:45:00Z
  Handed Off By: pmo-user@example.com
  Handed Off At: 2024-12-20T11:45:00Z

--------------------------------------------------------------------------------

⚠ DRY RUN MODE - No changes were made

To execute repairs, run with --execute flag:
  node repairAutoAcceptedBaselines.ts --execute

Total items that would be repaired: 2
```

### Post-Repair Verification

After running with `--execute`, verify:

1. **Check baseline status**: Projects should show `baseline_status = "handed_off"`
2. **SDMT can accept**: Navigate to SDMT Forecast/Changes and accept the baseline
3. **Audit log created**: New `BASELINE_ACCEPTED` entry should be created on accept

### Integration with Code Fixes

This script works in conjunction with code fixes to:

1. **handlers/handoff.ts**: Removed `force_accept` logic, always sets "handed_off"
2. **handlers/projects.ts**: Changed line 1062 to set "handed_off" not "accepted"
3. **handlers/acceptBaseline.ts**: Added defensive check against re-acceptance
4. **handlers/rejectBaseline.ts**: Added defensive check against re-rejection

Together, these ensure:
- Handoff sets `baseline_status = "handed_off"`
- Only SDMT can accept via `PATCH /projects/{projectId}/accept-baseline`
- Audit trail is complete for all baseline state transitions
