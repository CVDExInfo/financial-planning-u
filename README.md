# Financial Planning & Service Delivery UI

Enterprise-grade UI for PMO Pre-Factura estimation and SDMT cost/forecasting. This SPA is built with React + Vite + Tailwind and hosted behind CloudFront at the path prefix `/finanzas/`.

The backend for this project lives under `services/finanzas-api` and is defined with AWS SAM. The OpenAPI contract is in `openapi/finanzas.yaml`.

## 🔐 Authentication

This application uses **AWS Cognito** for authentication with support for:

- Direct username/password login (USER_PASSWORD_AUTH)
- Cognito Hosted UI (OAuth 2.0 implicit flow)
- Role-based access control using Cognito groups
- Token persistence across sessions
- Multi-role user support

**📖 For complete authentication documentation, see [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md)**

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
VITE_COGNITO_DOMAIN=us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com

# API & CloudFront
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_FINZ_ENABLED=true
```

### Cognito Configuration Details

**User Pool:** `us-east-2_FyHLtOhiY`
**App Client ID (no secret):** `dshos5iou44tuach7ta3ici5m`
**Cognito Domain:** `us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com`

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
- Check CloudFront behavior for `/finanzas/api/*` if using proxy mode
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

## Useful scripts

- `npm run dev` → start local dev server
- `npm run build` → production build (dist/)
- `npm run preview` → preview the built app
- `npm run lint` → lint the workspace
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
