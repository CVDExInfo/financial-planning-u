# FINANZAS PATH TO GREEN

## Status Dashboard

| Lane | Title | Status | Evidence | Owner |
|------|-------|--------|----------|-------|
| 1 | Auth & UI Unification | 🟢 **GREEN** | [LANE1_COMPLETION_REPORT.md](LANE1_COMPLETION_REPORT.md) | Copilot Agent |
| 2 | Backend SAM & RBAC | ⏳ **NOT STARTED** | — | TBD |
| 3 | CDN CloudFront & SPA | ⏳ **NOT STARTED** | — | TBD |
| 4 | CI/CD Workflow & Post-Deploy | ⏳ **NOT STARTED** | — | TBD |
| 5 | QA Smoke Tests & Evidence | ⏳ **NOT STARTED** | — | TBD |
| 6 | Repo Hygiene & Finalization | ⏳ **NOT STARTED** | — | TBD |

### Lane 1 Summary

- ✅ 12/12 preflight checks passing
- ✅ 6/6 deliverables completed
- ✅ 9/9 test scenarios documented
- ✅ No code changes needed (implementation already correct)
- 🔗 [Detailed Report](LANE1_COMPLETION_REPORT.md) | [Test Plan](LANE1_AUTH_UI_TEST_PLAN.md)

---

## 1) AUTH & UI — Unify Login, Fix Hosted UI, and Finanzas Routing

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-auth-ui-unification
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
Frontend + Auth Engineer (Amplify/Cognito + React Router)

SCOPE ENFORCEMENT
- ✅ Allowed: src/config/aws.ts, src/auth/**, src/components/**, src/routes/**, src/App.tsx, public/auth/callback.html, vite config, README
- ❌ Off-limits: backend infra, non-auth workflows (handled in other prompts)

OBJECTIVE
Unify the login experience using the Finanzas login page for both modules, fix Hosted UI callback/sign-out, ensure Finanzas SPA loads at /finanzas/ and stays there post-login, and confirm role-based redirect correctness.

DELIVERABLES
- Replace current login page with Finanzas design (single, unified `Login.tsx`)
- Hosted UI: correct domain, callback `/finanzas/auth/callback.html`, sign-out `/finanzas/`
- Direct USER_PASSWORD_AUTH flow: working with Cognito; stores `cv.jwt` and `finz_jwt`
- Router: basename `/finanzas`, <Link> components (remove raw anchors), no PMO fallback for Finanzas-only builds
- Role-based redirect: SDT/FIN/AUD → /finanzas/; PMO-only → /
- Docs: update README "Auth Flow" with quick steps

PRE-FLIGHT
- Confirm these envs resolve at build/runtime: `VITE_PUBLIC_BASE=/finanzas/`, `VITE_FINZ_ENABLED=true`, `VITE_API_BASE_URL` (will be injected by CI), Cognito Pool & Client IDs valid
- Verify `public/auth/callback.html` exists and can parse & store tokens

TESTS / CHECKS
- Local: `npm run dev` → navigate to `/finanzas/` → open Login page → login (direct + Hosted UI)
- DevTools: localStorage must contain `cv.jwt` and `finz_jwt` after login
- Refresh deep links: `/finanzas/catalog/rubros` loads without redirect
- Role redirect:
  - SDT/FIN/AUD user hits `/finanzas/` → stays in Finanzas post-login
  - PMO-only user hitting `/finanzas/` gets redirected to `/` (if PMO app present)
- Controlled failure: missing token → Finanzas routes must show Login

GREEN CRITERIA
- Both login methods (direct + Hosted UI) work and persist session
- Finanzas pages render and fetch data after login (no redirect to PMO)
- Deep links under `/finanzas/` work
- README updated with Auth Flow instructions

ITERATION POLICY
- Fix → re-run until GREEN; capture results in $GITHUB_STEP_SUMMARY (table of test cases + pass/fail).
```

---

## 2) BACKEND — SAM Template Fixes (Exports per Stage) & RBAC Consistency

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-sam-rbac-fixes
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
Backend SAM/Node engineer

SCOPE ENFORCEMENT
- ✅ Allowed: services/finanzas-api/template.yaml, services/finanzas-api/src/handlers/**, docs/**
- ❌ Off-limits: UI code (handled elsewhere)

OBJECTIVE
Enable prod stack creation by fixing CloudFormation export collisions and align RBAC so finance roles (SDT/FIN/AUD) pass backend checks.

DELIVERABLES
- `template.yaml`: change Outputs export names to be stage-unique:
  - `finz-api-url-${StageName}`, `finz-api-id-${StageName}`
- Handlers: update `ensureSDT()` (or equivalent) to allow finance roles:
  - Accept any of: `SDT`, `FIN`, `AUD` (configurable set)
  - Return consistent error shape on 403
- Docs: note RBAC policy & recommended Cognito group assignments

PRE-FLIGHT
- Confirm stack names: `finanzas-sd-api-dev`, `finanzas-sd-api-prod`
- Use `StageName` parameter for exports to avoid collision

TESTS / CHECKS
- `sam build && sam deploy --stack-name finanzas-sd-api-dev --parameter-overrides StageName=dev`
- `sam build && sam deploy --stack-name finanzas-sd-api-prod --parameter-overrides StageName=prod`
- Confirm CFN exports do not collide; both stacks CREATE/UPDATE COMPLETE
- Post-deploy smoke:
  - `/health` 200 JSON
  - `/catalog/rubros` 200
  - Protected endpoints: 403 without token, 200 with token for SDT/FIN/AUD users

GREEN CRITERIA
- Both dev & prod stacks deploy cleanly
- RBAC accepts SDT/FIN/AUD; PMO-only denied on protected finance endpoints
- Evidence: paste `aws cloudformation describe-stacks` outputs + curl results in $GITHUB_STEP_SUMMARY

ITERATION POLICY
- Fix → redeploy → smoke-test → iterate until GREEN
```

---

## 3) EDGE & CDN — CloudFront Behavior & SPA Fallback

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-cdn-fallback-and-oac
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
CDN/Edge Engineer (CloudFront + S3)

SCOPE ENFORCEMENT
- ✅ Allowed: .github/workflows/update-cloudfront.yml (or create), docs/cdn-proxy.md, optional CloudFront function code (JS)
- ❌ Off-limits: SAM/API code and core UI logic

OBJECTIVE
Ensure /finanzas/ always serves the Finanzas SPA index, including trailing slash and deep-link refresh, with correct OAC and behavior precedence.

DELIVERABLES
- Confirm `/finanzas/*` behavior exists and precedes `Default (*)`
- Add SPA fallback for `/finanzas/*` (404/403 → `/finanzas/index.html`, 200)
- Ensure trailing `/finanzas` rewrites to `/finanzas/` (CloudFront function or behavior config)
- Confirm S3 OAC bucket policy allows CloudFront to read `finanzas/` assets
- Docs: `cdn-proxy.md` with before/after, behavior precedence & fallback rationale

PRE-FLIGHT
- Distribution ID: EPQU7PVDLQXUA
- Bucket: `ukusi-ui-finanzas-prod` (prefix: `finanzas/`)

TESTS / CHECKS
- `curl -I https://<CF_DOMAIN>/finanzas/` → 200
- `curl -I https://<CF_DOMAIN>/finanzas` → 200 (redirect or content)
- Deep link: `curl -I https://<CF_DOMAIN>/finanzas/catalog/rubros` → 200
- OAC test: `aws s3api get-bucket-policy` shows CF dist arn; test asset fetch OK
- Verify asset paths in HTML reference `/finanzas/assets/*`

GREEN CRITERIA
- All 3 URLs above return 200 without PMO redirect
- No 403 from S3; no 404 for SPA deep links
- Evidence: curl outputs + CloudFront get-distribution excerpt in $GITHUB_STEP_SUMMARY

ITERATION POLICY
- Adjust behaviors/OAC → re-test → iterate until GREEN
```

---

## 4) CI/CD — Clean Up Workflows & Add Post-Deploy Validation

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-ci-cleanup-and-postdeploy
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
DevOps Engineer (GitHub Actions + OIDC)

SCOPE ENFORCEMENT
- ✅ Allowed: .github/workflows/deploy-ui.yml, deploy-api.yml, smoke-only.yml, post-deploy.yml (new), remove deprecated workflows, scripts/**
- ❌ Off-limits: app logic (handled in other lanes)

OBJECTIVE
Consolidate to a single UI deploy workflow, ensure prod uses correct API ID/URL, and add a post-deploy pipeline that runs smoke tests (API/UI), captures evidence, and iterates on failures.

DELIVERABLES
- Keep: `deploy-ui.yml`, `deploy-api.yml`, `smoke-only.yml`; remove outdated duplicates
- `deploy-ui.yml`: 
  - Build PMO and Finanzas (dist-pmo, dist-finanzas)
  - Inject `VITE_API_BASE_URL` by environment (dev/stg/prod) using repo vars:
    - e.g., `FINZ_API_ID_PROD`, `FINZ_API_STAGE_PROD=prod` → construct URL
  - Guards: fail if host id doesn't match expected (`EXPECTED_API_ID`)
- New `post-deploy.yml`:
  - Trigger: `workflow_run` on `deploy-ui.yml` success/failure
  - Steps:
    - curl CF `/` and `/finanzas/`
    - curl Finanzas HTML → verify `/finanzas/assets` + no `github.dev`
    - newman against prod API; fetch Cognito ID token via USERNAME/PASSWORD secrets
    - paste a 20-line HTML snippet + API results in $GITHUB_STEP_SUMMARY
  - On failure: open issue with logs and auto-assign Copilot

PRE-FLIGHT
- Repo variables present: `FINZ_API_ID_DEV/PROD`, `FINZ_API_STAGE_DEV/PROD`, `CLOUDFRONT_DIST_ID`, `S3_BUCKET_NAME`, Cognito secrets

TESTS / CHECKS
- Dry-run workflows locally or via a test branch
- Confirm `post-deploy.yml` runs even if deploy fails; evidence is attached

GREEN CRITERIA
- Single source of truth for UI deploy; no duplicate workflows
- Post-deploy produces evidence pack and flags blockers automatically
- Evidence: GH Actions run links + $GITHUB_STEP_SUMMARY tables

ITERATION POLICY
- Fix → re-run → iterate until GREEN
```

---

## 5) QA — Smoke Tests (API + UI) & Evidence Pack

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-qa-smoke-and-evidence
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
QA Engineer (Newman + curl + minimal Playwright optional)

SCOPE ENFORCEMENT
- ✅ Allowed: scripts/finanzas-smoke-tests.sh, scripts/test-protected-endpoints.sh, postman collections, docs/FINANZAS_DEPLOYMENT_VERIFICATION.md, README
- ❌ Off-limits: infra changes; CI config changes handled elsewhere

OBJECTIVE
Create a deterministic smoke suite against prod that verifies CF, S3, SPA, and API endpoints. Emit a clear Evidence Pack in the GH Summary.

DELIVERABLES
- Update `scripts/finanzas-smoke-tests.sh`: 
  - CF `/` and `/finanzas/` 200
  - grep `/finanzas/assets` in HTML; ensure no `github.dev`
  - print first 20 lines of Finanzas HTML
- `scripts/test-protected-endpoints.sh`:
  - Get Cognito `IdToken` (USERNAME/PASSWORD secrets)
  - Test `/health` (200), `/catalog/rubros` (200), `/allocation-rules` (200 with token)
- Update `FINANZAS_DEPLOYMENT_VERIFICATION.md`: add step-by-step E2E checks

PRE-FLIGHT
- Ensure GH secrets for Cognito test user present
- Confirm API URL variables injected by CI point to **prod** stage

TESTS / CHECKS
- Run scripts locally then in GitHub Actions (`smoke-only.yml`)
- Verify script output is concise and pasted in $GITHUB_STEP_SUMMARY

GREEN CRITERIA
- All checks pass in prod: CF, SPA HTML, public + protected API
- Evidence Pack present: tables, curls, and HTML snippet

ITERATION POLICY
- Fix test gaps → re-run until GREEN
```

---

## 6) REPO HYGIENE — Remove Dead Files, Align Tree, Docs Finalization

```
@workspace
Repo: valencia94/financial-planning-u
Branch: r1-repo-hygiene
Mode: plan → apply → test → iterate UNTIL GREEN

ROLE
Repo Gardener / Documentation Engineer

SCOPE ENFORCEMENT
- ✅ Allowed: removal of deprecated files, update docs/, adjust folder naming, .gitignore, README, docs/tree.structure.md
- ❌ Off-limits: functional code changes (handled in prior lanes)

OBJECTIVE
Clean the repo so it reflects the current architecture and removes legacy/dev-only artifacts. Make it easy to navigate for new contributors and auditors.

DELIVERABLES
- Remove deprecated workflows & dead scripts (keep only `deploy-ui.yml`, `deploy-api.yml`, `smoke-only.yml`, `post-deploy.yml`)
- Ensure `docs/tree.structure.md` reflects final structure:
  - `src/config/aws.ts`, `public/auth/callback.html`, `src/routes/finanzas/**`, handlers in `services/finanzas-api/src/handlers/**`, etc.
- Clean `.gitignore`: exclude `.pnpm-store`, build artifacts, env files
- Update README: add QuickStart (env, login, smoke tests), link Evidence Pack

PRE-FLIGHT
- Enumerate files to delete; confirm no imports reference them
- Validate docs reference correct commands and workflows

TESTS / CHECKS
- `npm run build` + `npm run test` pass after cleanup
- `git grep` shows no references to removed files

GREEN CRITERIA
- Build/tests pass; repo is lean and matches docs
- Evidence: add `git status` summary + `tree.structure.md` diff to $GITHUB_STEP_SUMMARY

ITERATION POLICY
- Remove → build → fix → iterate until GREEN
```

---

## Notes for the Agent

* **No pre-approvals.** Execute, prove with evidence, and return only when **all six lanes are GREEN**.
* **Evidence is mandatory**: paste curl outputs, first 20 lines of HTML, API json excerpts, and screenshots where possible into `$GITHUB_STEP_SUMMARY`.
* **If any environment variable is missing**, fail fast with a clear message and create an issue auto-assigned to Copilot with the gap.

If you want, I can bundle these into a single **Issue suite** with checklists for each lane so you can assign them sequentially.

---

## Implementation Roadmap

### Phase 1: Planning & Preflight (All Lanes)
- Verify environment variables and prerequisites for each lane
- Create feature branches for each lane (6 total)
- Document any blocking issues

### Phase 2: Execution (Parallel where possible)
- **Lane 1 & 5**: Auth/UI and QA can run in parallel (QA validates UI)
- **Lane 2 & 3**: Backend and CDN can run in parallel (independent)
- **Lane 4**: CI/CD orchestrates Lanes 1-3
- **Lane 6**: Repo hygiene is final cleanup

### Phase 3: Validation & Evidence
Each lane produces:
- Test results table in `$GITHUB_STEP_SUMMARY`
- curl outputs (for infrastructure lanes)
- Code snippets (for application lanes)
- Pass/Fail status

### Phase 4: Integration Testing
- All lanes merge to a `r1-integration` branch
- Full smoke test suite runs
- Final evidence pack generated
- Deploy to staging/prod when all GREEN

---

## Success Metrics

| Lane | Metric | Target |
|------|--------|--------|
| 1 (Auth/UI) | Login success rate | 100% (direct + Hosted UI) |
| 2 (Backend) | RBAC group acceptance | SDT/FIN/AUD pass, PMO denied |
| 3 (CDN) | Deep link accessibility | 200 on all paths |
| 4 (CI/CD) | Workflow reliability | Zero manual interventions |
| 5 (QA) | Smoke test pass rate | 100% in prod |
| 6 (Hygiene) | Build success | Pass after cleanup |

---

**Status**: Ready for assignment  
**Estimated Duration**: 2-3 sprints (with iteration)  
**Owner**: Engineering Team (SDT)
