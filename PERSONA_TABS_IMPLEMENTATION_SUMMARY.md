# Persona Tabs Implementation Summary

## Overview

This implementation adds persona-based view modes to the SDMT Forecast module, allowing users to switch between **SDM** (Service Delivery Manager) and **Gerente** (Manager/Executive) presentation modes. The persona system is independent of user roles and permissions—it purely affects UI presentation and default states.

## Architecture

### 1. PersonaContext (`src/contexts/PersonaContext.tsx`)

Central context provider for managing persona view mode state.

**Features:**
- Two view modes: `'SDM'` and `'Gerente'`
- Persists selection to `localStorage` (key: `finanzas:personaViewMode`)
- Defaults to `'SDM'` if no stored preference exists
- Provides `usePersona()` hook for components
- Provides `usePersonaOptional()` for optional integration

**API:**
```typescript
interface PersonaContextValue {
  viewMode: PersonaViewMode; // 'SDM' | 'Gerente'
  setViewMode: (mode: PersonaViewMode) => void;
}
```

**Usage:**
```typescript
const { viewMode, setViewMode } = usePersona();
```

### 2. PersonaTabs Component (`src/components/PersonaTabs.tsx`)

UI toggle component for switching between personas.

**Features:**
- Tab-based switcher with icons (User for SDM, Briefcase for Gerente)
- Tooltips explaining each persona mode
- Responsive design (hides labels on small screens)
- Integrates with shadcn/ui Tabs component

**Placement:**
- Currently shown in SDMTForecast header (portfolio/TODOS mode only)
- Can be placed in other modules as needed

### 3. Integration with App (`src/App.tsx`)

PersonaProvider wraps the application routing context:

```tsx
<PersonaProvider>
  <ProjectProvider>
    {/* App routes */}
  </ProjectProvider>
</PersonaProvider>
```

This ensures persona context is available throughout the app, inside the project context.

## Persona-Based Defaults

### Route: `/finanzas/sdmt/cost/forecast` + Project = TODOS

#### SDM View Mode
- **Matriz del Mes (MonthlySnapshotGrid)**: Expanded by default
  - Shows executive summary with 5 KPI cards
  - Full detailed grid view available
- **Rubros/Forecast Grid**: Expanded by default
  - Detailed 12-month forecast data visible immediately
  - Focus on data entry and operational management

**Rationale:** SDM users need immediate access to detailed data for operational decisions and data entry tasks.

#### Gerente View Mode
- **Matriz del Mes (MonthlySnapshotGrid)**: Expanded by default
  - Shows executive summary with 5 KPI cards
  - Provides high-level overview
- **Rubros/Forecast Grid**: Collapsed by default
  - Keeps focus on executive summary and KPIs
  - Detail grid available on demand via expand

**Rationale:** Gerente users prioritize high-level metrics and executive summaries over detailed line-item data.

### Single Project Mode

When viewing a specific project (not TODOS), both personas default to:
- All sections expanded (data-entry focused mode)

**Rationale:** Single project view implies focused work on that project's data.

## Implementation Details

### MonthlySnapshotGrid Enhancement

Added `defaultCollapsed` prop to MonthlySnapshotGrid:

```typescript
interface MonthlySnapshotGridProps {
  // ... existing props
  defaultCollapsed?: boolean; // New prop
}
```

**Behavior:**
- If `defaultCollapsed` is provided, uses that as initial state
- If user has previously set collapsed state (in sessionStorage), that takes precedence
- Otherwise, uses `defaultCollapsed` prop value
- Falls back to `false` (expanded) if no default provided

### SDMTForecast Integration

Added persona-aware logic in SDMTForecast:

```typescript
// Import persona context
import { usePersona } from '@/contexts/PersonaContext';
import { PersonaTabs } from '@/components/PersonaTabs';

// Inside component:
const { viewMode } = usePersona();

// Apply defaults via useEffect
useEffect(() => {
  if (isPortfolioView) {
    // SDM: expanded, Gerente: collapsed
    setIsRubrosGridOpen(viewMode === 'SDM');
  } else {
    // Single project: always expanded
    setIsRubrosGridOpen(true);
  }
}, [viewMode, isPortfolioView]);
```

## MonthlySnapshotGrid Features

The Matriz del Mes (MonthlySnapshotGrid) provides:

### 1. Executive Summary (Collapsed View)
When collapsed, shows:
- Month selector (current, previous, M1-M60)
- 5 KPI cards:
  - Budget
  - Forecast
  - Real (Actual)
  - % Consumo
  - Var vs Presupuesto
- Top variance items list (clickable to navigate to reconciliation)

### 2. Detailed Grid (Expanded View)
When expanded, shows:
- Full breakdown by Project or Rubro (switchable grouping)
- Search/filter capabilities
- Budget allocation per group
- Variance analysis (vs Budget and vs Forecast)
- Status indicators (En Meta, En Riesgo, Sobre Presupuesto)
- Per-row action buttons:
  - **Ver detalle mensual**: Scrolls to 12-month forecast grid
  - **Conciliación**: Navigates to reconciliation page
  - **Solicitar ajuste**: Opens budget adjustment request dialog

### 3. Cost Type Filter
The component supports filtering by cost type:
- **Labor**: Personnel costs only
- **Non-Labor**: Non-personnel costs only
- **Ambos**: All costs (default)

This filter is independent of persona mode and works the same for both SDM and Gerente views.

## Testing

### Unit Tests

Created test suite for PersonaTabs (`src/components/__tests__/PersonaTabs.test.tsx`):

**Test Cases:**
- ✓ Renders SDM and Gerente tabs
- ✓ Defaults to SDM view mode
- ✓ Switches to Gerente view mode when clicked
- ✓ Persists view mode to localStorage
- ✓ Loads view mode from localStorage
- ✓ Honors defaultMode prop when no localStorage value exists

### Integration Testing

Existing MonthlySnapshotGrid tests verify:
- Budget allocation logic
- Grouping modes (project/rubro)
- Filtering and search
- Variance calculations

## Manual Verification Checklist

### SDM Persona (TODOS Mode)
- [ ] PersonaTabs shows "SDM" as active by default
- [ ] Matriz del Mes is expanded showing 5 KPI cards
- [ ] Rubros/Forecast grid (12-month detail) is expanded
- [ ] Switching to Gerente collapses the rubros grid
- [ ] Preference persists after page refresh

### Gerente Persona (TODOS Mode)
- [ ] PersonaTabs shows "Gerente" as active when selected
- [ ] Matriz del Mes is expanded showing 5 KPI cards
- [ ] Rubros/Forecast grid (12-month detail) is collapsed
- [ ] Can manually expand rubros grid if needed
- [ ] Preference persists after page refresh

### MonthlySnapshotGrid Functionality
- [ ] 5 KPI cards display correct values (Budget, Forecast, Real, % Consumo, Var)
- [ ] Cost type filter works (Labor/Non-Labor/Ambos)
- [ ] Per-row actions work:
  - [ ] Ver detalle mensual scrolls to detail grid
  - [ ] Conciliación navigates to reconciliation page
  - [ ] Estructura de costos navigates to catalog (if implemented)
- [ ] Collapse/expand toggle works correctly
- [ ] Collapsed view shows summary with top variances
- [ ] Expanded view shows full breakdown table

### Single Project Mode
- [ ] PersonaTabs is NOT shown (only in TODOS mode)
- [ ] All sections are expanded by default
- [ ] Behavior is consistent regardless of last persona selection

## Files Changed

1. **New Files:**
   - `src/contexts/PersonaContext.tsx` - Persona context provider
   - `src/components/PersonaTabs.tsx` - Persona toggle UI
   - `src/components/__tests__/PersonaTabs.test.tsx` - Unit tests

2. **Modified Files:**
   - `src/App.tsx` - Added PersonaProvider wrapper
   - `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Integrated persona logic
   - `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx` - Added defaultCollapsed prop

## Future Enhancements

1. **Extend to Other Modules:**
   - Apply persona concept to other SDMT modules (Cashflow, Scenarios, etc.)
   - Add persona-specific views to reconciliation module

2. **Additional Personas:**
   - Consider adding "Auditor" persona for compliance-focused views
   - "CFO" persona for highest-level financial overview

3. **Persona Profiles:**
   - Save multiple preferences per persona (not just collapsed state)
   - Theme/color scheme per persona
   - Default filters per persona

4. **Analytics:**
   - Track which persona modes are most used
   - Identify which sections users expand/collapse most often
   - Optimize defaults based on usage patterns

## Notes

- Persona system is **presentation-only** and does not affect permissions or data access
- User roles (PMO, SDMT, etc.) and persona modes are independent concepts
- The implementation is backward compatible - existing functionality unchanged
- localStorage persistence ensures user preference is maintained across sessions
- Persona mode applies only in portfolio/TODOS view (single project mode uses fixed defaults)
