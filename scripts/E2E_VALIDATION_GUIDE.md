# End-to-End Validation Guide

## Overview

This guide provides comprehensive instructions for validating the financial-planning-u system after PRs #997 and #998 have been merged. The validation ensures that:

- Taxonomy loads correctly (local or from S3)
- All API endpoints return correct responses without HTTP errors
- Authorization and IAM permissions are properly configured
- Handlers write canonical `rubro_id` and `canonical_rubro_id` to database
- Migration scripts work correctly
- Frontend validates and submits canonical rubros
- CI checks pass

## Quick Start

### Prerequisites

Ensure you have the following tools installed:

- **Node.js** (v18.18.0 or higher)
- **pnpm** (9.15.9 or higher)
- **AWS CLI** v2 (for AWS-related checks)
- **jq** (for JSON processing)
- **SAM CLI** (optional, for local Lambda testing)

### Basic Usage

```bash
# Run all validations (requires AWS credentials)
bash scripts/validate-e2e-system.sh

# Run with custom project/baseline IDs
bash scripts/validate-e2e-system.sh \
  --project-id "P-12345678-1234-1234-1234-123456789012" \
  --baseline-id "base_custom_id"

# Skip AWS checks (useful for local development)
bash scripts/validate-e2e-system.sh --skip-aws

# Skip UI checks (faster execution)
bash scripts/validate-e2e-system.sh --skip-ui

# Test API health only
bash scripts/validate-e2e-system.sh \
  --api-url "https://api.example.com/dev" \
  --skip-aws --skip-ui

# Save report to file
bash scripts/validate-e2e-system.sh --output validation-report.txt
```

## Validation Sections

The script performs the following validations:

### A. Environment & Prerequisites

Checks for required CLI tools and displays configuration:

- Node.js version
- pnpm version
- jq availability
- AWS CLI version (if not skipped)
- SAM CLI version (if not skipped)

**Expected Outcome:** All required tools are installed and accessible.

### B. Taxonomy S3 / Loader Validation

Validates taxonomy storage and Lambda access:

1. **S3 Object Exists**: Verifies `s3://ukusi-ui-finanzas-prod/taxonomy/rubros.taxonomy.json` exists
2. **Lambda Environment Variables**: Checks `TAXONOMY_S3_BUCKET` and `TAXONOMY_S3_KEY` configuration
3. **Lambda IAM Permissions**: Verifies Lambda roles have `s3:GetObject` permissions

**Expected Outcome:** 
- S3 taxonomy object exists with proper metadata
- Lambda functions have environment variables configured (or use local fallback)
- Lambda execution roles have required S3 permissions

**Remediation:**
```bash
# Upload taxonomy to S3
aws s3 cp data/rubros.taxonomy.json \
  s3://ukusi-ui-finanzas-prod/taxonomy/rubros.taxonomy.json

# Verify upload
aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key taxonomy/rubros.taxonomy.json
```

### C. API Health Checks

Tests API endpoints for correct responses:

- `GET /projects/{projectId}/rubros` - List project rubros
- Validates HTTP 200 responses
- Checks for canonical rubro IDs in responses

**Expected Outcome:** All endpoints return HTTP 200 with valid JSON containing canonical rubros.

**Remediation:**
- If 500 errors: Check CloudWatch logs for Lambda errors
- If 403/401 errors: Verify authentication tokens and IAM permissions
- If 404 errors: Verify API Gateway deployment and routes

### D. Data Lineage Verification

Validates the complete data flow:

```
Baseline → Materializer → Allocations Table → API Response
```

1. **DynamoDB Tables**: Verifies allocations and project_rubros tables exist
2. **Sample Query**: Queries allocations for the test project
3. **Field Validation**: Checks `rubro_id` and `canonical_rubro_id` fields

**Expected Outcome:**
- Allocations table contains items with canonical fields
- `rubro_id` and `canonical_rubro_id` match
- `_legacy_id` field exists if migration was applied

**Remediation:**
```bash
# Run migration to canonicalize existing data
ALLOCATIONS_TABLE=allocations_prod \
PROJECT_RUBROS_TABLE=project_rubros_prod \
node scripts/fix-noncanonical-rubros.cjs --apply --batch=50
```

### E. Migration Script Verification

Tests the migration script functionality:

1. **Script Exists**: Verifies `scripts/fix-noncanonical-rubros.js` is present
2. **Dry-Run**: Tests dry-run mode execution

**Expected Outcome:** Script can be executed and performs dry-run without errors.

**Remediation:**
```bash
# Install dependencies if needed
pnpm install -D ts-node

# Test dry-run
node scripts/fix-noncanonical-rubros.cjs --dryrun
```

### F. IAM/Permission Checks

Validates Lambda execution role permissions:

1. **DynamoDB Permissions**: Verifies `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:Scan`
2. **S3 Permissions**: Verifies `s3:GetObject` for taxonomy bucket

**Expected Outcome:** Lambda roles have all required permissions.

**Remediation:**
Add missing permissions to Lambda execution role policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/allocations"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::ukusi-ui-finanzas-prod/taxonomy/*"
    }
  ]
}
```

### G. Frontend / UI Checks

Validates frontend build and testing infrastructure:

1. **Build**: Tests `pnpm build:finanzas`
2. **E2E Tests**: Checks for Playwright configuration

**Expected Outcome:** Frontend builds successfully without errors.

**Remediation:**
```bash
# Install dependencies
pnpm install

# Run build
pnpm build:finanzas

# Run E2E tests
pnpm test:e2e:finanzas
```

### H. CI Integration & Forbidden Tokens Check

Runs CI validation scripts:

1. **Canonical Rubros Check**: Runs `ci/check-canonical-rubros.cjs`
2. **Forbidden Rubros Check**: Runs `ci/check-forbidden-rubros.sh`

**Expected Outcome:** No non-canonical or forbidden rubro IDs found in codebase.

**Remediation:**

If non-canonical IDs found:
1. Add to `data/rubros.taxonomy.json` if it's a valid rubro
2. Add to `LEGACY_RUBRO_ID_MAP` in `canonical-taxonomy.ts` if it's a legacy alias
3. Replace with correct canonical ID if it's a typo

### I. Post-Deployment Monitoring

Provides monitoring recommendations and checks recent logs:

1. **CloudWatch Logs**: Retrieves recent Lambda execution logs
2. **Error Detection**: Checks for ERROR messages
3. **Taxonomy Load Messages**: Verifies taxonomy loading

**Expected Outcome:** No recent errors in CloudWatch logs.

**Monitoring Commands:**
```bash
# Watch Lambda logs
aws logs tail /aws/lambda/finanzas-api --since 5m --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-api \
  --filter-pattern "ERROR" \
  --start-time $(date --date='-15 minutes' +%s)000

# Search for specific patterns
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-api \
  --filter-pattern "Unknown rubro_id"
```

### J. Report & Remediation

Generates final report with:

- Total checks performed
- Pass/fail counts
- Go-live readiness decision
- Remediation recommendations
- Evidence file locations

## Command-Line Options

```
--project-id <id>        Project ID for testing (default: P-d9d24218-692f-4702-b860-c205a2aa45b2)
--baseline-id <id>       Baseline ID for testing (default: base_d01bf4ce1828)
--tax-bucket <bucket>    S3 taxonomy bucket (default: ukusi-ui-finanzas-prod)
--tax-key <key>          S3 taxonomy key (default: taxonomy/rubros.taxonomy.json)
--api-url <url>          API Gateway URL for API tests
--skip-aws               Skip AWS-specific checks (S3, Lambda, IAM, DynamoDB)
--skip-ui                Skip UI/E2E tests
--output <file>          Save report to file
--help                   Show help message
```

## Environment Variables

The script respects these environment variables:

```bash
# AWS configuration
export AWS_REGION=us-east-1
export AWS_PROFILE=your-profile

# Project/baseline for testing
export PROJECT_ID=P-12345678-1234-1234-1234-123456789012
export BASELINE_ID=base_custom_id

# Taxonomy S3 location
export TAX_BUCKET=ukusi-ui-finanzas-prod
export TAX_KEY=taxonomy/rubros.taxonomy.json

# API endpoint
export API_URL=https://api.example.com/dev
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Validation

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Run E2E Validation
        run: |
          bash scripts/validate-e2e-system.sh \
            --api-url "${{ secrets.DEV_API_URL }}" \
            --output validation-report.txt
      
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: validation-report.txt
```

### Local Development Workflow

```bash
# 1. Skip AWS checks for local development
bash scripts/validate-e2e-system.sh --skip-aws --skip-ui

# 2. Run only CI checks (fast)
node ci/check-canonical-rubros.cjs

# 3. Test migration script dry-run
node scripts/fix-noncanonical-rubros.cjs --dryrun

# 4. Build frontend
pnpm build:finanzas
```

## Troubleshooting

### AWS Credentials Issues

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Configure credentials
aws configure
```

### Missing Dependencies

```bash
# Install all project dependencies
pnpm install

# Install jq (macOS)
brew install jq

# Install jq (Ubuntu/Debian)
sudo apt-get install jq

# Install AWS CLI v2
# See: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
```

### Permission Denied

```bash
# Make script executable
chmod +x scripts/validate-e2e-system.sh
```

### Lambda Function Not Found

The script looks for Lambda functions containing "finanzas" in the name. If your functions use different naming:

1. Manually specify function name
2. Check AWS region is correct
3. Verify AWS credentials have `lambda:ListFunctions` permission

## Evidence Files

The script saves evidence to `/tmp/e2e-validation-<timestamp>/`:

- `s3-head-object.txt` - S3 taxonomy metadata
- `lambda-config-<function>.txt` - Lambda configuration
- `lambda-env-<function>.txt` - Lambda environment variables
- `iam-attached-policies-<role>.txt` - IAM attached policies
- `iam-inline-policies-<role>.txt` - IAM inline policies
- `api-get-rubros.txt` - API response for rubros endpoint
- `dynamodb-tables.txt` - DynamoDB table list
- `dynamodb-allocations-query.txt` - Sample allocations query
- `migration-dryrun.txt` - Migration script dry-run output
- `frontend-build.txt` - Frontend build output
- `ci-canonical-check.txt` - CI canonical rubros check output
- `cloudwatch-logs-<function>.txt` - Recent CloudWatch logs

## Exit Codes

- `0` - All checks passed (go-live ready)
- `1` - One or more checks failed (remediation needed)
- `2` - Script error or missing prerequisites

## Best Practices

1. **Always run dry-run first**: Before applying migration scripts
2. **Test in staging**: Validate in staging environment before production
3. **Monitor after deployment**: Watch CloudWatch logs for 30 minutes post-deployment
4. **Save evidence**: Keep validation reports for audit trail
5. **Incremental validation**: Run after each significant change
6. **Automate in CI**: Include in pre-deployment pipeline

## Related Documentation

- [CANONICAL_RUBROS_IMPLEMENTATION_SUMMARY.md](../CANONICAL_RUBROS_IMPLEMENTATION_SUMMARY.md) - Implementation details
- [scripts/fix-noncanonical-rubros.cjs](./fix-noncanonical-rubros.cjs) - Migration script
- [ci/check-canonical-rubros.cjs](../ci/check-canonical-rubros.cjs) - CI validation
- [data/rubros.taxonomy.json](../data/rubros.taxonomy.json) - Canonical taxonomy

## Support

For issues or questions:

1. Check CloudWatch logs for detailed error messages
2. Review evidence files in `/tmp/e2e-validation-*/`
3. Consult the remediation recommendations in the validation report
4. Refer to the implementation summary documents

## Changelog

### 2026-01-25
- Initial release
- Comprehensive validation covering all aspects from PRs #997 and #998
- Support for AWS and local development environments
- Evidence collection and detailed reporting
