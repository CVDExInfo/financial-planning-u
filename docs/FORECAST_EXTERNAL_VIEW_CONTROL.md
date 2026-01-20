# ForecastRubrosTable External View Control

## Overview

The `ForecastRubrosTable` component now supports external view mode control, allowing parent components to manage the table's display mode (Category vs Project view) programmatically. This fix has been applied to **both** Position #2 and Position #7 in the forecast dashboard.

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

External control is applied to two locations:

#### Position #2 (NEW_FORECAST_LAYOUT)
Line ~3154 - "Cuadrícula de Pronóstico" - Shown when `NEW_FORECAST_LAYOUT_ENABLED=true`:

```typescript
<ForecastRubrosTable
  {...otherProps}
  externalViewMode={breakdownMode === 'project' ? 'project' : 'category'}
  onViewModeChange={(v) => {
    handleBreakdownModeChange(v === 'project' ? 'project' : 'rubros');
  }}
/>
```

#### Position #7 (Portfolio View)
Line ~3744 - "Monitoreo mensual de proyectos vs. presupuesto" - Shown when `isPortfolioView=true`:

**Before:** Used 437 lines of custom `<Table>` implementation
**After:** Refactored to use `ForecastRubrosTable` with external control:

```typescript
<ForecastRubrosTable
  {...otherProps}
  externalViewMode={breakdownMode === 'project' ? 'project' : 'category'}
  onViewModeChange={(v) => {
    handleBreakdownModeChange(v === 'project' ? 'project' : 'rubros');
  }}
/>
```

### Session Storage Keys

- **Page-level (SDMTForecast)**: `forecastBreakdownMode` (values: `'project'` | `'rubros'`)
- **Table-level**: `forecastGridViewMode:{projectId}:{userEmail}` (only used when uncontrolled)

## Benefits

1. **Eliminates code duplication**: Position #7 no longer maintains separate custom Table code
2. **Consistent UX**: Both positions use the same component with identical features
3. **Synchronized state**: `breakdownMode` selector controls both table instances
4. **All features retained**: Budget editing, filters, search, labor/non-labor filtering all work
5. **Backward compatible**: Single project view and other usages unchanged

## Testing

All behavior is covered by unit tests in `ForecastRubrosTable.controlledView.spec.ts`:
- External control functionality
- Backward compatibility
- Session storage behavior
- View mode mapping logic

## Migration Notes

No migration required. The feature is fully backward compatible. Existing usages of `ForecastRubrosTable` without the new props will continue to work as before.
