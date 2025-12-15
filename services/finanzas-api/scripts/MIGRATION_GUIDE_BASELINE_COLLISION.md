# Baseline Collision Migration Guide

## Overview

This document describes how to use the migration script to fix baseline collision issues in the projects table where multiple different baselines have been incorrectly assigned to the same `projectId`.

## Problem Statement

In production, when multiple baselines were handed off to SDMT, new handoffs would overwrite an existing project's METADATA instead of creating distinct projects. This caused:

- Multiple different baselines and clients ending up under the same `PROJECT#<projectId>`
- Only one METADATA row per project (the last one written)
- SDMT Portfolio UI showing only the last accepted baseline instead of separate projects per baseline

### Example of Polluted Data

```
pk = PROJECT#P-49100b26-9cc4-45d3-b680-1813e1af3a11
  sk = HANDOFF#handoff_046e93a461 (baseline base_a424ba351ba4, code BL-SOC-BANCOL-002)
  sk = HANDOFF#handoff_0580f7e92a (baseline base_9043fea599fd, code BL-SOC-BANCOL-001)
  sk = HANDOFF#handoff_0ed0356712 (baseline base_47dc963af811, code BL-SOC-BANGO-012)
  sk = HANDOFF#handoff_2980b248e8 (baseline base_e9dbab91251e, code BL-SOC-BANGO-002)
  sk = METADATA (baseline base_db057dd7daaa, code BL-IKU-BASA-0034) ← Only this one visible!
```

## Solution

The migration script will:

1. Scan all projects for METADATA records
2. For each project, query all HANDOFF records
3. Identify handoffs whose `baselineId` differs from the project's METADATA `baseline_id`
4. For each mismatched handoff:
   - Generate a new unique `projectId`
   - Create new METADATA for that baseline
   - Create a copy of the handoff record under the new project
   - Update idempotency records to point to the new project
5. Leave the original project and METADATA intact

## Migration Script

### Location

`services/finanzas-api/scripts/migrate-handoff-baseline-projects.ts`

### Environment Variables

- `AWS_REGION`: AWS region (default: `us-east-2`)
- `TABLE_PROJECTS`: DynamoDB projects table name (default: `finz_projects`)
- `DRY_RUN`: Set to `true` for dry-run mode, `false` for live execution

### Prerequisites

1. AWS credentials configured (via environment or ~/.aws/credentials)
2. DynamoDB access permissions:
   - `dynamodb:Scan` on projects table
   - `dynamodb:Query` on projects table
   - `dynamodb:PutItem` on projects table (for live execution)
   - `dynamodb:UpdateItem` on projects table (for live execution)
3. Node.js and TypeScript installed

## Running the Migration

### Step 1: Dry Run (RECOMMENDED)

Always start with a dry run to see what changes will be made:

```bash
cd services/finanzas-api

# Dry run - no changes made
DRY_RUN=true AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects \
  npx ts-node scripts/migrate-handoff-baseline-projects.ts
```

Output will show:
- Number of projects scanned
- Projects with baseline conflicts
- Which handoffs will be moved to new projects
- New project IDs that will be created

### Step 2: Review Output

Carefully review the migration plan:
- Verify the conflicting handoffs make sense
- Check that the baseline IDs are correct
- Ensure new project IDs don't conflict with existing ones (they won't - UUIDs are used)

### Step 3: Execute Migration

Once you're confident in the dry run output, execute the live migration:

```bash
# LIVE EXECUTION - makes real changes!
DRY_RUN=false AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects \
  npx ts-node scripts/migrate-handoff-baseline-projects.ts
```

### Step 4: Verify Results

After migration, verify the results:

1. **Check DynamoDB**:
   ```bash
   aws dynamodb scan \
     --table-name finz_projects \
     --filter-expression "begins_with(pk, :prefix) AND sk = :sk" \
     --expression-attribute-values '{":prefix":{"S":"PROJECT#"},":sk":{"S":"METADATA"}}' \
     --region us-east-2
   ```

2. **Count projects before and after**:
   - Before: Count of METADATA records
   - After: Should increase by number of migrated handoffs

3. **Check SDMT Portfolio UI**:
   - Verify all baselines now appear as separate projects
   - Confirm no projects were lost or corrupted

## Example Migration Output

### Dry Run

```
================================================================================
Baseline Collision Migration Script
================================================================================
Mode: DRY RUN
Region: us-east-2
Table: finz_projects

[scan] Scanning for project METADATA records...
[scan] Found 15 project METADATA records

[analyze] Analyzing projects for baseline conflicts...
[analyze] Found 3 projects with baseline conflicts

================================================================================
MIGRATION PLAN
================================================================================

Project: P-49100b26-9cc4-45d3-b680-1813e1af3a11
  METADATA Baseline: base_db057dd7daaa
  Conflicting Handoffs: 7
    - handoff_046e93a461
      Baseline: base_a424ba351ba4
      New Project: P-8a7f2e4d-1c3b-4a5e-9d8f-7e6c5b4a3d2e
    - handoff_0580f7e92a
      Baseline: base_9043fea599fd
      New Project: P-7b8c9d0e-2f3a-4b5c-8e9f-6d7c8b9a0e1f
    ...

================================================================================
DRY RUN MODE - No changes will be made
To execute migration, run with DRY_RUN=false
================================================================================
```

### Live Execution

```
================================================================================
EXECUTING MIGRATION
================================================================================

[migrate] Processing project P-49100b26-9cc4-45d3-b680-1813e1af3a11
  [migrate] Moving handoff handoff_046e93a461 to new project P-8a7f2e4d-...
    ✓ Created new project METADATA for P-8a7f2e4d-...
    ✓ Created handoff record for P-8a7f2e4d-...
    [migrate] Updating idempotency record idem-key-123
      ✓ Updated idempotency record idem-key-123
  ...

================================================================================
MIGRATION COMPLETE
================================================================================
✓ Migrated 3 projects
✓ Created 7 new projects
```

## Safety Features

1. **Dry Run Mode**: Test the migration without making changes
2. **No Deletions**: Original projects and handoffs are preserved
3. **Migration Markers**: All migrated items include:
   - `migrated_from_project`: Original project ID
   - `migration_timestamp`: When migration occurred
4. **Idempotent**: Safe to re-run (will only migrate unconflicted handoffs)
5. **UUID-based IDs**: No risk of ID collisions

## Rollback Plan

If issues arise after migration:

1. **Identify migrated projects**:
   ```bash
   aws dynamodb scan \
     --table-name finz_projects \
     --filter-expression "attribute_exists(migrated_from_project)"
   ```

2. **Delete migrated projects** (if needed):
   - Delete METADATA records with `migrated_from_project` attribute
   - Delete HANDOFF records with `migrated_from_project` attribute
   - Restore idempotency records (if needed)

3. **Original data is preserved**: All original projects remain unchanged

## Post-Migration

### Expected Behavior

After migration:
- Each baseline has its own `PROJECT#<projectId>/METADATA` record
- SDMT Portfolio UI shows all baselines as separate projects
- No cross-baseline overwriting occurs for new handoffs
- Existing baselines can still receive updates (handoffs reuse the same project)

### Monitoring

Monitor for:
- New baseline collision warnings in application logs
- Projects with multiple baselines (shouldn't happen with new code)
- Handoff errors or failures

## Troubleshooting

### Migration Failed Mid-Way

If the migration script crashes:
1. Check error message and fix the issue
2. Re-run the migration (it's safe to re-run)
3. Already-migrated handoffs will be skipped

### Projects Not Appearing in UI

If projects don't appear after migration:
1. Check project METADATA has all required fields
2. Verify `baseline_status = "handed_off"` or `"accepted"`
3. Check RBAC permissions (sdm_manager_email, etc.)
4. Review application logs for errors

### Performance Issues

If migration is slow:
1. Check DynamoDB read/write capacity
2. Consider batching operations (future enhancement)
3. Run during low-traffic hours

## Support

For issues or questions:
- Review application logs: CloudWatch logs for finanzas-api
- Check DynamoDB directly: AWS Console or CLI
- Contact the development team with:
  - Migration output logs
  - Affected project IDs
  - Error messages

## Future Enhancements

Possible improvements to the migration script:
- Batch operations for better performance
- Progress tracking and resume capability
- More detailed validation and reporting
- Automated rollback capability
- Integration with CI/CD pipelines
