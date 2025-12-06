# Finanzas SD repository review vs. cliente Excel workflow

## Scope and sources
- Reviewed product definition and UI scope in `PRD.md`.
- Reviewed platform authentication and guardrails in `README.md`.
- Reviewed Finanzas SD API data model and infrastructure in `services/finanzas-api/template.yaml`.
- Reviewed implemented backend capabilities for handoff and rubros workflows in `IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md`.

## Strengths already in place
- **End-to-end auth and deployability**: Cognito configuration, CloudFront routing, and QA guardrails are clearly documented for stable delivery and local validation.
  - Auth flows, callback URLs, and QA gate commands are codified in the repo, ensuring Finanzas SD remains deployable and testable. 【F:README.md†L1-L199】
- **Data model coverage for project financials**: The SAM template provisions DynamoDB tables for projects, rubros (service tiers), allocations, payroll actuals, adjustments, providers, alerts, docs, and prefacturas, giving us primitives to store both plan and actual costs per rubro/category. 【F:services/finanzas-api/template.yaml†L55-L170】
- **API surface for handoff and rubros**: Handoff creation/upsert with idempotency and optimistic concurrency plus project rubro attachments already exist with RBAC aligned to PM/SDT/FIN/AUD. This matches the PM→SD handoff and service-tier catalog needs. 【F:IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md†L11-L177】

## Alignment with cliente Excel process
- **Plan vs. real tracking foundation**: Tables for allocations, payroll_actuals, adjustments, and alerts map to the Excel rubros (equipos, aduana, implementación, soporte, servicios administrados) and enable variance monitoring across the 60‑month lifecycle. 【F:services/finanzas-api/template.yaml†L55-L170】
- **Handoff ownership**: Implemented endpoints allow the PM to accept/modify the delivered case and transfer context to Service Delivery, mirroring the Excel-to-Planview handoff described by el cliente. 【F:IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md†L11-L177】
- **Catalog of rubros/tiers**: The rubros endpoints and taxonomy table let us store standardized service tiers comparable to the Excel sheets (Vendor, implementación, servicios administrados), giving Finance SD a structured alternative to ad-hoc Excel tabs. 【F:services/finanzas-api/template.yaml†L55-L170】【F:IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md†L31-L177】

## Gaps and risks to close
1. **Salesforce intake is manual**: No connector exists to pull the opportunity folio, contract value, or the original Excel artifact. PMs still download files by hand, leaving traceability gaps.
2. **Planview synchronization missing**: Projects are created manually in Planview; Finanzas SD tables do not yet store Planview IDs or status, so schedule/cost milestones can drift.
3. **Financial-cost rubro not explicit**: The current rubros taxonomy does not call out financing charges (tarjeta/préstamo) as a first-class rubro, so margin erosion from financing may be hidden.
4. **Plan vs. actual hours analytics**: While payroll_actuals exists, there is no dedicated endpoint/visual to compare budgeted vs. actual engineering hours by role (PM, implementación, operación) to trigger alerts early.
5. **Implementation vs. operación segmentation**: Rubros do not clearly differentiate one-time rollout costs vs. 60‑month managed services, making it harder to guard the recurring margin that the SDM must protect.
6. **Commission confidentiality boundary**: There is no place to store a summarized commission cost (without formulas). Risk: teams might try to upload the full Excel, leaking confidential macros.
7. **Baseline versioning and audit**: Projects lack stored references to the Excel version/margen base that Finance SD should use as the official “plan” for later variance analysis.

## Recommendations (prioritized)
1. **Add ingestion endpoint + metadata for Salesforce handoff**
   - Minimal path: new `/projects/import` that accepts folio, contract MRR, term, customer, and an S3 link to the uploaded Excel; store `sourceSystem: Salesforce` + `excelVersion` fields for audit.
   - Benefit: preserves the client’s current Excel while anchoring Finanzas SD as system of record for plan data.
2. **Model financing costs as a standard rubro**
   - Extend rubros taxonomy with a `financing` category and surface it in UI forms; enforce that allocations against this rubro are tracked separately from OPEX/CAPEX.
3. **Introduce plan-hour baseline per role**
   - Add fields on project handoff or a new `plan_hours` item keyed by role (PM, implementación, operación). Use payroll_actuals ingest to calculate variance and trigger alerts when thresholds are exceeded.
4. **Tag rubros by lifecycle phase**
   - Add `phase: implementation|operacion` to rubros attachments so dashboards can separate one-time rollout costs from recurring managed services.
5. **Commission cost envelope**
   - Permit an optional `commission_total` field on project plan data (no formulas), restricted to FIN/PM visibility, to acknowledge the cost without exposing confidential logic.
6. **Planview ID linkage**
   - Add `planviewId` to projects and create a lightweight sync job to mirror status/milestones, so Finanzas SD can warn if revenue start slips.
7. **Baseline snapshot storage**
   - At project creation, persist `margin_target`, `excel_version`, and a signed hash of the uploaded Excel to enable “plan vs real” comparisons and auditability.

## Fit for client Excel today
- Finanzas SD already supports authenticated, role-based access, rubros cataloging, and handoff workflows, which cover most of the structural pieces the Excel captures (ingresos, rubros de costos, margen estimado). 【F:README.md†L1-L199】【F:IMPLEMENTATION_SUMMARY_RUBROS_HANDOFF.md†L11-L177】
- To fully replace the Excel workflow, we must close the ingestion, financing, commission, and lifecycle segmentation gaps above; these are additive and can be implemented without disrupting current stability. 【F:services/finanzas-api/template.yaml†L55-L170】
