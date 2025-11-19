# Finanzas SD API Mapping

The Finanzas UI uses `buildApiUrl()` from `src/config/api.ts` to combine `VITE_API_BASE_URL` with relative paths. The key SDMT/PMO flows map to the following Lambda handlers behind the shared HTTP API (`services/finanzas-api/template.yaml`).

| FE fn | Path + Method | Backend handler | CORS source | Notes |
|-------|----------------|-----------------|-------------|-------|
| `getLineItems(project_id)` | `GET /projects/{project_id}/rubros` | `services/finanzas-api/src/handlers/rubros.ts:handler` | API Gateway HttpApi CORS config + `lib/http.ts` headers | Lists project rubros/line items, now always emits `Access-Control-*` headers on success/error. |
| `getBillingPlan(project_id)` | `GET /projects/{project_id}/billing` | `services/finanzas-api/src/handlers/billing.ts:handler` | API Gateway HttpApi CORS config + `lib/http.ts` headers | Aggregates prefactura records into `monthly_inflows` with consistent currency + status metadata. |
| `getInvoices(project_id)` | `GET /prefacturas?projectId=...` | `services/finanzas-api/src/handlers/prefacturas.ts:handler` | API Gateway HttpApi CORS config + `lib/http.ts` headers | Secured by Cognito JWT; returns `{ data: InvoiceDoc[], total }` and surfaces validation/auth errors with CORS-compliant responses. |

All three endpoints live under the same HttpApi instance (`Api` resource) and inherit the global `Access-Control-Allow-*` policy for `https://d7t9x3j66yd8k.cloudfront.net`.
