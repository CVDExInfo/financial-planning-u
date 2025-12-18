# SDMT Changes Module Fix Summary

## Problem Statement

After PR #706 (`Redesign SDMT Changes flow: baseline-aware, time-distributed impacts with forecast integration`), the SDMT "Cambios y Ajustes" module was showing an empty state with zero counts, making the module appear broken.

## Root Causes

1. **Missing Temporal Fields in API Payloads**: The new temporal distribution fields (`start_month_index`, `duration_months`, `allocation_mode`) were not being sent to or parsed from the backend
2. **Missing new_line_item_request Mapping**: The new rubro request feature was not properly mapped between UI form and API
3. **Type Mismatches**: ApprovalWorkflow component used camelCase field names while the domain types used snake_case
4. **Missing Context Validation**: No handling for ALL_PROJECTS context or clear baseline validation messaging

## Solutions Implemented

### 1. API Service Updates (`src/lib/api.ts`)

#### Changes:
- **Added parseNewLineItemRequest Helper**: Extracted reusable function to parse new_line_item_request from various API response formats
- **Enhanced getChangeRequests**: Updated normalizer to parse all temporal fields and new_line_item_request
- **Enhanced createChangeRequest**: 
  - Updated to send temporal fields in payload when present
  - Added new_line_item_request to request body
  - Parse temporal fields from response
- **Enhanced updateChangeApproval**: Parse temporal fields and new_line_item_request from approval response

#### Code Example:
```typescript
// Helper function to reduce duplication
private static parseNewLineItemRequest(item: any): ChangeRequest["new_line_item_request"] {
  const newLineItemRequest = item?.new_line_item_request || item?.newLineItemRequest;
  if (!newLineItemRequest) return undefined;
  
  return {
    name: newLineItemRequest.name || "",
    type: newLineItemRequest.type || "OPEX",
    description: newLineItemRequest.description || "",
  };
}

// In createChangeRequest - conditionally add temporal fields
if (change.start_month_index !== undefined) {
  body.start_month_index = change.start_month_index;
}
if (change.duration_months !== undefined) {
  body.duration_months = change.duration_months;
}
if (change.allocation_mode !== undefined) {
  body.allocation_mode = change.allocation_mode;
}
if (change.new_line_item_request) {
  body.new_line_item_request = {
    name: change.new_line_item_request.name,
    type: change.new_line_item_request.type,
    description: change.new_line_item_request.description,
  };
}
```

### 2. Type Alignment

#### ApprovalWorkflow Component (`src/features/sdmt/cost/Changes/ApprovalWorkflow.tsx`)

**Before:**
```typescript
interface ChangeRequest {
  startMonthIndex?: number;
  durationMonths?: number;
  allocationMode?: "one_time" | "spread_evenly";
  newLineItemRequest?: { ... };
}
```

**After:**
```typescript
interface ChangeRequest {
  // Using snake_case to match domain type
  start_month_index?: number;
  duration_months?: number;
  allocation_mode?: "one_time" | "spread_evenly";
  new_line_item_request?: { ... };
}
```

**Added Safe Undefined Checks:**
```typescript
{(changeRequest.start_month_index !== undefined || changeRequest.duration_months !== undefined) && (
  <div className="p-3 bg-muted/50 rounded-md">
    {changeRequest.start_month_index !== undefined && (
      <div>
        <span>Start Month:</span>
        <span>{changeRequest.start_month_index}</span>
      </div>
    )}
    {/* ... */}
  </div>
)}
```

#### SDMTChanges Component (`src/features/sdmt/cost/Changes/SDMTChanges.tsx`)

**Updated mapChangeToWorkflow:**
```typescript
const mapChangeToWorkflow = (change: DomainChangeRequest) => {
  return {
    // ... other fields
    // Use snake_case to match ApprovalWorkflow interface
    start_month_index: change.start_month_index,
    duration_months: change.duration_months,
    allocation_mode: change.allocation_mode,
    new_line_item_request: change.new_line_item_request,
  };
};
```

**Updated Mutation Type:**
```typescript
// Before: Only included specific fields
mutationFn: async (payload: Pick<DomainChangeRequest, "baseline_id" | ...>) => { }

// After: Includes all fields except auto-generated ones
mutationFn: async (payload: Omit<DomainChangeRequest, "id" | "requested_at" | "requested_by" | "status" | "approvals">) => { }
```

### 3. Context Validation

#### ALL_PROJECTS Check:
```typescript
if (selectedProjectId === ALL_PROJECTS_ID) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Las solicitudes de cambio solo están disponibles cuando seleccionas un proyecto específico.
          Por favor, selecciona un proyecto individual desde la barra superior para gestionar cambios.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

#### Baseline Validation:
- Button disabled when no baseline: `disabled={!currentProject?.baseline_id}`
- Clear alert message showing why module is disabled
- Tooltip on disabled button explaining requirement

## API Contract

### Request Payload (createChangeRequest)
```json
{
  "baseline_id": "baseline-123",
  "title": "Increase infrastructure capacity",
  "description": "Add more servers due to traffic growth",
  "impact_amount": 50000,
  "currency": "USD",
  "justification": "50% traffic increase observed",
  "affected_line_items": ["item-1", "item-2"],
  
  // Optional temporal fields
  "start_month_index": 13,
  "duration_months": 10,
  "allocation_mode": "spread_evenly",
  
  // Optional new line item request
  "new_line_item_request": {
    "name": "Security audit",
    "type": "OPEX",
    "description": "External compliance review"
  }
}
```

### Response Format
All change request endpoints (GET, POST, approval) return the same structure with temporal fields included when present.

## Backend Expectations

### Forecast Integration
The backend is expected to implement the following when a change request is approved:

1. **Parse Temporal Fields**: Extract `start_month_index`, `duration_months`, and `allocation_mode`
2. **Create Forecast Entries**: For each affected line item (or new line item if requested)
3. **Distribute Impact**:
   - `"one_time"`: Add full `impact_amount` to `start_month_index` only
   - `"spread_evenly"`: Divide `impact_amount` equally across `duration_months` starting from `start_month_index`
4. **Link to Source**: Optionally add `change_request_id` metadata to forecast cells

This is documented in `SDMTForecast.tsx` (lines 54-64).

## Testing Checklist

### Manual Testing Required:
- [ ] Create change request with temporal fields (one_time mode)
- [ ] Create change request with temporal fields (spread_evenly mode)
- [ ] Create change request with new_line_item_request
- [ ] Verify approval workflow displays all new fields correctly
- [ ] Test baseline gating (try to create change without accepted baseline)
- [ ] Test ALL_PROJECTS context shows appropriate message
- [ ] Verify error handling displays errors prominently
- [ ] Test on mobile viewport to ensure visibility

### Expected Behavior:
1. **With No Baseline**: "Nueva Solicitud de Cambio" button is disabled with clear alert
2. **With Baseline**: Button is enabled, form includes time distribution section
3. **In ALL_PROJECTS Context**: Module shows message to select specific project
4. **Approval Workflow**: Shows time distribution info box and new rubro details when present
5. **After Approval**: Invalidates forecast cache to trigger refresh

## Files Modified

1. `src/lib/api.ts` - API service changes (3 methods updated, 1 helper added)
2. `src/features/sdmt/cost/Changes/SDMTChanges.tsx` - Type updates, context validation
3. `src/features/sdmt/cost/Changes/ApprovalWorkflow.tsx` - Type alignment, safe checks

## Backward Compatibility

All changes are backward compatible:
- Temporal fields are optional
- new_line_item_request is optional
- Fields are only sent when present in the form
- API normalizers handle both snake_case and camelCase responses

## Security Review

✅ No security vulnerabilities introduced (verified with codeql_checker)

## Code Quality

✅ Addressed code review feedback:
- Extracted helper function to reduce duplication
- Fixed formatting issues
- Added proper type safety where possible

## Next Steps

1. **User Acceptance Testing**: Have product owner test the flows
2. **Backend Integration**: Ensure backend implements forecast distribution logic
3. **Monitor**: Watch for any API errors in production logs
4. **Documentation**: Update user-facing documentation if needed
