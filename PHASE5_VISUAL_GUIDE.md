# Phase 5 - TODOS Executive Layout Visual Guide

## Before (Original TODOS Layout)

```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Header: Gestión de Pronóstico                            │
│    [TODOS] Project Badge                                     │
│    [Guardar Pronóstico] [Guardar] [Exportar]                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ ⚠️ Baseline Status Panel (shown for all projects)           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 KPI Summary Cards (6 cards in row)                       │
│ [Total Planeado] [Pronóstico] [Real] [FTE] [Var Pron] [Var] │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 💰 Budget Simulation KPIs (when enabled)                    │
│ [Budget Total] [Variance] [Utilization] [Real vs Budget]    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 💼 Real Annual Budget KPIs                                  │
│ [Presupuesto Anual] [Over/Under] [%Consumo Pron] [%Consumo] │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 🔽 Budget & Simulation Panel (Collapsible)                  │
│    - Annual Budget Editor                                    │
│    - Monthly Budget Input                                    │
│    - Budget Simulator                                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📈 Portfolio Summary View                                   │
│    - Project list with metrics                              │
│    - Runway metrics                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 Charts Panel                                             │
│    [Monthly Trend | By Category | Cumulative]               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📋 Rubros Table                                             │
│    - Category totals                                         │
│    - Rubro-level breakdown                                   │
│    - Inline budget editing                                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 Forecast Grid (12-Month Detail Table)                    │
│    - Line-by-line breakdown                                  │
│    - Planned / Forecast / Actual columns                     │
│    - Editable cells                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 Charts and Analytics                                     │
│    - Monthly trends                                          │
│    - Variance analysis                                       │
└──────────────────────────────────────────────────────────────┘

❌ Issues:
- Too much information above the fold
- No clear hierarchy
- Budget health not immediately visible
- Charts buried below other content
- No way to hide heavy detail sections
```

---

## After (Executive Overview TODOS Layout)

```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Header: Gestión de Pronóstico                            │
│    [TODOS] Project Badge                                     │
│    [Guardar Pronóstico] [Guardar] [Exportar]                │
└──────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════╗
║ 🎯 EXECUTIVE KPI SUMMARY BAR                    [🟢 En Meta] ║
║                                                                ║
║ Presupuesto Total: $1.2M    Pronóstico Total: $1.15M         ║
║ Real Total: $850K           % Consumo: 71%                    ║
║ Desviación vs Presupuesto: -$50K (-4.2%)                     ║
║                                                                ║
║ Presupuesto actualizado: 15 Jan 2026 – PMO User              ║
╚══════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────┐
│ 📊 GRÁFICOS DE TENDENCIAS                                   │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [Tendencia Mensual] | Por Rubro | Acumulado           │  │
│ │                                                         │  │
│ │  Chart: Budget vs Forecast vs Real (Monthly)           │  │
│ │                                                         │  │
│ │  ╱──╲                                                   │  │
│ │ ╱    ╲  ──── Budget                                     │  │
│ │       ╲╱     ──── Forecast                              │  │
│ │              ──── Real                                  │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ ▶ Resumen de todos los proyectos                      [▼]   │
└──────────────────────────────────────────────────────────────┘
    Collapsed by default
    Contains: Portfolio Summary View, Project list, Runway metrics

┌──────────────────────────────────────────────────────────────┐
│ ▶ Cuadrícula de Pronóstico (12 meses) — Por Rubro     [▼]   │
└──────────────────────────────────────────────────────────────┘
    Collapsed by default
    Contains: Rubros table, Category breakdown, Budget editing
    Toggle: Ver por [Rubro] [Proyecto] - Default: Rubro
    - Por Rubro: Category-first view (unchanged from original)
    - Por Proyecto: Project-first view with nested collapsible rubros

┌──────────────────────────────────────────────────────────────┐
│ ▶ Simulador de Presupuesto                            [▼]   │
└──────────────────────────────────────────────────────────────┘
    Collapsed by default
    Contains: Annual budget, Monthly budget, Budget simulator

┌──────────────────────────────────────────────────────────────┐
│ ▶ Desglose Mensual vs Presupuesto (12 meses) — Por Proyecto [▼] │
└──────────────────────────────────────────────────────────────┘
    Collapsed by default
    Contains: Forecast Grid with full line-item detail
    Toggle: Ver por [Rubro] [Proyecto] - Default: Proyecto (recommended)
    - Por Rubro: Category-first view
    - Por Proyecto: Project-first view with nested collapsible rubros (collapsed by default)

✅ Benefits:
- Clean, executive-friendly "above the fold" view
- Budget health status immediately visible
- Charts prominent for quick insights
- All details accessible but hidden
- Progressive disclosure pattern
```

---

## Budget Health Pill - Status Logic

```
┌─────────────────────────────────────────────────────────┐
│                   Budget Health                         │
│                                                         │
│  🟢 EN META                                            │
│     consumption ≤ 90%  AND  forecast ≤ budget          │
│     Green background, green text                        │
│     Meaning: On track, no concerns                      │
│                                                         │
│  🟡 EN RIESGO                                          │
│     consumption > 90%  AND  forecast ≤ budget          │
│     Yellow background, yellow text                      │
│     Meaning: High consumption but still under budget    │
│                                                         │
│  🔴 SOBRE PRESUPUESTO                                  │
│     forecast > budget  OR  consumption > 100%           │
│     Red background, red text                            │
│     Meaning: Over budget or overspent                   │
│                                                         │
│  ⚪ SIN PRESUPUESTO                                    │
│     No monthly budget configured                        │
│     Gray background, gray text                          │
│     Meaning: Budget not set up yet                      │
└─────────────────────────────────────────────────────────┘
```

---

## Collapsible Sections Behavior

### Closed State (Default)
```
┌──────────────────────────────────────────────────────────┐
│ ▶ Section Title                                    [▼]   │
└──────────────────────────────────────────────────────────┘
```

### Open State (User Expands)
```
┌──────────────────────────────────────────────────────────┐
│ ▼ Section Title                                    [▲]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Full section content rendered here]                    │
│  - Tables, charts, forms, etc.                           │
│  - All interactive features work                         │
│  - Data loaded and displayed                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Interaction
- Click on header bar OR chevron to toggle
- Keyboard: Enter/Space on focused trigger
- Smooth expand/collapse animation
- State NOT persisted (resets on page reload)

---

## Single Project Mode - UNCHANGED

```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Header: Gestión de Pronóstico                            │
│    [Project X] Project Badge                                 │
│    [Guardar Pronóstico] [Guardar] [Exportar]                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ ✅ Baseline Status Panel                                    │
│    Status: Accepted | Baseline ID: base_xyz                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 KPI Summary Cards (6 cards in row)                       │
│ [Total Planeado] [Pronóstico] [Real] [FTE] [Var Pron] [Var] │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 🔽 Budget & Simulation Panel (Collapsible)                  │
│    - Annual Budget Editor                                    │
│    - Monthly Budget (if in portfolio)                        │
│    - Budget Simulator (if in portfolio)                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 Cuadrícula de Pronóstico (12 meses) — Por Rubro         │
│    - Line-by-line breakdown                                  │
│    - Planned / Forecast / Actual columns                     │
│    - Editable cells                                          │
│    - Category subtotals                                      │
│    Toggle: Ver por [Rubro] [Proyecto]                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📊 Charts and Analytics                                     │
│    - Monthly trends                                          │
│    - Variance analysis                                       │
│    - Forecast accuracy                                       │
└──────────────────────────────────────────────────────────────┘

✅ All original features preserved
✅ Layout unchanged
✅ Behavior unchanged
✅ No breaking changes
```

---

## Component Hierarchy

### TODOS View Components
```
SDMTForecast (isPortfolioView === true)
├── Header + Actions
├── DataHealthPanel (dev only)
├── ForecastSummaryBar (NEW POSITION)
│   ├── Budget Health Pill (NEW)
│   ├── Total Budget
│   ├── Total Forecast
│   ├── Total Actual
│   ├── % Consumption
│   └── Variance vs Budget
├── ForecastChartsPanel (NEW POSITION)
│   ├── Monthly Trend Tab (default)
│   ├── By Category Tab
│   └── Cumulative Tab
├── Collapsible: "Resumen de todos los proyectos" (NEW WRAPPER)
│   └── PortfolioSummaryView
├── Collapsible: "Cuadrícula de Pronóstico 12 Meses" (NEW WRAPPER)
│   └── ForecastRubrosTable
├── Collapsible: "Simulador de Presupuesto" (NEW WRAPPER)
│   ├── Annual Budget Editor
│   ├── Monthly Budget Input
│   └── BudgetSimulatorCard
└── Collapsible: "Desglose mensual vs presupuesto" (NEW WRAPPER)
    └── Forecast Grid (table)
```

### Single Project View Components (Unchanged)
```
SDMTForecast (isPortfolioView === false)
├── Header + Actions
├── BaselineStatusPanel
├── DataHealthPanel (dev only)
├── KPI Summary Cards (6 cards)
├── Budget Simulation KPIs (if enabled)
├── Real Annual Budget KPIs
├── Collapsible: "Budget & Simulation Panel"
│   ├── Annual Budget Editor
│   └── (no monthly budget or simulator in single mode)
├── Forecast Grid (regular Card)
└── Charts and Analytics
```

---

## Code Structure Changes

### ForecastSummaryBar.tsx
```typescript
// ADDED: Budget Health Status Logic
const getBudgetHealthStatus = () => {
  // Logic for En Meta / En Riesgo / Sobre Presupuesto
  // Returns { label, color, bgColor }
}

// ADDED: Budget Health Pill in UI
<div className="flex items-center justify-between">
  <h3>Resumen Ejecutivo - Cartera Completa</h3>
  <Badge className={budgetHealth.bgColor}>
    {budgetHealth.label}
  </Badge>
</div>
```

### SDMTForecast.tsx
```typescript
// MODIFIED: Hide Baseline in TODOS
{!isPortfolioView && <BaselineStatusPanel />}

// MODIFIED: Hide KPI cards in TODOS
{!isPortfolioView && (
  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
    {/* KPI cards */}
  </div>
)}

// NEW: TODOS Layout Section
{isPortfolioView && (
  <>
    {/* Charts prominent */}
    <ForecastChartsPanel />
    
    {/* Collapsible sections */}
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader>
          <CardTitle>Resumen de todos los proyectos</CardTitle>
          <CollapsibleTrigger />
        </CardHeader>
        <CollapsibleContent>
          <PortfolioSummaryView />
        </CollapsibleContent>
      </Card>
    </Collapsible>
    
    {/* More collapsible sections... */}
  </>
)}

// MODIFIED: Conditional Forecast Grid Wrapper
{isPortfolioView ? (
  <Collapsible defaultOpen={false}>
    {/* Wrapped version */}
  </Collapsible>
) : (
  <Card>
    {/* Original version */}
  </Card>
)}

// MODIFIED: Charts only in single project
{!isPortfolioView && <ChartInsightsPanel />}
```

---

## Testing Checklist

### Visual Testing
- [ ] TODOS view shows Executive KPI bar at top
- [ ] Budget Health pill displays (check each status color)
- [ ] Charts panel visible and interactive
- [ ] All 4 sections collapsed by default
- [ ] Clicking header expands/collapses sections
- [ ] Section content renders correctly when expanded
- [ ] Single-project view unchanged (baseline visible, KPIs visible)

### Functional Testing
- [ ] Budget Health pill shows correct status based on data
  - [ ] Green when consumption ≤ 90% and forecast ≤ budget
  - [ ] Yellow when consumption > 90% and forecast ≤ budget
  - [ ] Red when forecast > budget or consumption > 100%
  - [ ] Gray when no budget configured
- [ ] Charts panel tabs switch correctly
- [ ] All collapsible sections expand/collapse smoothly
- [ ] Data in collapsed sections loads correctly when expanded
- [ ] Navigation between TODOS and single project works
- [ ] No console errors
- [ ] No broken links or components

### Data Integrity
- [ ] All existing data displays correctly
- [ ] Budget values match expected amounts
- [ ] Charts show correct data
- [ ] Forecast grid edits still work
- [ ] Budget simulation still functional
- [ ] No data loss or missing information

---

## Screenshots Required

### TODOS View Screenshots
1. **Above the fold** - Executive KPI bar + Charts panel
2. **Budget Health pill** - Each status (En Meta, En Riesgo, Sobre Presupuesto)
3. **Collapsed sections** - All 4 sections in closed state
4. **Expanded section example** - One section open showing content
5. **Full page scroll** - Complete TODOS layout from top to bottom

### Single Project Screenshots
6. **Above the fold** - Baseline panel + KPI cards
7. **Full layout** - Verify no changes from before

### Comparison
8. **Before/After side-by-side** - TODOS view transformation

---

## Summary

This visual guide demonstrates the transformation of the TODOS view from a dense, information-heavy layout into a clean executive overview. The key improvements are:

1. **Immediate clarity** - Budget health visible at a glance
2. **Progressive disclosure** - Details hidden but accessible
3. **Chart prominence** - Visual insights above the fold
4. **Preserved functionality** - All features still available
5. **Zero breaking changes** - Single-project mode unchanged

The implementation uses minimal code changes, leverages existing components, and maintains full backwards compatibility while dramatically improving the executive user experience in TODOS mode.
