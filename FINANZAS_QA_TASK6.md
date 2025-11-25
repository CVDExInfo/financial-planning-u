# Finanzas QA Review – Task 6 (Navigation, Roles, Auth, API)

This report captures static analysis and configuration observations for the Finanzas module after Tasks 1–5.

## Commands run
- `npm run lint` – completed with existing warnings (no errors). See output for locations; notable reminder about `Navigation.tsx` dependency warning (useEffect on `finzEnabled`).
- `npm test` – fails because no `test` script is defined in package.json.
- `npm run build` – failed: Finanzas build requires `VITE_API_BASE_URL`; environment variable not set in current workspace.

## Key observations
- **Navigation & role visibility**: `Navigation.tsx` now derives an effective role from Cognito roles/availableRoles and filters module nav items via `canAccessRoute`, `canAccessFinanzasModule`, and `canAccessPMOModule`. Finanzas-only mode (`VITE_FINZ_ENABLED`) bypasses redirects; role switch dialog uses `setRole` from `useAuth`. Sidebar items for Finanzas are limited to Projects, Catálogo de Rubros, and Rules when Finanzas is enabled.
- **AuthProvider & role alignment**: `AuthProvider.tsx` builds session from stored Cognito tokens, maps groups to roles, and sets defaults via `getDefaultUserRole`. Route configs are validated with `getRoutesForRole`; role switching updates `cv.module` and user `current_role`. Hosted UI login/logout continue to use Cognito implicit flow. Tokens cleared on logout.
- **AWS/Cognito config**: `src/config/aws.ts` keeps canonical Cognito pool/domain/client IDs for Finanzas, redirects to `/finanzas/auth/callback.html`, and warns if `VITE_API_BASE_URL` is unset. OAuth response type remains `token` (implicit flow) with `openid` scope. Sign-out redirects to `/finanzas/`.
- **CloudFront rewrite**: `infra/cloudfront-function-finanzas-rewrite.js` preserves `/finanzas/auth/callback.html`, rewrites `/finanzas` and deep `/finanzas/*` paths without extensions to `/finanzas/index.html`, maintaining SPA routing.
- **Terraform outputs**: `infra/cloudfront.tf` documents the /finanzas/* behavior, SPA fallback error responses (403/404 → `/finanzas/index.html`), and OAC-based origin wiring; expects manual distribution updates as outputs.

## Outstanding issues / follow-up
- Provide `VITE_API_BASE_URL` when running `npm run build` (dev stage API is the expected value).
- No automated tests defined; confirm with team whether targeted suites exist for Finanzas.
- Manual QA (hosted UI login, role-based nav, API calls, logout) not executed in this environment; recommended to validate in dev/prod-like environment with Cognito and API connectivity configured.
