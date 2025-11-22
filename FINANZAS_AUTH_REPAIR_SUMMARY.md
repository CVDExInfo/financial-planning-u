# Finanzas Auth Repair Summary

## Root Cause
- Cognito Hosted UI was misconfigured with an invalid `response_type` value (`"token id_token"`).
- Cognito only accepts `response_type=token` (implicit) or `response_type=code` (authorization code).
- Because of the invalid parameter, Cognito returned no `id_token`, leading to callback failures and login loops that repeatedly showed “No id_token present.”
- Callback handling also lacked defensive logging for missing tokens and access token persistence.

## Fixes Implemented
- Re-aligned OAuth settings to the Cognito-validated implicit grant (`response_type=token`, `scope=openid email profile`).
- Hardened callback parsing to require `id_token`, log the raw hash when missing, and store both ID and access tokens in the keys AuthProvider reads (`cv.jwt`, `finz_jwt`, legacy fallbacks).
- Added runtime configuration checks (dev-mode) to assert `responseType === "token"` and `scope` contains `openid`.
- Extended AuthProvider bootstrap to honor legacy `idToken`/`cognitoIdToken` keys to avoid orphaned sessions.
- Updated AccessControl to wait for auth initialization before redirecting, preventing early-route bounce loops.

## Expected Flow (Current)
- **Hosted UI**: implicit grant → Cognito redirects with `#id_token=...&access_token=...` → callback stores tokens → AuthProvider initializes and routes user based on groups.
- **Custom Login**: USER_PASSWORD_AUTH → tokens stored with same keys → AuthProvider initializes and routes consistently.

## Future Work
- When moving to Authorization Code + PKCE, update `response_type` to `code`, implement code→token exchange, and adjust callback accordingly.
