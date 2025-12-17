# SDMT Changes Redesign - Quick Reference

## Form State Structure

```typescript
const form = {
  // Existing fields
  title: string;
  description: string;
  impact_amount: string;
  currency: Currency;
  baseline_id: string;
  justification: string;
  affected_line_items: string[];
  
  // NEW: Time distribution
  start_month_index: number;      // Default: 1
  duration_months: number;        // Default: 1
  allocation_mode: "one_time" | "spread_evenly"; // Default: "one_time"
  
  // NEW: New rubro support
  requires_new_rubro: boolean;    // Default: false
  new_rubro_name: string;
  new_rubro_type: string;         // Default: "OPEX"
  new_rubro_description: string;
};
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `title` | Required, non-empty | "El título es obligatorio." |
| `description` | Required, non-empty | "La descripción es obligatoria." |
| `justification` | Required, non-empty | "La justificación es obligatoria." |
| `impact_amount` | Number > 0 | "El impacto debe ser un número mayor a 0." |
| `currency` | One of: USD, EUR, MXN, COP | "Selecciona una moneda." |
| `start_month_index` | >= 1 | "El mes de inicio debe ser al menos 1." |
| `duration_months` | >= 1 | "La duración debe ser al menos 1 mes." |
| Time range | `start + duration - 1 <= period` | "La duración excede el período del proyecto (N meses)." |
| `affected_line_items` | Length > 0 (if not new rubro) | "Selecciona al menos un rubro afectado." |
| `new_rubro_name` | Required if `requires_new_rubro` | "El nombre del nuevo rubro es obligatorio." |
| `new_rubro_description` | Required if `requires_new_rubro` | "La descripción del nuevo rubro es obligatoria." |

## API Payload Structure

```typescript
// POST /projects/{projectId}/changes
{
  baseline_id: string;
  title: string;
  description: string;
  impact_amount: number;
  currency: Currency;
  justification: string;
  affected_line_items: string[];
  
  // NEW fields
  start_month_index: number;
  duration_months: number;
  allocation_mode: "one_time" | "spread_evenly";
  new_line_item_request?: {
    name: string;
    type: string;
    description: string;
  };
}
```

## Component Props

### ApprovalWorkflow.tsx

```typescript
interface ChangeRequest {
  // Existing...
  id: string;
  title: string;
  description: string;
  impact: number;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  approvalSteps: ApprovalStep[];
  currentStep: number;
  businessJustification: string;
  affectedLineItems: string[];
  
  // NEW
  startMonthIndex?: number;
  durationMonths?: number;
  allocationMode?: "one_time" | "spread_evenly";
  newLineItemRequest?: {
    name: string;
    type: string;
    description: string;
  };
}
```

## React Query Cache Invalidation

After approval, these queries are invalidated:
```typescript
queryClient.invalidateQueries({ 
  queryKey: ["forecast", selectedProjectId] 
});
queryClient.invalidateQueries({ 
  queryKey: ["lineItems", selectedProjectId] 
});
```

## UI Component Imports

```typescript
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
```

## Conditional Rendering Logic

```typescript
// Show impact summary only when form is valid
{isFormValid && (
  <ImpactSummary />
)}

// Show new rubro fields only when toggle is on
{form.requires_new_rubro && (
  <NewRubroFields />
)}

// Disable line items selector when new rubro mode
<LineItemSelector disabled={form.requires_new_rubro} />

// Disable change creation button when no baseline
<CreateButton disabled={!currentProject?.baseline_id} />
```

## Toast Notification with Action

```typescript
toast.success(
  `Cambio aprobado. Pronóstico actualizado para ${totalRubros} rubro${totalRubros !== 1 ? 's' : ''}`,
  {
    action: {
      label: "Ver Pronóstico",
      onClick: () => navigate("/sdmt/cost/forecast"),
    },
    duration: 5000,
  }
);
```

## Time Distribution Calculation Examples

### One-time (Example: $100,000 starting at month 5)
```
Month:   1    2    3    4    5    6    7    8
Amount:  0    0    0    0  100k   0    0    0
```

### Spread evenly (Example: $100,000 starting at month 5, duration 4)
```
Month:   1    2    3    4    5    6    7    8
Amount:  0    0    0    0   25k  25k  25k  25k
```

## CSS Classes Used

| Element | Classes |
|---------|---------|
| Time distribution section | `p-4 border rounded-lg bg-muted/20` |
| New rubro section | `p-4 border rounded-lg bg-muted/20` |
| Impact summary | `p-4 border rounded-lg bg-primary/5` |
| New line item request (Approval) | `p-3 bg-amber-50 border border-amber-200` |
| Validation error | `text-sm text-destructive mt-1` |
| Disabled input | `bg-muted` |

## Backend Integration Checklist

- [ ] Accept new fields in change request creation endpoint
- [ ] Validate time range on backend
- [ ] Store all new fields in database
- [ ] On approval, create new rubro if `new_line_item_request` exists
- [ ] On approval, update forecast based on:
  - `start_month_index`
  - `duration_months`
  - `allocation_mode`
  - `impact_amount`
  - `affected_line_items` or newly created rubro
- [ ] Optional: Add `change_request_id` to forecast cell response
- [ ] Test backward compatibility with old change requests

## Common Patterns

### Getting project period
```typescript
const projectPeriod = parseInt(selectedPeriod) || 60;
```

### Mapping domain change to workflow format
```typescript
const mapped = {
  ...change,
  startMonthIndex: change.start_month_index,
  durationMonths: change.duration_months,
  allocationMode: change.allocation_mode,
  newLineItemRequest: change.new_line_item_request,
};
```

### Formatting distribution description
```typescript
const description = form.allocation_mode === "one_time"
  ? `${formatAmount(form.impact_amount)} ${form.currency} en el mes ${form.start_month_index}`
  : `${formatAmount(form.impact_amount)} ${form.currency} distribuidos en ${form.duration_months} meses desde el mes ${form.start_month_index}`;
```

## Environment Dependencies

- React 18+
- React Router v6+
- TanStack Query (React Query)
- Radix UI primitives
- Tailwind CSS
- Sonner (toast notifications)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features required
- CSS Grid and Flexbox support needed
