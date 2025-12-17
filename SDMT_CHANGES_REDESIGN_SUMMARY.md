# SDMT Cost "Cambios y Ajustes" Redesign - Implementation Summary

## Overview

This implementation redesigns the SDMT Cost change request flow to be baseline-aware and time-aware, with proper integration to the forecast system.

## Key Features Implemented

### 1. Baseline Auto-Binding
- Change requests now automatically link to the project's accepted baseline
- The baseline ID field is read-only and auto-populated
- Change creation is disabled when no baseline exists
- Clear messaging when baseline is missing

### 2. Time Distribution Controls
Three new fields control how change impacts are distributed over time:

- **Start Month Index** (1-based): Which month the impact begins
- **Duration (months)**: How many months the impact applies to
- **Allocation Mode**: 
  - `one_time`: Full amount applied to start month only
  - `spread_evenly`: Amount divided equally across all months in duration

**Validation:**
- Start month must be ≥ 1
- Duration must be ≥ 1
- Start month + duration cannot exceed project period

### 3. New Rubro Support
Users can now request expenses that don't map to existing line items:

- Toggle: "Este cambio requiere un rubro nuevo"
- When enabled, capture:
  - New rubro name
  - Expense type (OPEX, CAPEX, OTHER)
  - Operational description
- Existing rubro selector is disabled when toggle is on

### 4. Impact Summary Preview
Before submission, users see a summary showing:
- Which baseline the change affects
- Which rubros are impacted (or new rubro details)
- How the amount will be distributed (e.g., "+500,000 USD distribuidos en 10 meses desde el mes 13")

### 5. Forecast Integration
After a change is approved:
- Forecast query cache is automatically invalidated
- User sees a toast notification with a "Ver Pronóstico" button
- The button deep-links to the forecast view
- Future enhancement: Highlight cells affected by the change (backend support required)

## Updated Data Model

### ChangeRequest Type
```typescript
export type ChangeRequest = {
  // Existing fields...
  id: string;
  baseline_id: string;
  title: string;
  description: string;
  impact_amount: number;
  currency: Currency;
  affected_line_items: string[];
  justification: string;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  approvals: Approval[];
  
  // NEW: Time distribution fields
  start_month_index?: number;
  duration_months?: number;
  allocation_mode?: "one_time" | "spread_evenly";
  
  // NEW: New line item request
  new_line_item_request?: {
    name: string;
    type: string;
    description: string;
  };
};
```

## UI Changes

### Change Creation Modal (SDMTChanges.tsx)
1. **Baseline Section**: Now read-only with auto-population
2. **Time Distribution Section**: New bordered section with:
   - Start month input
   - Duration input
   - Radio group for allocation mode
3. **New Rubro Section**: New bordered section with:
   - Toggle switch
   - Conditional fields for new rubro details
4. **Impact Summary**: New section showing distribution preview
5. **Validation Messages**: Enhanced error messages for all new fields

### Approval Workflow (ApprovalWorkflow.tsx)
- Displays time distribution info when present
- Shows new line item request with distinctive amber styling
- Updated to pass new fields through the workflow

### Forecast View (SDMTForecast.tsx)
- Added TODO comments for backend integration
- Placeholder for change request indicators on cells
- Cache invalidation ensures data refreshes after approvals

## Backend Integration Requirements

### 1. Change Request API
The `POST /projects/{id}/changes` endpoint must accept the new fields:

```json
{
  "baseline_id": "string",
  "title": "string",
  "description": "string",
  "impact_amount": 500000,
  "currency": "USD",
  "justification": "string",
  "affected_line_items": ["id1", "id2"],
  "start_month_index": 13,
  "duration_months": 10,
  "allocation_mode": "spread_evenly",
  "new_line_item_request": {
    "name": "Consultoría de seguridad",
    "type": "OPEX",
    "description": "..."
  }
}
```

### 2. Approval Processing
When a change is approved, the backend should:

1. **Parse time distribution parameters**
2. **Handle new rubro creation** (if `new_line_item_request` is present):
   - Create the new line item in the catalog
   - Link it to the project
   - Use its ID for forecast entries

3. **Update forecast entries**:
   - For `allocation_mode = "one_time"`:
     ```
     forecast[rubro_id][start_month_index] += impact_amount
     ```
   - For `allocation_mode = "spread_evenly"`:
     ```
     amount_per_month = impact_amount / duration_months
     for month in range(start_month_index, start_month_index + duration_months):
       forecast[rubro_id][month] += amount_per_month
     ```

4. **Link changes to forecast cells** (optional but recommended):
   - Store `change_request_id` with each affected forecast cell
   - Return this in the forecast API response
   - Frontend will use it to display "Change #ID" badges

### 3. Forecast API Enhancement
The `GET /plan/forecast` response should optionally include:

```typescript
type ForecastCell = {
  // Existing fields...
  line_item_id: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  
  // NEW: Optional field to link to source change
  change_request_id?: string;
};
```

## Testing Recommendations

1. **Baseline Auto-Population**:
   - Create change with accepted baseline → ID should auto-fill
   - Try without baseline → Button should be disabled

2. **Time Distribution**:
   - Set start month = 50, duration = 20, period = 60 → Should show error
   - Set valid range → Should pass validation
   - Test both allocation modes

3. **New Rubro**:
   - Toggle on → Existing rubros should be disabled
   - Fill in new rubro fields → Should validate
   - Submit → Payload should include `new_line_item_request`

4. **Forecast Integration**:
   - Approve a change → Toast should appear with link
   - Click "Ver Pronóstico" → Should navigate to forecast
   - Check forecast data → Should be refreshed (cache invalidated)

5. **Approval Workflow**:
   - View change in workflow → Should show time distribution
   - View change with new rubro → Should show amber-styled section

## Files Modified

1. `src/types/domain.d.ts` - Extended ChangeRequest type
2. `src/features/sdmt/cost/Changes/SDMTChanges.tsx` - Main form and logic
3. `src/features/sdmt/cost/Changes/ApprovalWorkflow.tsx` - Display new fields
4. `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Cache invalidation and TODOs

## Migration Notes

- Existing change requests will still work (new fields are optional)
- Frontend is backward compatible
- Backend should treat missing fields as:
  - `start_month_index` = 1
  - `duration_months` = 1
  - `allocation_mode` = "one_time"
  - `new_line_item_request` = undefined (use `affected_line_items` as before)

## Future Enhancements

1. **Change History on Forecast Cells**: Display which changes affected each cell
2. **Bulk Change Operations**: Allow multiple changes in one request
3. **Change Templates**: Pre-fill common change patterns
4. **Advanced Distribution Modes**: Custom monthly distributions, percentage-based
5. **Change Impact Simulation**: Preview forecast impact before submission
