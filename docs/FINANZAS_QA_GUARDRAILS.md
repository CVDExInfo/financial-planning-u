# Finanzas QA Guardrails

This document codifies the non-negotiable invariants for the Finanzas module. The QA gate enforces these rules automatically on pull requests that modify authentication, infrastructure, or API wiring for Finanzas.

## Core invariants

- **Cognito user pool and domain**
  - User pool ID must remain `us-east-2_FyHLtOhiY`.
  - Hosted UI domain must remain `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com` (unless overridden by an environment variable with the same format).
  - Finanzas must continue using the Finanzas/acta-ui Cognito app client (documented client ID), not a new hard-coded client.
  - Canonical defaults for pool ID, client ID, domain, CloudFront URL, and redirect paths are baked into `src/config/aws.ts` to satisfy CI guardrails even when env vars are absent.
- **Redirects**
  - Sign-in redirect must end at `/finanzas/auth/callback.html` on the CloudFront distribution.
  - Sign-out redirect must return to `/finanzas/` (with `/finanzas/login` as the sign-out landing page).
- **Static callback page**
  - Canonical file path: `public/auth/callback.html` (deploys to `/finanzas/auth/callback.html`).
  - The callback HTML must stay outside the React router (no SPA rewrite or router interception).
  - If `public/finanzas/auth/callback.html` exists at all, it must be a mirror or tiny redirect stub—never a second full implementation that would create `/finanzas/finanzas/auth/callback.html` in the build.
- **CloudFront routing**
  - The CloudFront function responsible for Finanzas SPA rewrites must exempt `/finanzas/auth/callback.html` and continue routing other SPA paths under `/finanzas/` to `/finanzas/index.html`.
- **Frontend auth wiring**
  - `src/config/aws.ts` must keep Cognito defaults aligned with the values above and keep OAuth redirects under `/finanzas/`.
  - Auth helpers must not hard-code alternate domains, pool IDs, or client IDs.
  - React Router must continue short-circuiting any `/auth/callback` path to allow the static HTML to run.
- **API wiring**
  - Finanzas API clients must remain compilable and configured to use the configured API base without introducing new hard-coded endpoints.
- **Scoped impact**
  - Do not modify or break acta-ui or prefacturas; Finanzas guardrails are scoped to the Finanzas module only.

## Reviewer/author checklist

Use this checklist before merging PRs that touch Finanzas auth, infra, or API files.

- [ ] Cognito defaults in `src/config/aws.ts` still match the documented pool ID, domain, and client ID.
- [ ] OAuth redirects remain under `/finanzas/` with sign-in at `/finanzas/auth/callback.html` and sign-out pointing to `/finanzas/` (or `/finanzas/login`).
- [ ] `public/auth/callback.html` exists and is the canonical implementation. Any alias under `public/finanzas/auth/callback.html` is either identical or a redirect stub (or absent entirely).
- [ ] CloudFront rewrite function keeps `/finanzas/auth/callback.html` exempt from SPA rewrites.
- [ ] Finanzas build (`npm run build:finanzas`) still succeeds.
- [ ] Lint and available tests pass.
- [ ] QA script `npm run qa:finanzas:auth` passes locally.
- [ ] acta-ui/prefacturas files are untouched except for read-only references.

### Running the automated check

```bash
npm run qa:finanzas:auth
```

The GitHub Actions workflow `.github/workflows/finanzas-qa.yml` runs the same guardrails on pull requests that touch Finanzas auth/infra/API files.

## “Do not” rules

- ❌ Do **not** hard-code new Cognito domains, pool IDs, or client IDs for Finanzas.
- ❌ Do **not** change the callback path without coordinated updates to CloudFront, Cognito, and S3.
- ❌ Do **not** reintroduce SPA routing or React Router interception for `/finanzas/auth/callback.html`.
- ❌ Do **not** add competing callback files under different paths.
- ❌ Do **not** bypass the QA gate when modifying Finanzas auth/infra/API files.

## Automation coverage vs. manual checks

- Automated: config file validation, callback file presence, CloudFront rewrite guard, basic build/lint hooks via GitHub Actions.
- Manual (still required): Cognito app client settings (allowed callback/logout URLs, enabled grant types) should be confirmed in AWS Console until AWS SDK/CLI validation is added to the script.

These guardrails keep the Finanzas authentication flow aligned with the deployed CloudFront/S3 layout and the Cognito callback configuration.

## Canonical callback location
- The Hosted UI redirect configured in Cognito points to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`.
- Finanzas assets are uploaded with `aws s3 sync dist-finanzas/ "s3://${FINANZAS_BUCKET_NAME}/finanzas/"`, so the callback **must** live at `dist-finanzas/auth/callback.html` (source: `public/auth/callback.html`).
- **Do not** place a duplicate at `public/finanzas/auth/callback.html`; that would deploy to `/finanzas/finanzas/auth/callback.html` and break the Hosted UI return path.

## Callback behavior
- Parses `id_token`/`access_token` from the hash (implicit grant).
- Stores tokens to the keys read by `AuthProvider` and related hooks: `cv.jwt`, `finz_jwt`, `idToken`, `cognitoIdToken`, and `finz_access_token` (when present).
- Redirects back to `/finanzas/` after successful processing.

## QA checks
- `scripts/qa/verify-finanzas-auth-config.sh`
  - Confirms `public/auth/callback.html` exists and the nested `public/finanzas/auth/callback.html` copy is **absent**.
  - Asserts the callback writes the expected token keys and redirects to `/finanzas/`.
- `scripts/build-guards-finanzas.sh`
  - Verifies `dist-finanzas/auth/callback.html` exists after build.
  - Fails if a nested `dist-finanzas/finanzas/auth/callback.html` artifact is present.

## Workflow expectations
- The Finanzas QA workflow should build with realistic defaults:
  - `VITE_PUBLIC_BASE=/finanzas/`
  - `VITE_FINZ_ENABLED=true`
  - Canonical Cognito values (domain, pool, client, redirect URLs) to avoid empty placeholders in the bundle.
- QA output should highlight callback guardrail failures explicitly so regressions are caught before deploy.
- The workflow only triggers on Finanzas auth/infra/API paths to avoid interfering with acta-ui or prefacturas pipelines.
