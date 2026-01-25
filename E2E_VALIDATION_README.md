# End-to-End System Validation

## Overview

This repository includes comprehensive end-to-end validation tooling for the financial planning system (Finanzas) to verify system health after PRs #997 and #998 have been merged.

## Quick Start

### Local Development Validation

```bash
# Fast validation (no AWS, no UI)
bash scripts/examples/validate-local-dev.sh
```

### Staging/Production Validation

```bash
# Full validation with AWS integration
export AWS_PROFILE=staging
export API_URL=https://api-staging.example.com/dev
bash scripts/examples/validate-staging.sh
```

### CI-Only Checks (Pre-commit)

```bash
# Fast CI checks only (~5 seconds)
bash scripts/examples/validate-ci-only.sh
```

## What Gets Validated

The validation script comprehensively checks:

✅ **Environment & Prerequisites**
- Node.js, pnpm, AWS CLI, jq, SAM CLI availability

✅ **Taxonomy S3 / Loader**
- S3 taxonomy object existence
- Lambda environment variables
- Lambda IAM permissions for S3 and DynamoDB

✅ **API Health**
- Endpoint responses (no 5xx errors)
- Canonical rubro IDs in responses

✅ **Data Lineage**
- Baseline → Materializer → Allocations → API flow
- DynamoDB canonical field verification

✅ **Migration Scripts**
- Dry-run capability testing
- Canonical ID migration validation

✅ **IAM/Permissions**
- Lambda execution role permissions
- DynamoDB and S3 access policies

✅ **Frontend/UI**
- Build validation
- E2E test infrastructure

✅ **CI Integration**
- Canonical rubros checks
- Forbidden tokens validation

✅ **Monitoring**
- CloudWatch logs review
- Error detection

## Documentation

- **[scripts/E2E_VALIDATION_GUIDE.md](scripts/E2E_VALIDATION_GUIDE.md)** - Complete validation guide
- **[scripts/examples/README.md](scripts/examples/README.md)** - Usage examples and scenarios
- **[scripts/validate-e2e-system.sh](scripts/validate-e2e-system.sh)** - Main validation script

## Files Included

### Scripts
- `scripts/validate-e2e-system.sh` - Main end-to-end validation script
- `scripts/fix-noncanonical-rubros.cjs` - Migration script for canonicalizing rubro IDs
- `scripts/examples/validate-local-dev.sh` - Local development validation example
- `scripts/examples/validate-staging.sh` - Staging environment validation example
- `scripts/examples/validate-ci-only.sh` - Fast CI checks example
- `scripts/examples/validate-api-only.sh` - API health checks example

### Documentation
- `scripts/E2E_VALIDATION_GUIDE.md` - Complete validation guide
- `scripts/examples/README.md` - Examples and usage scenarios

### CI Integration
- `ci/check-canonical-rubros.cjs` - Canonical rubros validation for CI
- `ci/check-forbidden-rubros.sh` - Forbidden tokens check for CI

## Usage Examples

### Validate Before Deployment

```bash
# Check system readiness before deploying to production
bash scripts/validate-e2e-system.sh \
  --api-url "https://api-prod.example.com/prod" \
  --output "/tmp/prod-readiness-check.txt"
```

### API Health Check

```bash
# Quick API endpoint validation
export API_URL=https://api.example.com/dev
bash scripts/examples/validate-api-only.sh
```

### Migration Script Dry-Run

```bash
# Test migration without making changes
ALLOCATIONS_TABLE=allocations_staging \
PROJECT_RUBROS_TABLE=project_rubros_staging \
node scripts/fix-noncanonical-rubros.cjs --dryrun
```

## Command-Line Options

The main validation script supports:

```
--project-id <id>        Project ID for testing
--baseline-id <id>       Baseline ID for testing
--tax-bucket <bucket>    S3 taxonomy bucket
--tax-key <key>          S3 taxonomy key
--api-url <url>          API Gateway URL
--skip-aws               Skip AWS-specific checks
--skip-ui                Skip UI/E2E tests
--output <file>          Save report to file
--help                   Show help message
```

## Exit Codes

- `0` - All checks passed (go-live ready)
- `1` - One or more checks failed (remediation needed)
- `2` - Script error or missing prerequisites

## Integration with CI/CD

### GitHub Actions

```yaml
- name: E2E Validation
  run: bash scripts/validate-e2e-system.sh --api-url "${{ secrets.API_URL }}"
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
bash scripts/examples/validate-ci-only.sh || exit 1
```

## Evidence Collection

All validation runs save evidence to `/tmp/e2e-validation-<timestamp>/`:

- S3 head-object responses
- Lambda configurations
- IAM policies
- API responses
- DynamoDB queries
- CloudWatch logs
- CI check outputs

## Troubleshooting

### Missing Dependencies

```bash
# Install required tools
brew install jq  # macOS
apt-get install jq  # Ubuntu/Debian

# Install pnpm
npm install -g pnpm

# Install AWS CLI v2
# See: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
```

### AWS Credentials

```bash
# Verify credentials
aws sts get-caller-identity

# Configure if needed
aws configure
```

### Permission Denied

```bash
# Make scripts executable
chmod +x scripts/validate-e2e-system.sh
chmod +x scripts/examples/*.sh
```

## Related PRs

- **PR #997** - Canonical taxonomy implementation
- **PR #998** - Data lineage and migration scripts

## Support

For detailed usage instructions, see:
- [E2E Validation Guide](scripts/E2E_VALIDATION_GUIDE.md)
- [Examples Documentation](scripts/examples/README.md)

For issues or questions, review the evidence files and consult the remediation recommendations in the validation report.
