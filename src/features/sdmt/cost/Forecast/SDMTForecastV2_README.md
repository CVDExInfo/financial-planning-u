# SDMTForecastV2 - Dashboard Orchestrator Component

## Overview

`SDMTForecastV2.tsx` is the main orchestrator component for the SDMT Forecast Dashboard V2. It provides a modular, component-based layout that composes five key positions in a clean, maintainable structure.

## Component Architecture

### Layout Structure

The component uses `DashboardLayout` wrapper and organizes content in 5 sequential positions:

1. **ExecutiveSummaryCard** - KPI tiles showing high-level metrics (presupuesto, pronóstico, real, consumo, varianza)
2. **PayrollMonthlyBudget** - Monthly budget management interface (collapsed by default, portfolio view only)
3. **ForecastMonthlyGrid** - Monthly forecast data grid with horizontal scrolling (expanded by default)
4. **MatrizExecutiveBar** - Executive summary bar with KPIs and action buttons (collapsed by default)
5. **ChartsPanelV2** - Trend and variance charts (collapsed by default, portfolio view only)

### State Management

#### Core Data State
- `forecastData: ForecastRow[]` - Main forecast data array
- `loading: boolean` - Loading state indicator
- `error: string | null` - Error state

#### Budget State
- `budgetYear: number` - Selected budget year (persisted to sessionStorage)
- `monthlyBudgets: number[]` - 12-month budget array (persisted to sessionStorage)
- `useMonthlyBudget: boolean` - Flag to enable/disable monthly budgets (persisted)

#### UI State (Session-Persisted)
- `isChartsPanelOpen: boolean` - Charts panel collapse state
- `isMatrizCollapsed: boolean` - Matriz executive bar collapse state

All UI states are persisted to `sessionStorage` for better UX.

## Key Features

### Portfolio and Single-Project Views
- Automatically detects portfolio view when `selectedProjectId === ALL_PROJECTS_ID`
- Conditionally renders components based on view mode
- Shows/hides monthly budget management based on permissions

### Data Loading
- Uses `useProjectLineItems` hook to fetch line items
- Computes `monthsToShow` from baseline duration (falls back to 60 months)
- Generates mock forecast data for initial testing (to be replaced with API calls)

### Computed KPIs
Three main computed values drive the dashboard:

1. **summaryKpis** - Aggregated totals across all months
   - `presupuesto` (budget/planned)
   - `pronostico` (forecast)
   - `real` (actual)
   - `consumo` (consumption percentage)
   - `varianza` (variance)

2. **monthlyTrends** - Monthly forecast values for charts
   - Array of `{ month: number, value: number }`

3. **varianceSeries** - Monthly variance values for charts
   - Array of `{ month: number, value: number }`

### Event Handlers

- `handleYearChange(year)` - Load monthly budgets for selected year
- `handleSaveMonthlyBudget()` - Save monthly budget to API
- `handleChartsPanelOpenChange(open)` - Toggle charts panel (persists to sessionStorage)
- `handleMatrizToggle(isOpen)` - Toggle matriz bar (persists to sessionStorage)
- `handleExportExcel()` - Export forecast data to Excel (placeholder)
- `handleExportPDF()` - Export forecast data to PDF (placeholder)
- `handleSaveForecast()` - Save forecast changes (placeholder)

## Usage

### Basic Import

```tsx
import { SDMTForecastV2 } from '@/features/sdmt/cost/Forecast/SDMTForecastV2';

function App() {
  return <SDMTForecastV2 />;
}
```

### Routing Setup

Add to your routing configuration:

```tsx
import { SDMTForecastV2 } from '@/features/sdmt/cost/Forecast/SDMTForecastV2';

const routes = [
  {
    path: '/sdmt/forecast/v2',
    element: <SDMTForecastV2 />,
  },
];
```

## Dependencies

### Required Components
- `ExecutiveSummaryCard` - from `./components/ExecutiveSummaryCard`
- `PayrollMonthlyBudget` - from `./components/PayrollMonthlyBudget`
- `ForecastMonthlyGrid` - from `./components/ForecastMonthlyGrid`
- `MatrizExecutiveBar` - from `./components/MatrizExecutiveBar`
- `ChartsPanelV2` - from `./components/ChartsPanelV2`

### Required Hooks
- `useAuth` - from `@/hooks/useAuth`
- `useProject` - from `@/contexts/ProjectContext`
- `useProjectLineItems` - from `@/hooks/useProjectLineItems`

### Required Utilities
- `computeTotals`, `computeVariance` - from `@/lib/forecast/analytics`
- `normalizeForecastRowForServer` - from `./utils/normalizeForServer`
- `getBaselineDuration` - from `./monthHelpers`

### UI Components
- `DashboardLayout` - from `@/components/ui/design-system/DashboardLayout`
- `Button`, `Badge`, `Select` - from `@/components/ui/*`
- `LoadingSpinner` - from `@/components/LoadingSpinner`

## Configuration

### SessionStorage Keys

The component uses the following sessionStorage keys:

- `forecastV2BudgetYear` - Selected budget year
- `forecastV2MonthlyBudgets` - JSON array of 12 monthly budgets
- `forecastV2UseMonthlyBudget` - Boolean flag for monthly budget mode
- `forecastChartsPanelOpen` - Charts panel collapse state
- `forecastV2MatrizCollapsed` - Matriz bar collapse state

### Permissions

Budget editing is controlled by:
- Must be in portfolio view (`isPortfolioView === true`)
- Must have authenticated user (`!!user`)

## TODOs / Future Enhancements

### API Integration
The component currently uses mock data. The following areas need API integration:

1. **Load Forecast Data** (line ~238)
   ```typescript
   // TODO: Replace with actual API call
   // const data = await getForecastPayload(selectedProjectId, monthsToShow);
   ```

2. **Load Monthly Budget** (line ~330)
   ```typescript
   // TODO: Load monthly budgets for new year from API
   // const response = await finanzasClient.getAllInBudgetMonthly(year);
   ```

3. **Save Monthly Budget** (line ~344)
   ```typescript
   // TODO: Save to API
   // await finanzasClient.putAllInBudgetMonthly(budgetYear, 'USD', monthlyBudgets);
   ```

### Export Functionality
The following export handlers are placeholders:
- `handleExportExcel()` - Implement Excel export using `@/lib/excel-export`
- `handleExportPDF()` - Implement PDF export using `@/lib/pdf-export`

### Save Functionality
- `handleSaveForecast()` - Implement forecast data persistence

## Testing

### Manual Testing Checklist

- [ ] Component loads without errors
- [ ] Project selector works correctly
- [ ] Portfolio/single-project view toggle works
- [ ] Year selector changes budget year
- [ ] Monthly budget panel appears in portfolio view
- [ ] Charts panel can be expanded/collapsed
- [ ] Matriz bar can be expanded/collapsed
- [ ] UI states persist across page refresh (sessionStorage)
- [ ] Loading spinner shows during data fetch
- [ ] Error message displays when data load fails

### Unit Testing

Component tests should be added at:
`src/features/sdmt/cost/Forecast/__tests__/SDMTForecastV2.test.tsx`

## Migration from SDMTForecast.tsx

Key differences from original `SDMTForecast.tsx`:

1. **Simplified Structure** - Uses 5 modular components instead of monolithic render
2. **DashboardLayout** - Uses new design system layout wrapper
3. **Session Persistence** - All collapsible states saved to sessionStorage
4. **Cleaner State Management** - Reduced state variables, focused on core functionality
5. **Mock Data** - Initial implementation uses generated mock data for testing

## Performance Considerations

- Uses `useMemo` for expensive computations (KPIs, trends, variance)
- Minimizes re-renders with proper dependency arrays in `useEffect`
- SessionStorage operations are lightweight (read on mount, write on change)
- Mock data generation is simple and fast

## Accessibility

- Semantic HTML structure
- Loading state with spinner for screen readers
- Error states with clear messaging
- Keyboard navigation support (native to shadcn/ui components)

## Browser Support

Requires modern browser with support for:
- ES6+ JavaScript
- sessionStorage API
- CSS Grid and Flexbox

---

**Created**: December 2024  
**Version**: 2.0.0  
**Status**: Production-ready (with mock data)
