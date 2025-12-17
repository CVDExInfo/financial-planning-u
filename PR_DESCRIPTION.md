# Pull Request: SDMT Forecast UI — Enable Adjusted Forecast Editing + Annual Budget Input

## Overview
This PR implements UI-only changes for two critical features requested for the SDMT Forecast page (Gestión de Pronóstico), enabling SDMT users to:
1. Edit and save adjusted forecast values (previously read-only)
2. Input and track annual all-in budget with comparison to forecasted spend

## Features Implemented

### Feature A: Forecast Adjusted by SDMT ✅
**Goal**: Allow SDMT users to edit forecast values representing "Adjusted Forecast"

**Changes**:
- ✅ Renamed "Pronóstico Total Ajustado PMO" → "Pronóstico Ajustado (SDMT)"
- ✅ Added inline editing for forecast cells (click to edit, Enter/blur to save)
- ✅ Created separate save button "Ajustar Pronóstico" with pending count badge
- ✅ Implemented backend PUT endpoint for persistence
- ✅ Added data reload after save to show updated values
- ✅ Fixed KPI display: "Total Planeado De Planview" clearly marked read-only
- ✅ Error handling with actionable toast messages

**Technical Implementation**:
```typescript
// State management - separate tracking
const [dirtyForecasts, setDirtyForecasts] = useState<Record<string, ForecastRow>>({});
const [dirtyActuals, setDirtyActuals] = useState<Record<string, ForecastRow>>({});

// Save handler
const handlePersistForecasts = async () => {
  const adjustments = entries.map(cell => ({
    line_item_id: cell.line_item_id,
    month: cell.month,
    forecast: cell.forecast,
    notes: cell.notes || '',
  }));
  await saveForecastAdjustments(selectedProjectId, adjustments);
  await loadForecastData(); // Reload to show saved values
};
```

### Feature B: Annual All-In Budget ✅
**Goal**: Input annual all-in budget and compare against forecast totals

**Changes**:
- ✅ Integrated pre-existing AnnualBudgetWidget component
- ✅ Positioned on Forecast page after BaselineStatusPanel
- ✅ Role-gated visibility (SDMT and EXEC_RO only)
- ✅ Year selector with ±2 year range
- ✅ Budget vs Forecast comparison with delta and percentage
- ✅ Progress bar with color-coded status (green/yellow/red)
- ✅ Alert when budget exceeded
- ✅ Uses existing backend API endpoints (no changes required)

**Integration**:
```tsx
{(user?.current_role === 'SDMT' || user?.current_role === 'EXEC_RO') && (
  <AnnualBudgetWidget
    year={new Date().getFullYear()}
    totalAdjustedForecast={totalForecast}
    onBudgetUpdate={(budget) => {
      toast.success(`Presupuesto ${budget.year} actualizado`);
    }}
  />
)}
```

## API Changes

### New Endpoint
**PUT /plan/forecast** - Save forecast adjustments
- **Auth**: SDMT or PMO roles only
- **Request Body**:
  ```json
  {
    "projectId": "proj_123",
    "adjustments": [
      {
        "line_item_id": "rubro_001",
        "month": 3,
        "forecast": 15000,
        "notes": "Adjusted for Q1 overrun"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "message": "Forecast adjustments saved successfully",
    "count": 12,
    "projectId": "proj_123",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
  ```
- **Storage**: DynamoDB with pattern `pk: FORECAST#{projectId}`, `sk: ADJUST#{line_item_id}#{month}`

### Existing Endpoints (Unchanged)
- GET /plan/forecast - Load forecast data
- GET /budgets/all-in - Load annual budget
- PUT /budgets/all-in - Save annual budget
- POST /payroll/bulk - Save actual values

## React Query Integration

### Query Keys Affected
```typescript
// Forecast data invalidation after save
await loadForecastData(); // Reloads ['lineItems', projectId] and forecast data

// Budget widget manages its own state
// Uses getAnnualBudget(year) and setAnnualBudget(year, amount, currency)
```

## Security & RBAC

### No RBAC Changes Required ✅
All authorization uses existing role checks:

**Frontend**:
```typescript
canEditForecast = user?.current_role === 'PMO' || user?.current_role === 'SDMT';
showBudgetWidget = user?.current_role === 'SDMT' || user?.current_role === 'EXEC_RO';
```

**Backend**:
```typescript
// PUT /plan/forecast handler
const userContext = await getUserContext(event);
if (!userContext.isSDMT && !userContext.isPMO) {
  return 403;
}
```

## Files Changed

### Backend (1 file, ~95 lines added)
- `services/finanzas-api/src/handlers/forecast.ts`
  - Added `updateForecastAdjustments()` function
  - Added PUT handler routing
  - Added BatchWriteCommand import

### Frontend (3 files, ~130 lines added)
- `src/api/finanzas.ts`
  - Added `saveForecastAdjustments()` method
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
  - Added dirtyForecasts state and tracking
  - Added handlePersistForecasts function
  - Updated handleCellSave to track forecast changes
  - Added AnnualBudgetWidget integration
  - Updated button layout with separate save buttons
  - Updated labels using i18n constants
- `src/lib/i18n/es.ts`
  - Added `plannedFromPlanview`, `adjustedForecastSDMT`, `adjustForecast`

### No Changes
- `src/components/budget/AnnualBudgetWidget.tsx` - Used as-is (pre-existing)
- Backend budget handlers - Used as-is (pre-existing)

## Testing Checklist

### Feature A - Forecast Adjustments
- [ ] Page loads with new label "Pronóstico Ajustado (SDMT)"
- [ ] Can click forecast (F) cells to edit inline
- [ ] Edited values show immediately in UI
- [ ] "Ajustar Pronóstico" button shows pending count
- [ ] Clicking save persists to backend
- [ ] Success toast appears after save
- [ ] Data reloads and shows updated forecast values
- [ ] Variación de Pronóstico updates correctly
- [ ] Error toast on save failure
- [ ] Can retry after error

### Feature B - Annual Budget
- [ ] Widget visible to SDMT users
- [ ] Widget visible to EXEC_RO users  
- [ ] Widget hidden from PM, auditor roles
- [ ] Year selector works, defaults to current year
- [ ] Can input budget amount
- [ ] Can change currency
- [ ] Save button persists budget
- [ ] Success toast after save
- [ ] Comparison shows budget vs totalForecast
- [ ] Delta calculates correctly
- [ ] Progress bar displays correct percentage
- [ ] Red alert when budget exceeded
- [ ] Last updated info displays

### Integration
- [ ] Both features work simultaneously
- [ ] No conflicts between forecast and budget saves
- [ ] Page performance acceptable
- [ ] Mobile responsive
- [ ] Accessibility (keyboard navigation, screen readers)

## Deployment

### Prerequisites
- DynamoDB allocations table exists (already deployed)
- API Gateway routes PUT to forecast handler (requires infra update)

### Deployment Steps
1. Deploy backend Lambda (forecast.ts handler)
2. Update API Gateway to route PUT /plan/forecast
3. Deploy frontend build
4. Smoke test both features

### Rollback Plan
If issues arise:
1. Revert to previous commit
2. PUT endpoint is new, removal won't break existing functionality
3. Frontend changes are backward compatible

## Design Decisions

### Why Separate Save Buttons?
- **Clarity**: Users understand what they're saving (forecasts vs actuals)
- **Granular Control**: Can save forecasts without affecting actuals
- **Error Isolation**: Failure in one doesn't block the other
- **Audit Trail**: Separate operations for better tracking

### Why Reuse Inline Edit Pattern?
- **Consistency**: Same UX for forecast and actual editing
- **Proven**: Pattern already tested and working
- **Minimal Code**: Less duplication, easier maintenance

### Why Integrate Existing Budget Widget?
- **DRY Principle**: Don't recreate functionality
- **Battle-Tested**: Widget already handles edge cases
- **Maintainability**: Single source of truth for budget logic

## Known Limitations

1. **Forecast Adjustments Storage**: Stored separately from base forecast data (design choice for audit trail)
2. **Budget Aggregate**: Calculated in UI from totalForecast, not persisted aggregate in backend
3. **Year Range**: Budget widget limited to ±2 years from current (configurable if needed)
4. **Single Project**: Budget is org-wide but comparison shows single project forecast (portfolio view aggregates correctly)

## Future Enhancements

### Short Term
- [ ] Add loading skeleton for budget widget
- [ ] Add keyboard shortcuts (Ctrl+S to save)
- [ ] Add confirmation dialog before saving multiple adjustments

### Medium Term
- [ ] Add audit log viewer for forecast adjustment history
- [ ] Add real-time collaboration indicators
- [ ] Add export specifically for budget comparison report
- [ ] Add forecast comparison across multiple years

### Long Term
- [ ] Add predictive analytics for budget forecasting
- [ ] Add what-if scenario modeling
- [ ] Add automated budget alerts/notifications

## Documentation

Comprehensive implementation guide available in:
`IMPLEMENTATION_SUMMARY_FORECAST_UI.md`

Covers:
- Detailed technical specifications
- Data flow diagrams
- Security considerations
- Testing guidelines
- Troubleshooting tips

## Questions?

For questions or issues:
1. Check IMPLEMENTATION_SUMMARY_FORECAST_UI.md
2. Review code comments in changed files
3. Contact @valencia94 or Copilot team

---

**PR Type**: Feature Enhancement  
**Impact**: Medium (UI-only with minimal backend)  
**Risk**: Low (additive changes, no breaking modifications)  
**Testing**: Manual testing required before merge
