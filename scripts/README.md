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

---

## Taxonomy Validation & Reconciliation

### validate-taxonomy-dynamo-full.cjs

**Purpose**: Validates that DynamoDB `finz_rubros_taxonomia` table is in sync with frontend canonical taxonomy and backend mapping.

**What it validates**:
- ✅ Frontend canonical IDs exist in DynamoDB
- ✅ Backend-derived IDs exist in DynamoDB
- ✅ Partition keys follow `LINEA#<linea_codigo>` format
- ✅ Attributes match (descripcion, categoria, fuente_referencia, etc.)
- ✅ No duplicate entries for same linea_codigo

**Requirements**:
- Node 18+
- AWS credentials with `dynamodb:Scan` permission
- Environment variables:
  - `AWS_REGION` (default: us-east-2)
  - `TAXONOMY_TABLE` (default: finz_rubros_taxonomia)

**Usage**:
```bash
# Basic validation
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia \
  node scripts/validate-taxonomy-dynamo-full.cjs

# Output: tmp/taxonomy_report_full.json
```

**Output**: Creates `tmp/taxonomy_report_full.json` with detailed findings:
- `missingInDynamo`: Canonical IDs not in DynamoDB
- `extraInDynamo`: DynamoDB IDs not in canonical taxonomy
- `attributeMismatches`: Items with incorrect attributes
- `backendMissingFrontend`: Backend IDs missing from frontend
- `frontendMissingBackend`: Frontend IDs not used in backend

**Exit codes**:
- `0` = Validation completed successfully
- `2` = Validation failed (AWS error, file not found, etc.)

**Used in**: `.github/workflows/deploy-ui.yml` (CI validation gate)

---

### remediate-taxonomy-dynamo.cjs

**Purpose**: Interactive CLI tool to fix taxonomy mismatches identified by the validator.

**What it does**:
1. **P1 - Fix PK mismatches**: Copy→Put→Delete with backups
2. **P2 - Create missing IDs**: Put minimal items from canonical taxonomy
3. **P3 - Update attributes**: Fix descripcion, categoria, etc.
4. **P4 - List extras**: Log legacy/deprecated IDs for manual review

**Requirements**:
- Node 18+
- AWS credentials with DynamoDB read/write permissions:
  - `dynamodb:GetItem`
  - `dynamodb:PutItem`
  - `dynamodb:UpdateItem`
  - `dynamodb:DeleteItem`
- Valid report from `validate-taxonomy-dynamo-full.cjs`

**Usage**:
```bash
# Interactive remediation (prompts for each change)
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia \
  node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json

# The script will:
# 1. Display each issue with context
# 2. Prompt: "Fix this issue? (y/N)"
# 3. Create backup before modification
# 4. Apply approved change
# 5. Log action to tmp/remediation-log.json
```

**Safety Features**:
- ✅ Interactive approval for EVERY change
- ✅ Automatic backups to `tmp/backups/`
- ✅ Complete audit log in `tmp/remediation-log.json`
- ✅ Rollback capability (re-put backed-up items)

**Output Files**:
- `tmp/backups/backup_<pk>_<sk>.json` - Backup of each modified item
- `tmp/remediation-log.json` - Complete log of all actions

**Example Session**:
```
$ node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json

PK mismatches to consider (priority 1):
ID MOD-IN2 has pk mismatch: pk is "LINEA#MOD-EXT" but expected LINEA#MOD-IN2
Fix PK for MOD-IN2 (copy->put->delete)? (y/N): y
✅ Backup created: tmp/backups/backup_LINEA-MOD-EXT_CATEGORIA-MOD.json
✅ Created LINEA#MOD-IN2|CATEGORIA#MOD
✅ Deleted LINEA#MOD-EXT|CATEGORIA#MOD

Missing canonical IDs to create (priority 2): 3
Create minimal item for MOD-XYZ? (y/N): y
✅ Created LINEA#MOD-XYZ|CATEGORIA#MOD

Remediation finished; log written to tmp/remediation-log.json
```

**Rollback Procedure**:
```bash
# If you need to undo changes, restore from backups:
aws dynamodb put-item \
  --table-name finz_rubros_taxonomia \
  --item file://tmp/backups/backup_LINEA-MOD-EXT_CATEGORIA-MOD.json \
  --region us-east-2
```

---

## Documentation

For complete implementation details, see:
- `TAXONOMY_VALIDATION_IMPLEMENTATION_SUMMARY.md` - Full documentation
- `tmp/taxonomy_report_full.json.template` - Example report structure
- `tmp/taxonomy_remediation_plan.json.template` - Example remediation plan
- `tmp/summary.txt.template` - Example human-readable summary

