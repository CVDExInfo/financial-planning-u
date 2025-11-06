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

- `deploy-ui.yml` checks required vars (`S3_BUCKET_NAME`, `CLOUDFRONT_DIST_ID`, `VITE_API_BASE_URL`), normalizes API base, builds with feature flags, syncs to S3, then invalidates CloudFront.
- Future improvement: Add smoke test requesting `/finanzas/catalog/rubros` post-deploy with `curl` and append status to summary.

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
