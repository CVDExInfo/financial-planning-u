# Validation Testing Guide

This document provides step-by-step instructions for testing the API connectivity validation infrastructure.

## Prerequisites

- Node.js >= 18.18
- npm >= 9
- bash shell
- curl (optional, for network tests)

## Test Suite

### Test 1: Pre-Build Validation - Success Case

**Purpose:** Verify that pre-build validation passes when VITE_API_BASE_URL is properly set.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export BUILD_TARGET=finanzas
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
npm run validate:pre-build
```

**Expected Result:**
```
✅ VITE_API_BASE_URL is set: https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
✅ Pre-build validation passed
Exit code: 0
```

---

### Test 2: Pre-Build Validation - Failure Case

**Purpose:** Verify that pre-build validation fails when VITE_API_BASE_URL is not set.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export BUILD_TARGET=finanzas
unset VITE_API_BASE_URL
npm run validate:pre-build
```

**Expected Result:**
```
❌ CRITICAL: VITE_API_BASE_URL is not set

This environment variable is REQUIRED for Finanzas builds.
Without it, the frontend will not be able to connect to the API.

Exit code: 1
```

---

### Test 3: API Configuration Validation - With Connectivity Skip

**Purpose:** Verify API configuration validation works in offline mode.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
export SKIP_CONNECTIVITY_CHECK=true
npm run validate:api-config
```

**Expected Result:**
```
✅ VITE_API_BASE_URL is set
✅ API configuration is valid
⚠️  Skipping connectivity checks
Exit code: 0 (warnings are OK)
```

---

### Test 4: API Configuration Validation - URL Format Validation

**Purpose:** Verify that invalid URL formats are rejected.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export VITE_API_BASE_URL="not-a-valid-url"
export SKIP_CONNECTIVITY_CHECK=true
npm run validate:api-config
```

**Expected Result:**
```
❌ CRITICAL: VITE_API_BASE_URL has invalid format
   Got: 'not-a-valid-url'
   Expected: https://... or http://...
Exit code: 1
```

---

### Test 5: Build Integration - Finanzas Build Success

**Purpose:** Verify that Finanzas build runs pre-build validation automatically.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# This should run pre-build validation automatically
npm run build:finanzas 2>&1 | head -20
```

**Expected Result:**
```
> bash scripts/pre-build-validate.sh

🔍 Pre-Build Validation (BUILD_TARGET=finanzas)
✅ VITE_API_BASE_URL is set: ...
✅ Pre-build validation passed

[Vite] Configuring for FINANZAS (BUILD_TARGET=finanzas)
[Vite][Finanzas] ✅ VITE_API_BASE_URL: ...
```

---

### Test 6: Build Integration - Build Failure

**Purpose:** Verify that build fails when VITE_API_BASE_URL is not set.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
unset VITE_API_BASE_URL
npm run build:finanzas 2>&1 | grep -A 10 "CRITICAL"
```

**Expected Result:**
```
❌ CRITICAL: VITE_API_BASE_URL is not set
Exit code: 1 (build should fail)
```

---

### Test 7: PMO Build - No Validation Required

**Purpose:** Verify that PMO builds don't require VITE_API_BASE_URL.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export BUILD_TARGET=pmo
unset VITE_API_BASE_URL
npm run validate:pre-build
```

**Expected Result:**
```
ℹ️  PMO build detected - skipping Finanzas-specific checks
Exit code: 0
```

---

### Test 8: Enhanced Error Messages - Vite Config

**Purpose:** Verify that vite.config.ts shows enhanced error messages.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
unset VITE_API_BASE_URL
export BUILD_TARGET=finanzas

# Try to run vite build directly (bypassing npm scripts)
npx vite build 2>&1 | grep -A 15 "CRITICAL BUILD ERROR"
```

**Expected Result:**
```
╔════════════════════════════════════════════════════════════════╗
║  ❌ CRITICAL BUILD ERROR: VITE_API_BASE_URL not set           ║
╚════════════════════════════════════════════════════════════════╝

The Finanzas frontend REQUIRES VITE_API_BASE_URL to function.
Without this configuration:
  ❌ API calls will fail with 'Failed to fetch' errors
  ❌ Application will not load any data
  ❌ Users will see empty grids and visualizations

🔧 To fix this:
  ...
```

---

### Test 9: Post-Deployment Verification - Simulated Success

**Purpose:** Test post-deployment verification script (with mocked environment).

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export CLOUDFRONT_DOMAIN=d7t9x3j66yd8k.cloudfront.net
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# Note: This will likely fail in a sandboxed environment without network access
# But we can test that the script runs and checks the right things
bash scripts/post-deploy-verify.sh 2>&1 | head -30
```

**Expected Result:**
```
╔════════════════════════════════════════════════════════════════╗
║            Post-Deployment Verification                        ║
╚════════════════════════════════════════════════════════════════╝

📍 Section 1: CloudFront UI Accessibility
Testing: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
...
```

---

### Test 10: Script Permissions

**Purpose:** Verify all scripts are executable.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
ls -la scripts/*.sh | grep -E "(validate-api-config|pre-build-validate|post-deploy-verify)"
```

**Expected Result:**
```
-rwxr-xr-x ... scripts/post-deploy-verify.sh
-rwxr-xr-x ... scripts/pre-build-validate.sh
-rwxr-xr-x ... scripts/validate-api-config.sh
```

All scripts should have execute permissions (x flag).

---

## Integration Tests

### Test 11: GitHub Actions Workflow Syntax

**Purpose:** Verify the deploy-ui.yml workflow has valid syntax.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u

# Check for common YAML syntax errors
cat .github/workflows/deploy-ui.yml | grep -E "^[[:space:]]+- name:" | wc -l
```

**Expected Result:**
Should show a count of step names (around 20+). No YAML parsing errors.

---

### Test 12: Package.json Scripts Validation

**Purpose:** Verify all npm scripts are properly defined.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u

# Check that our new scripts are defined
npm run | grep -E "(validate:api-config|validate:pre-build|smoke:api)"
```

**Expected Result:**
```
validate:api-config
  bash scripts/validate-api-config.sh
validate:pre-build
  bash scripts/pre-build-validate.sh
smoke:api
  bash scripts/finanzas-e2e-smoke.sh
```

---

## Documentation Tests

### Test 13: README Documentation

**Purpose:** Verify README contains validation documentation.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u

# Check for validation section
grep -n "Validation & Verification" README.md
grep -n "validate:api-config" README.md
```

**Expected Result:**
Should find references to the validation section and npm scripts.

---

### Test 14: API Connectivity Validation Guide

**Purpose:** Verify comprehensive guide exists and is complete.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u

# Check file exists and has content
[ -f API_CONNECTIVITY_VALIDATION.md ] && echo "✅ Guide exists"
wc -l API_CONNECTIVITY_VALIDATION.md
```

**Expected Result:**
```
✅ Guide exists
600+ API_CONNECTIVITY_VALIDATION.md
```

---

## Regression Tests

### Test 15: Existing Functionality Preserved

**Purpose:** Verify that existing builds still work when properly configured.

**Steps:**
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# Install dependencies
npm ci

# Run linter (should pass)
npm run lint

# Try to build (with TypeScript errors ignored)
npm run build:finanzas 2>&1 | grep -E "(Built|dist-finanzas)"
```

**Expected Result:**
Build completes successfully with output indicating `dist-finanzas/` directory created.

---

## Test Results Template

Copy this template to record your test results:

```markdown
# Validation Infrastructure Test Results

**Tester:** [Your Name]
**Date:** [Date]
**Environment:** [Local/CI/CD]

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Pre-Build Validation Success | ⬜ Pass / ⬜ Fail | |
| 2 | Pre-Build Validation Failure | ⬜ Pass / ⬜ Fail | |
| 3 | API Config Validation Offline | ⬜ Pass / ⬜ Fail | |
| 4 | API Config URL Format | ⬜ Pass / ⬜ Fail | |
| 5 | Build Integration Success | ⬜ Pass / ⬜ Fail | |
| 6 | Build Integration Failure | ⬜ Pass / ⬜ Fail | |
| 7 | PMO Build No Validation | ⬜ Pass / ⬜ Fail | |
| 8 | Enhanced Error Messages | ⬜ Pass / ⬜ Fail | |
| 9 | Post-Deploy Verification | ⬜ Pass / ⬜ Fail | |
| 10 | Script Permissions | ⬜ Pass / ⬜ Fail | |
| 11 | Workflow Syntax | ⬜ Pass / ⬜ Fail | |
| 12 | Package.json Scripts | ⬜ Pass / ⬜ Fail | |
| 13 | README Documentation | ⬜ Pass / ⬜ Fail | |
| 14 | API Guide Exists | ⬜ Pass / ⬜ Fail | |
| 15 | Existing Functionality | ⬜ Pass / ⬜ Fail | |

**Overall Status:** ⬜ All Tests Pass / ⬜ Some Tests Failed

**Issues Found:**
- [List any issues]

**Recommendations:**
- [List any recommendations]
```

---

## Automated Test Script

For convenience, here's a script that runs the basic validation tests:

```bash
#!/bin/bash
# test-validation-infrastructure.sh

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Validation Infrastructure Test Suite                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0

test_case() {
  local name="$1"
  local cmd="$2"
  
  echo "Testing: $name"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  ✅ PASS"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ FAIL"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

cd /home/runner/work/financial-planning-u/financial-planning-u

# Test 1: Scripts are executable
test_case "Scripts are executable" \
  "[ -x scripts/validate-api-config.sh ] && [ -x scripts/pre-build-validate.sh ] && [ -x scripts/post-deploy-verify.sh ]"

# Test 2: Pre-build validation succeeds with valid config
test_case "Pre-build validation (success)" \
  "export BUILD_TARGET=finanzas VITE_API_BASE_URL=https://test.com/dev && bash scripts/pre-build-validate.sh"

# Test 3: Pre-build validation fails without config
test_case "Pre-build validation (failure)" \
  "export BUILD_TARGET=finanzas && unset VITE_API_BASE_URL && ! bash scripts/pre-build-validate.sh"

# Test 4: NPM scripts are defined
test_case "NPM scripts defined" \
  "npm run 2>&1 | grep -q validate:api-config"

# Test 5: Documentation exists
test_case "Documentation exists" \
  "[ -f API_CONNECTIVITY_VALIDATION.md ] && [ -s API_CONNECTIVITY_VALIDATION.md ]"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Test Summary                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi
```

Save this as `scripts/test-validation-infrastructure.sh` and make it executable to run all basic tests.
