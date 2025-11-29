# SDMT Changes 500 deep-dive

## 1) Backend routing and infrastructure
- Both `GET` and `POST /projects/{projectId}/changes` are wired to `ChangesFn` (handler `changes.handler`) with Cognito auth and DynamoDB CRUD permissions against `ChangesTable` (`${TablePrefix}changes`).【F:services/finanzas-api/template.yaml†L1222-L1255】
- All Lambda functions inherit `TABLE_CHANGES` (`${TablePrefix}changes`) via globals; the data helper falls back to `finz_changes` if the env var is missing, so a mis-set prefix silently points to a non-existent table and yields Dynamo `ResourceNotFoundException`.【F:services/finanzas-api/template.yaml†L21-L61】【F:services/finanzas-api/src/lib/dynamo.ts†L26-L60】

## 2) Handler behaviour and 500 surfaces
- `GET` requires `projectId`, enforces `ensureCanRead`, and queries `pk = PROJECT#{projectId}` in the changes table; it only returns a 500 when Dynamo reports the table is missing or another unhandled Dynamo error bubbles up.【F:services/finanzas-api/src/handlers/changes.ts†L73-L109】【F:services/finanzas-api/src/handlers/changes.ts†L204-L227】
- `POST` enforces `ensureCanWrite`, rejects invalid JSON with 400 and missing `title`/`description`/numeric `impact_amount` with 422, then writes `pk = PROJECT#{projectId}` / `sk = CHANGE#{id}`. Duplicates return 409, a missing table again returns a 500, all other Dynamo errors bubble as 500s.【F:services/finanzas-api/src/handlers/changes.ts†L111-L199】
- Unit tests mock Dynamo/auth and assert the “table not found” path returns 500, so green tests do not validate that the real dev table exists or that `TABLE_CHANGES` is wired correctly.【F:services/finanzas-api/tests/unit/changes.spec.ts†L181-L191】

## 3) Contract tests vs live traffic
- The contract script discovers the first project from `/projects`, then calls `GET /projects/{id}/changes` and `POST` with `title`, `description`, `impact_amount`, `currency`, `justification`, and `affected_line_items`; any non-2xx exits. It does **not** assert on a specific table name, so a mis-resolved table that returns HTTP 500 would fail, but a wrong table name that exists (e.g., seeded elsewhere) could still pass.【F:tests/finanzas/changes/run-changes-tests.sh†L37-L128】

## 4) Frontend wiring and payload
- `ApiService.getChangeRequests`/`createChangeRequest` hit `/projects/${project_id}/changes` with Authorization headers and payload fields the handler accepts (`title`, `description`, `impact_amount`, `currency`, `justification`, `affected_line_items`, optional `baseline_id`), and they normalize responses into the UI model without extra fields that could 4xx/500 the handler.【F:src/lib/api.ts†L715-L818】
- The SDMT Changes UI requires a selected project, validates the same required fields, and submits through `ApiService.createChangeRequest`; it does not add unexpected properties or routes.【F:src/features/sdmt/cost/Changes/SDMTChanges.tsx†L63-L152】

## 5) Likely root cause of dev 500s
Only two realistic 500 paths exist in the handler: Dynamo `ResourceNotFoundException` (or other Dynamo failures) and unexpected exceptions. Given:
- Env fallbacks allow `tableName("changes")` to silently resolve to `finz_changes` when `TABLE_CHANGES`/`TablePrefix` are wrong.【F:services/finanzas-api/src/lib/dynamo.ts†L26-L60】
- UI and contract payloads align with the handler and are pre-validated, leaving Dynamo resolution as the remaining source of 500s.
The dev 500s are therefore most consistent with the Lambda resolving a non-existent or wrong changes table (prefix/env drift or missing table deployment). Both GET and POST would surface that as HTTP 500, while mocked unit tests stay green and contract tests can still pass if they happen to hit an accidentally present table name.

## 6) Minimal, precise fix plan
1) **Verify and align table wiring**: In the dev stack, confirm `TABLE_CHANGES` equals the deployed `${TablePrefix}changes` and that the `ChangesTable` resource actually exists. If the prefix differs from deployed tables, adjust the stack env/parameter or create the missing `${TablePrefix}changes` table.
2) **Tighten Dynamo error handling**: Optionally translate `ResourceNotFoundException` into a clearer 503/404 in `changes.ts` so misconfigurations don’t present as opaque 500s during future rollouts (auth must remain unchanged).
3) **Strengthen contract coverage**: Add an assertion in `run-changes-tests.sh` to fail when the response body matches the “Changes table not found” error string, ensuring CI fails when the table/env wiring regresses.
4) **Manual validation**: After fixing the table/env, run the contract script and create/list changes in the UI to confirm both endpoints return 2xx and persist data.

## 7) Test and validation checklist
- Backend unit tests: `cd services/finanzas-api && npm test -- --runInBand`
- Contract tests: `bash tests/finanzas/projects/run-projects-tests.sh` and `bash tests/finanzas/changes/run-changes-tests.sh`
- Frontend build: `npm run build:finanzas`
- Manual UI: In dev, log in, select a project, load Changes (no 500s), submit a new change with required fields, see it listed, refresh to confirm persistence.
