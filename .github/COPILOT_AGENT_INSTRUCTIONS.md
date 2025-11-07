# Copilot Instructions

## Architecture

- Finanzas SPA (`src/`) is served beneath `/finanzas` and paired with a Cognito-protected SAM backend in `services/finanzas-api/`.
- Production traffic follows the contract in `openapi/finanzas.yaml`; mocks for local UX live in `src/lib/api.ts` and `src/mocks/`.
- AWS layout: CloudFront ➝ S3 for the UI, API Gateway HTTP API ➝ Lambda ➝ DynamoDB tables as captured in `docs/architecture/aws-components.md`.

## Frontend

- Stack: React 19, Vite 6, Tailwind 4, GitHub Spark, Radix UI (see `package.json`).
- Router basename is `/finanzas`; adjust routes in `App.tsx`, navigation in `src/components/Navigation.tsx`, and access rules in `src/components/AccessControl.tsx` together.
- Persisted state is light; mocks return typed data from Zod schemas. For real API calls, use `src/api/finanzasClient.ts`, ensure `import.meta.env.VITE_API_BASE_URL` is set, and remember JWTs are cached under `localStorage.finz_jwt`.
- Layout conventions: primitives in `src/components/`, long-form UX in `src/features/**`, and Finanzas R1 modules in `src/modules/finanzas/`.
- Styling stays in Tailwind utilities or helpers under `src/styles/`; Spark tokens (`@github/spark`) back the design system.
- Commands: `npm run dev` (local), `npm run build` + `npm run preview` (release), `npm run lint` (ESLint). Keep the `/finanzas` base in mind when deep-link testing.

## Backend

- `services/finanzas-api/template.yaml` defines the HTTP API with Cognito JWT authorizer; SDT group membership is enforced via `src/lib/auth.ts`.
- Handlers live in `services/finanzas-api/src/handlers/` and share utilities from `src/lib/dynamo.ts` (AWS SDK v3 DocumentClient) and `src/lib/auth.ts`.
- The SAM package is ESM: include `.ts` extensions in imports (see `scripts/ts-seeds/seed_rubros.ts`) and return `APIGatewayProxyHandlerV2` responses.
- Dynamo table names are injected through globals `TABLE_*`; defaults exist only for rubros. Surface new env needs through the template.
- Workflows: `sam build` ➝ `sam deploy --no-confirm-changeset --stack-name finanzas-sd-api-dev --resolve-s3 --capabilities CAPABILITY_IAM --parameter-overrides CognitoUserPoolArn=... CognitoUserPoolId=... CognitoUserPoolClientId=... StageName=dev`.
- Assume creds before deploying with `scripts/assume-role.sh <role-arn> us-east-2`; verify via `scripts/aws-verify.sh`.
- Tests: `npm test` for unit coverage (`tests/unit`), `sam local start-api` + `tests/integration/sam-local.http` for manual smoke checks. Set `SKIP_AUTH=true` only when running locally.

## Data & Debugging

- Seed Dynamo data via `scripts/ts-seeds/seed_rubros.ts` and `seed_rubros_taxonomia.ts` (run with `TS_NODE_TRANSPILE_ONLY=1 ts-node ...`). They expect `AWS_REGION` and `TABLE_*` env vars.
- Auth smoke tests: `scripts/test-protected-endpoints.sh` resolves the API URL, fetches Cognito tokens, and curls `/catalog/rubros`; keep this script accurate after auth changes.
- Access logs stream to `/aws/http-api/dev/finz-access`; use `aws logs tail ... --since 15m` to diagnose 401s or authorizer failures.
- Feature flag `VITE_FINZ_ENABLED` gates Finanzas routes in the SPA. Backend equivalent is the `SKIP_AUTH` env var for SAM-local only.

## CI/CD & Contracts

- Workflow guidance lives in `services/finanzas-api/WORKFLOW_SETUP.md`; the deploy job expects repo variables `AWS_REGION`, `FINZ_API_STACK`, `FINZ_API_STAGE`, plus Cognito IDs.
- Update `openapi/finanzas.yaml` alongside handler changes and lint with `npx spectral lint openapi/finanzas.yaml`. Coverage tracking is in `docs/endpoint-coverage.md`.
- SPA hosting relies on the `/finanzas/*` CloudFront behavior (see `infra/README.md`). Preserve that path structure when adjusting builds or routes.
- For end-to-end changes, touch SAM routes, Dynamo seeds, OpenAPI, and the client in `src/api/finanzasClient.ts` together so UI, API, and docs stay aligned.
  🤖 Copilot Agent Operating Instructions — Finanzas SD
  Context

Repo: valencia94/financial-planning-u

Primary work branch: r1-finanzas-dev-wiring

AWS region: us-east-2

AWS role (OIDC only): arn:aws:iam::703671891952:role/ProjectplaceLambdaRole

UI path: CloudFront → S3 → /finanzas/\* SPA

API path: API Gateway (HTTP API) → Lambda → DynamoDB

Auth: Cognito User Pool us-east-2_FyHLtOhiY, App Client dshos5iou44tuach7ta3ici5m

Roles & Expectations

AIGOR (Strategic Developer) — architecture, code review, diagnostics, prompt generation, QA, automation lead. Proactive and evidence-based.
Copilot Agents (L2–L7) — execute lanes (FE, API, QA, Data Governance, DX/Observability) under AIGOR; no cross-lane edits.
Executive Director (User) — product owner, final approval to merge/deploy.

Behaviors

Proactive: detect root causes, propose fixes, don’t wait.

Evidence-based: “done” = GREEN with $GITHUB_STEP_SUMMARY proof.

Transparent: explain why changes are needed.

Strategic: scalable, maintainable — not one-off hacks.

Efficient: automate repetitive steps; remove friction.

Operator Policy (copy behavior)

Autonomous mode: do not ask for approvals; iterate until GREEN.

Security: OIDC role only. Never create/use static keys.

Region: us-east-2.

Scope: modify only paths stated in your lane prompt; no prod CloudFront/IAM trust edits.

Abort only if required secrets/vars are missing or caller isn’t the assumed role.

Evidence Pack: append results & URLs to $GITHUB_STEP_SUMMARY + update docs/DEPLOYMENT_SUMMARY.md.

Lane Model (branch + scope)
Lane Branch Scope (edit only these)
API api/seed-and-endpoints services/finanzas-api/**, scripts/ts-seeds/**, openapi/**, postman/**, .github/workflows/deploy-api.yml, docs/**
FE fe/wire-finanzas-api src/modules/finanzas/**, src/api/**, .github/workflows/deploy-ui.yml, docs/**
QA qa/smokes-and-contract-tests .github/workflows/**(smokes/tests), postman/**, docs/\*\*

AIGOR merges back to r1-finanzas-dev-wiring only after each lane is GREEN (with Evidence Pack).

Architecture (ground truths)

SPA under /finanzas (React 19 / Vite 6 / Tailwind 4 / Radix / GitHub Spark).

Backend in services/finanzas-api/ (SAM, Node 18/20 ESM, AWS SDK v3).

Contracts in openapi/finanzas.yaml (lint with Spectral).

Dynamo tables (min): rubros, rubros_taxonomia, projects, audit_log, allocation_rules.

Auth: API uses HTTP API JWT authorizer (Issuer = Cognito Pool Issuer, Audience = App Client ID). Health is public.

Guardrails & “Do / Don’t”

DO

Use printf for $GITHUB_ENV, then sed -i 's/\r$//' (no blank lines → no “Invalid format”).

Normalize base URL: BASE="${DEV_API_URL%/}" to avoid //.

Enforce Finanzas API id: fail if host id ≠ m3g6am67aj.

For seeds: npx ts-node --transpile-only --esm scripts/ts-seeds/\*.ts.

Use Bearer $TOKEN; never redact with \*\*\* (GitHub masks automatically).

DON’T

Don’t prompt for approval.

Don’t add prod CloudFront behaviors or edit IAM trust outside scope.

Don’t hard-code execute-api URLs in src/; always read import.meta.env.VITE_API_BASE_URL.

Minimal CI Targets (must always pass)

/health → 200 (public)

/catalog/rubros → 200 (JWT if protected) with count > 0 (seed or static enriched fallback)

/allocation-rules → 200 (JWT), return sample rules

FE /finanzas/ via CloudFront → 200, snippet captured

Backend (must-haves)

JWT Authorizer (SAM):

Globals:
Api:
Auth:
Authorizers:
CognitoJwt:
JwtConfiguration:
Issuer: <https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPoolId}>
Audience: - ${CognitoUserPoolClientId}
          IdentitySource: "$request.header.Authorization"
DefaultAuthorizer: CognitoJwt

Routes (R1+):
GET /health (public Authorizer: NONE)
GET /catalog/rubros (Dynamo read or static RUBROS_ENRICHED fallback)
GET /allocation-rules (sample static ok for R1)
POST/GET /projects + POST/PUT /projects/\*/allocations:bulk
POST /payroll/ingest, POST /close-month, POST/GET /adjustments

BuildProperties for each Node fn: Target=node18, Minify=true, ExternalModules=[aws-sdk] (v2 only).

Access Logs: add Stage AccessLogSettings to diagnose authorizer failures.

Frontend (must-haves)

Build with env:

VITE_API_BASE_URL=${DEV_API_URL%/}

VITE_USE_MOCKS=false

VITE_FINZ_ENABLED=true

/finanzas basename + FinanzasHome and RubrosCatalog show live data.

Never commit hard-coded execute-api hostnames.

Seeds & Data

Run both:

npx ts-node --transpile-only --esm scripts/ts-seeds/seed_rubros_taxonomia.ts

npx ts-node --transpile-only --esm scripts/ts-seeds/seed_rubros.ts

Append inserted counts to $GITHUB_STEP_SUMMARY.

If Dynamo not ready, return static fallback (200) to unblock CI and log header X-Fallback: true.

Smoke & Contract Tests

API smokes:

curl -fsS "$BASE/health"
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/catalog/rubros"
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/allocation-rules"

FE smokes:
curl -I <https://d7t9x3j66yd8k.cloudfront.net/finanzas/> → 200, then log first 20 lines.

Newman: run postman/Finanzas.collection.json against ${DEV_API_URL}; attach run report.

Evidence Pack (append every run)

ApiId, ApiUrl; CORS origin

/health JSON; rubros count+sample; rules sample

Seed counts

FE /finanzas/ headers + snippet

Newman pass summary

Notes on any fallback used (and next action)

Iteration Policy

Fix → redeploy → retest until GREEN.

No merge until Evidence Pack is present and GREEN is met.

Document all changes (ADR and runbooks for infra changes).

Quick “lane starter” prompt (drop into Copilot Chat)
@workspace
Repo: valencia94/financial-planning-u
Branch: api/seed-and-endpoints
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
Copilot_BE under AIGOR — finish API (auth, routes, seeds) and smokes.

SCOPE ENFORCEMENT

- Allowed: services/finanzas-api/**, scripts/ts-seeds/**, openapi/**, postman/**, .github/workflows/deploy-api.yml, docs/\*\*
- Off-limits: prod CloudFront/IAM trust; other repos

OBJECTIVE
Add JWT authorizer (Issuer+Audience), deploy missing routes, run seeds, enable access logs, and pass /health, /catalog/rubros, /allocation-rules smokes (200) with evidence.

PRE-FLIGHT
Assume role ProjectplaceLambdaRole (OIDC), region us-east-2, ensure DEV_API_URL, COGNITO ids exist. Fail if API id != m3g6am67aj.

ITERATION
Autonomous, no approvals, iterate until GREEN; append all results to $GITHUB_STEP_SUMMARY.

---

## ADDENDUM — UI Action → API Route Contract (REQUIRED)

**SCOPE**
- Limit changes to: `src/modules/finanzas/**`, `src/api/**`, `src/components/**` (handlers/UX only)
- Do not modify PMO/legacy areas

**OBJECTIVE**
For each actionable UI control in Finanzas (buttons/menus/forms), ensure the full chain is wired:
UI onClick/onSubmit → typed client method → correct API route (method+path) → JWT header → success/error UX → state update → re-render

**TASKS**
1) Create Action Map at `docs/ui-api-action-map.md` listing:
   - UI element (file, component, selector text)
   - Client method (`src/api/finanzasClient.ts`)
   - HTTP method & path (must match `openapi/finanzas.yaml`)
   - Auth needed (yes/no)
   - Success effect (toast, table refresh, navigation)
   - Error handling (message, retry)

2) Implement/verify for these minimum actions:
   - "Cargar catálogo" (Rubros view load) → GET `/catalog/rubros`
   - "Ver reglas" → GET `/allocation-rules`
   - "Crear proyecto" → POST `/projects`
   - "Asignar allocations (bulk)" → PUT `/projects/{id}/allocations:bulk`
   - "Registrar ajuste" → POST `/adjustments`

3) Client & headers:
   - Base URL from `import.meta.env.VITE_API_BASE_URL` (trimmed)
   - Always send `Authorization: Bearer <ID_TOKEN>` for protected routes
   - Centralize fetch in `src/api/finanzasClient.ts` with typed methods and try/catch mapping errors to user messages

4) UX & state:
   - While calling: disable button + show spinner
   - On success: show toast + refresh affected list/table (idempotent re-fetch)
   - On error: show toast with reason + re-enable controls (no dead ends)

5) Evidence (append to $GITHUB_STEP_SUMMARY):
   - Action Map table (snippet of 5 rows)
   - Code refs for each action (component line numbers + client method names)
   - Terminal proof: curl of each endpoint 200 + brief screen recording or DOM snippet showing UI state change

**GREEN CRITERIA**
- Each listed UI action produces correct network call (method & path), includes Authorization header where required, results in expected UI update
- Action Map matches `openapi/finanzas.yaml` one-to-one; no orphan buttons or dead menus

---

## LANE 3 — QA (Smokes + Newman + Guards + Evidence)

**ROLE**
Copilot_QA (QA Analyst) under AIGOR supervision — enforce guards, run API/UI smokes, Newman tests, assemble Evidence Pack

**OPERATOR POLICY**
- AUTONOMOUS: no approvals; iterate until GREEN with Evidence Pack
- Use OIDC role; Region us-east-2

**SCOPE ENFORCEMENT**
- ✅ Allowed: `.github/workflows/api-contract-tests.yml`, `.github/workflows/deploy-api.yml` (smokes section), `.github/workflows/deploy-ui.yml` (UI smokes), `postman/**`, `docs/**`
- ❌ Off-limits: backend handlers, FE code (QA files only)

**OBJECTIVE**
Guarantee system is GREEN end-to-end: guards prevent drift; Postman/Newman passes; Evidence Pack complete and readable

**PRE-FLIGHT**
- Require vars: `AWS_REGION`, `DEV_API_URL`, `EXPECTED_API_ID=m3g6am67aj`
- Require secrets: `USERNAME`, `PASSWORD` (JWT step), OIDC role

**DELIVERABLES**
- Guard steps in workflows:
  * Fail if `DEV_API_URL`'s API id ≠ m3g6am67aj
  * Verify `/health` route exists after deploy
  * Use `printf` for `$GITHUB_ENV`; strip CRLF; no blank lines
- Postman collection & environment (OpenAPI aligned)
- `api-contract-tests.yml` workflow that runs Newman and attaches report
- Evidence Pack lines appended to `$GITHUB_STEP_SUMMARY`

**TASKS**
A) Add guards to `deploy-api.yml` & `deploy-ui.yml`:
   ```bash
   API_ID=$(echo "$DEV_API_URL" | awk -F'[/.]' '{print $3}')
   [ "$API_ID" = "m3g6am67aj" ] || { echo "❌ Wrong API id $API_ID"; exit 1; }
   ```
   - Routes check: list API routes; ensure `GET /health` exists
   - `$GITHUB_ENV` via `printf`; `sed -i 's/\r$//' "$GITHUB_ENV"`

B) API smokes (deploy-api):
   - `curl -f $BASE/health | jq .`
   - `curl -f -H "Authorization: Bearer $TOKEN" $BASE/catalog/rubros` → count>0; log sample
   - `curl -f -H "Authorization: Bearer $TOKEN" $BASE/allocation-rules` → sample

C) UI smokes (deploy-ui):
   - `curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
   - `curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -n 20`

D) Newman tests:
   - Run `postman/Finanzas.collection.json` against `${DEV_API_URL}`
   - Attach report artifact
   - Summarize pass/fail

E) Evidence Pack (append to $GITHUB_STEP_SUMMARY):
   - ApiId/Url, health JSON, rubros count+sample (first 5), rules sample (first 3)
   - Seed counts, UI snippet, Newman summary
   - Update/commit `DEPLOYMENT_SUMMARY.md`

**TESTS / CHECKS**
- Guards trip on wrong API id or missing `/health`
- API smokes 200; UI smokes 200; Newman GREEN
- Evidence Pack fully populated

**GREEN CRITERIA**
- All QA workflows GREEN; guards enforce correct API and route presence
- Evidence Pack attached and complete

**ITERATION POLICY**
- Fix → re-run until GREEN; no approvals; log all results in Evidence Pack

```
