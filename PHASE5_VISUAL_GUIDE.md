# Phase 5 - TODOS Executive Layout Visual Guide (Validated + Expanded)

_Last updated: 2026-01-13 (Validated & expanded by AI)_

---

## Table of contents

1. Overview
2. Before (Original TODOS Layout) — preserved for reference
3. After (Executive Overview TODOS Layout) — high-level
4. Budget Health Pill — logic & colors
5. Collapsible Sections Behavior & Accessibility
6. Modes: TODOS (Portfolio) and Single-Project
7. Component Hierarchy (full module list)
8. Module & Component Specifications (API, props, data contracts)
9. Design Tokens & Visual Assets
10. Code Structure & Key Files
11. Testing & QA Plan (Visual, Functional, Data Integrity, E2E, Performance)
12. Screenshots Required & Naming Conventions
13. Implementation Notes, Acceptance Criteria & Rollback Plan
14. Change Log

---

## 1. Overview

This guide documents the Phase 5 transformation of the TODOS view from a dense, information-heavy layout to an executive-friendly overview. The emphasis is on immediate clarity, progressive disclosure, visible budget health, and preserving all existing features and behaviors in single-project mode.

---

## 2. Before (Original TODOS Layout)

(Reference — unchanged)

- Header: Gestión de Pronóstico + actions
- Baseline Status Panel (shown for all projects)
- KPI Summary Cards (6 cards)
- Budget Simulation KPIs (when enabled)
- Real Annual Budget KPIs
- Budget & Simulation Panel (collapsible)
- Portfolio Summary View
- Charts Panel
- Rubros Table
- Forecast Grid (12-month)
- Charts and analytics
- Issues: Too much above the fold, unclear hierarchy, charts buried, no way to hide heavy sections.

---

## 3. After (Executive Overview TODOS Layout)

(High level)

- Header: Gestión de Pronóstico + actions
- **Executive KPI Summary Bar** (top of page; shows Budget Health pill + top-line numbers)
- **Charts Panel** now anchored at the bottom/end (Monthly Trend, By Category, Cumulative) so hero real estate stays lightweight while the experience ends with trends.
- Collapsible sections (default closed): Portfolio Summary, Forecast Grid (12 months), Budget Simulator, Desglose Mensual vs Presupuesto — each section preserves original content but is hidden behind progressive disclosure
- Monthly Snapshot Grid and Top Variance tables are temporarily hidden via `SHOW_MONTHLY_SNAPSHOT_GRID` / `SHOW_VARIANCE_TABLES` feature toggles so executives only see the streamlined story.
- Single project mode remains unchanged.

---

## 4. Budget Health Pill — Status Logic & Colors

### Status logic (unchanged)

- **🟢 EN META**
  - Conditions: `consumption <= 90% AND forecast <= budget`
  - Color: Green background, green text
  - Meaning: On track.
- **🟡 EN RIESGO**
  - Conditions: `consumption > 90% AND forecast <= budget`
  - Color: Yellow background, yellow text
  - Meaning: High consumption but still under budget.
- **🔴 SOBRE PRESUPUESTO**
  - Conditions: `forecast > budget OR consumption > 100%`
  - Color: Red background, red text
  - Meaning: Over budget/overspent.
- **⚪ SIN PRESUPUESTO**
  - Conditions: `no monthly budget configured`
  - Color: Gray background, gray text
  - Meaning: Budget not set up yet.

### Suggested color tokens (HEX)

- `--color-budget-green: #4ac795` _(Ikusi green as requested for table header color)_
- `--color-budget-green-dark: #3dbf82`
- `--color-budget-yellow: #F2C94C`
- `--color-budget-red: #FF6B6B`
- `--color-budget-gray: #BDBDBD`
  > Note: adjust for WCAG contrast as needed. See Accessibility section.

---

## 5. Collapsible Sections Behavior & Accessibility

**Behavior**

- Default: _closed_ for all four main sections.
- Interaction: click or press Enter/Space on the header/chevron toggles open/closed.
- Smooth animation and progressive disclosure; content loads when expanded (lazy load to reduce initial payload).

**Accessibility**

- Use native `<button>` for triggers or `role="button"` with `tabindex="0"`.
- ARIA attributes:
  - `aria-expanded="false|true"` on the trigger element.
  - `aria-controls="section-id"` linking to the collapsible content.
  - Use `id` on collapsible content. Example: `id="portfolio-summary-content"`.
- Keyboard:
  - `Tab` to focus trigger, `Enter` / `Space` toggles.
  - If sections must be navigable quickly, consider `Alt + Arrow` patterns for accordion navigation.
- Focus management:
  - When opened, focus stays on the trigger (do not auto-focus into big content that disorients users).
  - For screen reader users, announce "expanded" state via `aria-live="polite"` for the KPI pill updates if the change is dynamic.

---

## 6. Modes: TODOS (Portfolio) and Single-Project

**TODOS (isPortfolioView === true)**

- Baseline panel hidden.
- KPI cards hidden.
- Executive KPI Summary Bar shown at top (ForecastSummaryBar).
- Charts Panel rendered at the very end of the page (ForecastChartsPanel) after all collapsible sections.
- Four collapsible wrapper sections introduced:
  - `Resumen de todos los proyectos` → `PortfolioSummaryView`
  - `Cuadrícula de Pronóstico (12 meses)` → `ForecastRubrosTable`
  - `Simulador de Presupuesto` → Annual/Monthly budget editor + simulator
  - `Desglose Mensual vs Presupuesto` → full Forecast Grid
- Default: collapsed (progressive disclosure).
- Monthly Snapshot Grid (portfolio heatmap) and Top Variance tables remain hidden until their corresponding flags are re-enabled. Keep documentation for them handy for Phase 6.

**Single Project (isPortfolioView === false)**

- Remains unchanged. Baseline visible, KPI cards visible, original Forecast Grid and charts available.

---

## 7. Component Hierarchy (full module list)

**Top-level**

- `SDMTForecast` (root)
  - `Header + Actions`
  - `DataHealthPanel` (dev only)
  - `ForecastSummaryBar` _(NEW position for TODOS)_
    - `BudgetHealthPill` _(NEW component)_
    - `TotalsRow` (Budget/Forecast/Actual/%Consumption/Variance)
  - `CollapsibleSection` wrappers (4):
    - `PortfolioSummaryView`
    - `ForecastRubrosTable`
    - `BudgetSimulatorPanel` (Annual + Monthly)
    - `ForecastGridDetailed`
  - `ForecastChartsPanel` _(anchored to the bottom of TODOS layout)_
    - `MonthlyTrendChart`, `ByCategoryChart`, `CumulativeChart`
  - `BaselineStatusPanel` (single project only)
  - `KpiSummaryCards` (single project only)
  - `ChartInsightsPanel` (single project only)
  - _Temporarily disabled components:_ `MonthlySnapshotGrid` and `TopVariance{Projects,Rubros}Table` (behind `SHOW_MONTHLY_SNAPSHOT_GRID` / `SHOW_VARIANCE_TABLES`).

---

## 8. Module & Component Specifications

> Each component includes props and data contract expectations. Keep props minimal and typed (TypeScript).

### ForecastSummaryBar.tsx

**Responsibility:** Display executive KPI summary across portfolio with Budget Health pill.

**Props**

```ts
interface ForecastSummaryBarProps {
  totalBudget: number; // cents or decimal (document unit)
  totalForecast: number;
  totalActual: number;
  percentConsumption: number; // 0-100
  variance: number; // totalForecast - totalBudget
  lastUpdated?: string; // ISO timestamp
  budgetHealth?:
    | "EN_META"
    | "EN_RIESGO"
    | "SOBRE_PRESUPUESTO"
    | "SIN_PRESUPUESTO";
}
```

**Behavior**

- Derive `budgetHealth` from the values if not passed.
- Render `BudgetHealthPill` with appropriate color and label.
- Expose `data-testid` attributes for e2e tests.

---

### BudgetHealthPill.tsx

**Props**

```ts
interface BudgetHealthPillProps {
  status: "EN_META" | "EN_RIESGO" | "SOBRE_PRESUPUESTO" | "SIN_PRESUPUESTO";
  tooltipText?: string;
}
```

**Accessibility**

- `role="status"` and `aria-live="polite"` for dynamic updates.
- High contrast text vs background (WCAG AA minimum).

---

### Collapsible (generic)

**Props**

```ts
interface CollapsibleProps {
  id: string;
  headerLabel: string;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
}
```

**Accessibility**

- Trigger: `<button aria-expanded aria-controls>`
- Content: `<div id={id} role="region" aria-labelledby={triggerId}>`

---

### ForecastRubrosTable / ForecastGridDetailed

**Requirements**

- Table header color: Ikusi green `--color-ikusi-green: #4ac795` for header backgrounds.
- Support large datasets with virtualization (react-window / react-virtualized).
- Inline editing cells must persist edits with optimistic UI and rollback on server error.

---

## 9. Design Tokens & Visual Assets

**Color palette**

- `--color-ikusi-green: #4ac795` (table header & accents)
- `--color-budget-green: #4ac795`
- `--color-budget-yellow: #F2C94C`
- `--color-budget-red: #FF6B6B`
- `--color-budget-gray: #BDBDBD`
- `--color-card-bg: #FFFFFF`
- `--color-muted-text: #6B6B6B`

**Typography**

- Headline: Inter 600 (or system sans), 20-24px
- Body: Inter 400, 14-16px
- Small / secondary: Inter 400, 12px

**Spacing**

- 8px base spacing (grid) — use multiples for layout.

**Icons & Logos**

- Use SVG icons (inline) for KPI pill, chevrons, status badges.
- Ensure exported SVGs have `role="img"` and `aria-label`.

---

## 10. Code Structure & Key Files

- `src/views/SDMTForecast.tsx` (root)
- `src/components/ForecastSummaryBar/ForecastSummaryBar.tsx`
- `src/components/BudgetHealthPill/BudgetHealthPill.tsx`
- `src/components/ForecastChartsPanel/ForecastChartsPanel.tsx`
- `src/components/Collapsible/Collapsible.tsx`
- `src/components/ForecastRubrosTable/ForecastRubrosTable.tsx`
- `src/components/ForecastGridDetailed/ForecastGridDetailed.tsx`
- `src/styles/tokens.css` (or tokens.ts)
- `src/tests/visual/phase5/` (visual regression tests)
- `src/tests/unit/ForecastSummaryBar.test.tsx` (unit)
- `src/e2e/phase5.spec.ts` (cypress / playwright)

**Sample code snippet (Budget Health logic):**

```ts
export function getBudgetHealthStatus({ consumption, forecast, budget }) {
  if (!budget)
    return {
      label: "SIN PRESUPUESTO",
      status: "SIN_PRESUPUESTO",
      color: "--color-budget-gray",
    };
  if (forecast > budget || consumption > 100)
    return {
      label: "SOBRE PRESUPUESTO",
      status: "SOBRE_PRESUPUESTO",
      color: "--color-budget-red",
    };
  if (consumption > 90)
    return {
      label: "EN RIESGO",
      status: "EN_RIESGO",
      color: "--color-budget-yellow",
    };
  return { label: "EN META", status: "EN_META", color: "--color-budget-green" };
}
```

---

## 11. Testing & QA Plan

### Visual Testing

- Verify the Executive KPI bar is visible above the fold in TODOS view.
- Confirm Budget Health pill displays correct color for each status.
- Charts panel visible at the very bottom and interactive (hover tooltips, legend toggles).
- Collapsible sections — all 4 collapsed by default; expand/collapse works and content loads.

### Functional Testing

- Unit tests for `getBudgetHealthStatus` (all branches).
- Unit tests for `ForecastSummaryBar` rendering with various props.
- Integration tests verifying collapsed sections lazy-load data.
- E2E tests:
  - Navigate to TODOS view, validate above the fold items.
  - Toggle sections and validate content loads with correct data.
  - Test inline edits in `ForecastGridDetailed` and persistence/rollback on error.

### Data Integrity

- Ensure totals match the underlying dataset.
- Confirm no rounding errors or currency formatting issues.
- Validate budget simulation results match server-calculated values.

### Performance

- Page initial load time < 3s on 3G simulated network.
- Collapsible lazy-loading should reduce payload for TODOS view.
- Virtualization for tables when > 200 rows.

### Regression

- Single-project mode unchanged. Run smoke tests to confirm baseline panel/KPI cards exist.

---

## 12. Screenshots Required & Naming Conventions

**TODOS View**

1. `phase5_todos_above_fold.png` — Executive KPI bar (charts now live at the end)
2. `phase5_budget_pill_en_meta.png` — Budget Health pill (EN META)
3. `phase5_budget_pill_en_riesgo.png` — Budget Health pill (EN RIESGO)
4. `phase5_budget_pill_sobre_presupuesto.png` — Budget Health pill (SOBRE PRESUPUESTO)
5. `phase5_collapsed_sections.png` — All 4 sections collapsed
6. `phase5_expanded_portfolio_summary.png` — Example expanded section
7. `phase5_todos_charts_bottom.png` — Capture of the charts panel anchored at the bottom
8. `phase5_full_page_scroll.png` — Full TODOS layout

**Single Project** 9. `phase5_single_above_fold.png` — Baseline panel + KPI cards 10. `phase5_single_full_layout.png` — Full single-project layout

**Comparison** 11. `phase5_before_after_todos.png` — side-by-side comparison

**Storage**

- Place images under: `docs/phase5/screenshots/` in the repo.

---

## 13. Implementation Notes, Acceptance Criteria & Rollback Plan

**Acceptance criteria**

- Executive KPI Summary Bar is displayed on TODOS by default and reflects calculated totals.
- Budget Health pill displays correct color and label for all four statuses.
- Collapsible wrappers exist and lazy-load their content when opened.
- Single-project mode is unchanged.
- All tests in `src/tests/*` pass in CI (unit + e2e + visual regression).
- Feature toggles `SHOW_MONTHLY_SNAPSHOT_GRID` / `SHOW_VARIANCE_TABLES` remain off until Phase 6, and documentation explains their purpose.

**Rollback**

- Keep the feature behind a feature flag: `FEATURE_TODOS_EXECUTIVE_LAYOUT`.
- If any production issue arises, flip the flag off to restore previous TODOS layout instantaneously.

**Feature toggle notes**

- `SHOW_MONTHLY_SNAPSHOT_GRID` and `SHOW_VARIANCE_TABLES` live inside `SDMTForecast.tsx`. Keep them `false` in production to maintain the streamlined executive layout; toggling them on brings back the heavier analytics modules without additional code changes.

---

## 14. Change Log

- `2026-01-16` — Documented the charts-at-bottom change, captured the hidden modules + toggles, refreshed screenshots, and updated acceptance criteria.
- `2026-01-13` — Validated original file; expanded with module APIs, accessibility, design tokens, full QA plan, screenshot conventions, and implementation notes.

---

## Appendix: Quick dev checklist (copy to PR template)

- [ ] Add `ForecastSummaryBar` component and `BudgetHealthPill`.
- [ ] Add tokens file and include Ikusi green for table header.
- [ ] Implement collapsible wrapper with aria attributes.
- [ ] Add unit tests and e2e tests for TODOS behaviors.
- [ ] Add visual regression tests and collect baseline screenshots.
- [ ] Add `FEATURE_TODOS_EXECUTIVE_LAYOUT` feature flag with default enabled in staging.
- [ ] Update PR description with before/after screenshots.
