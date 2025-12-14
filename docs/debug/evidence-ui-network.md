# UI network evidence (SDMT cost forecast)

## Endpoints observed
- `GET /projects?limit=100` – used by project selector (`getProjects` in `src/api/finanzas.ts`).
- `GET /baseline?projectId=<id>&project_id=<id>` – SDMT baseline payload for metrics/cards.
- `GET /allocations?projectId=<id>` – cost allocation rows backing SDMT charts.
- `GET /payroll?projectId=<id>&project_id=<id>` – MOD series for SDMT projections.

## Sample response shapes
- Projects: `{ data: ProjectDTO[], total: number }` or bare array; items carry `project_id`, `codigo/code`, `cliente/client`, MOD totals, status fields.
- Baseline/Allocations/Payroll: array responses expected by charts (see `src/api/finanzas.ts`).

## Pagination behavior
- `/projects` currently requests a single page with `limit=100`. DynamoDB backend responds with `LastEvaluatedKey` when more projects exist, but the UI makes no follow-up call.

## Finding
- Live CloudFront endpoint responded with `503 Service Unavailable`, so network traces could not be captured directly. Based on API client and handler code, **missing projects are not present in the single-page response** because pagination is not followed; UI does not filter them afterward.

## Before/after comparison
- Before fix: `/projects?limit=100` returns first page only; any `LastEvaluatedKey` is ignored so end-user-created projects beyond the first 100 never reach the UI.
- After fix: backend now scans all pages internally and returns the complete authorized project list in one response (UI still issues a single call).
