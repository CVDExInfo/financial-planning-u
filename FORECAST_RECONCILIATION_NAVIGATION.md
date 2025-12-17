# SDMT Forecast ↔ Facturas Reconciliation Navigation Implementation

## Overview

This implementation enables bidirectional navigation between the SDMT Forecast view and the Facturas Reconciliation module, allowing users to seamlessly add or edit facturas directly from the forecast grid.

## Component Files Modified

### 1. SDMT Forecast View
**File**: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Key Changes**:
- Added `useLocation` hook to capture current URL for returnUrl
- Modified `navigateToReconciliation` function (lines 342-353) to include `returnUrl` parameter
- Updated actuals cell display logic (lines 879-925) to always show the ExternalLink icon
- Changed tooltip text to indicate:
  - "View/Edit Factura" when actuals exist (`cell.actual > 0`)
  - "Add Factura / Enter Actuals" when no actuals present
- Added effect (lines 85-91) to detect `_refresh` parameter and reload data when returning from reconciliation

**Icon Location**: The navigation icon appears in the "Actuals" row of each forecast cell in the 12-month grid.

### 2. Facturas Reconciliation View
**File**: `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx`

**Key Changes**:
- Added `ArrowLeft` icon import
- Extracted `returnUrl` from URL parameters (line 229)
- Updated initial form data population (lines 231-241) to set both `start_month` and `end_month`
- Added `handleCancelUpload` function (lines 636-642) to navigate back on cancel
- Modified invoice upload success handler (lines 521-535) to navigate back with refresh parameter
- Added "Volver a Pronóstico" (Back to Forecast) button (lines 783-789) in the filtered view header

**Dialog Behavior**: When navigated from Forecast with line_item and month parameters, the upload dialog automatically opens with the form pre-filled.

## Navigation Flow

### Scenario 1: Factura Exists (Edit Flow)

1. User clicks ExternalLink icon in Forecast actuals cell that has `actual > 0`
2. Tooltip shows: "View/Edit Factura"
3. Navigation: `/sdmt/cost/reconciliation?line_item=XXX&month=Y&returnUrl=/sdmt/cost/forecast`
4. Reconciliation page loads with filtered view showing existing factura
5. User can view/edit the factura details
6. User clicks "Volver a Pronóstico" button to return
7. Forecast page reloads with refreshed actuals data

### Scenario 2: No Factura (Create Flow)

1. User clicks ExternalLink icon in Forecast actuals cell with no actuals (`actual = 0`)
2. Tooltip shows: "Add Factura / Enter Actuals"
3. Navigation: `/sdmt/cost/reconciliation?line_item=XXX&month=Y&returnUrl=/sdmt/cost/forecast`
4. Reconciliation page opens upload dialog automatically with:
   - Line item pre-selected
   - Month pre-selected (both start_month and end_month)
5. User fills in factura details and saves
6. On success, automatically navigates back to Forecast with `_refresh` parameter
7. Forecast page detects refresh parameter and reloads data
8. User can also cancel, which returns to Forecast without changes

### Scenario 3: Cancel from Create Mode

1. User clicks ExternalLink icon from Forecast
2. Upload dialog opens with pre-filled context
3. User clicks "Cancelar" button
4. If `returnUrl` is present, navigates back to Forecast
5. Otherwise, just closes the dialog

## URL Parameters

### From Forecast to Reconciliation
```
/sdmt/cost/reconciliation?line_item=<LINE_ITEM_ID>&month=<MONTH>&returnUrl=<ENCODED_URL>
```

### From Reconciliation back to Forecast
```
/sdmt/cost/forecast?<original_params>&_refresh=<TIMESTAMP>
```

The `_refresh` parameter with a timestamp ensures:
- Browser doesn't use cached data
- Forecast component's effect detects the change and reloads
- Actuals reflect the newly created/updated factura

## Data Refresh Mechanism

### Forecast Component
- Listens for `_refresh` parameter in URL (useEffect on `location.search`)
- When detected, calls `loadForecastData()` to fetch fresh data
- Ensures newly created/updated facturas appear in the actuals row

### Reconciliation Component
- After successful invoice upload, invalidates invoice cache
- Appends `_refresh` timestamp to returnUrl before navigating back
- This triggers Forecast to reload without requiring manual refresh

## User Experience Improvements

1. **Always Accessible**: Icon is always visible in actuals cells, not just when data exists
2. **Contextual Tooltips**: Clear indication whether user will add or edit
3. **Pre-filled Forms**: When adding factura, project and period are already selected
4. **Seamless Return**: Automatic navigation back to Forecast with updated data
5. **Clear Navigation**: "Volver a Pronóstico" button provides explicit return path
6. **No Manual Refresh**: Data automatically updates when returning from reconciliation

## Technical Implementation Details

### State Management
- Forecast: Uses existing `forecastData` state and `loadForecastData()` function
- Reconciliation: Uses existing `uploadFormData` state and form handlers
- No additional state required; leverages URL parameters for navigation context

### Backward Compatibility
- Existing direct navigation to reconciliation (without returnUrl) continues to work
- Upload form can still be opened via "Subir Factura" button
- No breaking changes to existing API contracts

### Error Handling
- Missing returnUrl: Reconciliation behaves normally without automatic navigation back
- Invalid line_item/month: Form validation catches issues before submission
- Network errors: Standard error toasts display; user remains in context

## Testing Scenarios

### Manual Testing Checklist
- [ ] Click icon on cell with actuals > 0 → Opens reconciliation with correct filter
- [ ] Click icon on cell with actuals = 0 → Opens upload dialog pre-filled
- [ ] Save new factura → Returns to Forecast with updated actuals
- [ ] Cancel upload → Returns to Forecast without changes
- [ ] Click "Volver a Pronóstico" → Returns to original Forecast view
- [ ] Verify data refresh after return (actuals update visible)
- [ ] Test with portfolio view (multiple projects)
- [ ] Test with different months
- [ ] Test with missing/invalid parameters

### Edge Cases Handled
- Portfolio view: Icon works for each project's line items
- Missing permissions: Existing permission checks still apply
- No returnUrl: Reconciliation functions normally
- Multiple rapid clicks: Navigation state managed properly
- Browser back button: Works as expected with returnUrl in history

## Future Enhancements

1. **Visual Feedback**: Add loading spinner during navigation
2. **Optimistic Updates**: Show pending actuals immediately in Forecast
3. **Batch Creation**: Support creating facturas for multiple months at once
4. **Draft State**: Allow saving incomplete facturas as drafts
5. **History Trail**: Show navigation breadcrumbs for complex flows

## Security & Validation

- All existing RBAC checks remain in place
- Upload form validation unchanged
- Invoice approval workflow unaffected
- returnUrl parameter is not used for sensitive operations
- URL parameters are properly encoded/decoded

## Related Files

- Route definitions: `src/App.tsx` (lines 199-202)
- Navigation component: `src/components/Navigation.tsx`
- API functions: `src/features/sdmt/cost/Forecast/forecastService.ts`
- Type definitions: `src/types/domain.ts`

## Deployment Notes

- No database migrations required
- No API changes required
- Pure frontend enhancement
- Can be deployed independently
- No environment variables needed
