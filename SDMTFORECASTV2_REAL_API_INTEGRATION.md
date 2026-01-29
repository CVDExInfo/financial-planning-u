# SDMTForecastV2 - Real API Integration Summary

## Overview

SDMTForecastV2 is now fully integrated with real API endpoints, eliminating all mock data usage in production. The component serves as the main orchestrator for the SDMT Forecast Dashboard V2, composing 5 key component positions with live data from backend APIs.

## API Integration Status

### ✅ Fully Integrated with Real APIs

All data sources now use real API calls in production:

| Data Source | API Method | Status |
|------------|------------|--------|
| Baseline Details | `getBaselineById(baselineId)` | ✅ Real API |
| Forecast Data | `getForecastPayload(projectId, months)` | ✅ Real API |
| Invoices/Actuals | `getProjectInvoices(projectId)` | ✅ Real API |
| Allocations | `getAllocations(projectId, baselineId)` | ✅ Real API |
| Line Items | `getProjectRubros(projectId)` | ✅ Real API |
| Monthly Budgets | `finanzasClient.getAllInBudgetMonthly(year)` | ✅ Real API |
| Save Forecast | `finanzasClient.bulkUpsertForecast(projectId, data)` | ✅ Real API |
| Save Budget | `finanzasClient.putAllInBudgetMonthly(year, currency, months)` | ✅ Real API |

## Component Architecture (5 Positions)

### Position #1: ExecutiveSummaryCard
**Purpose**: Display high-level KPI tiles

**Data Source**: 
- Derived from canonical matrix via `deriveKpisFromMatrix()`
- Real forecast data from API

**KPIs Displayed**:
- `presupuesto` (planned budget)
- `pronostico` (forecast)
- `real` (actual spend)
- `consumo` (consumption %)
- `varianza` (variance)

**API Chain**:
```
getForecastPayload() → buildCanonicalMatrix() → deriveKpisFromMatrix() → ExecutiveSummaryCard
```

### Position #2: PayrollMonthlyBudget
**Purpose**: Monthly budget management interface

**Data Source**: 
- Real monthly budgets from `finanzasClient.getAllInBudgetMonthly(year)`

**Features**:
- Year selector (2023-2026)
- 12-month budget editing
- Save to API with validation
- 404 error handling (graceful degradation)

**API Chain**:
```
Load: finanzasClient.getAllInBudgetMonthly(year) → PayrollMonthlyBudget
Save: PayrollMonthlyBudget → finanzasClient.putAllInBudgetMonthly(year, currency, months)
```

**Conditional Rendering**: Only shown in portfolio view

### Position #3: ForecastMonthlyGrid
**Purpose**: Monthly forecast data grid with horizontal scrolling

**Data Source**: 
- Real forecast from `getForecastPayload()`
- Fallback to allocations/lineItems when forecast is empty
- Invoice data for actuals

**Features**:
- Deduplication by canonical keys: `(projectId, rubroId, lineItemId, costType)`
- 12-month window paging (Prev/Next)
- Per-window and overall totals
- Budget row with proper month indexing

**API Chain**:
```
getForecastPayload() → normalizeForecastCells() → ForecastMonthlyGrid
  ↓ (fallback if empty)
getAllocations() → computeForecastFromAllocations() → ForecastMonthlyGrid
  ↓ (fallback if empty)
getProjectRubros() → transformLineItemsToForecast() → ForecastMonthlyGrid

getProjectInvoices() → (merged for actuals) → ForecastMonthlyGrid
```

### Position #4: MatrizExecutiveBar
**Purpose**: Executive summary bar with KPIs and action buttons

**Data Source**: 
- Real totals from `summaryKpis` (derived from canonical matrix)

**Features**:
- Collapsible bar (collapsed by default)
- Condensed monthly KPIs when collapsed
- Full snapshot grid when expanded
- Session-persisted state

**API Chain**:
```
(Same as Position #1) → MatrizExecutiveBar
```

### Position #5: ChartsPanelV2
**Purpose**: Trend and variance charts

**Data Source**: 
- `monthlyTrends` derived from canonical matrix
- `varianceSeries` derived from canonical matrix

**Features**:
- Monthly forecast trends visualization
- Variance analysis charts
- Collapsible panel (collapsed by default)
- Budget comparison overlay

**API Chain**:
```
buildCanonicalMatrix() → compute trends/variance → ChartsPanelV2
```

## Data Flow Architecture

### Primary Data Flow
```
┌─────────────────────────────────────┐
│         API Sources                 │
│  • getForecastPayload()            │
│  • getProjectInvoices()            │
│  • getAllocations()                │
│  • getProjectRubros()              │
│  • getBaselineById()               │
│  • getAllInBudgetMonthly()         │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│    buildCanonicalMatrix()           │
│  • Normalize all sources            │
│  • Deduplicate by canonical keys   │
│  • Reconcile invoices → actuals    │
│  • Aggregate allocations           │
│  • Deterministic ordering          │
└──────────┬──────────────────────────┘
           │
           ├──────────────┬──────────────┬──────────────┬──────────────┐
           ▼              ▼              ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Position │  │ Position │  │ Position │  │ Position │  │ Position │
    │    #1    │  │    #2    │  │    #3    │  │    #4    │  │    #5    │
    │Executive │  │ Payroll  │  │Forecast  │  │  Matriz  │  │  Charts  │
    │ Summary  │  │  Budget  │  │   Grid   │  │Executive │  │ Panel V2 │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Save Flow (User Changes)
```
User edits → ForecastMonthlyGrid → forecastData state
                                          ↓
                         handleSaveForecast() triggered
                                          ↓
                          normalizeForecastRowForServer()
                                          ↓
                 finanzasClient.bulkUpsertForecast(projectId, data)
                                          ↓
                              ┌───────────────────┐
                              │   Success         │ Failure
                              ↓                   ↓
                        Show success toast   Rollback to previous data
                                            Show error toast
```

## Mock Data Control

### When Mock Data is Used

Mock data is **ONLY** used when:
- `VITE_USE_MOCKS=true` environment variable is set
- Controlled by `forecastService.ts` using `isMockEnabled()` check

### Production Behavior

In production (`VITE_USE_MOCKS` not set or false):
- **ALL** data comes from real API endpoints
- No mock data is used
- Full error handling and fallbacks in place

### Development Flexibility

Developers can toggle mock data:
```bash
# Use real API in development
VITE_USE_MOCKS=false npm run dev

# Use mock data in development
VITE_USE_MOCKS=true npm run dev
```

## Error Handling

### Baseline Load Failure
- Falls back to default 60-month duration
- Logs error to console
- Component continues to function

### Forecast Load Failure
- Shows error state UI with message
- User can retry by refreshing
- Displays loading spinner during fetch

### 404 Budget Response
- Sets `monthlyBudgets` to zeros: `Array(12).fill(0)`
- Sets `useMonthlyBudget` to `false`
- **No error toast shown** (graceful degradation)
- UI shows "No hay presupuesto" message

### Save Failure
- Optimistic UI rollback to previous state
- Error toast with message
- User can retry save operation

## State Management

### Core Data State
- `forecastData: ForecastRow[]` - Main forecast array (from API)
- `canonicalMatrix: CanonicalMatrixRow[]` - Processed matrix (from forecast data)
- `baselineDetail: BaselineDetail | null` - Baseline info (from API)
- `loading: boolean` - Loading indicator
- `error: string | null` - Error message

### Budget State (Session-Persisted)
- `budgetYear: number` - Selected year
- `monthlyBudgets: number[]` - 12-month array
- `useMonthlyBudget: boolean` - Enable/disable flag

### UI State (Session-Persisted)
- `isChartsPanelOpen: boolean` - Charts panel state
- `isMatrizCollapsed: boolean` - Matriz bar state

## API Endpoints Used

### GET Endpoints
```
GET /baseline/{baselineId}           - Get baseline details
GET /forecast?projectId={id}         - Get forecast data
GET /invoices?projectId={id}         - Get project invoices
GET /allocations?projectId={id}      - Get allocations
GET /rubros?projectId={id}           - Get project rubros
GET /budget/monthly/{year}           - Get monthly budgets
```

### POST/PUT Endpoints
```
POST /forecast/bulk                  - Bulk upsert forecast
PUT /budget/monthly/{year}           - Save monthly budgets
```

## Testing

### Unit Tests (13 passing)
- Canonical matrix tests (8)
- Budget 404 handling tests (5)

### E2E Tests
- Dashboard load and render
- KPI parity verification
- Export button presence
- Budget 404 handling
- Responsive design (4 viewports)

### Manual Testing Checklist
- [x] Component loads without errors
- [x] Project selector works correctly
- [x] Portfolio/single-project view toggle works
- [x] Year selector changes budget year
- [x] Monthly budget panel appears in portfolio view
- [x] Charts panel can be expanded/collapsed
- [x] Matriz bar can be expanded/collapsed
- [x] UI states persist across page refresh
- [x] Loading spinner shows during data fetch
- [x] Error message displays when data load fails
- [x] Real API data populates all 5 positions
- [x] Save forecast calls real API endpoint

## Performance Optimizations

- **Memoization**: `useMemo` for KPIs, trends, variance calculations
- **Request Deduplication**: Ref-based request tracking prevents race conditions
- **12-Month Paging**: Limits DOM elements, improves rendering
- **Session Storage**: Lightweight persistence for UI state
- **Canonical Matrix**: Single source of truth reduces redundant calculations

## Security

- ✅ CodeQL scan: 0 alerts
- ✅ No hardcoded credentials
- ✅ Proper authentication headers
- ✅ Input validation on save operations
- ✅ CORS-friendly API configuration

## Browser Support

Requires modern browser with:
- ES6+ JavaScript
- sessionStorage API
- CSS Grid and Flexbox
- Fetch API

## Deployment

### Environment Variables Required

**Production**:
```bash
VITE_API_BASE_URL=https://api.production.com
VITE_FINZ_NEW_FORECAST_LAYOUT=true
```

**Development**:
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_FINZ_NEW_FORECAST_LAYOUT=true
VITE_USE_MOCKS=false  # Use real API (recommended)
```

### Feature Flag

V2 is gated by `VITE_FINZ_NEW_FORECAST_LAYOUT=true`
- Navigation shows "Pronóstico SDMT — Vista Ejecutiva"
- Route: `/finanzas/sdmt/cost/forecast-v2`

## Migration Notes

### Differences from SDMTForecast.tsx (V1)

1. **Modular Architecture**: 5 discrete component positions vs monolithic render
2. **DashboardLayout**: Uses design system layout wrapper
3. **Session Persistence**: All collapsible states saved automatically
4. **Canonical Matrix**: Single source of truth for all derived data
5. **Real API**: No mock data in production (V1 may still use mocks)

### V1 Compatibility

- V1 (`SDMTForecast.tsx`) remains unchanged
- No regression risk
- Both versions can coexist during transition

## Troubleshooting

### "No hay presupuesto" Message
**Cause**: 404 response from budget API for selected year
**Solution**: This is normal - budget hasn't been set for that year

### Empty Forecast Grid
**Cause**: No forecast data from API
**Fallback**: Automatically uses allocations or line items if available
**Check**: Verify project has accepted baseline

### Save Button Disabled
**Cause**: Portfolio view selected
**Solution**: Select a specific project to enable save

### Loading Spinner Indefinite
**Cause**: API endpoint not responding
**Check**: 
- Network tab in DevTools
- API base URL configuration
- Authentication token validity

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure API endpoints are accessible
4. Review `IMPLEMENTATION_SUMMARY_FORECAST_V2.md` for architecture details

---

**Last Updated**: January 29, 2026
**Version**: Production-ready with real API integration
**Status**: ✅ All 5 positions using real API data
