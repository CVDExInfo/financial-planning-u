# Finanzas UI inventory (English vs Spanish stacks)

## Top-level navigation and route targets

Navigation is built in `Navigation.tsx` and wired to route components in `App.tsx`. The table maps each visible menu item to its route, rendered component, and stack.

| Nav section | Label (route) | Component | Stack |
| --- | --- | --- | --- |
| PMO | Estimator (`/pmo/prefactura/estimator`) | `PMOEstimatorWizard` | English / PMO legacy | 
| SDMT Costos | Catalog (`/sdmt/cost/catalog`) | `SDMTCatalog` | English SDMT | 
| SDMT Costos | Forecast (`/sdmt/cost/forecast`) | `SDMTForecast` | English SDMT | 
| SDMT Costos | Reconciliation (`/sdmt/cost/reconciliation`) | `SDMTReconciliation` | English SDMT | 
| SDMT Costos | Changes (`/sdmt/cost/changes`) | `SDMTChanges` | English SDMT | 
| SDMT Costos | Cash Flow (`/sdmt/cost/cashflow`) | `SDMTCashflow` (premium-gated) | English SDMT | 
| SDMT Costos | Scenarios (`/sdmt/cost/scenarios`) | `SDMTScenarios` (premium-gated) | English SDMT | 
| Finanzas | Catálogo de Rubros (`/catalog/rubros`) | `RubrosCatalog` | Spanish Finanzas | 
| Finanzas | Proyectos (`/projects`) | `ProjectsManager` | Spanish Finanzas | 
| Finanzas | Rules (`/rules`) | `AllocationRulesPreview` | Spanish Finanzas | 
| Finanzas | Ajustes (`/adjustments`) | `AdjustmentsManager` | Spanish Finanzas | 
| Finanzas | Proveedores (`/providers`) | `ProvidersManager` | Spanish Finanzas |

The home route is `/` and renders `FinanzasHome` when the Finanzas feature flag is on (otherwise the legacy English `HomePage`). The user profile route `/profile` is available but not exposed in the top navigation bar.【F:src/components/Navigation.tsx†L109-L169】【F:src/App.tsx†L165-L205】

## Overlap / duplicate screens

* Catalog management exists in both stacks: the English SDMT nav points to `SDMTCatalog` (project-aware catalog using `addProjectRubro` and project context), while the Finanzas nav exposes `RubrosCatalog`, which fetches rubros directly from the Finanzas API and lets users attach them to projects. Both screens ultimately push rubros into projects but through different flows and data sources.【F:src/components/Navigation.tsx†L122-L166】【F:src/App.tsx†L182-L200】【F:src/features/sdmt/cost/Catalog/SDMTCatalog.tsx†L1-L140】【F:src/modules/finanzas/RubrosCatalog.tsx†L1-L110】
* Project lists/creation are split: SDMT features pull projects via `ProjectContext`/`ApiService` for context selection, while the Finanzas `ProjectsManager` page separately loads projects from the Finanzas API and offers creation. This means projects are surfaced in both English (context bar) and Spanish (`/projects`) flows.【F:src/App.tsx†L160-L205】【F:src/components/ProjectContextBar.tsx†L38-L160】【F:src/lib/api.ts†L20-L88】【F:src/modules/finanzas/ProjectsManager.tsx†L28-L205】

## Data source notes for Spanish modules (`src/modules/finanzas`)

* **FinanzasHome** – purely navigational tiles; no data fetching.
* **ProjectsManager** – reads projects via `ApiService.getProjects()` (real API) and creates projects with `finanzasClient.createProject` against the Finanzas backend (no mock usage).【F:src/modules/finanzas/ProjectsManager.tsx†L48-L129】
* **RubrosCatalog** – loads rubros with `finanzasClient.getRubros()` and posts to `createProjectRubro`; entirely API-driven.【F:src/modules/finanzas/RubrosCatalog.tsx†L50-L110】
* **AllocationRulesPreview** – pulls allocation rules from `finanzasClient.getAllocationRules()`; read-only preview tied to live API responses.【F:src/modules/finanzas/AllocationRulesPreview.tsx†L15-L110】
* **AdjustmentsManager** – creates adjustments via `finanzasClient.createAdjustment`; form-only UI with server submission (no local mocks).【F:src/modules/finanzas/AdjustmentsManager.tsx†L41-L103】
* **ProvidersManager** – posts new providers through `finanzasClient.createProvider`; no mock data source.【F:src/modules/finanzas/ProvidersManager.tsx†L40-L100】

## Navigation consolidation decisions

When Finanzas is enabled, the top navigation shows only Spanish Finanzas entries plus the PMO Estimator: Catálogo de Rubros, Proyectos, Rules, Ajustes, Proveedores, and Estimator.
