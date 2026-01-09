# SDMT Forecast – Pre-flight Discovery Notes

## OpenAPI (openapi/finanzas.yaml)
- **Baseline accept/reject**: not documented in OpenAPI (no `/projects/{id}/accept-baseline` or `/projects/{id}/reject-baseline` paths found). The spec only references baseline fields in schemas. 
- **Forecast & actuals per-project**:
  - Forecast updates are documented under `PUT /projects/{id}/allocations:bulk` with `type=forecast` in query. 
  - Actuals appear tied to payroll/actuals schemas (e.g., `PayrollActual` fields), but a direct per-project actuals endpoint is not explicitly listed in the spec. 
- **Budgets per-project**: annual all-in budget endpoints are documented as `GET/PUT /budgets/all-in?year=YYYY`. 
- **Budgets All-In Monthly (all projects)**: **not** documented in OpenAPI. 
- **Rubros/Catalog**:
  - `GET /catalog/rubros` (catalog list)
  - `GET/POST /projects/{id}/rubros` (project rubros)
  - `DELETE /projects/{id}/rubros/{rubroId}` (detach)

## Frontend locations
- **Baseline status / accept UI**:
  - `src/components/baseline/BaselineStatusPanel.tsx` (uses `acceptBaseline`, `rejectBaseline`)
- **SDMT Forecast main view**:
  - `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
- **TODOS / ALL_PROJECTS mode**:
  - `ALL_PROJECTS_ID` in `src/contexts/ProjectContext.tsx`
  - Portfolio logic in `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
- **Budget All‑In Monthly hooks/actions**:
  - `finanzasClient.getAllInBudgetMonthly` in `src/api/finanzasClient.ts`
  - Used in `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

## Backend (Finanzas API)
- **Handlers**:
  - Baseline accept/reject: `services/finanzas-api/src/handlers/acceptBaseline.ts`, `rejectBaseline.ts`
  - Budgets all-in monthly: `services/finanzas-api/src/handlers/budgets.ts` (GET/PUT `/budgets/all-in/monthly`)
- **CORS**:
  - Centralized in `services/finanzas-api/src/lib/http.ts` (Allow-Methods includes GET/PUT/OPTIONS)
  - API CORS configuration in `services/finanzas-api/template.yaml` (CloudFront domain + local dev)
