# Taxonomy DynamoDB SOT Implementation

## Overview

This implementation makes the DynamoDB table `finz_rubros_taxonomia` the canonical source of truth for taxonomy data across the application. The CI validation now compares the frontend canonical taxonomy file against the live DynamoDB table instead of comparing against a backend file.

## Changes Made

### 1. Updated CI Validation Script (`scripts/validate-taxonomy-sync.cjs`)

**Previous behavior:**
- Compared frontend and backend taxonomy files
- Used file-based validation

**New behavior:**
- Scans the DynamoDB table `finz_rubros_taxonomia`
- Compares frontend canonical IDs with DynamoDB entries
- Tolerant of multiple attribute names (linea_codigo, id, code, linea_codigo_alias, LineaCodigo)
- Exit codes:
  - 0: Success (sync)
  - 1: File not found
  - 2: Mismatch detected
  - 3: Error during validation

**Environment variables:**
- `AWS_REGION`: AWS region (default: us-east-2)
- `TAXONOMY_TABLE`: DynamoDB table name (default: finz_rubros_taxonomia)

### 2. Created Seed Script (`scripts/sync-taxonomy-to-dynamo.cjs`)

A helper script for ops to seed or sync the DynamoDB table from the frontend canonical taxonomy file.

**Usage:**
```bash
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/sync-taxonomy-to-dynamo.cjs
```

**What it does:**
- Parses `src/lib/rubros/canonical-taxonomy.ts`
- Extracts canonical taxonomy IDs
- Upserts minimal entries into DynamoDB with:
  - `linea_codigo`: The canonical ID
  - `descripcion`: The ID (placeholder)
  - `categoria`: "UNASSIGNED"
  - `createdAt`: Current timestamp

**Important notes:**
- This is a manual ops tool - NOT run automatically in CI
- Only run when you have validated the canonical data
- Requires appropriate AWS permissions
- Creates minimal entries - operators should enrich via proper tooling

### 3. Updated GitHub Actions Workflow (`.github/workflows/deploy-ui.yml`)

**Changes:**
1. Added AWS credentials configuration step using `aws-actions/configure-aws-credentials@v2`
2. Updated validation step to:
   - Set `TAXONOMY_TABLE` and `AWS_REGION` environment variables
   - Run from `services/finanzas-api` directory to access AWS SDK packages
   - Changed step name to reflect DynamoDB validation

**Required secrets:**
- `AWS_ROLE_TO_ASSUME`: IAM role ARN that the GitHub Action will assume

**Required IAM permissions for the role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-2:703671891952:table/finz_rubros_taxonomia"
    }
  ]
}
```

### 4. Backend Configuration (No Changes Required)

The backend was already correctly configured:
- `services/finanzas-api/src/lib/dynamo.ts` has a fallback for `rubros_taxonomia` → `finz_rubros_taxonomia`
- `services/finanzas-api/template.yaml` sets `TABLE_RUBROS_TAXONOMIA` to `${TablePrefix}rubros_taxonomia`
- `TablePrefix` defaults to `finz_`
- Result: `tableName('rubros_taxonomia')` resolves to `finz_rubros_taxonomia`

## Rollout Plan

### 1. Prerequisites
- [ ] Set up `AWS_ROLE_TO_ASSUME` in GitHub secrets
- [ ] Ensure IAM role has necessary DynamoDB permissions
- [ ] Verify DynamoDB table `finz_rubros_taxonomia` exists and is populated

### 2. Deployment
- [ ] Merge this PR to main branch
- [ ] Workflow will automatically run taxonomy validation against DynamoDB

### 3. If Validation Fails
If the CI validation fails due to missing IDs in DynamoDB:

1. Review the error output to see which IDs are missing
2. If appropriate, run the seed script:
   ```bash
   AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/sync-taxonomy-to-dynamo.cjs
   ```
3. Re-run the CI workflow

### 4. Verification
- [ ] CI validation passes
- [ ] Backend materializer tests pass
- [ ] Frontend UI displays rubros correctly
- [ ] SDMTForecast renders rubros and allocations properly

## Benefits

1. **Single Source of Truth**: All server-side functions read from the same DynamoDB table
2. **Centralized Updates**: Taxonomy changes are immediately available to all services
3. **Prevents Drift**: CI validation ensures frontend canonical file stays in sync with DynamoDB
4. **Operational Safety**: Seed script provides safe way to bootstrap or backfill the table
5. **Minimal Code Changes**: Uses existing infrastructure with env-based configuration

## Frontend Considerations

The frontend continues to use `src/lib/rubros/canonical-taxonomy.ts` for:
- Build-time grouping and logic
- UI labels and display
- Static typing and validation

The CI validation ensures this file stays in sync with the DynamoDB source of truth.

**Alternative (not implemented):** The frontend could request taxonomy from a backend API endpoint at runtime. This would enable dynamic updates but requires:
- Additional API endpoint
- Client-side caching strategy
- Network call overhead
- More complex error handling

The current approach (build-time file + CI validation) provides a good balance of performance and consistency.

## Troubleshooting

### Validation fails with "Frontend taxonomy file not found"
- Ensure `src/lib/rubros/canonical-taxonomy.ts` exists
- Check file path is correct relative to script location

### Validation fails with AWS credentials error
- Verify `AWS_ROLE_TO_ASSUME` secret is set in GitHub
- Check IAM role has necessary permissions
- Ensure role trust policy allows GitHub Actions OIDC

### Seed script fails with permission denied
- Verify AWS credentials are configured
- Check IAM permissions include `dynamodb:PutItem` on the table
- Ensure table name is correct

### Backend still using wrong table
- Check `TABLE_RUBROS_TAXONOMIA` environment variable in deployment
- Verify SAM template has correct `TablePrefix`
- Review CloudFormation stack parameters

## Files Changed

- `.github/workflows/deploy-ui.yml` - Added AWS credentials and updated validation
- `scripts/validate-taxonomy-sync.cjs` - Replaced with DynamoDB-based validation
- `scripts/sync-taxonomy-to-dynamo.cjs` - New seed script for ops

## Files NOT Changed (Verified Correct)

- `services/finanzas-api/src/lib/dynamo.ts` - Already has correct fallback
- `services/finanzas-api/template.yaml` - Already configured correctly
- `services/finanzas-api/src/lib/materializers.ts` - Uses `tableName()` correctly
