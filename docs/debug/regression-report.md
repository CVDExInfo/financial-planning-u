# Regression report (last 7 days)

## Recent changes touching data flow
- `ddc796a6984ec157a8a5b24006ec2923dd640b5c` (2025-12-08): Raised `/projects` limit to 100 and added query param handling without pagination; touched `services/finanzas-api/src/handlers/projects.ts` and `src/api/finanzas.ts`.
- `7597e5bd123ba965071797bb24c8494a53c13551` (2025-12-13): Removed canonical seed tooling (no functional change to listing logic but affects dataset size).
- `7eac0f9` (2025-12-10): Payroll fallback adjustments (unrelated to project listing).

## Suspected regression commit
- **Commit:** `ddc796a6984ec157a8a5b24006ec2923dd640b5c`
- **Reasoning:** Introduced hard `limit` handling for `GET /projects` but did not surface pagination tokens or loop through pages. With more than 100 records (now likely after seed removal), end-user-created projects beyond the first page are never returned.
- **Diff summary:** Added `limit` clamp and request param parsing on the handler and API client (`/projects?limit=100`), but kept a single DynamoDB `ScanCommand` without `LastEvaluatedKey` handling.
