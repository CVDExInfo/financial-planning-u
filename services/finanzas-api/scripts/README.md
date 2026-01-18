# Finanzas API Scripts

## Backfill Baseline Materialization

The `backfill-baseline-materialization.ts` script materializes allocations and rubros for existing baselines in the database.

### Usage

#### Dry-run (Safe - No Writes)

```bash
# Basic dry-run
ts-node scripts/backfill-baseline-materialization.ts

# Dry-run with force rewrite zeros flag
FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts
```

#### Execute (Writes to Database)

```bash
# Execute writes (non-production)
CONFIRM=yes ts-node scripts/backfill-baseline-materialization.ts

# Execute writes with force rewrite zeros flag
CONFIRM=yes FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts
```

#### Production Execution

```bash
# Production requires CONFIRM_PROD=YES
CONFIRM_PROD=YES CONFIRM=yes ts-node scripts/backfill-baseline-materialization.ts

# Production with force rewrite zeros
CONFIRM_PROD=YES CONFIRM=yes FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONFIRM` | No | `false` | Set to `yes` to execute writes. Without this, script runs in dry-run mode. |
| `CONFIRM_PROD` | Yes (production) | `false` | Set to `YES` when running in production (`NODE_ENV=production` or `STAGE_NAME=prod`). |
| `FORCE_REWRITE_ZEROS` | No | `false` | Set to `yes` to allow overwriting existing zero-amount allocations with positive values. |

### Safety Features

1. **Dry-run by default**: Without `CONFIRM=yes`, the script only simulates changes without writing to the database.

2. **Production guard**: When running in production environment, the script requires `CONFIRM_PROD=YES` to proceed.

3. **Idempotent writes**: The script checks for existing allocations and skips them by default to avoid duplicates.

4. **Force rewrite zeros**: When `FORCE_REWRITE_ZEROS=yes` is set:
   - Existing allocations with zero amounts can be overwritten with positive values
   - This is useful for fixing data migration issues where allocations were created with $0
   - All overwrites are logged for audit purposes

### Examples

**Scenario 1**: Preview what would be materialized (safe)
```bash
ts-node scripts/backfill-baseline-materialization.ts
```

**Scenario 2**: Execute materialization in staging
```bash
CONFIRM=yes ts-node scripts/backfill-baseline-materialization.ts
```

**Scenario 3**: Fix zero-amount allocations in staging
```bash
CONFIRM=yes FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts
```

**Scenario 4**: Production execution (requires all safety flags)
```bash
# Set environment
export NODE_ENV=production
export STAGE_NAME=prod

# Run with all safety confirmations
CONFIRM_PROD=YES CONFIRM=yes ts-node scripts/backfill-baseline-materialization.ts
```

### Output

The script logs:
- Mode (DRY-RUN or EXECUTE)
- Force rewrite zeros status (ENABLED or DISABLED)
- Number of baselines found
- For each baseline:
  - Baseline ID and Project ID
  - Planned allocations count
  - Planned rubros count
  - (If executing) Actual allocations and rubros written

### GitHub Actions Workflow

A GitHub Actions workflow is available at `.github/workflows/backfill.yml` for running dry-runs on staging:

- **Trigger**: Manual dispatch (`workflow_dispatch`)
- **Mode**: Dry-run only (no writes)
- **Environment**: Staging or Production (both run dry-run)
- **Force Rewrite Zeros**: Optional checkbox

⚠️ **Important**: The GitHub Actions workflow is configured for dry-runs only. Production writes should always be performed manually with appropriate safeguards and oversight.

### Troubleshooting

**Issue**: Script reports "All allocations were skipped (idempotent)"

**Solution**: This is normal if allocations were already materialized. If you need to overwrite zero-amount allocations, use `FORCE_REWRITE_ZEROS=yes`.

**Issue**: Production guard error

**Solution**: Ensure `CONFIRM_PROD=YES` is set when `NODE_ENV=production` or `STAGE_NAME=prod`.
