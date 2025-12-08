# Baseline acceptance discovery (Finanzas SD)

This note documents where the current baseline handoff/acceptance concepts live before applying fixes.

- **Estimator signing location**: The PMO Estimator final step (`src/features/pmo/prefactura/Estimator/steps/ReviewSignStep.tsx`) is where the user checks a review box, submits `createPrefacturaBaseline`, and later calls `handoffBaseline` with `aceptado_por`. This is the closest thing to a "sign & accept" action in the UI today.
- **Estimator payload fields**: Baseline creation payload includes signature metadata (`signed_by`, `signed_role`, `signed_at`) and supporting docs. Handoff payload currently passes `baseline_id`, `mod_total`, `pct_ingenieros`, `pct_sdm`, and `aceptado_por`.
- **Backend handoff/metadata**: The Lambda handler at `services/finanzas-api/src/handlers/handoff.ts` writes `PROJECT#...` METADATA when a handoff is posted, setting `baseline_id` and timestamps but not persisting `accepted_by` or `baseline_status`. The more recent `services/finanzas-api/src/handlers/projects.ts` handoff branch also seeds `baseline_status: "handed_off"` and captures `accepted_by` from `aceptado_por`/`owner` but does not expose it via the normalizer.
- **Dynamo records observed**: Handoff/idempotency records store `baselineId`, `handoffId`, `owner`, `status: HandoffComplete`, and incoming fields (including `aceptado_por` when provided). Project METADATA rows carry `baseline_id` and `baseline_accepted_at` but acceptance attribution is not consistently written or surfaced.
- **UI display points**:
  - `/finanzas/projects` uses `ProjectsManager` → `ProjectDetailsPanel` (no acceptance fields shown) and `ProjectContextBar` (shows `baselineId` and optional `baselineAcceptedAt` label only).
  - Project dropdown and details rely on `useProjects` normalization, which currently strips acceptance metadata.
  - SDMT cost pages reuse `ProjectContextBar`, so any acceptance info added there will flow to Catalog/Reconciliation/Changes headers.
- **Schemas/types**: `src/types/domain.d.ts` and `src/lib/api.schema.ts` already define optional `accepted_by`, `accepted_ts`, and `baseline_accepted_at` fields, but `baseline_status` is missing and the normalization layer (`src/lib/api.ts`) ignores these acceptance fields when mapping `/projects` responses.

These gaps explain why acceptance data stored during handoff is never rendered in the SDMT UI.
