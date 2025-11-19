# Document Upload & Navigator Discovery (Nov 19 2025)

## Backend wiring

- `services/finanzas-api/template.yaml` exposes `DocsBucketName` (default `ukusi-ui-finanzas-prod`) and injects it via `DOCS_BUCKET`; DynamoDB `finz_docs` keeps metadata via `TABLE_DOCS`.
- `UploadDocumentFunction` (`src/handlers/upload-docs.ts`) serves `POST /uploads/docs` and returns `{ uploadUrl, objectKey }` for modules `prefactura|catalog|reconciliation`; it writes metadata rows with `pk=DOC#${projectId}` and stores uploader email from Cognito claims.
- No additional `/documents` CRUD endpoints exist yet—after S3 upload, Prefactura invoices POST to `/prefacturas` for metadata persistence; catalog/reconciliation screens currently keep metadata client-side only.

## Front-end usage today

- Shared client: `src/api/finanzas.ts` already normalizes `uploadInvoice` (invoice + metadata POST to `/prefacturas`) and `uploadSupportingDocument` (presign + S3 PUT, but no metadata POST).
- Screens calling `uploadSupportingDocument`: Prefactura Estimator `ReviewSignStep` and SDMT Cost Catalog `SDMTCatalog` (Deal Inputs & supporting docs). Reconciliation uses `uploadInvoice` (not the helper) to tie uploads to invoices. Change Manager currently lacks any document upload wiring.
- UI copy references "shared `/uploads/docs` flow" but there is no reusable upload service beyond the API helper; progress + error handling duplicated per screen.

## Navigator / auth hooks

- `src/components/Navigation.tsx` renders a top-right dropdown with Ikusi logo, role switcher, and `signOut()` hook but Profile/Roles action is only visual (no routing). `UserProfile` component exists but is not wired into the dropdown or any route.
- Logout currently calls `useAuth().signOut()` which clears local JWTs but does not invoke the Cognito Hosted UI logout helper (`logoutWithHostedUI` in `src/config/aws.ts`). Roles derive from `useAuth` context and can switch, but menu lacks link to a dedicated profile/roles screen.

## Missing artifacts

- No OpenAPI / `03_APIContracts.yaml` present in repo; only SAM template defines API shapes. Need to align FE + BE based on template/handlers directly.
