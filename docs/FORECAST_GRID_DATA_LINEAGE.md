# Forecast Grid Data Lineage Documentation

## Overview
This document explains how data flows through the SDMT Forecast feature, specifically focusing on Position #7 (Monitoreo mensual de proyectos vs. presupuesto) to prevent future regressions.

## Issue History

### PR #952 - Incomplete Implementation
- **Problem**: Added breakdown mode selector UI but didn't connect it to rendering logic
- **Symptoms**: No data loads in grids when switching between "Proyectos" and "Rubros por proyecto"
- **Root Cause**: `breakdownMode` state was stored but never used to control what gets rendered

### Fix Implementation
- Modified `ForecastRubrosTable` to accept external view mode control
- Connected Position #7's `breakdownMode` to `ForecastRubrosTable`'s `viewMode`
- Eliminated redundant 300+ line table implementation

## Data Flow Architecture

### 1. Data Loading Pipeline

```
API/Database
  ↓
getForecastPayload(projectId, months) → ForecastCell[]
getProjectInvoices(projectId) → InvoiceDoc[]
  ↓
loadForecastData() / loadPortfolioForecast()
  ├─ normalizeInvoiceMonth() → convert invoice month to (1-12)
  ├─ matchInvoiceToCell() → apply actuals to forecast cells
  └─ setForecastData() → store raw cells
  ↓
State Variables
  ├─ forecastData: ForecastRow[]
  ├─ portfolioLineItems: ProjectLineItem[]
  ├─ categoryTotals: Map<string, CategoryTotals>
  ├─ categoryRubros: Map<string, CategoryRubro[]>
  ├─ projectTotals: Map<string, ProjectTotals>
  └─ projectRubros: Map<string, ProjectRubro[]>
  ↓
Rendering Components
  ├─ Position #2: ForecastRubrosTable (canonical 12-month grid)
  ├─ Position #3: MonthlySnapshotGrid (executive snapshot)
  └─ Position #7: ForecastRubrosTable (monitoring with breakdown modes)
```

### 2. State Variables Reference

| Variable | Type | Computed From | Purpose |
|----------|------|---------------|---------|
| `forecastData` | ForecastRow[] | API via `getForecastPayload()` | Raw forecast cells (P/F/A/V) |
| `portfolioLineItems` | ProjectLineItem[] | Aggregated from all projects | Portfolio-wide line items (TODOS) |
| `categoryTotals` | Map<string, CategoryTotals> | `buildCategoryTotals(forecastData)` | Totals grouped by cost category |
| `categoryRubros` | Map<string, CategoryRubro[]> | `buildCategoryRubros(forecastData, lineItems)` | Rubros grouped by category |
| `projectTotals` | Map<string, ProjectTotals> | `buildProjectTotals(forecastData)` | Totals grouped by project |
| `projectRubros` | Map<string, ProjectRubro[]> | `buildProjectRubros(forecastData, lineItems)` | Rubros grouped by project |

### 3. Position Comparison

| Position | Component | Purpose | View Control | Data Source |
|----------|-----------|---------|--------------|-------------|
| **#2** | ForecastRubrosTable | Canonical 12-month grid | Internal toggle | categoryTotals, categoryRubros, projectTotals, projectRubros |
| **#3** | MonthlySnapshotGrid | Executive snapshot | N/A | forecastData, portfolioLineItems |
| **#7** | ForecastRubrosTable | Monitoring with breakdown | External via `breakdownMode` | categoryTotals, categoryRubros, projectTotals, projectRubros |

## Position #7: Breakdown Mode Implementation

### Breakdown Mode Mapping

```typescript
// Position #7 dropdown selector
<Select value={breakdownMode} onValueChange={handleBreakdownModeChange}>
  <SelectItem value="project">Proyectos</SelectItem>
  <SelectItem value="rubros">Rubros por proyecto</SelectItem>
</Select>

// Maps to ForecastRubrosTable viewMode
externalViewMode={breakdownMode === 'rubros' ? 'category' : 'project'}
```

| Breakdown Mode | View Mode | Description |
|----------------|-----------|-------------|
| `'project'` | `'project'` | Group by project with rubros under each project |
| `'rubros'` | `'category'` | Group by category with rubros under each category |

### Component Configuration

```tsx
<ForecastRubrosTable
  categoryTotals={categoryTotals}
  categoryRubros={categoryRubros}
  projectTotals={projectTotals}
  projectRubros={projectRubros}
  portfolioTotals={portfolioTotalsForCharts}
  monthlyBudgets={monthlyBudgets}
  onSaveBudget={handleSaveBudgetFromTable}
  formatCurrency={formatCurrency}
  canEditBudget={canEditBudget}
  defaultFilter="all"
  externalViewMode={breakdownMode === 'rubros' ? 'category' : 'project'}
  hideViewModeToggle={true}
/>
```

## ForecastRubrosTable Component

### Props Interface

```typescript
interface ForecastRubrosTableProps {
  categoryTotals: Map<string, CategoryTotals>;
  categoryRubros: Map<string, CategoryRubro[]>;
  projectTotals?: Map<string, ProjectTotals>;
  projectRubros?: Map<string, ProjectRubro[]>;
  portfolioTotals: PortfolioTotals;
  monthlyBudgets: Array<{ month: number; budget: number }>;
  onSaveBudget: (budgets: Array<{ month: number; budget: number }>) => Promise<void>;
  formatCurrency: (amount: number) => string;
  canEditBudget: boolean;
  defaultFilter?: FilterMode;
  externalViewMode?: ViewMode; // External control (Position #7 uses this)
  hideViewModeToggle?: boolean; // Hide internal toggle when externally controlled
}
```

### View Mode Control

- **Internal Control** (Position #2): Component manages its own viewMode state, persisted in sessionStorage
- **External Control** (Position #7): Parent component controls viewMode via `externalViewMode` prop
- When `externalViewMode` is provided:
  - Component uses external value instead of internal state
  - Internal toggle is hidden via `hideViewModeToggle={true}`
  - SessionStorage persistence is skipped

## Critical Implementation Rules

### ❌ DON'T

1. **Don't create separate grid implementations** - Always use existing components (ForecastRubrosTable, MonthlySnapshotGrid)
2. **Don't ignore breakdown mode selectors** - If a dropdown exists, it must control rendering
3. **Don't duplicate data transformation logic** - Use shared utility functions (buildCategoryTotals, buildProjectTotals, etc.)
4. **Don't mix view mode controls** - Use either internal OR external, never both

### ✅ DO

1. **Do use ForecastRubrosTable** - It's battle-tested and handles all edge cases
2. **Do map breakdownMode to viewMode** - Keep UI labels aligned with technical implementation
3. **Do pass all required data** - categoryTotals, categoryRubros, projectTotals, projectRubros
4. **Do document state mapping** - Explain how user actions translate to data transformations

## Testing Checklist

When modifying forecast grid code:

- [ ] Test breakdownMode="project" shows project-grouped view
- [ ] Test breakdownMode="rubros" shows category-grouped view  
- [ ] Test dropdown switches between modes correctly
- [ ] Test data loads for both modes (no empty state)
- [ ] Test with TODOS (ALL_PROJECTS) mode
- [ ] Test with single project mode
- [ ] Test filter modes (labor/all/non-labor) work in both breakdown modes
- [ ] Test budget editing works correctly
- [ ] Test search/filter functionality
- [ ] Test empty states display appropriately

## Regression Prevention

### Code Review Checklist

When reviewing forecast grid changes:

1. ✅ Does the PR connect UI controls to rendering logic?
2. ✅ Are all data props passed to components?
3. ✅ Is viewMode/breakdownMode mapping documented?
4. ✅ Are there tests covering both breakdown modes?
5. ✅ Does the implementation reuse existing components?

### Common Pitfalls

1. **Adding UI without data wiring** - Always connect selectors to state that controls rendering
2. **Creating redundant tables** - Reuse ForecastRubrosTable instead of duplicating
3. **Ignoring sessionStorage** - Respect user preferences for view modes and filters
4. **Breaking external control** - When using `externalViewMode`, never call `setInternalViewMode` from external code

## Files Modified

1. `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Position #7 implementation
2. `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx` - External view mode control
3. `docs/FORECAST_GRID_DATA_LINEAGE.md` - This documentation

## Related Documentation

- `src/features/sdmt/cost/Forecast/BUDGET_SIMULATOR_DOCS.md` - Budget simulator implementation
- `src/features/sdmt/cost/Forecast/categoryGrouping.ts` - Category aggregation logic
- `src/features/sdmt/cost/Forecast/projectGrouping.ts` - Project aggregation logic

## Contact

For questions or issues related to forecast grid data flow:
- Review this documentation first
- Check git blame for recent changes
- Review PR #952 and the fix for context
