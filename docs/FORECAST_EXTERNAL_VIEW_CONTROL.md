# ForecastRubrosTable External View Control

## Overview

The `ForecastRubrosTable` component now supports external view mode control, allowing parent components to manage the table's display mode (Category vs Project view) programmatically.

## Changes

### Component Interface

Two new optional props have been added to `ForecastRubrosTable`:

```typescript
interface ForecastRubrosTableProps {
  // ... existing props
  externalViewMode?: ViewMode;        // 'category' | 'project'
  onViewModeChange?: (v: ViewMode) => void;
}
```

### Behavior

#### When Controlled (externalViewMode provided):
- The table uses the `externalViewMode` prop instead of its internal state
- Changes made via the internal toggle buttons call `onViewModeChange` callback
- Session storage persistence is disabled
- Full control is delegated to the parent component

#### When Uncontrolled (externalViewMode not provided):
- The table behaves as before, using internal state
- View mode is persisted to session storage
- Backward compatible with existing usage

### Integration with SDMTForecast

In Position #7 (Monitoreo mensual de proyectos vs. presupuesto), the table is now controlled by the page-level `breakdownMode`:

```typescript
// Mapping
const tableViewMode = breakdownMode === 'project' ? 'project' : 'category';

// Props
<ForecastRubrosTable
  {...otherProps}
  externalViewMode={tableViewMode}
  onViewModeChange={(v) => {
    handleBreakdownModeChange(v === 'project' ? 'project' : 'rubros');
  }}
/>
```

### Session Storage Keys

- **Page-level (SDMTForecast)**: `forecastBreakdownMode` (values: `'project'` | `'rubros'`)
- **Table-level**: `forecastGridViewMode:{projectId}:{userEmail}` (only used when uncontrolled)

## Testing

All behavior is covered by unit tests in `ForecastRubrosTable.controlledView.spec.ts`:
- External control functionality
- Backward compatibility
- Session storage behavior
- View mode mapping logic

## Migration Notes

No migration required. The feature is fully backward compatible. Existing usages of `ForecastRubrosTable` without the new props will continue to work as before.
