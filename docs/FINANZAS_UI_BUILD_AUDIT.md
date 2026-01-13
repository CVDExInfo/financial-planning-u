# Finanzas UI Build Audit Report

## Scope
This report reviews the Finanzas UI build pipeline and artifacts, focusing on the Vite build configuration, build scripts, and the deploy workflow checks. The intent is to ensure the build output matches the deployment expectations and to provide a local pre-build verification protocol.

## Build Entry Points
- **Primary build script (Finanzas)**: `npm run build:finanzas` runs `scripts/pre-build-validate.sh`, TypeScript build, and `vite build` with `BUILD_TARGET=finanzas`.【F:package.json†L8-L14】【F:scripts/pre-build-validate.sh†L1-L90】
- **Pre-build validation** enforces `VITE_API_BASE_URL`, `VITE_COGNITO_DOMAIN`, and `VITE_CLOUDFRONT_URL` and validates OAuth settings before build, so the bundle cannot be produced with missing critical config.【F:scripts/pre-build-validate.sh†L27-L139】

## Vite Build Configuration
- **Build target selection** uses `BUILD_TARGET` to set output directory (`dist-finanzas`) and base path (`/finanzas/`), ensuring asset URLs are rooted at `/finanzas/assets/...`.【F:vite.config.ts†L12-L25】【F:vite.config.ts†L29-L38】
- **API base URL injection** uses `VITE_API_BASE_URL` and fails the build if not set for Finanzas, preventing a broken bundle from being deployed.【F:vite.config.ts†L40-L83】

## Deployment Verification Checks
The deploy workflow contains multiple checks that validate the build output and deployment consistency:
- **Asset base path guard** ensures `dist-finanzas/index.html` does not reference `/assets/` (missing `/finanzas/` base).【F:.github/workflows/deploy-ui.yml†L436-L450】
- **Bundle hash recording** stores hashed JS/CSS for comparison against the previous successful deploy, so a build that *should* change but doesn’t will be flagged.【F:.github/workflows/deploy-ui.yml†L270-L383】
- **S3 asset verification** compares assets referenced in `dist-finanzas/index.html` to the objects stored under `finanzas/assets/` in S3, failing if a referenced asset is missing.【F:.github/workflows/deploy-ui.yml†L688-L739】

## Pre-Build Verification Protocol (Local)
Use the new script below to mimic the deploy build verification locally:

```
export VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
export VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com
export VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net

bash scripts/verify-finanzas-build.sh
```

The script:
1. Runs `npm run build:finanzas`.
2. Extracts `index.html` asset references (`/finanzas/assets/*.js|*.css`).
3. Verifies every referenced asset exists in `dist-finanzas/`.

【F:scripts/verify-finanzas-build.sh†L1-L38】

## Notes on “Same Asset Filenames”
Vite uses **content hashes** in asset filenames. If changes are outside the Finanzas build scope (e.g., docs, PMO-only changes, or data/config changes that do not affect the bundle), the asset filenames will remain unchanged. The deploy workflow’s bundle-hash comparison is designed to fail **only** when Finanzas files changed but the bundle did not, indicating a potential build pipeline issue.【F:.github/workflows/deploy-ui.yml†L369-L383】

## Summary
- The build is correctly configured to target `/finanzas/` and inject the required API/Cognito configuration.
- The deploy pipeline has explicit guards for base paths, bundle hashes, and S3 asset presence.
- A local pre-build verification script is provided to mirror the deploy checks and confirm assets are correctly emitted before deployment.
