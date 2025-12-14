# Fix summary

## Changed files
- `services/finanzas-api/src/handlers/projects.ts` – paginate DynamoDB scans for `/projects`, add structured logs, and return the complete authorized list in one response.
- `services/finanzas-api/tests/unit/projects.rbac.spec.ts` – new coverage proving multi-page scans are stitched together and totals preserved.
- `src/api/__tests__/finanzas.projects.test.ts` – guardrail that large project lists are not truncated on the client normalization path.

## What changed and why
- Replaced single-page scans with a loop over `LastEvaluatedKey`, so all authorized projects are returned even when the table exceeds 100 records.
- Added request/response logs to capture user identity, roles, and pagination state for troubleshooting and auditability.
- Added tests to prevent regressions: backend pagination stitching, contract total preservation, and frontend normalization retaining all items.

## How it resolves the issue
- The UI now receives the full project dataset in its single `/projects` request, so end-user-created projects appear in selectors and downstream SDMT views instead of being dropped after the first DynamoDB page.
