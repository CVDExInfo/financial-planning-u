# Finanzas CI/CD Quick Reference

Quick commands and checks for developers working on the Finanzas module.

## Before Pushing Changes

### 1. Build Finanzas Correctly
```bash
# Set environment
export VITE_API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
export VITE_FINZ_ENABLED="true"
export VITE_PUBLIC_BASE="/finanzas/"

# Build
BUILD_TARGET=finanzas npm run build
```

### 2. Run Build Guards
```bash
./scripts/build-guards-finanzas.sh
```

Expected: `✅ All build guards passed!`

### 3. Run Linter
```bash
npm run lint
```

### 4. Test Locally (Optional)
```bash
# Preview the build
BUILD_TARGET=finanzas npm run preview
# Visit http://localhost:4173/finanzas/
```

## Common Issues & Fixes

### ❌ "index.html uses incorrect /assets/* paths"
**Fix**:
```bash
# Ensure BUILD_TARGET is set
BUILD_TARGET=finanzas npm run build
```

### ❌ "Development URLs found in build"
**Fix**: Remove hardcoded URLs from source code
```typescript
// ❌ Bad
const API_URL = "https://myapp.github.dev/api"

// ✅ Good
const API_URL = import.meta.env.VITE_API_BASE_URL
```

### ❌ "Environment variables missing"
**Fix**: Export required variables
```bash
export VITE_API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
export VITE_FINZ_ENABLED="true"
```

## PR Checklist

Before requesting review:
- [ ] Built with `BUILD_TARGET=finanzas`
- [ ] Build guards pass (`./scripts/build-guards-finanzas.sh`)
- [ ] No linting errors (warnings OK)
- [ ] PR checks are green in GitHub
- [ ] No hardcoded dev URLs in code
- [ ] Environment variables used correctly

## CI/CD Workflows

### Finanzas PR Quality Gates
- **Triggers**: PRs to `main`
- **File**: `.github/workflows/finanzas-pr-checks.yml`
- **Checks**: Env vars, build, guards, lint, API health
- **Status**: Must pass to merge

### API Tests
- **Triggers**: PRs to `main`
- **File**: `.github/workflows/test-api.yml`
- **Tests**: Unit tests, SAM build, local smoke
- **Status**: Must pass to merge

## Key Commands

```bash
# Install dependencies
npm ci

# Build Finanzas
BUILD_TARGET=finanzas npm run build

# Run build guards
./scripts/build-guards-finanzas.sh

# Lint code
npm run lint

# Preview build
BUILD_TARGET=finanzas npm run preview

# Run E2E tests (requires credentials)
export USERNAME="..." PASSWORD="..."
./scripts/finanzas-e2e-smoke.sh

# Check build output
ls -la dist-finanzas/
grep -E "src=|href=" dist-finanzas/index.html
```

## Required Environment Variables

| Variable | Value | Used For |
|----------|-------|----------|
| `VITE_API_BASE_URL` | API endpoint URL | API communication |
| `VITE_FINZ_ENABLED` | `"true"` | Enable Finanzas module |
| `VITE_PUBLIC_BASE` | `"/finanzas/"` | Base path for routing |
| `BUILD_TARGET` | `"finanzas"` | Vite build target |

## Build Output Validation

After building, verify:
```bash
# Check index.html has correct paths
grep -E 'src="/finanzas/assets/' dist-finanzas/index.html
# Should show 1+ matches

# Check no incorrect paths
grep -E 'src="/assets/' dist-finanzas/index.html
# Should show nothing

# Check no dev URLs
grep -r "github.dev\|codespaces" dist-finanzas/
# Should show nothing
```

## When PR Checks Fail

1. **Check the workflow logs** in GitHub Actions
2. **Look for the specific guard that failed**
3. **Fix the issue locally**
4. **Re-run guards**: `./scripts/build-guards-finanzas.sh`
5. **Push the fix**
6. **Checks will re-run automatically**

## Getting Help

- **Workflows**: See `docs/WORKFLOW_SETUP.md`
- **Branch Protection**: See `docs/BRANCH_PROTECTION_SETUP.md`
- **Test Results**: See `docs/CI_CD_TEST_RESULTS.md`
- **Scripts**: See `scripts/README.md`
- **Troubleshooting**: See "Troubleshooting" section in `docs/WORKFLOW_SETUP.md`

## API Endpoints (Dev)

```bash
BASE="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"

# Public
curl "$BASE/health"

# Protected (requires JWT)
curl -H "Authorization: Bearer $TOKEN" "$BASE/catalog/rubros"
curl -H "Authorization: Bearer $TOKEN" "$BASE/allocation-rules"
```

## Repository Settings (Admin Only)

**Branch Protection** on `main`:
- ✅ Required checks: `finanzas-quality-gates`, `unit-and-local`
- ✅ Required reviews: 1+ approval
- ✅ Conversation resolution required
- ✅ No force pushes
- ✅ No direct pushes (use PRs)

See `docs/BRANCH_PROTECTION_SETUP.md` for setup instructions.

---

**Quick Tip**: Bookmark this file for fast reference!
