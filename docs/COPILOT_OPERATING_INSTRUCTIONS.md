# 🤖 Copilot Agent Operating Instructions — Finanzas SD (Updated)

> **Purpose:** Single source of truth for Copilot execution across Finanzas SD module. This update adds stage-aware API exports, CloudFront SPA fallback, unified login flow, RBAC consistency, and post-deploy evidence requirements. **Operate autonomously** and **iterate until GREEN**.

---

## 🧭 Context

- **Repo:** `valencia94/financial-planning-u`
- **Primary Branches:** `main` (prod), `r1-finanzas-dev-wiring` (dev), feature/lanes
- **Region:** `us-east-2`
- **CloudFront:** Distribution ID (prod) `EPQU7PVDLQXUA`, domain `https://d7t9x3j66yd8k.cloudfront.net`
- **UI Paths:**
  - PMO SPA at root `/` → S3 root
  - Finanzas SPA at `/finanzas/*` → S3 prefix `finanzas/`
- **API Gateway (HTTP API):** SAM stack `finanzas-sd-api-<stage>`; stage = `dev`/`prod`
- **Auth:** Cognito User Pool `us-east-2_FyHLtOhiY`, App Client `dshos5iou44tuach7ta3ici5m`
- **DynamoDB Tables (prefix `finz_`):** `projects`, `rubros`, `rubros_taxonomia`, `allocations`, `payroll_actuals`, `adjustments`, `alerts`, `providers`, `audit_log`

---

## 🧩 Roles & Expectations

**AIGOR Strategic Developer** — sets direction; no pre-approvals needed.
**Copilot Agent** — builds and deploys autonomously; attaches **Evidence Pack**; iterates until GREEN.

**Behavior:** Proactive, evidence-based, stage-aware, OIDC-only, fail-fast, no hard-coded execute-api in `src/`.

---

## ⚙️ General Operating Policy

- **AUTONOMOUS MODE:** Do **not** ask for approvals; iterate until GREEN.
- **Security:** OIDC role only for AWS; no static keys.
- **Envs:** Write with `printf` and strip CRLF (`sed -i 's/\r$//' "$GITHUB_ENV"`).
- **Stages:** Treat **dev** and **prod** as first-class citizens (no collisions).
- **Evidence:** Every run must append a complete **Evidence Pack** to `$GITHUB_STEP_SUMMARY`.

---

## 🗺️ Architecture (Target State)

- **UI:** Two SPAs — PMO (root `/`) and Finanzas (`/finanzas/*`) — built via Vite with correct `base` and Router basename.
- **API:** SAM HTTP API with default Cognito JWT authorizer; public `/health`, `/catalog/rubros`; protected: `projects`, `rubros (project)`, `allocations:bulk`, `plan`, `payroll/ingest`, `close-month`, `adjustments`, `alerts`, `providers`, `prefacturas/webhook`.
- **RBAC:** Cognito group → role; finance access = `SDT|FIN|AUD`.
- **CDN:** CloudFront behavior `/finanzas/*` → S3 origin `finanzas-ui-s3`; SPA fallback; OAC bucket policy.

---

## 🧱 Backend — SAM Must-Haves

### 1) Stage-scoped exports (avoid collisions)

```yaml
Outputs:
  FinzApiUrl:
    Description: HTTP API URL
    Value: !Sub "https://${Api}.execute-api.${AWS::Region}.amazonaws.com/${StageName}"
    Export:
      Name: !Sub "finz-api-url-${StageName}"
  FinzApiId:
    Description: HTTP API ID
    Value: !Ref Api
    Export:
      Name: !Sub "finz-api-id-${StageName}"
```

- **Stacks:** `finanzas-sd-api-dev` (`StageName=dev`), `finanzas-sd-api-prod` (`StageName=prod`).

### 2) RBAC consistency

- **Update** `ensureSDT()` (or equivalent) to accept any of: `SDT`, `FIN`, `AUD` (configurable set).
- OR standardize group assignment to `SDT` only — in either case, **front and back must match**.

### 3) Public & protected routes

- Public: `GET /health`, `GET /catalog/rubros`
- Protected (JWT): all others — **fail 401** without token; **200** with valid `IdToken`.

---

## 🎛️ Frontend — Auth & Routing Must-Haves

### 1) Unified login (Finanzas design)

- Replace PMO login with **Finanzas Login** (single `Login.tsx`), styled consistently.
- Direct login (USER_PASSWORD_AUTH) and Hosted UI supported.

### 2) Hosted UI configuration (Cognito)

```ts
oauth: {
  domain: 'us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com',
  scope: ['email', 'openid', 'profile'],
  redirectSignIn: 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html',
  redirectSignOut: 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/',
  responseType: 'code' // or 'token' if implicit
}
```

- **Callback page** (`public/finanzas/auth/callback.html`) must parse token, set **both** `cv.jwt` and `finz_jwt`, then route by groups (prefer Finanzas unless `cv.module==='pmo'`).

### 3) Router & base

- Vite `base='/finanzas/'`; React Router basename `/finanzas`.
- Use `<Link to="...">` (no raw `href`) for internal navigation.
- Finanzas-only builds: no PMO fallback; post-login lands at `/finanzas/`.

### 4) API client

- Production disables mocks. All real calls use `src/api/finanzasClient.ts` and **`VITE_API_BASE_URL`** injected by CI.
- No `window.location.origin` or hard-coded execute-api URLs in `src/`.

---

## 🌩️ CDN — CloudFront Behavior & SPA Fallback

- **Behavior precedence:** `/finanzas/*` before `Default (*)`.
- **OAC Bucket Policy:** S3 denies public; allows CloudFront distribution to read `finanzas/`.
- **SPA fallback:** Custom Error Responses for `/finanzas/*`: 404/403 → `/finanzas/index.html` (HTTP 200).
- **Trailing slash:** Normalize `/finanzas` → `/finanzas/` (CF function or redirect rule).

**Validation curls (post-deploy):**

```bash
curl -I https://<CF_DOMAIN>/finanzas/            # 200
curl -I https://<CF_DOMAIN>/finanzas             # 200 (redirect or content)
curl -I https://<CF_DOMAIN>/finanzas/catalog/rubros  # 200
```

---

## 🚀 CI/CD — Deploys & Guards

### 1) Deploy UI (`.github/workflows/deploy-ui.yml`)

- **Build targets:**

  - PMO → `dist-pmo/` (base `/`)
  - Finanzas → `dist-finanzas/` (base `/finanzas/`)

- **Inject envs by stage** (use repo variables):

  - `FINZ_API_ID_DEV`, `FINZ_API_STAGE_DEV=dev`
  - `FINZ_API_ID_PROD`, `FINZ_API_STAGE_PROD=prod`
  - Construct `VITE_API_BASE_URL=https://$API_ID.execute-api.${AWS_REGION}.amazonaws.com/$STAGE`

- **Guards:**

  - **EXPECTED_API_ID** = `${{ vars.FINZ_API_ID_<ENV> }}`; fail if host id mismatch.
  - Fail if `dist-finanzas/index.html` contains `src="/assets/` (should be `/finanzas/assets/`).
  - Fail if HTML contains `github.dev` / `codespaces`.

- **Upload:**

  - PMO → `s3://$S3_BUCKET/`
  - Finanzas → `s3://$S3_BUCKET/finanzas/`

- **Invalidate:** `/*`, `/finanzas/*`, `/finanzas/index.html`

### 2) Deploy API (`.github/workflows/deploy-api.yml`)

- OIDC only; stacks: `finanzas-sd-api-<stage>`; pass `StageName=<stage>`.
- **After deploy:**
  - Read CFN outputs `finz-api-id-<stage>`, `finz-api-url-<stage>`.
  - Guard routes present: `/health`, `/catalog/rubros`, `POST /projects`.
  - Guard: CognitoJwt authorizer configured.
  - Smoke: `/health` 200; `POST /projects` with JWT; `/catalog/rubros` 200.
  - **Seed** `rubros_taxonomia` with `ts-node` script; log inserted counts.

### 3) Post-Deploy (`.github/workflows/post-deploy.yml`)

- **Trigger:** `workflow_run` on `deploy-ui` (success or failure).
- **Steps:**
  - curl CF `/`, `/finanzas/`, HTML snippet (first 20 lines)
  - verify `/finanzas/assets` exists; no `github.dev` in HTML
  - newman or curl API: `GET /health`, `GET /catalog/rubros` (200), `GET /allocation-rules` (with JWT)
  - **Append Evidence Pack** to `$GITHUB_STEP_SUMMARY`; open issue if failed.

---

## 🔬 Evidence Pack (Required in `$GITHUB_STEP_SUMMARY`)

**API**

- `ApiId`, `ApiUrl`
- `/health` JSON (`ok:true` expected)
- `/catalog/rubros` count (≥1), sample keys
- `/allocation-rules` count (≥1) with JWT

**Seeds**

- Upsert counts (rubros taxonomy, etc.)

**UI**

- CloudFront `/finanzas/` headers (200)
- First 20 lines of HTML; **must** include `/finanzas/assets/`
- No `github.dev` / `codespaces` in HTML

**Newman**

- Collection run summary with pass/fail per request

---

## ✅ Minimal CI Targets

- **UI:**

  - `/finanzas/` returns 200
  - HTML uses `/finanzas/assets/*`
  - No dev references in HTML

- **API:**

  - `/health` 200
  - `/catalog/rubros` 200
  - Protected endpoint 200 with **IdToken**; 401 without

- **RBAC:**

  - Back-end accepts `SDT|FIN|AUD` (or front/back standardized on one)
  - PMO-only users are denied finance endpoints (403)

- **Deploy:**
  - dev & prod stacks co-exist (stage-scoped exports)
  - post-deploy workflow produced Evidence Pack

---

## 🧪 Local & Manual Smoke (quick sheet)

```bash
# Frontend
npm ci && npm run build
npx serve dist-finanzas   # or preview

# Backend
sam build && sam deploy --stack-name finanzas-sd-api-dev --parameter-overrides StageName=dev

# API
curl -fsS $API_URL/health | jq .
curl -fsS $API_URL/catalog/rubros | jq '.data | length'
ID_TOKEN=$(aws cognito-idp initiate-auth ... --query 'AuthenticationResult.IdToken' --output text)
curl -fsS -H "Authorization: Bearer $ID_TOKEN" $API_URL/allocation-rules | jq '.data | length'

# CDN
curl -I https://<CF_DOMAIN>/finanzas/
curl -s https://<CF_DOMAIN>/finanzas/ | head -n 20
```

---

## 🔁 Iteration Policy

- **Fix → redeploy → smoke → attach Evidence Pack → repeat** until all Minimal CI Targets are GREEN.
- On any failure, **open an issue** with logs and assign to Copilot automatically.
- Do not block on pre-approvals; merge when all guards and tests are GREEN.

---

## 🧹 Repo Hygiene (post-cleanup)

- Keep workflows: `deploy-ui.yml`, `deploy-api.yml`, `smoke-only.yml`, `post-deploy.yml` (new).
- Remove deprecated workflow duplicates.
- Update `docs/tree.structure.md` to reflect finalized structure and env injection points.
- `.gitignore`: ensure `.pnpm-store`, `dist*/`, `*.env*` (local) are excluded.

---

## Quick Reference — Key Endpoints

| Endpoint                              | Auth              | Expected Status | Notes                   |
| ------------------------------------- | ----------------- | --------------- | ----------------------- |
| `GET /health`                         | None              | 200             | Health check, public    |
| `GET /catalog/rubros`                 | None              | 200             | Rubros taxonomy, public |
| `POST /projects`                      | JWT + SDT/FIN/AUD | 200/201         | Create project          |
| `GET /projects`                       | JWT + SDT/FIN/AUD | 200             | List projects           |
| `PUT /projects/{id}/allocations:bulk` | JWT + SDT/FIN/AUD | 200             | Bulk allocate           |
| `POST /payroll/ingest`                | JWT + SDT/FIN/AUD | 200/202         | Ingest payroll          |
| `POST /close-month`                   | JWT + SDT/FIN/AUD | 200/202         | Close month             |
| `POST /adjustments`                   | JWT + SDT/FIN/AUD | 201             | Create adjustment       |
| `GET /adjustments`                    | JWT + SDT/FIN/AUD | 200             | List adjustments        |
| `GET /alerts`                         | JWT + SDT/FIN/AUD | 200             | Fetch alerts            |
| `POST /providers`                     | JWT + SDT/FIN/AUD | 201             | Create provider         |
| `GET /providers`                      | JWT + SDT/FIN/AUD | 200             | List providers          |

---

## Environment Variables Checklist

### Build & Runtime (React/Vite)

- [ ] `VITE_PUBLIC_BASE` = `/finanzas/`
- [ ] `VITE_FINZ_ENABLED` = `true` (for Finanzas-only builds)
- [ ] `VITE_API_BASE_URL` = injected by CI (dev/prod specific)
- [ ] `VITE_COGNITO_REGION` = `us-east-2`
- [ ] `VITE_COGNITO_USER_POOL_ID` = `us-east-2_FyHLtOhiY`
- [ ] `VITE_COGNITO_CLIENT_ID` = `dshos5iou44tuach7ta3ici5m`

### CI/CD (GitHub Actions)

- [ ] `FINZ_API_ID_DEV` (repo var)
- [ ] `FINZ_API_ID_PROD` (repo var)
- [ ] `FINZ_API_STAGE_DEV` = `dev` (repo var)
- [ ] `FINZ_API_STAGE_PROD` = `prod` (repo var)
- [ ] `S3_BUCKET_NAME` (repo var)
- [ ] `CLOUDFRONT_DIST_ID` (repo var)
- [ ] `AWS_REGION` = `us-east-2` (repo var)
- [ ] `COGNITO_TEST_USER` (GitHub secret)
- [ ] `COGNITO_TEST_PASSWORD` (GitHub secret)

---

### Final Note

These instructions are **binding** for the agent. If any ambiguity arises, choose the option that best matches: **stage-aware, OIDC-only, evidence-driven, minimal-surprise**.

**Status:** Active  
**Last Updated:** November 11, 2025  
**Owner:** Copilot Agent (Finanzas SD)
