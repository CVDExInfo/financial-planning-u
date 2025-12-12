# Financial Planning & Service Delivery UI

Enterprise-grade UI for PMO Pre-Factura estimation and SDMT cost/forecasting. This SPA is built with React + Vite + Tailwind and hosted behind CloudFront at the path prefix `/finanzas/`.

The backend for this project lives under `services/finanzas-api` and is defined with AWS SAM. The OpenAPI contract is in `openapi/finanzas.yaml`.

## 🚀 Recent updates

- PM users now see only the baseline estimator and rubros/cost structure pages; forecast, reconciliation, and changes are hidden and blocked by route guards.
- The prefactura/baseline flow now captures a manual **Service Delivery Manager (Nombre)** and persists it through the API payloads and Dynamo metadata.

## 🔐 Authentication

This application uses **AWS Cognito** for authentication with support for:

- Direct username/password login (USER_PASSWORD_AUTH)
- Cognito Hosted UI (OAuth 2.0 implicit flow)
- Role-based access control using Cognito groups
- Token persistence across sessions
- Multi-role user support

**📖 Authentication Documentation:**
- **[Authentication Flow Overview](./AUTHENTICATION_FLOW.md)** - Comprehensive authentication architecture
- **[Auth Validation Guide](./docs/auth-validation.md)** - Step-by-step testing and troubleshooting

## ✅ Finanzas QA gate

Automated guardrails protect Finanzas authentication, CloudFront routing, and API wiring:

- Run locally: `npm run qa:finanzas:auth`
- CI workflow: `.github/workflows/finanzas-qa.yml` (runs on PRs touching Finanzas auth/infra/API files)
- Guardrail details: `docs/FINANZAS_QA_GUARDRAILS.md`
- Canonical callback source: `public/auth/callback.html` → served at `/finanzas/auth/callback.html` (avoid nested `/finanzas/finanzas/` paths)

Use this gate before merging to ensure Cognito defaults, callback routing, and CloudFront rewrites stay aligned. The guardrails are scoped to Finanzas and should not be used to modify acta-ui or prefacturas.

### Quick Start - Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local` with required variables:**
   ```bash
   # Cognito Configuration
   VITE_COGNITO_REGION=us-east-2
   VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
   VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
   VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com
   
   # API & CloudFront
   VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
   VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
   VITE_FINZ_ENABLED=true
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Test Hosted UI login:**
   - Navigate to `http://localhost:5173/finanzas/`
   - Click "Sign in with Cognito Hosted UI"
   - Use test credentials (see below)

### Development Credentials

For local development and testing:

- **Email**: `christian.valencia@ikusi.com`
- **Password**: `Velatia@2025`

### Required Environment Variables

```bash
# Cognito Configuration
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com

# API & CloudFront
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
VITE_FINZ_ENABLED=true
```

### Cognito Configuration Details

**User Pool:** `us-east-2_FyHLtOhiY`
**App Client ID (no secret):** `dshos5iou44tuach7ta3ici5m`
**Cognito Domain:** `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com` (⚠️ **Note**: NO hyphen after region)

**OAuth Flow:** Implicit flow (`responseType: 'token'`)

- **Redirect Sign In:** `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
- **Redirect Sign Out:** `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

**Auth Flows Enabled:**

- `ALLOW_USER_PASSWORD_AUTH` - Direct username/password login
- `ALLOW_REFRESH_TOKEN_AUTH` - Token refresh
- `ALLOW_USER_SRP_AUTH` - SRP authentication (optional)

### 3-Step Troubleshooting Guide

#### 1. **"Invalid username or password" error**

**Symptoms:** Login fails with "NotAuthorizedException" or "Invalid username or password"

**Check:**

```bash
# Verify user exists and is confirmed
aws cognito-idp admin-get-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username christian.valencia@ikusi.com \
  --region us-east-2

# Look for: UserStatus: CONFIRMED
```

**Fix:** If user status is `FORCE_CHANGE_PASSWORD` or not confirmed, reset password via AWS Console.

#### 2. **"Unexpected token '<'" or HTML response error**

**Symptoms:** Console shows JSON parse error or "Expected JSON, got text/html"

**Cause:** API returns HTML redirect or error page instead of JSON

**Check:**

```bash
# Test API directly
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
```

**Fix:**

- Ensure API Gateway authorizer is configured correctly
- Confirm `VITE_API_BASE_URL` points directly to the Finanzas API Gateway stage (no CloudFront proxy paths)
- Verify token is valid and not expired (check in DevTools → Application → Local Storage)

#### 3. **Hosted UI redirect fails or shows "redirect_uri_mismatch"**

**Symptoms:** After clicking "Sign in with Cognito Hosted UI", redirect fails or shows error

**Check:**

```bash
# Verify Cognito OAuth configuration
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-2_FyHLtOhiY \
  --client-id dshos5iou44tuach7ta3ici5m \
  --region us-east-2 \
  | jq '.UserPoolClient.CallbackURLs, .UserPoolClient.LogoutURLs'

# Should show:
# CallbackURLs: ["https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html"]
# LogoutURLs: ["https://d7t9x3j66yd8k.cloudfront.net/finanzas/"]
```

**Fix:** Update App Client callback URLs in AWS Console → Cognito → User Pools → App Integration → App clients.

### Quick Auth Setup (Local Development)

**The app now uses a unified Finanzas-styled login page for all modules.**

1. **Start the dev server:**

   ```bash
   npm ci && npm run dev
   ```

2. **Navigate to Finanzas login:**

   ```
   http://localhost:5173/finanzas/
   ```

3. **Two login options:**

   - **Direct login:** Enter credentials in the form (USER_PASSWORD_AUTH flow)
   - **Cognito Hosted UI:** Click "Sign in with Cognito Hosted UI" button (OAuth implicit flow)

4. **Verify tokens in localStorage:**

   - Open DevTools → Application → Local Storage
   - Should see: `cv.jwt` and `finz_jwt` (both methods store both keys)

5. **Deep link test:**

   - From FinanzasHome, click "Catálogo de Rubros"
   - URL should be `http://localhost:5173/finanzas/catalog/rubros`
   - Refresh page → should stay on same page (SPA routing works)

6. **Role-based redirect validation:**
   - SDT/FIN/AUD users → stay in `/finanzas/` after login
   - PMO-only users → redirect to `/` (if PMO app is deployed)
   - Dual-role users → preference stored in `cv.module` (default: Finanzas)

**Test Credentials:**

- Email: `christian.valencia@ikusi.com`
- Password: `Velatia@2025`

For detailed auth flow and troubleshooting, see [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md) and [Lane 1 Test Plan](./docs/LANE1_AUTH_UI_TEST_PLAN.md).

## Overview

- Frontend: React 19, Vite 6, Tailwind v4, GitHub Spark design system, Radix UI
- Routing base path: `/finanzas/` (Vite) and `/finanzas` (React Router)
- Hosting: S3 (private) + CloudFront, behavior path pattern `/finanzas/*`
- Auth & Roles (UI-level): PMO, SDMT, VENDOR, EXEC_RO (read-only)
- Data: Mock API in `src/lib/api.ts` for local development; real API contract under `openapi/finanzas.yaml`

## ⚠️ Required Configuration: VITE_API_BASE_URL

**The Finanzas frontend REQUIRES `VITE_API_BASE_URL` to be set.** Without this configuration:

- ❌ **Build will FAIL** for Finanzas target (`BUILD_TARGET=finanzas`)
- ❌ **API calls will fail** with clear error messages
- ❌ **Application will not function** correctly

Finanzas currently uses the **API dev stage as production**. Keep `VITE_API_BASE_URL` pointed at the dev stage for both dev and prod builds until a dedicated prod stage exists.

### 🚀 Quick Setup

#### For Local Development

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env.local
   ```

2. **The default configuration in `.env.development` points to the dev API:**

   ```bash
   VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   ```

3. **Override in `.env.local` if needed** (e.g., for local API development):

   ```bash
   # .env.local (git-ignored)
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

4. **Start the dev server:**
   ```bash
   npm ci
   npm run dev
   ```

#### For CI/CD and Production

Set `VITE_API_BASE_URL` as an environment variable at build time:

```bash
# GitHub Actions example (from .github/workflows/deploy-ui.yml)
env:
  VITE_API_BASE_URL: ${{ vars.DEV_API_URL }}

# Manual build example
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev \
  BUILD_TARGET=finanzas \
  npm run build
```

### 📋 Environment Configuration Files

| File               | Purpose                                | Git Tracked         |
| ------------------ | -------------------------------------- | ------------------- |
| `.env.example`     | Template with all variables documented | ✅ Yes              |
| `.env.development` | Default values for local development   | ✅ Yes              |
| `.env.local`       | Local overrides (your personal config) | ❌ No (git-ignored) |
| `.env.production`  | Production-specific defaults           | ✅ Yes              |

### 🔍 Troubleshooting

#### Error: "VITE_API_BASE_URL is not set for Finanzas build"

**Cause:** The `VITE_API_BASE_URL` environment variable is missing or empty during build.

**Fix:**

```bash
# Set the variable before building
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
npm run build:finanzas
```

#### Console Error: "VITE_API_BASE_URL is not configured"

**Cause:** The frontend bundle was built without the API base URL being injected.

**Fix:** Rebuild with `VITE_API_BASE_URL` set (see above).

#### API calls return HTML instead of JSON

**Symptoms:** Browser console shows errors like:

```
API returned HTML (likely login page or wrong endpoint) instead of JSON
```

**Possible Causes:**

1. Wrong `VITE_API_BASE_URL` value
2. API Gateway not deployed or misconfigured
3. CORS issues

**Fix:**

```bash
# Verify the API is accessible
curl https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# Should return JSON:
# {"ok":true,"stage":"dev","time":"2024-..."}
```

### 📖 Additional Configuration

The Finanzas frontend also uses these environment variables (Cognito uses the Hosted UI implicit flow with `response_type=token`):

- `VITE_COGNITO_*` - Cognito authentication (see Authentication section above)
- `VITE_AWS_REGION` - AWS region for API calls
- `VITE_CLOUDFRONT_URL` - CloudFront domain used to build default redirect URIs (`<CLOUDFRONT>/finanzas/auth/callback.html` and `<CLOUDFRONT>/finanzas/`)
- `VITE_FINZ_ENABLED` - Enable Finanzas module (default: true)
- `BUILD_TARGET` - Build target: `finanzas` or `pmo` (default: `finanzas`)

See `.env.example` for complete documentation of all variables.

## Prerequisites

- Node.js >= 18.18
- npm >= 9
- AWS CLI (for deploy)

## Quick start (dev)

```bash
npm ci
npm run dev
```

Vite will start a dev server (typically on <http://localhost:5173>). The app routes are rooted at `/finanzas`, so local dev URLs look like `http://localhost:5173/finanzas/`.

## Build

```bash
npm run build
```

Artifacts are emitted to `dist/` with the correct base URL baked in (`/finanzas/`). To preview the production build locally:

```bash
npm run preview
```

## 🔍 Validation & Verification

The project includes comprehensive validation scripts to ensure proper API connectivity and deployment health.

### Pre-Build Validation

Before building, validate that your API configuration is correct:

```bash
# Validate API configuration and connectivity
npm run validate:api-config

# Quick pre-build check (runs automatically during npm run build:finanzas)
npm run validate:pre-build
```

The `validate:api-config` script checks:

- ✅ `VITE_API_BASE_URL` is set and non-empty
- ✅ URL format is valid
- ✅ DNS resolution works for the API host
- ✅ API `/health` endpoint is reachable (HTTP 200)
- ✅ CORS configuration is present
- ✅ Critical endpoints like `/catalog/rubros` respond correctly

**Note:** The `build:finanzas` script now automatically runs `pre-build-validate.sh` to catch configuration issues before building.

### Post-Deployment Verification

After deploying to CloudFront + S3, verify the deployment:

```bash
# Set environment variables for your deployment
export CLOUDFRONT_DOMAIN=d7t9x3j66yd8k.cloudfront.net
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
export S3_BUCKET=ukusi-ui-finanzas-prod

# Run verification
bash scripts/post-deploy-verify.sh
```

The post-deployment script checks:

- ✅ CloudFront UI is accessible at `/finanzas/`
- ✅ Static assets (JS/CSS) load correctly with proper base paths
- ✅ API endpoints are reachable from the deployed frontend
- ✅ API URL is embedded in the frontend bundle
- ✅ S3 bucket contains expected files (optional)

### End-to-End Smoke Tests

Run comprehensive E2E tests against a deployed environment:

```bash
# Set credentials
export USERNAME="christian.valencia@ikusi.com"
export PASSWORD="Velatia@2025"

# Run smoke tests
npm run smoke:api
```

The smoke test validates:

- ✅ Cognito authentication (IdToken generation)
- ✅ Public endpoints (`/health`, `/catalog/rubros`)
- ✅ Protected endpoints (`/allocation-rules`) with auth
- ✅ Lambda → DynamoDB writes (creates test adjustment)
- ✅ DynamoDB persistence (verifies record exists)
- ✅ Audit log integration

### Continuous Integration

The GitHub Actions workflow (`.github/workflows/deploy-ui.yml`) automatically runs:

1. **Pre-Build Checks:**

   - Environment variable validation
   - API connectivity validation (`scripts/validate-api-config.sh`)
   - `/health` endpoint preflight check

2. **Build Validation:**

   - Verifies API URL is embedded in bundle
   - Checks for configuration bleed (no PMO config in Finanzas build)
   - Validates base path correctness

3. **Post-Deploy Verification:**
   - CloudFront accessibility test
   - API smoke tests (public endpoints)
   - Comprehensive deployment verification (`scripts/post-deploy-verify.sh`)

**Release Gate:** Deployments will **FAIL** if any validation step fails, preventing broken deployments from reaching production.

## Deploy (S3 + CloudFront)

This app is designed to be served at the CloudFront path prefix `/finanzas/`. You have two essential requirements:

1. CloudFront behavior configured for `/finanzas/*` that points to your S3 origin (with OAC)
2. Objects in S3 stored under the `finanzas/` key prefix (so `/finanzas/index.html` maps to `s3://<bucket>/finanzas/index.html`)

Recommended bucket and distribution are documented in `infra/README.md`:

- Bucket: `ukusi-ui-finanzas-prod` (private, versioned, encrypted)
- Distribution: `EPQU7PVDLQXUA` (example)

### One-time infra

Use Terraform in `infra/` to provision the S3 bucket, OAC, and cache policies. Then, in the CloudFront console, add:

- Origin: your S3 bucket (with OAC)
- Behavior: Path pattern `/finanzas/*`
- Custom error responses for SPA deep links:
  - 403 → `/finanzas/index.html`
  - 404 → `/finanzas/index.html`

See `infra/README.md` for step-by-step details.

### Upload and invalidate

After `npm run build`, upload the contents of `dist/` to the S3 prefix `finanzas/` and invalidate CloudFront:

```bash
# Upload to the finanzas/ prefix so keys match the CloudFront path
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete

# Invalidate the /finanzas/* path so clients get the latest bits
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*'
```

Tip: There’s a helper script to create the S3 bucket with recommended policies: `scripts/create-s3-bucket.sh`.

### Deployment Verification

Before merging deployment changes (especially PR #126), run the pre-merge verification script:

```bash
# Verify dev environment
./scripts/verify-pr126-checklist.sh --stage dev

# Verify prod environment
./scripts/verify-pr126-checklist.sh --stage prod
```

This script checks:

- Repository variables are configured correctly
- CloudFront function (`finanzas-path-rewrite`) is attached to all `/finanzas*` behaviors
- CloudFront origin has empty `OriginPath` (critical for correct S3 routing)
- S3 bucket structure is correct
- API endpoint is accessible
- Build artifacts do not contain PMO-specific files (e.g., `aws-exports.js`)

See [PR126_CHECKLIST.md](./PR126_CHECKLIST.md) for detailed requirements and troubleshooting.

## Pathing and SPA routing

The app is hard-configured for the `/finanzas` base path:

- `vite.config.ts` → `base: '/finanzas/'`
- `src/App.tsx` → `<BrowserRouter basename="/finanzas">`
- CloudFront behavior → `/finanzas/*`
- S3 keys → upload build to `finanzas/` prefix

This ensures deep links like `/finanzas/pmo/prefactura/estimator` work both locally and behind CloudFront. Make sure CloudFront custom error responses return `/finanzas/index.html` for 403/404 to support SPA routing.

## Roles and access (UI)

The UI simulates role-based access and permissions:

- Roles: `PMO`, `SDMT`, `VENDOR`, `EXEC_RO` (read-only)
- Role switcher: top bar → role badge dropdown (visible when multiple roles are available)
- Default landing routes:
  - PMO → `/finanzas/pmo/prefactura/estimator`
  - SDMT → `/finanzas/sdmt/cost/catalog`
  - VENDOR → `/finanzas/sdmt/cost/catalog`
  - EXEC_RO → `/finanzas/sdmt/cost/cashflow`

During local development, the app will use a demo user if Spark runtime isn’t present, and you can switch roles via the dropdown. For quick testing, navigate to `/profile` to view user info and roles.

## Backend API

- OpenAPI: `openapi/finanzas.yaml` (validated with Spectral; see `docs/endpoint-coverage.md`)
- SAM service: `services/finanzas-api/` with multiple Lambdas and DynamoDB tables
- Status: Core endpoints (health, catalog, projects, handoff) are implemented; others are stubbed for R1

The UI currently uses mock data in `src/lib/api.ts`. To integrate the live API, introduce an HTTP client (e.g., fetch or axios) with a configurable base URL and progressively replace `ApiService` methods.

## CI/CD & Quality Gates

This repository includes automated quality gates to ensure code quality and prevent regressions:

### For Developers

Before pushing changes, run:

```bash
# Build Finanzas with correct configuration
BUILD_TARGET=finanzas npm run build

# Run build guards to validate output
./scripts/build-guards-finanzas.sh

# Expected: ✅ All build guards passed!
```

**Quick Reference**: See `docs/QUICK_REFERENCE.md` for fast commands and troubleshooting.

### PR Workflow

Every PR to `main` automatically runs:

- ✅ Environment variables validation
- ✅ Finanzas UI build with production config
- ✅ Build guards (base path, dev URLs, asset integrity)
- ✅ Code quality checks (ESLint)
- ✅ API health check

**Status**: All checks must pass before merging.

### Build Guards

The `scripts/build-guards-finanzas.sh` script validates:

1. Build artifacts exist
2. Base path is `/finanzas/assets/` (not `/assets/`)
3. No hardcoded development URLs (github.dev, codespaces)
4. Environment variables are set
5. Asset files (JS/CSS) are present

### Documentation

- **Complete Guide**: `docs/WORKFLOW_SETUP.md` - CI/CD workflows, local testing, troubleshooting
- **Branch Protection**: `docs/BRANCH_PROTECTION_SETUP.md` - GitHub configuration for admins
- **Quick Reference**: `docs/QUICK_REFERENCE.md` - Fast commands and common fixes
- **Test Results**: `docs/CI_CD_TEST_RESULTS.md` - Validation evidence
- **Scripts**: `scripts/README.md` - All available scripts documented

### Workflows

- `.github/workflows/finanzas-pr-checks.yml` - PR quality gates (runs on PRs to main)
- `.github/workflows/test-api.yml` - API unit tests and SAM validation
- `.github/workflows/deploy-ui.yml` - Deployment with comprehensive guards
- `.github/workflows/smoke-only.yml` - Manual smoke testing

## Testing

### Behavioral Testing Protocol

The application uses a comprehensive behavioral testing protocol that validates API, CORS, RBAC, and UI behavior:

- **Behavioral API Tests** (blocking on PR):
  - `npm run test:behavioral` → Run health, CORS, RBAC, and schema tests
  - Tests authenticate with real Cognito users and validate live API behavior
  - No seeded data required - tests discover and validate real data shapes

- **Playwright UI Tests** (non-blocking, manual/nightly):
  - `npm run test:ui` → Run routing RBAC and data state validation tests
  - Validates role-based route visibility and access control
  - Tests empty-state handling and chart rendering

**📖 Testing Documentation:**
- **[Behavioral Testing Guide](./docs/BEHAVIORAL_TESTING.md)** - Complete testing protocol documentation
- **[Security: NO_GROUP Validation](./docs/BEHAVIORAL_TESTING.md#security-no_group-user-validation)** - Critical role leakage prevention

**Setup Test Users**:
```bash
# Create Cognito test users (requires AWS credentials)
./scripts/cognito/setup-test-users.sh
```

**Required Test Credentials** (environment variables):
```bash
# Configure for each role: PMO, SDMT, EXEC_RO, NO_GROUP
E2E_PMO_EMAIL=e2e-pmo-test@ikusi.com
E2E_PMO_PASSWORD=SecureTestPass2025!
E2E_SDMT_EMAIL=e2e-sdmt-test@ikusi.com
E2E_SDMT_PASSWORD=SecureTestPass2025!
E2E_EXEC_EMAIL=e2e-exec-test@ikusi.com
E2E_EXEC_PASSWORD=SecureTestPass2025!
E2E_NO_GROUP_EMAIL=e2e-nogroup-test@ikusi.com  # CRITICAL for security testing
E2E_NO_GROUP_PASSWORD=SecureTestPass2025!
```

**CI Workflows:**
- `.github/workflows/behavioral-api-tests.yml` - Runs on PR (blocking)
- `.github/workflows/ui-playwright.yml` - Manual/nightly UI tests
- `.github/workflows/api-contract-tests.yml` - Legacy Newman tests (seed step now non-blocking)

## Useful scripts

- `npm run dev` → start local dev server
- `npm run build` → production build (dist/)
- `npm run preview` → preview the built app
- `npm run lint` → lint the workspace
- `npm run test:behavioral` → **run behavioral API tests (health, CORS, RBAC, schema)**
- `npm run test:ui` → **run Playwright UI behavioral tests**
- `npm run test:unit` → run unit tests
- `npm run generate-docs-pdf` → generate PDF versions of all documentation files (legacy)
- `npm run render-docs` → generate bilingual PDF/DOCX documentation with corporate branding
- `scripts/build-guards-finanzas.sh` → **validate Finanzas build artifacts (CI/CD quality gate)**
- `scripts/finanzas-e2e-smoke.sh` → end-to-end smoke tests with Cognito
- `scripts/create-s3-bucket.sh` → create and configure the S3 bucket for hosting
- `scripts/deploy-check.sh` → CI-friendly build verification (lint/build). Adjust as needed.

## Troubleshooting

- Deep links return 404 via CloudFront
  - Ensure CloudFront custom error responses map 403/404 to `/finanzas/index.html`
- Assets 404 after deploy
  - Verify you uploaded to `s3://<bucket>/finanzas/` and not the bucket root
- Blank screen or wrong base URL locally
  - Confirm `vite.config.ts` base `/finanzas/` and router basename `/finanzas` are intact
- Permission denied screens
  - Switch roles using the top bar role dropdown; AccessControl will redirect to your role’s default route

## Repository map (quick)

- Frontend: `src/` (components, features, lib, mocks)
- Infra (UI hosting): `infra/` (Terraform + manual CF instructions)
- Backend (API): `services/finanzas-api/` (SAM template and handlers)
- OpenAPI: `openapi/finanzas.yaml`
- Docs: `docs/` (API coverage, environment, auth usage, SOPs, architecture)
- Documentation Pipeline: `scripts/docs/` (bilingual PDF/DOCX generator with corporate branding)
- Generated Docs: `public/docs/latest/` (bilingual PDF and DOCX files with index.html)
- Diagrams: `diagrams/` (Mermaid and Draw.io source files)
- Branding Assets: `assets/` (logos, templates, styles for documentation)
- PDF Docs (Legacy): `docs-pdf/` (PDF versions generated via `npm run generate-docs-pdf`)
- Architecture: See `docs/tree.structure.md` for detailed repository structure and architecture decisions

---

Questions or issues? Start with `docs/tree.structure.md` for architecture overview, `infra/README.md` for hosting details, `docs/endpoint-coverage.md` for API validation, or open an issue in this repo.
