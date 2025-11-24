# Finanzas QA Guardrails

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
