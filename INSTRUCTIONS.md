# Project Operating Instructions (Finanzas SD – API & UI)

## Roles
- **Backend Lead**: owns `/services/finanzas-api` (SAM, handlers, DDB, API Gateway).
- **FE Lead**: owns `/src` (UI). No backend logic in FE.
- **SRE**: owns workflows, alarms, canaries, OIDC integrity.

## Guardrails (non-negotiable)
- **OIDC-only** AWS auth. No static AWS keys in workflows.
- Region **us-east-2**.
- Do NOT change `/finanzas/*` CloudFront behavior or any acta-ui resources.
- Every new route returns **501** until implemented and is covered by tests.
- Single Node pkg per service (`services/finanzas-api/package.json`).

## Required repository settings (Actions → Variables / Secrets)
**Variables**
- `AWS_REGION=us-east-2`
- `FINZ_API_STACK=finanzas-sd-api-dev`
- `FINZ_API_STAGE=dev`
- `COGNITO_USER_POOL_ID=<your user pool id>`
- `COGNITO_USER_POOL_ARN=<your user pool arn>`

**Secret**
- `OIDC_AWS_ROLE_ARN=<arn:aws:iam::703...:role/ProjectplaceLambdaRole>`

## QA Gates (must pass before merge)
1) **Unit tests**: `npm test` in `/services/finanzas-api` (pro-rata, coverage math).
2) **SAM local smoke**: `/health` and `/catalog/rubros` → 200.
3) **Deploy OIDC**: `aws sts get-caller-identity` must succeed; no static fallback.
4) **Deployment summary**: API URL + working curl commands written to `$GITHUB_STEP_SUMMARY`.

## Failure policy
- If OIDC fails, **stop** the job with a helpful error. Never fall back to static creds.
- If any required variable is empty, **stop** with a clear message.

## Best practices
- Keep SAM authorizer issuer param from `COGNITO_USER_POOL_ID`.
- Add handlers incrementally; stubs return **501** and are asserted in tests.
- One `package.json` per service; no nested Node projects.
