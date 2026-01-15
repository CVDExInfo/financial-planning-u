# Pre-merge Preflight Workflow Setup Guide

This document provides instructions for setting up and using the pre-merge preflight GitHub Actions workflow.

## Overview

The `pre-merge-preflight` workflow provides automated **STRONG✓CONFIRMED** validation for pull requests targeting the `main` branch. It runs comprehensive checks including unit tests, integration tests, and CloudWatch log validation to ensure code quality and functionality before merging.

## Workflow File

- **Location**: `.github/workflows/pre-merge-preflight.yml`
- **Triggers**: 
  - Pull requests to `main` branch (opened, synchronize, reopened, ready_for_review)
  - Manual workflow dispatch

## Workflow Steps

### 1. Build & Test Phase
- **Setup**: Node.js 18 with pnpm package manager
- **Dependencies**: Install finanzas-api dependencies
- **Unit Tests**: Run unit tests for finanzas-api service (`pnpm -s test -- --runInBand`)
- **Lint & Build**: Repository-level linting and building (non-blocking)

### 2. Integration Tests Phase
- **Dry-run Backfill**: Calls `/admin/backfill` with `dryRun: true` and asserts `allocationsAttempted > 0`
- **Real Backfill**: Calls `/admin/backfill` with `dryRun: false` and asserts `allocationsWritten > 0`
- **Allocations GET**: Fetches allocations via GET endpoint and asserts non-empty response

### 3. CloudWatch Validation Phase
- **Configure AWS**: Sets up AWS credentials for CloudWatch access
- **Preview Check**: Polls CloudWatch for `normalizeBaseline preview` logs and validates `laborCount > 0`
- **Result Check**: Polls CloudWatch for `materializeAllocationsForBaseline result` logs and validates `allocationsWritten > 0`

### 4. Artifact Upload
- Uploads all key JSON responses and log outputs as workflow artifacts for audit purposes

## Required Repository Secrets

Add these secrets to your repository (Settings → Secrets and variables → Actions → Repository secrets):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `API_BASE` | Staging API base URL | `https://d7t9x3j66yd8k.cloudfront.net/finanzas` |
| `API_TOKEN` | Bearer token for API authentication | `Bearer eyJhbGc...` |
| `BASELINE_ID` | Test baseline ID for integration tests | `base_5c62d927a71b` |
| `PROJECT_ID` | Test project ID for allocations verification | `P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7` |
| `AWS_REGION` | AWS region for CloudWatch logs | `us-east-2` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID (with CloudWatch read permissions) | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | Your AWS secret key |
| `CLOUDWATCH_LOG_GROUP` | Lambda log group name for materializer logs | `/aws/lambda/finanzas-api-materializer` |

### AWS IAM Permissions Required

The AWS credentials must have the following permissions:
- `logs:FilterLogEvents` on the specified log group
- `logs:GetLogEvents` on the specified log group

Example IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:GetLogEvents"
      ],
      "Resource": "arn:aws:logs:REGION:ACCOUNT_ID:log-group:LOG_GROUP_NAME:*"
    }
  ]
}
```

## Setting Up Secrets

### Using GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value
5. Click **Add secret**

### Using GitHub CLI

```bash
# Set API_BASE
gh secret set API_BASE -b"https://d7t9x3j66yd8k.cloudfront.net/finanzas"

# Set API_TOKEN
gh secret set API_TOKEN -b"Bearer YOUR_TOKEN_HERE"

# Set BASELINE_ID
gh secret set BASELINE_ID -b"base_5c62d927a71b"

# Set PROJECT_ID
gh secret set PROJECT_ID -b"P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7"

# Set AWS_REGION
gh secret set AWS_REGION -b"us-east-2"

# Set AWS credentials
gh secret set AWS_ACCESS_KEY_ID -b"YOUR_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY -b"YOUR_SECRET_ACCESS_KEY"

# Set CloudWatch log group
gh secret set CLOUDWATCH_LOG_GROUP -b"/aws/lambda/finanzas-api-materializer"
```

## Branch Protection Setup

To require the preflight check before merging:

1. Go to **Settings** → **Branches**
2. Click **Add rule** or edit existing rule for `main`
3. Enable **Require status checks to pass before merging**
4. Search for and select **Pre-merge preflight** (or `preflight`)
5. Save changes

## Workflow Artifacts

After each run, the workflow uploads the following artifacts (viewable in the workflow run page):

- `dry_run_backfill.json` - Response from dry-run backfill API call
- `real_run_backfill.json` - Response from real backfill API call
- `allocations_list.json` - Response from allocations GET call
- `preview_msgs.txt` - CloudWatch logs for normalizeBaseline preview
- `materializer_msgs.txt` - CloudWatch logs for materializeAllocationsForBaseline result
- `/tmp/dry_run_out.txt` - Extracted allocationsAttempted count
- `/tmp/real_run_out.txt` - Extracted allocationsWritten count
- `/tmp/allocations_out.txt` - Extracted allocations count
- `/tmp/cw_preview_out.txt` - Extracted preview laborCount
- `/tmp/cw_materializer_out.txt` - Extracted materializer allocationsWritten

## Troubleshooting

### Workflow Fails on Unit Tests

- Check the test logs in the workflow run
- Run tests locally: `cd services/finanzas-api && pnpm test`
- Fix failing tests before pushing

### Workflow Fails on Integration Tests

- Verify `API_BASE` and `API_TOKEN` secrets are correct
- Check if the API endpoint is accessible
- Verify `BASELINE_ID` and `PROJECT_ID` exist in the staging environment

### Workflow Fails on CloudWatch Checks

- Verify AWS credentials have correct permissions
- Check if `CLOUDWATCH_LOG_GROUP` name is correct
- Ensure logs were generated within the last hour (workflow searches last 3600 seconds)
- If logs are older, you may need to trigger a backfill first

### No Logs Found in CloudWatch

The workflow searches for logs from the last hour. If:
- Your logs are older than 1 hour, the CloudWatch steps will fail
- To fix: trigger a fresh backfill or extend the time window in the workflow

### Extending CloudWatch Search Window

Edit `.github/workflows/pre-merge-preflight.yml` and change:
```bash
START_MS=$(($(date +%s) - 3600))  # 3600 seconds = 1 hour
```
to:
```bash
START_MS=$(($(date +%s) - 7200))  # 7200 seconds = 2 hours
```

## Manual Workflow Run

To manually trigger the workflow:

1. Go to **Actions** → **pre-merge-preflight**
2. Click **Run workflow**
3. Select the branch
4. Click **Run workflow**

## Benefits

1. **Automated Validation**: Eliminates manual testing steps before merging
2. **CloudWatch Evidence**: Automatically captures and validates log entries
3. **Audit Trail**: All responses saved as artifacts for review
4. **Security**: No credentials exposed in code or logs
5. **Reusability**: Works for all PRs targeting main branch
6. **Quality Gate**: Prevents merging broken code

## Next Steps

1. ✅ Add all required secrets to the repository
2. ✅ Enable branch protection requiring this workflow
3. ✅ Test the workflow on an open PR
4. ✅ Review artifacts from successful run
5. ✅ Merge confidently with STRONG✓CONFIRMED evidence
