# Validation plan

## Local commands
- `npm test` – runs smoke tests plus unit suites (includes new pagination and normalization tests).
- `npm run lint` – ensures TypeScript/ESLint health.
- `npm run build` – validate typecheck/build (set `VITE_API_BASE_URL` for Finanzas build).

## Verification script
- Not required; backend pagination covered by Jest unit tests in `services/finanzas-api/tests/unit/projects.rbac.spec.ts`.

## Deployed validation
1. Open `https://d7t9x3j6j6yd8k.cloudfront.net/finanzas/sdmt/cost/forecast` with an account that owns custom projects.
2. Project selector should list all owned/authorized projects (including user-created ones).
3. Selecting any project should populate SDMT metrics/cards (baseline, allocations, payroll charts) without missing data.
4. Confirm no authorization errors in browser console/network; responses should include full project list (`total` matches count) with no `LastEvaluatedKey` truncation.
