# Environment Configuration (Finanzas Module)

This document captures the environment variables and deployment pathing required for the Finanzas (budget management) module across local development, CI workflows, and CloudFront/S3 hosting.

## Overview

The Finanzas UI is served from a CloudFront distribution backed by an S3 bucket under the SPA base path `/finanzas/`. The React Router `basename` and Vite `base` must match this path to ensure deep-linking works when users refresh on nested routes (e.g. `/finanzas/catalog/rubros`).

## Variables Matrix

| Variable             | Scope              | Required                  | Description                                                 | Notes                                                      |
| -------------------- | ------------------ | ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `VITE_API_BASE_URL`  | Build / Runtime    | Yes                       | Base URL of deployed Finanzas API stage (no trailing slash) | Normalized in deploy workflows to remove trailing slashes. |
| `VITE_FINZ_ENABLED`  | Build / Runtime    | Recommended               | Feature flag to enable Finanzas routes in the UI            | Set to `true` in dev to expose catalog.                    |
| `AWS_REGION`         | CI Deploy          | Yes                       | AWS region for SAM/API + S3/CloudFront                      | Defaults to `us-east-2` if not provided.                   |
| `S3_BUCKET_NAME`     | CI Deploy          | Yes                       | Target bucket for SPA assets                                | Must match Terraform output.                               |
| `CLOUDFRONT_DIST_ID` | CI Deploy          | Yes                       | Distribution to invalidate after UI deploy                  | SPA path invalidated: `/finanzas/*`.                       |
| `OIDC_AWS_ROLE_ARN`  | CI Deploy (Secret) | Yes                       | Federated role used by GitHub Actions via OIDC              | Provided as secret in workflow input.                      |
| `TABLE_RUBROS`       | API Seed Script    | Yes (for seed)            | DynamoDB table name for Rubros definitions                  | Passed to seed script execution context.                   |
| `COGNITO_JWKS_URL`   | API Contract Tests | Yes (protected endpoints) | JWKS endpoint to validate Cognito JWTs                      | Derived from UserPool; used in tests.                      |

## Canonical API Selection & Drift Guards

There are currently TWO distinct HTTP APIs in the wider platform context:

- **Finanzas SD API (dev)** – the one this UI must call (example: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`).
- **Acta (legacy/other domain) API (prod)** – similar shape but NOT the target for Finanzas (`https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod`).

To prevent accidental drift (e.g., pointing the Finanzas UI at the Acta API) we enforce guards in CI:

| Guard | Mechanism | Failure Symptom | Resolution |
|-------|-----------|-----------------|------------|
| Canonical API ID | Extract API ID from `DEV_API_URL` (`awk -F'[/.]' '{print $3}'`). Compare with expected `FINZ_EXPECTED_API_ID` (optional var). | Pipeline step exits before smokes. | Set `DEV_API_URL` to Finanzas API stage URL or update expected ID if stack replaced. |
| `/health` route presence | `aws apigatewayv2 get-routes --api-id <id>` and grep for `GET /health`. | 404 during smokes; guard step fails. | Ensure `HealthFn` (public authorizer NONE) is present in SAM template and redeploy. |
| Authorization header correctness | Smokes use `Authorization: Bearer $TOKEN`. | 401 on protected endpoints; earlier logs showed literal `***`. | Keep token variable; never mask manually. GitHub redacts automatically. |
| Trailing slash normalization | CI removes trailing slashes from `DEV_API_URL`. | Double slashes in requests (//catalog). | Fixed automatically by normalization step. |

### Required Public `/health` Endpoint

The Finanzas API must expose a **public** (no JWT) `GET /health` for lightweight availability checks. In SAM (`template.yaml`), set `Auth: Authorizer: NONE` for the health event. Example handler:

```ts
// services/finanzas-api/src/handlers/health.ts
export const handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true, service: 'finanzas-sd-api', stage: 'dev', time: new Date().toISOString() }),
});
```

### Environment Variables Involved

| Variable | Purpose | Notes |
|----------|---------|-------|
| `DEV_API_URL` | Canonical Finanzas API base (stage URL). | Resolved from CloudFormation output `FinzApiUrl` in UI deploy workflow; overrides any stale repo var. |
| `VITE_API_BASE_URL` | Frontend build-time and runtime API base. | Set equal to normalized `DEV_API_URL` inside workflows. |
| `FINZ_EXPECTED_API_ID` | Optional guard value for API ID drift. | If set and mismatch occurs, pipeline fails early. |
| `VITE_FINZ_ENABLED` | Feature flag gating Finanzas routes. | Must be `true` for module visibility. |
| `VITE_USE_MOCKS` | Frontend mocking toggle. | Forced `false` in CI to ensure real API integration. |

### CI Guard Implementation (Excerpt)

```bash
API_URL=$(aws cloudformation describe-stacks --stack-name "$FINZ_API_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='FinzApiUrl'].OutputValue" --output text)
DEV_API_URL="${API_URL%/}"
HOST_ID=$(echo "$DEV_API_URL" | awk -F'[/.]' '{print $3}')
if [ -n "$EXPECTED_API_ID" ] && [ "$HOST_ID" != "$EXPECTED_API_ID" ]; then
  echo "❌ Expected API id $EXPECTED_API_ID, got $HOST_ID"; exit 1
fi
aws apigatewayv2 get-routes --api-id "$HOST_ID" --query 'Items[].RouteKey' --output text | tr '\t' '\n' | grep -q 'GET /health' || {
  echo "❌ Route GET /health missing on API $HOST_ID"; exit 1; }
```

### Troubleshooting Drift & Errors

| Symptom | Root Cause | Quick Check | Fix |
|---------|------------|-------------|-----|
| 404 /health | Route not deployed; health function missing/wrong path. | `aws apigatewayv2 get-routes --api-id <id>` | Add health handler & redeploy SAM. |
| 404 catalog/rubros | Catalog function failed build; incorrect entryPoints. | SAM build logs; route list. | Ensure `EntryPoints: - src/handlers/catalog.ts` with `CodeUri: .` |
| 401 allocation-rules | Missing/invalid Bearer token. | Curl with `-v` to view headers (locally). | Ensure JWT generation step succeeded; use `Bearer $TOKEN`. |
| UI calling wrong API (prod vs dev) | Stale `VITE_API_BASE_URL` or mis-set variable. | Inspect build log echo lines. | Rely on CFN resolution step; remove hard-coded repo var. |
| Literal `***` in logs | Manual mask attempt. | Review workflow script. | Do not replace token; GitHub masks automatically. |

### Adding Another Environment

For a new stage (e.g., `qa`):
1. Deploy SAM stack for that stage; capture `FinzApiUrl` output.
2. Set a branch or workflow variable `FINZ_API_STACK=finanzas-sd-api-qa`.
3. (Optional) Set `FINZ_EXPECTED_API_ID` for the qa API id.
4. Guard & UI deploy will auto-resolve `DEV_API_URL` from CloudFormation.

### Summary

The CI system now *derives* the API base URL at deploy time, validates it targets the correct gateway, confirms `/health` exists, and only then runs endpoint smokes using a true `Bearer $TOKEN`. This prevents silent drift to an unrelated API and gives early, explicit failure signals.


## Local Development

```bash
# .env.local (example)
VITE_API_BASE_URL=https://abc123.execute-api.us-east-2.amazonaws.com/dev
VITE_FINZ_ENABLED=true
```

Run local dev server:

```bash
npm run dev
```

## Build Considerations

1. Trailing Slash Removal: `VITE_API_BASE_URL` is sanitized during CI to avoid `//` in fetch URLs.
2. SPA Base Path: Ensure `vite.config.ts` has `base: '/finanzas/'`. Router `basename` must match.
3. Feature Flag: If `VITE_FINZ_ENABLED` is not `true`, Finanzas routes are not registered (safe dark-launch).

## CloudFront / S3 Pathing

- UI assets uploaded to: `s3://<S3_BUCKET_NAME>/finanzas/`.
- CloudFront must forward `/finanzas/*` to the S3 origin.
- 403/404 responses should be rewritten to `/finanzas/index.html` for deep links.

## API Integration

The UI client (`finanzasClient.ts`) builds requests as:

```
{VITE_API_BASE_URL}/catalog/rubros
```

It strips any trailing slash from `VITE_API_BASE_URL` and adds an `Authorization` header when a token (`finz_jwt`) is present in `localStorage`.

## Seeding Data

The seed script `services/finanzas-api/scripts/seed_rubros.ts` requires:

```bash
TABLE_RUBROS=<dynamodb-table-name>
```

Run (example):

```bash
npm run seed:rubros
```

(Executed from the `services/finanzas-api/` directory; ensure AWS credentials configured.)

## CI Workflow Alignment

Current behavior (summarized):

- Resolve canonical API base from CloudFormation output `FinzApiUrl` using the stack name (e.g., `finanzas-sd-api-dev`). Normalize trailing slash.
- Set `VITE_API_BASE_URL=${DEV_API_URL%/}`, `VITE_USE_MOCKS=false`, and `VITE_FINZ_ENABLED=true` for the UI build.
- Guard (pre-smoke): parse API id from `DEV_API_URL` (optionally compare with `FINZ_EXPECTED_API_ID`) and verify `GET /health` exists via `aws apigatewayv2 get-routes`.
- Build UI, upload to S3 under `/finanzas/`, and invalidate CloudFront.
- Post-deploy smokes: UI root HEAD/GET checks; API smokes for `/health` (public), `/catalog/rubros` and `/allocation-rules` using `Authorization: Bearer $TOKEN`.

## Troubleshooting

| Symptom                                         | Likely Cause                          | Fix                                                    |
| ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| 404 on refresh of nested route                  | Missing SPA error rewrite             | Configure CloudFront to serve `index.html` on 403/404. |
| API calls show double slash (`//catalog`)       | Trailing slash in `VITE_API_BASE_URL` | Normalize or remove trailing slash.                    |
| Finanzas route missing                          | Feature flag not set                  | Set `VITE_FINZ_ENABLED=true` and rebuild.              |
| CORS errors from API                            | CloudFront domain not in AllowOrigins | Update SAM template CORS config and redeploy.          |
| Seed script fails with `TABLE_RUBROS` undefined | Missing env variable                  | Export `TABLE_RUBROS` before running script.           |

## Next Steps

- Add post-deploy UI smoke to confirm Rubros table renders.
- Document protected endpoints and JWT acquisition flow once Cognito setup is finalized.
