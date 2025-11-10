# Scripts Directory

This directory contains utility scripts for building, testing, deploying, and validating the Finanzas application.

## CI/CD & Quality Gates

### build-guards-finanzas.sh

**Purpose**: Validates Finanzas build artifacts to ensure production readiness.

**What it checks**:
- ✅ Build artifacts exist (`dist-finanzas/`)
- ✅ Base path uses `/finanzas/assets/` (not `/assets/`)
- ✅ No hardcoded development URLs (github.dev, codespaces)
- ✅ Environment variables are set (optional)
- ✅ Asset files (JS/CSS) are present

**Usage**:
```bash
# After building
BUILD_TARGET=finanzas npm run build

# Run all guards
./scripts/build-guards-finanzas.sh

# Skip environment validation (useful in CI)
./scripts/build-guards-finanzas.sh --skip-env-check
```

**Exit codes**:
- `0` = All checks passed
- `1` = One or more checks failed

**Used in**: `.github/workflows/finanzas-pr-checks.yml`

**Documentation**: See `docs/WORKFLOW_SETUP.md`

---

## Testing Scripts

### finanzas-e2e-smoke.sh

**Purpose**: End-to-end smoke tests for Finanzas API and UI.

**What it tests**:
- Cognito authentication
- API health endpoint
- Protected endpoints (catalog, allocation-rules)
- DynamoDB write operations
- Audit log verification

**Prerequisites**:
```bash
export USERNAME="your-cognito-username"
export PASSWORD="your-cognito-password"
```

**Usage**:
```bash
./scripts/finanzas-e2e-smoke.sh
```

**Used in**: `.github/workflows/smoke-only.yml`

### finanzas-smoke-tests.sh

**Purpose**: Lighter smoke tests for Finanzas functionality.

**Usage**:
```bash
./scripts/finanzas-smoke-tests.sh
```

---

## Testing & QA

### qa-full-review.sh

**Purpose**: Comprehensive QA review of the application.

**Usage**:
```bash
./scripts/qa-full-review.sh
```

### qa-ui-test.sh

**Purpose**: UI-focused testing script.

**Usage**:
```bash
./scripts/qa-ui-test.sh
```

---

## API Testing

### test-api-routes-complete.sh

**Purpose**: Tests all API routes with comprehensive coverage.

**Usage**:
```bash
./scripts/test-api-routes-complete.sh
```

### test-all-api-routes.sh

**Purpose**: Tests all API endpoints.

**Usage**:
```bash
./scripts/test-all-api-routes.sh
```

### test-all-routes-with-mock-data.sh

**Purpose**: Tests API routes using mock data.

**Usage**:
```bash
./scripts/test-all-routes-with-mock-data.sh
```

### test-protected-endpoints.sh

**Purpose**: Tests protected API endpoints requiring authentication.

**Usage**:
```bash
./scripts/test-protected-endpoints.sh
```

---

## AWS & Deployment

### assume-role.sh

**Purpose**: Assumes an AWS IAM role for deployment operations.

**Usage**:
```bash
./scripts/assume-role.sh [role-arn]
```

### aws-verify.sh

**Purpose**: Verifies AWS credentials and permissions.

**Usage**:
```bash
./scripts/aws-verify.sh
```

### create-s3-bucket.sh

**Purpose**: Creates S3 bucket for UI hosting.

**Usage**:
```bash
./scripts/create-s3-bucket.sh [bucket-name]
```

### deploy-check.sh

**Purpose**: Pre-deployment validation checks.

**Usage**:
```bash
./scripts/deploy-check.sh
```

### verify-deployment.sh

**Purpose**: Post-deployment verification.

**Usage**:
```bash
./scripts/verify-deployment.sh
```

### validate-prod-deployment.sh

**Purpose**: Production deployment validation.

**Usage**:
```bash
./scripts/validate-prod-deployment.sh
```

---

## Cognito & Authentication

### configure-cognito-hosted-ui.sh

**Purpose**: Configures Cognito hosted UI settings.

**Usage**:
```bash
./scripts/configure-cognito-hosted-ui.sh
```

---

## Documentation

### generate-docs-pdf.cjs

**Purpose**: Generates PDF documentation from markdown.

**Usage**:
```bash
npm run generate-docs-pdf
```

**Used in**: `.github/workflows/generate-docs-pdf.yml`

---

## Data & Mocks

### generate-mock-data.js

**Purpose**: Generates mock data for testing.

**Usage**:
```bash
node scripts/generate-mock-data.js
```

---

## Legacy Scripts

### build-guard.sh

**Purpose**: Legacy build guard script (superseded by `build-guards-finanzas.sh`)

**Note**: Consider using `build-guards-finanzas.sh` for new work.

---

## Script Categories

### Critical (Used in CI/CD)
- ✅ `build-guards-finanzas.sh` - PR quality gates
- ✅ `finanzas-e2e-smoke.sh` - Smoke testing
- ✅ `generate-docs-pdf.cjs` - Documentation generation

### Testing
- `finanzas-smoke-tests.sh`
- `qa-full-review.sh`
- `qa-ui-test.sh`
- `test-api-routes-complete.sh`
- `test-all-api-routes.sh`
- `test-all-routes-with-mock-data.sh`
- `test-protected-endpoints.sh`

### Deployment & AWS
- `assume-role.sh`
- `aws-verify.sh`
- `create-s3-bucket.sh`
- `deploy-check.sh`
- `verify-deployment.sh`
- `validate-prod-deployment.sh`

### Utilities
- `configure-cognito-hosted-ui.sh`
- `generate-mock-data.js`

---

## Best Practices

### Before Using Scripts

1. **Check permissions**: Ensure scripts are executable
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Set environment variables**: Many scripts require AWS credentials and endpoints
   ```bash
   export AWS_REGION="us-east-2"
   export VITE_API_BASE_URL="https://..."
   ```

3. **Read the script**: Check what the script does before running
   ```bash
   head -50 scripts/script-name.sh
   ```

### When Creating New Scripts

1. **Add shebang**: `#!/usr/bin/env bash`
2. **Use strict mode**: `set -euo pipefail`
3. **Document purpose**: Add header comment
4. **Make executable**: `chmod +x`
5. **Update this README**: Add entry for your script

### Error Handling

Most scripts use `set -euo pipefail`:
- `-e`: Exit on error
- `-u`: Exit on undefined variable
- `-o pipefail`: Exit on pipe failure

---

## Documentation References

- **CI/CD Workflows**: See `docs/WORKFLOW_SETUP.md`
- **Branch Protection**: See `docs/BRANCH_PROTECTION_SETUP.md`
- **Test Results**: See `docs/CI_CD_TEST_RESULTS.md`
- **API Documentation**: See `docs/archive/FINANZAS_CI_CD_SUMMARY.md`

---

## Support

For questions about scripts:
1. Check the script header for documentation
2. Review related workflow files in `.github/workflows/`
3. See documentation in `docs/` directory
4. Contact the development team

---

**Last Updated**: 2025-11-10
