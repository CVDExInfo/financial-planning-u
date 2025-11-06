# Financial Planning & Service Delivery UI

Enterprise-grade UI for PMO Pre-Factura estimation and SDMT cost/forecasting. This SPA is built with React + Vite + Tailwind and hosted behind CloudFront at the path prefix `/finanzas/`.

The backend for this project lives under `services/finanzas-api` and is defined with AWS SAM. The OpenAPI contract is in `openapi/finanzas.yaml`.

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

## Useful scripts

- `npm run dev` → start local dev server
- `npm run build` → production build (dist/)
- `npm run preview` → preview the built app
- `npm run lint` → lint the workspace
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
- Docs: `docs/` (API coverage, environment, auth usage)

---

Questions or issues? Start with `infra/README.md` for hosting details, `docs/endpoint-coverage.md` for API validation, or open an issue in this repo.
