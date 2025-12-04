# Finanzas SD – Invoice Reconciliation

## Overview
- **Purpose:** Enable Ikusi finance teams to match real vendor invoices against forecast allocations (line items/months) to validate spend, track variances, and close the loop on the R1 Execution Plan item *“Finanzas SD – Reconciliation.”*
- **End-to-end flow:** A user selects a project, uploads a vendor invoice and metadata, the UI requests an S3 presigned URL, the browser performs a direct PUT to the shared documents bucket, and the backend records an `INVOICE` row linked to the project/line item. Reconciliation status tiles (Matched / Pending / Disputed) reflect stored invoice status.

## Data Model
### INVOICE entity (data dictionary alignment)
- `invoice_id` (**PK**, pattern `inv_[a-z0-9]{10}`, **system-generated** — planned; current implementation uses `INV-<short-uuid>`).
- `project_id` (**FK → PROJECT.project_id**, required). User selects project; enforced in UI and backend path.
- `invoice_number` (business-facing vendor invoice number, **user-entered**; backend currently falls back to `INV-<timestamp>` when absent).
- `currency` (ISO-4217, **user-entered**; **planned** — not persisted yet, current amounts are implicitly USD in UI formatting).
- `amount` (numeric invoice total, **user-entered**; validated positive in UI and API).
- `invoice_date` (`YYYY-MM-DD`, **user-entered**; validated in UI/API and stored as ISO string).
- `forecast_id` (**optional FK → FORECAST_ALLOCATION.forecast_id**, **planned**; current schema links via `line_item_id` + `month` instead of a forecast allocation id).

### Related entities
- **PROJECT**: Project context for reconciliation; invoices are stored under `pk = PROJECT#<projectId>` in DynamoDB `prefacturas` table. UI enforces project selection via `ProjectContext`.
- **FORECAST_ALLOCATION**: Target allocation per line item and month. Current matching is implicit (`line_item_id` + `month`); a `forecast_id` column is not yet created.
- **PROVIDER**: Vendors are captured as free-text `vendor` on invoices; no FK to a providers table yet (table `TABLE_PROVIDERS` exists, but reconciliation flow does not attach provider ids).
- **Document metadata**: Stored separately in `docs` table when presigning uploads (`DOC-<suffix>` documentId), keyed by project + module (`reconciliation`).

### Generated vs. user-entered identifiers
- **System-generated:** `invoice_id` (`INV-xxxx` today; planned `inv_[a-z0-9]{10}`), S3 `objectKey`, `documentId`, timestamps, `uploaded_by` email.
- **User-entered:** `invoice_number`, `vendor`, `amount`, `invoice_date`, `description`, `line_item_id`, `month`, and uploaded file name/content-type.

## S3 Document Handling
- **Bucket:** `ukusi-ui-finanzas-prod` (provided via `DocsBucketName` / `DOCS_BUCKET`).
- **Key structure:** `docs/{projectId}/{module}/{contextPart}-{rand}-{safeFilename}` where `module` is `reconciliation`; `contextPart` prefers `lineItemId`, else `invoiceNumber`, else timestamp. Filenames sanitize `[^A-Za-z0-9._-]` to `_`.
- **Flow:**
  1. UI calls `POST /uploads/docs` with project, module=`reconciliation`, line item, vendor, amount, invoice number/date, and file metadata. Handler validates required fields for reconciliation and generates `uploadUrl` + `objectKey` + `documentId` while recording metadata in `docs` table.
  2. Browser performs a direct `PUT` to S3 using `uploadUrl` with `Content-Type` set from the file.
- **CORS requirements:** Bucket must allow origin `https://d7t9x3j66yd8k.cloudfront.net`, methods `GET/PUT/HEAD` (UI also mentions `POST` tolerance), and `AllowedHeader=*`. Exposed headers include `ETag`, `x-amz-request-id`, `x-amz-id-2` (per `services/finanzas-api/README.md` and `docs/finanzas-docs-bucket-cors.md`).

## API Contracts
### Presign upload (documents)
- **Method/URL:** `POST /uploads/docs`
- **Request (JSON):**
  ```json
  {
    "projectId": "PROJ-123",
    "module": "reconciliation",
    "lineItemId": "RUBRO-1",
    "invoiceNumber": "FAC-9981",
    "invoiceDate": "2024-11-01",
    "vendor": "Ikusi Vendor",
    "amount": 12500,
    "contentType": "application/pdf",
    "originalName": "invoice-nov.pdf"
  }
  ```
- **Response 201:**
  ```json
  {
    "uploadUrl": "https://ukusi-ui-finanzas-prod.s3.amazonaws.com/...", 
    "objectKey": "docs/PROJ-123/reconciliation/RUBRO-1-ab12-invoice-nov.pdf",
    "documentId": "DOC-ab12",
    "metadata": { "pk": "DOC#PROJ-123", "sk": "RECONCILIATION#2024-...#DOC-ab12", ... }
  }
  ```
- **Validation:** Requires `projectId`, `module` ∈ {prefactura, catalog, reconciliation, changes}, `contentType`, `originalName`; reconciliation additionally requires `lineItemId`, valid `invoiceDate`, positive `amount`, and `vendor`.

### Create invoice
- **Method/URL:** `POST /projects/{projectId}/invoices`
- **Request body:**
  ```json
  {
    "projectId": "PROJ-123",
    "lineItemId": "RUBRO-1",
    "month": 11,
    "amount": 12500,
    "description": "Networking refresh",
    "vendor": "Ikusi Vendor",
    "invoiceNumber": "FAC-9981",
    "invoiceDate": "2024-11-01",
    "documentKey": "docs/PROJ-123/reconciliation/RUBRO-1-ab12-invoice-nov.pdf",
    "originalName": "invoice-nov.pdf",
    "contentType": "application/pdf"
  }
  ```
- **Behavior:**
  - Validates projectId matches path, lineItemId exists in `rubros` table, `month` 1–12, `amount > 0`, and optional `invoiceDate` parses.
  - Generates `invoiceId` = `INV-<short-uuid>` (planned to shift to `inv_[a-z0-9]{10}`).
  - Writes item to DynamoDB `prefacturas` table under `pk = PROJECT#<projectId>`, `sk = INVOICE#<invoiceId>` with status default `Pending` and `uploaded_by` resolved from Cognito token.
- **Response 201:** Normalized invoice payload:
  ```json
  {
    "id": "INV-ab12",
    "project_id": "PROJ-123",
    "line_item_id": "RUBRO-1",
    "month": 11,
    "amount": 12500,
    "status": "Pending",
    "vendor": "Ikusi Vendor",
    "invoice_number": "FAC-9981",
    "invoice_date": "2024-11-01T00:00:00.000Z",
    "documentKey": "docs/PROJ-123/reconciliation/RUBRO-1-ab12-invoice-nov.pdf",
    "originalName": "invoice-nov.pdf",
    "contentType": "application/pdf",
    "uploaded_by": "user@example.com",
    "uploaded_at": "2024-11-05T12:00:00.000Z"
  }
  ```

### Status update
- **Method/URL:** `PUT /projects/{projectId}/invoices/{invoiceId}/status`
- **Payload:** `{ "status": "Matched" | "Pending" | "Disputed", "comment"?: "string" }`
- **Effect:** Updates status (and optional comment) with `updated_at` timestamp; returns normalized invoice.

## UI Flow (SDMT Reconciliation)
1. **Select project** via header project selector (required for API calls).
2. **Open Reconciliation** at `/sdmt/cost/reconciliation` (redirect supported from `/finanzas/...`).
3. **Upload Invoice**
   - Click “Upload invoice” (opens dialog).
   - Fill **Line Item**, **Month**, **Amount**, **Vendor**, **Invoice Number** (vendor-provided), **Invoice Date**, optional **Description**, and attach file.
   - Submit triggers `uploadInvoice`:
     1. Call presign endpoint to obtain `uploadUrl`/`objectKey`.
     2. PUT file to S3 using presigned URL.
     3. POST invoice creation with metadata + `documentKey`.
4. **On success:**
   - File stored under `docs/{projectId}/reconciliation/...` in `ukusi-ui-finanzas-prod`.
   - Invoice row added to `prefacturas` table with status `Pending`.
   - Dashboard tiles (Matched / Pending / Disputed) refresh via `useProjectInvoices` refetch.
5. **Viewing & actions:** Table lists invoices with line item/month, vendor, invoice number, amount, status badge. Users with approval rights can set status to `Matched` or `Disputed`. “Go to forecast” link opens Forecast view filtered by line item/month to align with allocations.
6. **Key UI clarifications:**
   - **Invoice Number** is the vendor’s reference and user-editable.
   - **invoice_id** / `id` returned by API is internal and not directly editable; used for status updates.

## Status Logic
- Supported statuses: `Pending` (default), `Matched`, `Disputed`.
- Status is explicitly set via status update API; matching logic is manual (no automated variance check yet).
- Planned linkage to forecasts: store `forecast_id` to tie an invoice to a specific allocation; current UI uses `line_item_id` + `month` and surfaces variance exports as a derived report (see “Export variance report” action).

## Open Questions / TODOs
- **Identifier format:** Align `invoice_id` generation with data-dictionary pattern `inv_[a-z0-9]{10}` (currently `INV-<short-uuid>`).
- **Currency handling:** Add `currency` column/input (currently implicit USD formatting in UI).
- **Forecast linkage:** Add `forecast_id` field and backend join to `FORECAST_ALLOCATION`; today matching is heuristic via line item/month only.
- **Provider reference:** Consider FK to `PROVIDER` table instead of free-text `vendor`.
- **Validation/uniqueness:** Enforce uniqueness on `(project_id, invoice_number)` to avoid duplicates; add stricter invoice number/date validation per business rules.
- **Search & filters:** Enhance UI filters (by status/vendor/date range) and add pagination if invoice counts grow.
- **Document lifecycle:** Define retention/deletion rules for S3 objects when invoices are removed or replaced.
