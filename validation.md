# Validation Report — SDMT/Finanzas UI Enhancements

This document maps the requested changes to their implementation locations and notes runtime dependencies that must be available for the UI to visibly reflect those changes.

## 1) Core Functional Fixes (Correctness & Stability)

### 1.1 Baseline → Rubros → Forecast Consumption (Critical)
**Implementation evidence**
- Baseline rubros materialization/fallback is implemented in `loadBaselineRubros` with parallel fetches for rubros, allocations, prefacturas, and baseline detail, then a fallback to `rubrosFromAllocations` when rubros are empty.  
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
  - Uses `finanzasClient.getRubrosForBaseline`, `getAllocationsForBaseline`, `getPrefacturasForBaseline`, `getBaselineById`, and `rubrosFromAllocations`.
- Rubros fallback utilities are centralized and exported from the SDMT barrel.  
  - File: `src/features/sdmt/utils/index.ts`
  - File: `src/features/sdmt/utils/rubrosFromAllocations.ts`

**Runtime dependency**
Baseline endpoints must resolve successfully (CORS + 200 responses) or fallback data cannot populate. The API currently exposes `GET /baseline/{baseline_id}` (singular); the frontend now aligns to that path. If the backend does not expose baseline-scoped rubros/allocations/prefacturas endpoints, those fallbacks will still be empty and require backend support.

### 1.2 Stable Initial Page Load (No “Navigate Away to Fix” Bug)
**Implementation evidence**
- `isLoadingForecast` state is tracked in `SDMTForecast` and used to render loading cards while data is fetched.
- `Promise.allSettled` / `Promise.all` is used for coordinated data loading, with stale-request guards (`latestRequestKeyRef`, `requestIdRef`) to prevent race conditions.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Runtime dependency**
The API must respond consistently. Repeated 404/CORS failures can still cause empty data even though the load is “stable.”

### 1.3 FTE Calculation Accuracy (Baseline vs Forecast)
**Implementation evidence**
- `totalFTE` prefers `baselineDetail.labor_estimates`, falls back to baseline payload, then to line items. Values are rounded to 2 decimals.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Runtime dependency**
Baseline detail must be available; otherwise UI falls back to line items.

---

## 2) Data & Architecture Corrections

### 2.1 Shared Rubros Utilities (Barrel Exports)
**Implementation evidence**
- Barrel export introduced in `src/features/sdmt/utils/index.ts`.
- SDMT forecast logic imports `rubrosFromAllocations` from the barrel.
  - Files: `src/features/sdmt/utils/index.ts`, `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

### 2.2 Metadata‑Driven Forecast Context
**Implementation evidence**
- Forecast metadata is tracked in `generatedAt` and `dataSource` state for diagnostics.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Runtime dependency**
Metadata correctness depends on backend payloads and successful fetches.

### 2.3 Prevent Silent CI / Deploy Failures
**Implementation evidence**
- Deploy guards now include baseline API availability checks and a workflow_dispatch guard for latest `main`.
  - File: `.github/workflows/deploy-ui.yml`

---

## 3) UX / UI Improvements (User‑Facing)

### 3.1 SDMT Forecast Dashboard Clarity
**Implementation evidence**
- KPI sections render loading placeholders while `isLoadingForecast` is true.
- Forecast summary and layout structure updated in SDMT forecast view.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

### 3.2 Forecast Analytics Consolidation
**Implementation evidence**
- KPI summary and chart panels are grouped and driven from consolidated state.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

### 3.3 Executive Matrix (Matriz del Mes — Vista Ejecutiva)
**Implementation evidence**
- Monthly Snapshot Grid defines the executive “Matriz del Mes” and uses collapsible/summary view with totals and variance grouping.
  - File: `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`

### 3.4 Month Range Expansion (M1 → M60)
**Implementation evidence**
- Month selector explicitly supports M1–M60.
  - File: `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`

**Runtime dependency**
Project‑relative month anchoring depends on baseline start data and API payloads.

### 3.5 Year Filter (Past / Future Analysis)
**Implementation evidence**
- Budget year selection and related budget loading logic exist in `SDMTForecast` for annual and monthly budget interactions.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Status**
This is present as a budget‑year selector, but a dedicated forecast year filter UI is not clearly surfaced. Additional UX wiring may still be required.

---

## 4) Upscale / Executive‑Level Enhancements

### 4.1 Baseline Detail Panel Value
**Implementation evidence**
- Baseline panel includes labor and non‑labor detail tables, totals, and “Materializar Ahora” button.
  - File: `src/components/baseline/BaselineStatusPanel.tsx`

### 4.2 Portfolio‑Level Executive Readability
**Implementation evidence**
- Executive KPI summary bar and portfolio aggregation exist for TODOS/portfolio mode.
  - File: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

### 4.3 Future‑Proofing (Long contracts, multi‑year)
**Implementation evidence**
- M1–M60 support and monthly budget allocations exist.
  - Files: `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`, `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

---

## Current Blockers to Visual Confirmation

1) **Baseline API endpoints** must return data for the projects visible in the UI.  
   Without these endpoints, the baseline‑driven UI improvements will appear empty.

2) **Manual deploys must be on latest `main`**.  
   The workflow now guards this, but if a manual deploy is triggered from an older SHA, the UI will remain unchanged.

---

## Validation Summary

**Conclusion:** The requested fixes appear **implemented in code** and promoted in the repo.  
**Remaining issue:** The UI still looks unchanged because baseline API calls fail in production (404/CORS), and because deploys have been rerun on an older SHA. The workflow guard now prevents stale‑SHA deploys, and the baseline API smoke test will block deploys until backend endpoints respond correctly.
