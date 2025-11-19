# Baseline Creation Flow Mapping

- **UI Surface**: `src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx`
  - `handleDigitalSign` orchestrates the Review & Sign step inside the SDM Cost Estimator wizard.
  - Calls `ApiService.createBaseline` with the aggregate labor/non-labor payload and metadata collected from prior steps.
- **Frontend Service**: `src/lib/api.ts`
  - `ApiService.createBaseline(request)` POSTs the payload to `POST /baseline` using the configured `VITE_API_BASE_URL`.
  - Receives `{ baseline_id, project_id, signature_hash, total_amount, created_at }` and bubbles it back to the wizard to drive confirmation UI + downstream SDMT handoff.
- **API Gateway / Lambda**:
  - **Endpoint**: `POST /baseline` (see `services/finanzas-api/template.yaml` → `BaselineFn`).
  - **Handler**: `services/finanzas-api/src/handlers/baseline.ts:createBaseline`.
  - Validates payload, computes canonical totals, stamps a server-side `signature_hash`, writes the project/baseline record into DynamoDB, and emits an audit-log entry.
- **Data Stores**:
  - **Projects Table**: `TABLE_PROJECTS` (defaults to `finz_projects`) stores the project/baseline metadata plus the canonical payload + hash for SDMT use.
  - **Audit Log Table**: `TABLE_AUDIT` captures `baseline_created` events with the signature hash and caller metadata.

This chain ensures the SDM Cost Estimator UI, shared API client, Lambda handler, and DynamoDB persistence all stay aligned for baseline creation.
