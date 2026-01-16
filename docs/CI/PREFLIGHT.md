# Preflight Workflow Documentation

## Overview

The Pre-merge Preflight workflow (`.github/workflows/pre-merge-preflight.yml`) performs automated smoke tests and validation before merging changes to the main branch. This workflow ensures that critical API functionality, especially allocations materialization and retrieval, works correctly.

## Workflow Triggers

- **Pull Request Events**: `opened`, `synchronize`, `reopened`
- **Manual Trigger**: `workflow_dispatch`

## Required Secrets and Variables

### GitHub Repository Variables
- `COGNITO_TESTER_USERNAME`: Cognito test user username
- `COGNITO_TESTER_PASSWORD`: Cognito test user password  
- `COGNITO_WEB_CLIENT`: Cognito app client ID

### GitHub Repository Secrets
- `AWS_REGION`: AWS region (e.g., `us-east-2`)
- `AWS_ACCESS_KEY_ID`: AWS access key for CloudWatch and Cognito
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `VITE_API_BASE_URL` or `API_BASE`: API base URL (e.g., `https://...amazonaws.com/dev`)
- `CLOUDWATCH_LOG_GROUP`: CloudWatch log group name

## Workflow Steps

### 1. Environment Setup
- Checkout code
- Setup Node.js 20
- Configure AWS credentials
- Ensure `pnpm` is available (via corepack or npm install)

### 2. Validation
- Validate Cognito credentials are present
- Fetch API token from Cognito using AWS CLI
- Validate required AWS secrets

### 3. Install Dependencies
- Run `pnpm install --frozen-lockfile`

### 4. Run Tests
- Execute pre-merge checks script (if present)
- Run finanzas-api unit tests
- Run preflight allocations smoke test

### 5. Artifacts
- Upload test outputs and smoke test results
- Retain artifacts for 30 days

## Preflight Allocations Smoke Test

The `preflight-allocations.js` script performs end-to-end testing:

1. **Authentication**: Obtains Cognito token using test credentials
2. **Backfill Test**: Calls `POST /admin/backfill` with baseline `base_5c62d927a71b`
   - Verifies `allocationsWritten > 0`
3. **Allocations Query Test**: Calls `GET /allocations?projectId=P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7`
   - Verifies response has `length > 0`
   - Verifies allocations have correct PK format (`PROJECT#...`)
4. **Artifact Generation**: Writes JSON artifacts for verification

### Artifacts Generated
- `real_run_backfill.json`: Backfill API response
- `allocations_list.json`: Allocations query response
- `preflight_summary.txt`: Test summary and status
- `ci_tests_output.txt`: Unit test output

## Running Locally

### Prerequisites
```bash
# Set environment variables
export COGNITO_TESTER_USERNAME="your-test-user"
export COGNITO_TESTER_PASSWORD="your-test-password"
export COGNITO_WEB_CLIENT="your-client-id"
export AWS_REGION="us-east-2"
export API_BASE="https://...amazonaws.com/dev"
export BASELINE_ID="base_5c62d927a71b"
export PROJECT_ID="P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7"
```

### Run Preflight Script
```bash
cd services/finanzas-api
node scripts/preflight-allocations.js
```

### Run Unit Tests
```bash
cd services/finanzas-api
pnpm test
```

## Troubleshooting

### Missing Secrets/Variables
**Error**: `Required env variable COGNITO_USER is not set`

**Solution**: Add the required variables to GitHub repository settings:
- Go to: Settings → Secrets and variables → Actions
- Add variables: `COGNITO_TESTER_USERNAME`, `COGNITO_TESTER_PASSWORD`, `COGNITO_WEB_CLIENT`
- Add secrets: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VITE_API_BASE_URL`

### pnpm Not Found
**Error**: `pnpm installation failed`

**Solution**: The workflow attempts multiple fallbacks:
1. Check if pnpm already installed
2. Enable corepack and prepare pnpm
3. Install pnpm globally via npm

If all fail, ensure the GitHub runner has npm available.

### Cognito Authentication Failed
**Error**: `Cognito auth failed`

**Solution**:
- Verify credentials are correct
- Ensure user pool and client ID match
- Check AWS region is correct
- Verify the test user account is active

### API Requests Fail
**Error**: `HTTP 403` or `HTTP 500`

**Solution**:
- Verify API_BASE URL is correct
- Check Cognito token has proper permissions
- Verify AVP policies allow the test user to call admin endpoints
- Check CloudWatch logs for detailed error messages

### Zero Allocations Returned
**Error**: `Expected allocations.length > 0, got 0`

**Solution**:
- Verify baseline has been materialized
- Check DynamoDB table for allocations with `pk = PROJECT#P-7e4fbaf2...`
- Run migration script if allocations exist under `BASELINE#` PK
- Check CloudWatch logs for materialization errors

## Migration Script

If historical allocations were written with `pk = BASELINE#...`, run the migration script:

```bash
cd services/finanzas-api

# Dry run (no writes)
DRY_RUN=true ts-node scripts/migrate-allocations-to-project-pk.ts

# Real migration
DRY_RUN=false ts-node scripts/migrate-allocations-to-project-pk.ts
```

The migration script:
- Scans for allocations with `BASELINE#` PK
- Creates new items with `PROJECT#` PK
- Uses idempotent writes (safe to run multiple times)
- Does NOT delete original items

## Success Criteria

A successful preflight run requires:
- ✅ All unit tests pass
- ✅ Backfill returns `allocationsWritten > 0`
- ✅ GET /allocations returns `length > 0`
- ✅ Allocations have `pk` format: `PROJECT#<projectId>`
- ✅ Allocations have `sk` format: `ALLOCATION#<baselineId>#<rubroId>#<month>`

## Related Documentation

- [Materializers Implementation](../../services/finanzas-api/src/lib/materializers.ts)
- [Allocations Handler Tests](../../services/finanzas-api/test/allocations.materializer.spec.ts)
- [Migration Script](../../services/finanzas-api/scripts/migrate-allocations-to-project-pk.ts)
