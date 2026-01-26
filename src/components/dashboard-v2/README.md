# DashboardV2 Components

## Overview

This directory contains the modular components for DashboardV2, a modernized forecast dashboard with virtualized grid rendering and single-call data aggregation.

## Component Hierarchy

```
DashboardV2 (Main orchestrator)
├── TopBar (Navigation and controls)
├── ExecutiveSummary (KPI cards)
├── MonthlyBudgetPanel (Collapsible budget management)
├── ForecastGridWrapper (Grid data preparation)
│   └── ForecastGrid (Virtualized grid - NOT YET IMPLEMENTED)
└── ForecastChartsPanel (Trend and variance charts)
```

## Implementation Status

### ✅ Completed
- DashboardV2.tsx - Main shell and orchestration
- TopBar.tsx - STUB (requires full implementation)
- ExecutiveSummary.tsx - STUB (requires full implementation)
- MonthlyBudgetPanel.tsx - STUB (requires full implementation)
- ForecastGridWrapper.tsx - STUB (requires full implementation)
- ForecastChartsPanel.tsx - STUB (requires full implementation)

### ❌ Not Yet Implemented
- ForecastGrid.tsx - Virtualized grid with react-window
- MonthlySnapshotGrid.tsx - Executive matrix view
- Cell editing components
- Keyboard navigation handlers
- Accessibility features (ARIA labels, focus management)

## Usage

```tsx
import { DashboardV2 } from '@/components/dashboard-v2/DashboardV2';

function App() {
  return (
    <DashboardV2
      initialViewMode="portfolio"
      initialMonths={12}
      initialYear={2024}
    />
  );
}
```

## Feature Flags

DashboardV2 respects the following environment variables:

- `VITE_DASHBOARD_V2_ENABLED` - Enable/disable dashboard (default: false)
- `VITE_DASHBOARD_V2_EDIT` - Enable edit mode (default: false)
- `VITE_DASHBOARD_V2_READONLY` - Force read-only (default: false)

## Next Steps

### High Priority
1. Implement ForecastGrid with react-window virtualization
2. Add cell editing with optimistic updates
3. Integrate useBulkUpsert for save functionality
4. Add keyboard navigation (Tab, Arrow keys)
5. Implement accessibility features

### Medium Priority
1. Complete TopBar with all controls
2. Build full ExecutiveSummary with KPI cards
3. Implement MonthlyBudgetPanel 12-month grid
4. Add charts integration (LineChart, StackedColumns)
5. Create MonthlySnapshotGrid

### Low Priority
1. Add export functionality (Excel, PDF)
2. Implement advanced filtering
3. Add search/find in grid
4. Create print stylesheet
5. Add mobile responsive layouts

## Testing

### Unit Tests
- [ ] DashboardV2 rendering tests
- [ ] TopBar interaction tests
- [ ] ExecutiveSummary calculation tests
- [ ] Grid virtualization tests

### Integration Tests
- [ ] Data flow from useDashboardData
- [ ] Edit → Save → Refresh cycle
- [ ] Conflict resolution handling

### E2E Tests
- [ ] Full user workflow: load → navigate → edit → save
- [ ] Performance test with large dataset (10K rows × 60 months)

## Performance Targets

- Initial load: <3s
- Grid render (visible area): <2s
- Scrolling FPS: 60
- API p95 latency: <800ms

## Accessibility Requirements

- WCAG AA color contrast
- Keyboard navigation throughout
- Screen reader support
- Focus visible on all interactive elements
- ARIA labels for complex widgets

## References

- [DashboardV2 Migration Guide](../../DASHBOARD_V2_MIGRATION.md)
- [QA Checklist](../../QA.md)
- [OpenAPI Spec](../../openapi/portfolio-forecast.yaml)
