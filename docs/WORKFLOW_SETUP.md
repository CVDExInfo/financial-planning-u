# CI/CD Workflow Setup & Quality Gates

## Overview

This document describes the CI/CD workflows, quality gates, and guardrails implemented for the Finanzas module to ensure code quality, prevent regressions, and maintain deployment integrity.

## Table of Contents

- [Workflows](#workflows)
  - [Finanzas PR Quality Gates](#finanzas-pr-quality-gates)
  - [Deploy UI](#deploy-ui)
  - [Test API](#test-api)
  - [Smoke Tests](#smoke-tests)
- [Quality Gates](#quality-gates)
- [Build Guards](#build-guards)
- [Branch Protection](#branch-protection)
- [Local Testing](#local-testing)
- [Troubleshooting](#troubleshooting)

## Workflows

### Finanzas PR Quality Gates

**File**: `.github/workflows/finanzas-pr-checks.yml`

**Purpose**: Automated quality gates that run on every pull request to validate Finanzas changes before merging.

**Triggers**:
- Pull requests to `main` branch
- Manual dispatch

**Quality Gates Performed**:

1. **Environment Variables Validation**
   - Validates required environment variables are set
   - Checks correct values for `VITE_PUBLIC_BASE`, `VITE_FINZ_ENABLED`
   - Ensures API endpoint is configured

2. **Finanzas UI Build**
   - Builds the Finanzas UI with production configuration
   - Uses `BUILD_TARGET=finanzas` for proper base path
   - Validates build completes without errors

3. **Build Artifact Validation** (Critical Guards)
   - **Base Path Verification**: Ensures all assets use `/finanzas/assets/` prefix
   - **Hardcoded URL Detection**: Checks for github.dev, codespaces, localhost references
   - **Asset Integrity**: Verifies JavaScript and CSS files are present
   - Uses `scripts/build-guards-finanzas.sh` for comprehensive checks

4. **Code Quality (ESLint)**
   - Runs ESLint on the codebase (non-blocking)
   - Reports warnings and errors

5. **API Health Check**
   - Tests API endpoint connectivity (non-blocking)
   - Validates `/health` endpoint responds

**Required Variables**:
- `VITE_API_BASE_URL` (default: dev endpoint)
- `VITE_FINZ_ENABLED` (set to "true")
- `VITE_PUBLIC_BASE` (set to "/finanzas/")

**Status**: ✅ Required for PR merge (configure in branch protection)

---

### Deploy UI

**File**: `.github/workflows/deploy-ui.yml`

**Purpose**: Deploys both PMO and Finanzas portals to S3/CloudFront.

**Triggers**:
- Push to `main` branch
- Push to development branches
- Manual dispatch

**Key Features**:
- Builds both PMO (base: `/`) and Finanzas (base: `/finanzas/`)
- Includes comprehensive build guards (lines 162-189)
- Validates CloudFront configuration
- Performs UI and API smoke tests
- Runs Newman API tests

**Build Guards Included**:
1. Base path verification for `/finanzas/assets/`
2. Development URL detection (github.dev, codespaces)
3. CloudFront behavior validation
4. S3 bucket and CloudFront distribution checks

**Required Secrets**:
- `OIDC_AWS_ROLE_ARN`

**Required Variables**:
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DIST_ID`
- `DEV_API_URL` (optional, uses defaults)
- `AWS_REGION` (default: us-east-2)

---

### Test API

**File**: `.github/workflows/test-api.yml`

**Purpose**: Tests Finanzas API on pull requests.

**Triggers**:
- Pull requests to `main` branch
- Manual dispatch

**Tests Performed**:
- Unit tests (`npm test`)
- SAM build validation
- SAM local API smoke tests:
  - `GET /health` (200 OK)
  - `GET /catalog/rubros` (200 OK)
  - `GET /allocation-rules` (200 OK with local auth bypass)

**Status**: ✅ Required for PR merge

---

### Smoke Tests

**File**: `.github/workflows/smoke-only.yml`

**Purpose**: Run smoke tests against deployed environment without deployment.

**Triggers**:
- Manual dispatch (select dev or prod)

**Tests**:
- API health check
- Protected endpoints with Cognito authentication
- UI accessibility check
- DynamoDB verification

**Uses**:
- `scripts/finanzas-e2e-smoke.sh` for comprehensive E2E testing

---

## Quality Gates

### Critical Quality Gates (Must Pass)

1. **Environment Configuration**
   - All required environment variables must be set
   - Values must match expected patterns
   - API endpoint must be valid

2. **Build Success**
   - TypeScript compilation must succeed
   - Vite build must complete without errors
   - No missing dependencies

3. **Base Path Integrity**
   - All assets must use `/finanzas/assets/` prefix
   - No assets can use root `/assets/` path
   - Validates correct Vite configuration

4. **Development URL Detection**
   - No `github.dev` URLs
   - No `codespaces` references
   - No `githubusercontent.com` links
   - No `localhost` or `127.0.0.1` references

5. **Asset Integrity**
   - JavaScript bundle(s) present in `dist-finanzas/assets/`
   - CSS stylesheet(s) present in `dist-finanzas/assets/`
   - `index.html` exists and is valid

### Non-Critical Quality Gates (Advisory)

1. **Code Quality (ESLint)**
   - Reports warnings and errors
   - Does not block PR merge
   - Should be addressed for code quality

2. **API Connectivity**
   - Tests if API is reachable
   - Non-blocking (API might be down temporarily)
   - Good indicator of environment health

---

## Build Guards

### Build Guards Script

**File**: `scripts/build-guards-finanzas.sh`

**Purpose**: Standalone script to validate Finanzas build artifacts. Can be run locally or in CI.

**Usage**:
```bash
# With environment validation
./scripts/build-guards-finanzas.sh

# Skip environment validation (useful in CI)
./scripts/build-guards-finanzas.sh --skip-env-check
```

**Guards Performed**:

1. **Build Artifacts Existence**
   - Checks `dist-finanzas/` directory exists
   - Verifies `index.html` is present

2. **Base Path Verification**
   - Detects incorrect `/assets/*` paths (should be `/finanzas/assets/*`)
   - Validates correct `/finanzas/assets/*` paths exist
   - Reports asset reference count

3. **Development URL Detection**
   - Scans for: `github.dev`, `codespaces`, `githubusercontent.com`
   - Scans for: `localhost:3000`, `127.0.0.1`
   - Shows matches with file locations

4. **Environment Variables Validation** (optional)
   - Checks `VITE_API_BASE_URL`
   - Checks `VITE_FINZ_ENABLED`
   - Can be skipped with `--skip-env-check`

5. **Asset File Integrity**
   - Counts JavaScript files in assets
   - Counts CSS files in assets
   - Fails if no assets found

**Exit Codes**:
- `0` - All checks passed
- `1` - One or more checks failed

---

## Branch Protection

### Required Configuration

To enforce quality gates, configure branch protection rules for the `main` branch:

#### Required Status Checks

Navigate to: **Repository Settings → Branches → Branch protection rules → main**

Enable and configure:
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required checks:
    - `finanzas-quality-gates` (from finanzas-pr-checks.yml)
    - `unit-and-local` (from test-api.yml) 
    - Any other critical workflows

#### Required Reviews

- ✅ **Require pull request reviews before merging**
  - Required approving reviews: **1** (minimum)
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners (optional)

#### Additional Settings (Recommended)

- ✅ **Require conversation resolution before merging**
- ✅ **Do not allow bypassing the above settings**
- ✅ **Restrict who can push to matching branches** (admins only)

### Why Branch Protection Matters

Branch protection ensures:
1. No code reaches `main` without passing all tests
2. Build guards automatically catch configuration errors
3. Peer review provides human validation
4. Quality gates prevent deployment regressions

**⚠️ Important**: These settings must be configured by a repository administrator through the GitHub web interface.

---

## Local Testing

### Prerequisites

```bash
# Required tools
node --version  # v20 or higher
npm --version   # v10 or higher
aws --version   # AWS CLI v2

# Optional (for API testing)
sam --version   # SAM CLI
```

### Running Finanzas Build Locally

```bash
# 1. Set environment variables
export VITE_API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
export VITE_FINZ_ENABLED="true"
export VITE_PUBLIC_BASE="/finanzas/"

# 2. Install dependencies
npm ci

# 3. Build Finanzas
BUILD_TARGET=finanzas npm run build

# 4. Run build guards
./scripts/build-guards-finanzas.sh

# Expected output: ✅ All build guards passed!
```

### Running Quality Gates Locally

To simulate the PR checks workflow:

```bash
#!/bin/bash
# Save as: test-pr-locally.sh

set -e

echo "🔍 Simulating PR Quality Gates..."

# Environment setup
export VITE_API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
export VITE_FINZ_ENABLED="true"
export VITE_PUBLIC_BASE="/finanzas/"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build
echo "🔨 Building Finanzas..."
BUILD_TARGET=finanzas npm run build

# Run guards
echo "🛡️ Running build guards..."
./scripts/build-guards-finanzas.sh

# Lint (optional)
echo "🔍 Running linter..."
npm run lint || echo "⚠️ Linting issues found (non-blocking)"

# API health check (optional)
echo "🏥 Checking API health..."
curl -sS -f "${VITE_API_BASE_URL}/health" | jq . || echo "⚠️ API not reachable"

echo ""
echo "✅ All local quality gates passed!"
```

### Testing API Locally

```bash
# 1. Navigate to API directory
cd services/finanzas-api

# 2. Install dependencies
npm ci

# 3. Run unit tests
npm test

# 4. Build with SAM
sam build

# 5. Start local API
export SKIP_AUTH=true
sam local start-api --warm-containers EAGER

# 6. Test endpoints (in another terminal)
curl http://127.0.0.1:3000/health | jq .
curl http://127.0.0.1:3000/catalog/rubros | jq .
curl http://127.0.0.1:3000/allocation-rules | jq .
```

### Testing E2E Flow

```bash
# Set credentials
export USERNAME="your-cognito-username"
export PASSWORD="your-cognito-password"

# Run E2E smoke tests
./scripts/finanzas-e2e-smoke.sh
```

---

## Troubleshooting

### Common Issues

#### 1. Base Path Verification Fails

**Error**: `❌ FAILED: index.html uses incorrect /assets/* paths`

**Cause**: Vite base path not set correctly

**Fix**:
```bash
# Check vite.config.ts
# Ensure: base: isPmo ? "/" : "/finanzas/"

# Rebuild with correct target
BUILD_TARGET=finanzas npm run build

# Verify
grep -E 'src=|href=' dist-finanzas/index.html
# Should show: /finanzas/assets/...
```

#### 2. Development URLs Found

**Error**: `❌ FAILED: Development URLs found in build`

**Cause**: Source code contains hardcoded dev URLs

**Fix**:
```bash
# Find the references
grep -r "github.dev" src/
grep -r "codespaces" src/

# Replace with environment variables
# Use: import.meta.env.VITE_API_BASE_URL
# Not: "https://myapp.github.dev/..."
```

#### 3. Environment Variables Missing

**Error**: `❌ VITE_API_BASE_URL is not set`

**Cause**: Environment variables not exported

**Fix**:
```bash
# Create .env file (don't commit!)
cat > .env << EOF
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_FINZ_ENABLED=true
VITE_PUBLIC_BASE=/finanzas/
EOF

# Or export in shell
export VITE_API_BASE_URL="..."
export VITE_FINZ_ENABLED="true"
```

#### 4. npm ci Fails

**Error**: `npm ci failed (likely lock mismatch)`

**Cause**: `package-lock.json` out of sync

**Fix**:
```bash
# Fallback to npm install
npm install

# Or regenerate lock file
rm package-lock.json
npm install
```

#### 5. Build Guards Script Permission Denied

**Error**: `Permission denied: ./scripts/build-guards-finanzas.sh`

**Cause**: Script not executable

**Fix**:
```bash
chmod +x ./scripts/build-guards-finanzas.sh
```

#### 6. PR Checks Fail but Local Tests Pass

**Possible Causes**:
- CI environment variables differ from local
- Cache issues in CI
- Different Node.js version

**Fix**:
```bash
# Check Node version matches
node --version  # Should be v20

# Clear local cache
rm -rf node_modules dist-finanzas
npm ci
BUILD_TARGET=finanzas npm run build

# Re-run guards
./scripts/build-guards-finanzas.sh
```

---

## CI/CD Best Practices

### For Developers

1. **Always run build guards locally** before pushing
   ```bash
   ./scripts/build-guards-finanzas.sh
   ```

2. **Test builds with both targets**
   ```bash
   BUILD_TARGET=pmo npm run build
   BUILD_TARGET=finanzas npm run build
   ```

3. **Never commit**:
   - Development URLs (github.dev, codespaces)
   - Hardcoded localhost references
   - Credentials or secrets
   - Build artifacts (`dist-*` folders)

4. **Always use environment variables** for configuration
   ```typescript
   // ✅ Good
   const apiUrl = import.meta.env.VITE_API_BASE_URL;
   
   // ❌ Bad
   const apiUrl = "https://myapp.github.dev/api";
   ```

5. **Review PR checks** before requesting review
   - All status checks should be green
   - Review build guard output
   - Fix any linting issues

### For Reviewers

1. **Verify PR checks pass**
   - Look for green checkmarks on all required checks
   - Review build guard output in "Guard: Build Artifact Validation" step

2. **Check for**:
   - Proper environment variable usage
   - No hardcoded URLs or credentials
   - Build configuration changes are intentional

3. **Test locally if needed**:
   ```bash
   git fetch origin pull/123/head:pr-123
   git checkout pr-123
   BUILD_TARGET=finanzas npm run build
   ./scripts/build-guards-finanzas.sh
   ```

---

## API Endpoints Reference

### Development Environment

**Base URL**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`

| Endpoint | Method | Auth | Description | Expected Response |
|----------|--------|------|-------------|-------------------|
| `/health` | GET | Public | Health check | 200 OK with status |
| `/catalog/rubros` | GET | Public/JWT | Budget categories | 200 OK with 71 items |
| `/allocation-rules` | GET | JWT Required | Allocation rules | 200 OK with rules data |
| `/projects` | GET | JWT Required | List projects | 200 OK with projects |
| `/projects` | POST | JWT Required | Create project | 201 Created |

### Production Environment

**Base URL**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod`

Same endpoints as dev environment.

### Cognito Configuration

- **User Pool**: `us-east-2_FyHLtOhiY`
- **App Client**: `dshos5iou44tuach7ta3ici5m`
- **Region**: `us-east-2`

---

## Summary

This CI/CD setup provides:

✅ **Automated Quality Gates** - Every PR is validated before merge
✅ **Build Guards** - Catches configuration errors automatically  
✅ **Environment Validation** - Ensures correct variables are set
✅ **Development URL Detection** - Prevents dev URLs in production
✅ **Base Path Verification** - Validates `/finanzas/` routing
✅ **Asset Integrity** - Confirms build artifacts are present
✅ **API Testing** - Validates backend connectivity
✅ **Local Testing Tools** - Same checks locally as in CI

**Result**: Confident deployments with minimal risk of regressions.

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vite Configuration](https://vitejs.dev/config/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference.html)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

**Last Updated**: 2025-11-10
**Maintained By**: Development Team
**Questions**: See troubleshooting section or contact team lead
