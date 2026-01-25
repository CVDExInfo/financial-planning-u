# Validation Examples

This directory contains practical examples showing how to use the E2E validation script in different scenarios.

## Available Examples

### 1. Local Development (`validate-local-dev.sh`)

Validates the system in a local development environment without AWS services.

**Use case:** Development workflow, pre-commit checks, local testing

**Usage:**
```bash
bash scripts/examples/validate-local-dev.sh
```

**What it validates:**
- ✓ Node.js, pnpm, jq availability
- ✓ Migration script existence
- ✓ CI checks (canonical rubros)
- ✗ Skips AWS S3, Lambda, DynamoDB checks
- ✗ Skips UI/E2E tests

### 2. Staging Environment (`validate-staging.sh`)

Comprehensive validation against staging environment with full AWS integration.

**Use case:** Pre-production validation, deployment readiness check

**Usage:**
```bash
export AWS_PROFILE=staging
export API_URL=https://api-staging.example.com/dev
bash scripts/examples/validate-staging.sh
```

**Environment variables:**
- `API_URL` (required): Staging API Gateway URL
- `AWS_PROFILE` (optional): AWS credentials profile
- `PROJECT_ID` (optional): Test project ID
- `BASELINE_ID` (optional): Test baseline ID
- `TAX_BUCKET` (optional): S3 taxonomy bucket
- `TAX_KEY` (optional): S3 taxonomy key

**What it validates:**
- ✓ All environment checks
- ✓ S3 taxonomy availability
- ✓ Lambda configuration and permissions
- ✓ API health endpoints
- ✓ DynamoDB data lineage
- ✓ Migration scripts
- ✓ CI checks

### 3. CI Checks Only (`validate-ci-only.sh`)

Fast validation of CI checks only, useful for pre-commit hooks.

**Use case:** Quick pre-commit validation, CI pipeline

**Usage:**
```bash
bash scripts/examples/validate-ci-only.sh
```

**What it validates:**
- ✓ Canonical rubros check (ci/check-canonical-rubros.cjs)
- ✓ Forbidden rubros check (ci/check-forbidden-rubros.sh)

**Performance:** Fast (~5-10 seconds)

### 4. API Health Only (`validate-api-only.sh`)

Validates API endpoints without AWS infrastructure checks.

**Use case:** API smoke testing, quick health check

**Usage:**
```bash
export API_URL=https://api.example.com/dev
bash scripts/examples/validate-api-only.sh
```

**Environment variables:**
- `API_URL` (required): API Gateway URL
- `PROJECT_ID` (optional): Test project ID

**What it validates:**
- ✓ API endpoint responses
- ✓ Canonical rubro IDs in responses
- ✗ Skips AWS infrastructure
- ✗ Skips UI tests

## Custom Validation Scenarios

You can create custom validation scenarios by combining different flags:

### Example: Production Readiness Check

```bash
bash scripts/validate-e2e-system.sh \
  --api-url "https://api-prod.example.com/prod" \
  --project-id "P-12345678-1234-1234-1234-123456789012" \
  --tax-bucket "production-taxonomy-bucket" \
  --output "/tmp/prod-readiness-check.txt"
```

### Example: Frontend Build Validation

```bash
bash scripts/validate-e2e-system.sh \
  --skip-aws \
  --output "/tmp/frontend-build-check.txt"
```

This skips AWS checks but runs frontend build validation.

### Example: Quick Pre-Push Check

```bash
bash scripts/validate-e2e-system.sh \
  --skip-aws \
  --skip-ui \
  --output "/tmp/quick-check.txt"
```

## Integration with Git Hooks

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Run CI checks before allowing commit
bash scripts/examples/validate-ci-only.sh || exit 1
```

### Pre-push Hook

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
# Run local validation before allowing push
bash scripts/examples/validate-local-dev.sh || exit 1
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Validate System
  run: |
    bash scripts/examples/validate-staging.sh
  env:
    API_URL: ${{ secrets.STAGING_API_URL }}
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### GitLab CI

```yaml
validate:
  stage: test
  script:
    - bash scripts/examples/validate-staging.sh
  variables:
    API_URL: $STAGING_API_URL
```

## Troubleshooting Examples

If an example fails, check:

1. **Missing environment variables**: Ensure required variables are set
2. **AWS credentials**: Verify AWS CLI is configured (`aws sts get-caller-identity`)
3. **Dependencies**: Run `pnpm install` to ensure all tools are available
4. **Permissions**: Ensure scripts are executable (`chmod +x scripts/examples/*.sh`)

## Creating Custom Examples

To create a custom example:

1. Copy an existing example as a template
2. Modify the validation flags to suit your needs
3. Add custom environment variable checks
4. Update documentation in the file header
5. Make the script executable (`chmod +x`)

## See Also

- [E2E_VALIDATION_GUIDE.md](../E2E_VALIDATION_GUIDE.md) - Complete validation guide
- [validate-e2e-system.sh](../validate-e2e-system.sh) - Main validation script
- [fix-noncanonical-rubros.cjs](../fix-noncanonical-rubros.cjs) - Migration script
