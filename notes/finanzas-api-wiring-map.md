# Finanzas SD – Frontend API Usage Map (Phase 1)

| FE function | HTTP | Path | Used by screen/component | Expected shape |  
| --- | --- | --- | --- | --- |
| `uploadInvoice` (presign + upload) | `POST` to `/uploads/docs`, S3 `PUT`, then `POST` to `/prefacturas` | `/uploads/docs` and `/prefacturas` | SDMT Reconciliation (`SDMTReconciliation.tsx`) | Presign returns `{ uploadUrl, objectKey }`; final create returns `InvoiceDTO` with ids, amounts, document metadata, status. |
| `uploadSupportingDocument` | `POST` to `/uploads/docs`, S3 `PUT` | `/uploads/docs` | (Not currently referenced by screens) | Returns `{ documentKey, originalName, contentType }` after upload. |
| `updateInvoiceStatus` | `PUT` | `/projects/{projectId}/invoices/{invoiceId}/status` | (No current UI caller) | Expects `{ status, comment? }`; returns updated `InvoiceDTO`. |
| `addProjectRubro` | `POST` (fallback on 404/405) | `/projects/{id}/catalog/rubros` → `/projects/{id}/rubros` | Not directly referenced; superseded by `finanzasClient.createProjectRubro` | Accepts flexible JSON payload; returns raw JSON (parsed if present). |
| `getProjectRubros` / `getProjectLineItems` | `GET` (fallback on 404/405) | `/projects/{id}/rubros` → `/projects/{id}/catalog/rubros` | `useProjectLineItems` hook | Returns array of line items (`LineItemDTO[]`), tolerates `{ data: [] }` envelope. |
| `getProjects` | `GET` | `/projects?limit=50` | Finanzas Projects Manager | Returns JSON payload; caller normalizes from `data`/`items` arrays. |
| `getInvoices` | `GET` | `/prefacturas?projectId={id}` | SDMT Forecast | Returns array of invoice rows; mapped to `InvoiceDoc` with amount, month, status, document metadata. |

## `finanzasClient` thin wrapper

| FE function | HTTP | Path | Used by screen/component | Expected shape |
| --- | --- | --- | --- | --- |
| `health` | `GET` | `/health` | (Diagnostics only; no UI hook found) | `{ ok: boolean, stage?, time? }`. |
| `getRubros` | `GET` | `/catalog/rubros` | Finanzas Rubros Catalog | `{ data: Rubro[], total? }` validated via zod schema. |
| `getAllocationRules` | `GET` | `/allocation-rules` | Allocation Rules Preview | `{ data: AllocationRule[] }` validated via schema. |
| `createProject` | `POST` | `/projects` | Finanzas Projects Manager | Expects validated `ProjectCreate`; returns `Project`. |
| `createProjectRubro` | `POST` | `/projects/{id}/rubros` | Rubros Catalog (Add to project) | Body `{ rubroIds: string[], monto_total?, tipo_ejecucion?, meses_programados?, notas? }`; returns created rubro association. |
| `saveAllocations` | `PUT` | `/projects/{id}/allocations:bulk` | (No direct UI caller in current tree) | `{ updated_count: number, allocations: unknown[] }`. |
| `createAdjustment` | `POST` | `/adjustments` | Adjustments Manager | Returns backend response (opaque). |
| `createProvider` | `POST` | `/providers` | Providers Manager | Returns backend response (opaque). |

## Backend route map (Phase 2)

| Route | Method | Handler file | Auth guard | Response envelope |
| --- | --- | --- | --- | --- |
| `/health` | GET | `src/handlers/health.ts` | None (Auth: NONE) | `{ ok: true }` via `ok()` helper. |
| `/projects` | GET | `src/handlers/projects.ts` | `ensureCanRead` | `ok({ data: projects[], total })`. |
| `/projects` | POST | `src/handlers/projects.ts` | `ensureCanWrite` | `ok(newProject, 201)` where body includes identifiers and audit metadata. |
| `/projects/{projectId}/rubros` | GET | `src/handlers/rubros.ts` | `ensureCanRead` | `ok({ data, total })` of attached rubros. |
| `/projects/{projectId}/rubros` | POST | `src/handlers/rubros.ts` | `ensureCanWrite` | `ok({ message, attached })` after linking rubros. |
| `/projects/{projectId}/rubros/{rubroId}` | DELETE | `src/handlers/rubros.ts` | `ensureCanWrite` | `ok({ message })` when detaching. |
| `/projects/{projectId}/catalog/rubros` | — | *(no dedicated route defined; closest is `/projects/{projectId}/rubros` and alias `/line-items`)* | — | — |
| `/line-items` (alias for project rubros) | GET | `src/handlers/line-items.ts` | `ensureCanRead` | `ok({ data, total, project_id })`; OPTIONS handled with `noContent()`. |
| `/catalog/rubros` | GET | `src/handlers/catalog.ts` | `ensureCanRead` (template Auth: NONE) | JSON `{ data, total, nextToken? }`, falls back to seeded sample when DDB unavailable. |
| `/prefacturas` | GET | `src/handlers/prefacturas.ts` | `ensureCanRead` | `ok({ data, projectId, total })` filtered by `projectId` query param. |
| `/prefacturas` | POST | `src/handlers/prefacturas.ts` | `ensureCanWrite` | `ok(invoiceItem, 201)` with generated `invoiceId` and metadata. |
| `/uploads/docs` | POST | `src/handlers/upload-docs.ts` | `ensureCanWrite` | `ok({ uploadUrl, objectKey })` presign response. |
| `/projects/{projectId}/invoices` | GET | `src/handlers/invoices/app.ts` | `ensureCanRead` | `ok({ data, projectId, total })` normalized from prefacturas table. |
| `/projects/{projectId}/invoices/{invoiceId}` | GET | `src/handlers/invoices/app.ts` | `ensureCanRead` | `ok(normalizedInvoice)` by `invoiceId`. |
| `/projects/{projectId}/invoices/{invoiceId}/status` | PUT/POST | `src/handlers/invoices/app.ts` | `ensureCanWrite` | `ok(normalizedInvoice)` after status/comment update. |
| `/plan/forecast` | GET | `src/handlers/forecast.ts` | None (Auth: NONE) | `ok({ data, projectId, months, generated_at })`; requires `projectId` query param. |

## Phase 3 – FE vs BE mismatches

| Type | FE surface | BE route/handler | What is mismatched | Evidence |
| --- | --- | --- | --- | --- |
| A) Missing route | `addProjectRubro` / `getProjectRubros` first try `/projects/{id}/catalog/rubros` (Finanzas client + `useProjectLineItems`) | No `/projects/{id}/catalog/rubros` in template; only `/projects/{id}/rubros` in `rubros.ts` | FE issues an initial POST/GET to a non-existent path, relying on fallback after a 404/405. | FE paths: `finanzas.ts` lines 295–361, 331–363. BE map: `/projects/{projectId}/rubros` only. |
| C) Shape mismatch | `getInvoices` (`src/api/finanzas.ts`) expects response array at root | `/prefacturas` GET returns `ok({ data, projectId, total })` (`prefacturas.ts`) | FE does `Array.isArray(response.data)` so `{ data: [...] }` yields empty list; invoices never surface. | FE parsing: `finanzas.ts` lines 407–434. BE envelope: Phase 2 table row for `/prefacturas` GET. |
| A + C + D) Missing/shape/auth drift | Forecast UI (`ApiService.getForecastData` in `src/lib/api.ts`) calls `GET /projects/{id}/plan` with auth and expects bare array | Only backend forecast route is `GET /plan/forecast` (no auth) returning `{ data, projectId, months, generated_at }` | Path does not exist, shape differs, and FE still requires auth headers while BE marks auth NONE, leading to 404s and empty data fallback. | FE call: `lib/api.ts` lines 355–388. BE route: Phase 2 table row for `/plan/forecast`. |
| E) Legacy/unreached | UI/clients never call new invoices endpoints (`/projects/{id}/invoices`, `/invoices/{id}`) added in `invoices/app.ts` | Backend exposes invoice CRUD under `/projects/{projectId}/invoices…` | FE still uses legacy `/prefacturas` list, so new normalized routes are unused/unvalidated. | FE helper list (Phase 1 table) vs BE invoice routes (Phase 2 table). |

## Phase 4 – Contract test runs

| Test script | Result | Notes |
| --- | --- | --- |
| `bash tests/finanzas/projects/run-projects-tests.sh` | 🔴 Blocked | Script aborts immediately with `FINZ_API_BASE or DEV_API_URL must be set (e.g. https://.../dev)`; no HTTP calls were executed. |

## Phase 5 – Wiring fixes applied

* **Projects**: `getProjects` now always sends the Cognito auth header to satisfy the backend `ensureCanRead` guard.
* **Catalog / Rubros**: `addProjectRubro` targets the deployed `/projects/{id}/rubros` endpoint first, only falling back to the legacy `/catalog/rubros` path on 404/405.
* **Invoices**: `getInvoices` normalizes the `{ data: [...] }` envelope returned by `/prefacturas` so invoice rows render.
* **Forecast**: Frontend calls `/plan/forecast?projectId=…` and backend endpoint now requires `ensureCanRead` with Cognito auth, returning `{ data }` parsed into an array.
