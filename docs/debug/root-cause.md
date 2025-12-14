# Root cause analysis

- **Primary root cause:** The `/projects` handler scans DynamoDB with a hard `Limit` (default 100) and returns only the first page, ignoring `LastEvaluatedKey`. The frontend calls `/projects?limit=100` once and never paginates. When the projects table exceeds 100 records, end-user-created projects beyond the first page are omitted from the API response.
- **Evidence:** Handler code before fix used a single `ScanCommand` with `Limit: limit` and no `ExclusiveStartKey` loop (`services/finanzas-api/src/handlers/projects.ts`). The API client requests `/projects?limit=100` (`src/api/finanzas.ts`) and normalizes the first payload only. Seed/demo projects remain visible because they occupy early records in the scan; user-generated rows are pushed to later pages and dropped.
- **Secondary contributors:** Recent seed removal increased reliance on live data, raising the project count past 100 and exposing the pagination gap.
