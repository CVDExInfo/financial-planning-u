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
