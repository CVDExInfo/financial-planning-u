# Repository Review (Senior Engineer Assessment)

## 1) High-Level System Snapshot
- **Product scope:** React + Vite SPA for PMO pre-factura estimation and SDMT cost/forecasting, delivered under the `/finanzas/` path and fronted by CloudFront; backend defined in `services/finanzas-api` with the OpenAPI contract in `openapi/finanzas.yaml`.【F:README.md†L1-L6】
- **Authentication:** AWS Cognito (implicit OAuth and password auth), multi-role support via groups, hosted UI redirects at `/finanzas/auth/callback.html`, and token persistence across sessions.【F:README.md†L7-L159】
- **Hosting and infra accents:** Private S3 + CloudFront behavior for `/finanzas/*`, Cognito user pool `us-east-2_FyHLtOhiY`, and API Gateway stage consumed via `VITE_API_BASE_URL`.【F:README.md†L3-L6】【F:README.md†L85-L159】

## 2) End-to-End Repository Map (Tree-Line View)
- **Application shell:** `src/App.tsx` centralizes routing, auth gating, idle logout, navigation, and feature mounts for PMO, SDMT, and Finanzas modules.【F:src/App.tsx†L1-L200】
- **Front-end composition:**
  - `src/components/` – shared UI (navigation, auth provider, alerts, context bars).
  - `src/features/` – PMO/SDMT domain features (prefactura estimator, cost catalog/forecast/reconciliation, etc.).
  - `src/modules/finanzas/` – Finanzas R1 feature set (Rubros catalog, allocation rules, cashflow/scenario dashboards, adjustments, providers, projects manager).
  - `src/lib/` – client utilities (API stubs, React Query client, hooks).
- **Backend contract & assets:** `openapi/finanzas.yaml` (API contract), `services/finanzas-api` (SAM stack skeleton), `postman/` and `scripts/qa` (contract tests & auth verification), `public/auth/callback.html` (token handoff page referenced by Cognito).【F:README.md†L3-L6】【F:README.md†L21-L30】
- **Docs & runbooks:** Extensive markdown library in repo root plus `docs/` and `infra/` for operational guides (QA guardrails, deployment, auth troubleshooting).

## 3) Functional Flow & UI Architecture
- **Routing shell:** `BrowserRouter` with a configurable `BASENAME` defaults to `/finanzas`; login routes are dynamically derived to keep hosted UI and direct auth aligned with the base path.【F:src/App.tsx†L52-L139】
- **Auth lifecycle:** `AuthProvider` + `useAuth` expose `isAuthenticated` and roles, block access until session ready, and short-circuit the callback path to avoid SPA interception. Idle logout via `useIdleLogout` enforces session hygiene.【F:src/App.tsx†L9-L134】
- **Access control:** `AccessControl` wraps all feature routes; when route configuration is missing for a role, a guarded alert is shown to prompt admin action.【F:src/App.tsx†L139-L154】
- **Feature mount points:**
  - **Finanzas:** default home at `/finanzas/`, with routes for projects, providers, adjustments, rubros catalog, allocation previews, cashflow, scenarios, and SDMT redirects to maintain path compatibility.【F:src/App.tsx†L156-L200】
  - **SDMT:** cost catalog, forecast, reconciliation, cashflow, scenarios, and changes mounted under `/sdmt/cost/...` with redirects from legacy `/finanzas/sdmt/...` paths.【F:src/App.tsx†L176-L194】
  - **PMO:** prefactura estimator wizard under `/pmo/prefactura/estimator`.【F:src/App.tsx†L170-L174】

## 4) Build, QA, and Automation Posture
- **Scripts & targets:** `package.json` exposes dual build targets (`BUILD_TARGET=pmo|finanzas`), pre-build API validation, lint, unit tests, Playwright E2E, Newman contract tests, seeding utilities, and specialized QA/auth checks (`qa:finanzas:auth`).【F:package.json†L9-L37】
- **Guardrails:** `npm run build:finanzas` is pre-gated by `scripts/pre-build-validate.sh` to fail fast when `VITE_API_BASE_URL` is misconfigured; post-deploy verification scripts live under `scripts/` and `docs/` runbooks reference them.【F:README.md†L70-L143】【F:package.json†L14-L37】
- **CI hooks:** README references `.github/workflows/finanzas-qa.yml` for path-scoped QA enforcement on PRs touching auth/infra/API areas.【F:README.md†L21-L30】

## 5) AWS Architecture & Deployment Model
- **Edge delivery:** CloudFront behavior on `/finanzas/*` fronts a private S3 origin hosting the Vite-built SPA; base URL baked into the bundle is `/finanzas/` to keep routing consistent across environments.【F:README.md†L1-L6】
- **Identity:** Cognito user pool `us-east-2_FyHLtOhiY` with app client `dshos5iou44tuach7ta3ici5m`, implicit grant flow, and explicit callback/logout URLs anchored to the CloudFront domain (`/finanzas/auth/callback.html`, `/finanzas/`).【F:README.md†L85-L159】
- **API:** API Gateway stage consumed via `VITE_API_BASE_URL`; health checks and contract tests expect JSON responses and validate authorizer behavior. Dev stage currently serves prod traffic until a prod stage is provisioned.【F:README.md†L70-L140】
- **Pipelines:** Build-time env injection for `VITE_API_BASE_URL` and Cognito variables; README provides GitHub Actions example and manual build syntax to keep infra/env parity.【F:README.md†L70-L140】

## 6) Risks & Gaps (Deep Dive)
- **Monolithic entrypoint:** `src/App.tsx` owns all route wiring and auth gating; as modules grow, lack of lazy-loaded feature routers will inflate bundle size and complicate ownership boundaries.【F:src/App.tsx†L14-L200】
- **Runtime assurance visibility:** No recent test artifacts in this branch; pre-release confidence depends on re-running lint/unit/E2E/contract suites and publishing the results (e.g., `test-results-*` files exist but are stale).【F:package.json†L9-L37】
- **API stage coupling:** Frontend relies on the API dev stage for both dev/prod; absence of a dedicated prod stage increases blast radius for backend changes. README warns but enforcement is manual.【F:README.md†L70-L143】
- **Docs sprawl:** Dozens of operational docs exist without a single navigational index for engineers; discoverability risk for new contributors.

## 7) Recommendations (Actionable)
1. **Modularize routing with lazy loading:** Introduce feature-level routers (e.g., `routes/finanzas.tsx`, `routes/sdmt.tsx`, `routes/pmo.tsx`) and wrap imports in `React.lazy`/`Suspense` to keep `src/App.tsx` focused on shell concerns and reduce initial payload.【F:src/App.tsx†L14-L200】
2. **Publish fresh validation results:** Run `npm run lint`, `npm run test:unit`, `npm run test:e2e:finanzas`, and `npm run contract-tests`; capture outputs in `test-results-<date>.md` and link from README or a `VALIDATION_SUMMARY.md` section for traceability.【F:package.json†L9-L37】
3. **Define prod API stage & config guardrails:** Create a dedicated API Gateway prod stage and parameterize `VITE_API_BASE_URL` by environment; extend `scripts/pre-build-validate.sh` to reject dev-stage URLs for prod builds and add a checklist entry in README.
4. **Add a docs index:** Create a single `docs/INDEX.md` (or expand `ASSESSMENT_INDEX.md`) that groups auth, deployment, QA, and runbook links to reduce onboarding time.
5. **AWS alignment review:** Confirm CloudFront behaviors, Cognito callback URLs, and Hosted UI domain remain consistent with the baked base path; automate a nightly `qa:finanzas:auth` run to detect drift.【F:README.md†L21-L159】

## 8) Optional Enhancements
- **Observability:** Add browser error logging (e.g., Sentry) gated by env vars to capture auth and routing edge cases in production.
- **Performance:** Introduce code-splitting for heavy charts/dashboards in Finanzas modules and leverage React Query caching for API-backed pages when real endpoints are wired.
- **Security:** Enforce CSP headers at CloudFront and audit token storage to ensure only secure, httpOnly cookies are used when possible; currently relies on localStorage keys `cv.jwt` and `finz_jwt`.【F:README.md†L184-L199】
