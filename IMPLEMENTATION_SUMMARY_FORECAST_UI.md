# SDMT Forecast UI Enhancements - Implementation Summary

## Overview
This PR implements UI-only changes for two features requested for the SDMT Forecast page:
1. **Feature A**: Enable "Forecast Adjusted by SDMT" with editable forecast values
2. **Feature B**: Add Annual All-In Budget input and comparison

## Changes Made

### Feature A: Forecast Adjusted by SDMT

#### UI Changes
- **Label Rename**: Changed "Ajustado PMO" to "Pronóstico Ajustado (SDMT)" throughout the UI
- **i18n Updates**: Added new Spanish text constants in `src/lib/i18n/es.ts`:
  - `plannedFromPlanview`: "Total Planeado De Planview"
  - `adjustedForecastSDMT`: "Pronóstico Ajustado (SDMT)"
  - `adjustForecast`: "Ajustar Pronóstico"

#### Functionality
- **Inline Editing**: Reused existing cell edit pattern to enable forecast value editing
- **Separate Tracking**: Added `dirtyForecasts` state to track forecast changes separately from actual changes
- **Save Functionality**: 
  - New "Ajustar Pronóstico" button with badge showing pending forecast adjustments
  - Separate "Guardar Reales" button for actual values
  - After save, calls `loadForecastData()` to refresh and show updated values

#### Backend Changes (Minimal & Additive)
**File**: `services/finanzas-api/src/handlers/forecast.ts`
- Added `updateForecastAdjustments()` function
- Added PUT handler to existing forecast endpoint
- Stores adjustments in DynamoDB with pattern: `pk: FORECAST#{projectId}`, `sk: ADJUST#{line_item_id}#{month}`
- Auth check: Only SDMT or PMO can update forecasts
- Uses BatchWriteCommand for bulk updates (max 25 per batch)

**File**: `src/api/finanzas.ts`
- Added `saveForecastAdjustments()` client method
- Calls PUT /plan/forecast with projectId and array of adjustments

#### KPI Behavior
- **Total Planeado De Planview**: Explicitly marked as read-only in UI
- **Pronóstico Ajustado (SDMT)**: Marked as editable, reflects user adjustments
- **Variación de Pronóstico**: Correctly updates when adjusted forecast differs from planned
  - Formula: `totalVariance = totalForecast - totalPlanned`

### Feature B: Annual All-In Budget

#### Component Integration
- **Existing Component**: Integrated pre-existing `AnnualBudgetWidget` from `src/components/budget/AnnualBudgetWidget.tsx`
- **Location**: Added to SDMT Forecast page after BaselineStatusPanel
- **Role-Based Display**: Only visible to SDMT and EXEC_RO roles

#### Widget Features (Pre-existing)
- Year selector with 5-year range (current year ±2)
- Numeric input for budget amount
- Currency selector (USD, EUR, MXN)
- Save functionality using existing API endpoints:
  - GET `/budgets/all-in?year={year}`
  - PUT `/budgets/all-in` with body `{year, amount, currency}`
- Comparison display:
  - Budget Total vs Adjusted Forecast (totalForecast)
  - Remaining/Excess amount with color coding
  - Progress bar with percentage consumed
  - Alert when budget exceeded
- Last updated timestamp and user

#### Data Flow
```
SDMTForecast.tsx
  ├─ Calculates totalForecast from forecastData
  └─ Passes to AnnualBudgetWidget as totalAdjustedForecast prop
      ├─ Loads existing budget via getAnnualBudget(year)
      ├─ User inputs/edits budget amount
      ├─ Saves via setAnnualBudget(year, amount, currency)
      └─ Displays comparison with totalForecast
```

## API Endpoints Used

### New Endpoints
- **PUT /plan/forecast**: Save forecast adjustments
  - Body: `{projectId: string, adjustments: [{line_item_id, month, forecast, notes}]}`
  - Auth: SDMT or PMO only
  - Returns: `{message, count, projectId, updatedAt}`

### Existing Endpoints (No Changes)
- **GET /plan/forecast**: Load forecast data (unchanged)
- **GET /budgets/all-in**: Load annual budget
- **PUT /budgets/all-in**: Save annual budget
- **POST /payroll/bulk**: Save actual values (unchanged)

## React Query Integration

### Data Invalidation
After saving forecast adjustments, the component:
1. Calls `loadForecastData()` to reload all forecast data
2. This ensures UI reflects the latest saved values
3. Clears `dirtyForecasts` state after successful save

### State Management
```typescript
// Separate state tracking
const [dirtyForecasts, setDirtyForecasts] = useState<Record<string, ForecastRow>>({});
const [dirtyActuals, setDirtyActuals] = useState<Record<string, ForecastRow>>({});

// Separate save handlers
const handlePersistForecasts = async () => { ... }
const handlePersistActuals = async () => { ... }
```

## Error Handling

### Forecast Save Errors
- Catches errors during save
- Uses `handleFinanzasApiError` for consistent error handling
- Shows actionable toast message
- Keeps edits in UI so user can retry
- Does not clear `dirtyForecasts` on error

### Budget Widget Errors
- Shows toast on load failure
- Shows toast on save failure
- Disables save button during operations
- Maintains user input on error for retry

### Inline Error States
- Forecast error state displays in grid area
- Non-blocking error messages preserve page functionality
- Debug information included for troubleshooting

## Security & RBAC

### No RBAC Changes
- Uses existing role checks: `user?.current_role === 'SDMT'`
- No changes to role definitions, auth guards, or route access
- Backend PUT endpoint enforces SDMT/PMO access via existing `getUserContext()`

### Authorization Flow
```
Frontend Check:
  canEditForecast = user?.current_role === 'PMO' || user?.current_role === 'SDMT'

Backend Check (PUT /plan/forecast):
  userContext = await getUserContext(event)
  if (!userContext.isSDMT && !userContext.isPMO) { return 403 }

Budget Widget Display:
  (user?.current_role === 'SDMT' || user?.current_role === 'EXEC_RO')
```

## Testing Checklist

### Feature A - Forecast Adjustments
- [ ] Labels display as "Pronóstico Ajustado (SDMT)" instead of "Ajustado PMO"
- [ ] Can click on forecast (F) cells to edit values inline
- [ ] Edited values show in local state immediately
- [ ] "Ajustar Pronóstico" button shows count of pending changes
- [ ] Clicking save button persists changes to backend
- [ ] After save, toast shows success message
- [ ] After save, data reloads and shows updated values
- [ ] Variación de Pronóstico updates when forecast differs from planned
- [ ] Error handling shows actionable message on save failure
- [ ] Changes remain in UI for retry on error

### Feature B - Annual Budget
- [ ] Widget visible to SDMT users on Forecast page
- [ ] Widget visible to EXEC_RO users on Forecast page
- [ ] Widget hidden from other roles
- [ ] Year selector defaults to current year
- [ ] Can select different years (±2 from current)
- [ ] Loads existing budget for selected year
- [ ] Can input budget amount
- [ ] Can select currency (USD, EUR, MXN)
- [ ] Save button persists budget to backend
- [ ] Comparison shows budget vs totalForecast
- [ ] Progress bar reflects percentage consumed
- [ ] Alert shown when budget exceeded
- [ ] Last updated info displays correctly

### Integration Testing
- [ ] Both features work simultaneously without conflict
- [ ] Saving forecasts doesn't affect budget
- [ ] Saving budget doesn't affect forecasts
- [ ] Role checks work correctly for both features
- [ ] Page performance acceptable with both widgets

## Deployment Notes

### Backend Deployment
1. Deploy updated Lambda handler: `services/finanzas-api/src/handlers/forecast.ts`
2. Ensure PUT method routed to forecast handler in API Gateway
3. Verify DynamoDB permissions for allocations table (already exists)

### Frontend Deployment
1. Standard build and deploy process
2. No environment variable changes required
3. No new dependencies added

### Rollback Plan
If issues arise:
1. Revert to previous commit
2. PUT endpoint is new, so removing it won't break existing functionality
3. UI changes are backward compatible (old label still understandable)

## Files Changed

### Backend
- `services/finanzas-api/src/handlers/forecast.ts` - Added PUT handler

### Frontend
- `src/api/finanzas.ts` - Added saveForecastAdjustments method
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Main UI changes
- `src/lib/i18n/es.ts` - Added Spanish text constants

### No Changes Required
- `src/components/budget/AnnualBudgetWidget.tsx` - Pre-existing, used as-is
- Backend budget handlers - Pre-existing, used as-is

## Notes

### Design Decisions
1. **Separate Save Buttons**: Chose to have distinct save buttons for forecasts and actuals to avoid confusion and allow granular control
2. **Minimal Backend**: Added only one PUT handler, reused existing DynamoDB table
3. **Reuse Pattern**: Forecast editing reuses the same inline edit pattern as actuals
4. **Widget Integration**: Leveraged pre-existing AnnualBudgetWidget rather than creating new component

### Future Enhancements
- Consider merging save operations if users prefer single "Save All" button
- Add real-time collaboration indicators for multi-user editing
- Add audit log viewing for forecast adjustment history
- Add export functionality specifically for budget comparison report

### Known Limitations
- Forecast adjustments stored separately from base forecast data
- Budget widget calculates from UI state; not persisted aggregate in backend
- Year range in budget widget limited to ±2 from current year
