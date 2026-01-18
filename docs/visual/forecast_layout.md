# Forecast Layout Changes (Feature Flagged)

## Overview

This document describes the new forecast page layout available via the `VITE_FINZ_NEW_FORECAST_LAYOUT` feature flag. The changes improve usability by reorganizing components and collapsing less frequently used sections by default.

## Feature Flag

**Environment Variable:** `VITE_FINZ_NEW_FORECAST_LAYOUT`

**Default:** `false` (production) / `true` (development)

**Values:**
- `true` - Enable new layout with reorganized components
- `false` or unset - Use original layout (backwards compatible)

## Additional Feature Flags

### Hide Key Trends Cards

**Environment Variable:** `VITE_FINZ_HIDE_KEY_TRENDS`

**Default:** `false` (cards visible)

**Values:**
- `true` - Hide the two executive Key Trends cards (Proyectos con mayor variación & Rubros con mayor variación)
- `false` or unset - Show the Key Trends cards (default behavior)

**Description:** This flag allows hiding the "Top Variance" executive cards on the Forecast page for a cleaner executive view. When enabled, the two variance analysis cards that show projects and rubros with the highest variance vs budget will not be rendered. This is useful for streamlined presentations or when these metrics are not needed.

**Usage:** Set `VITE_FINZ_HIDE_KEY_TRENDS=true` in your environment file or environment variables to hide the cards.

## Changes Summary

### 1. Component Reorganization

The Forecast page layout has been reorganized to prioritize the most important information:

**New Layout Order (when flag is `true`):**

1. **Header** - Page title and navigation
2. **Executive KPI Summary** - Key metrics at the top (TODOS/Portfolio view only)
3. **→ Cuadrícula de Pronóstico** ← **(MOVED UP & RENAMED)**
   - Previously titled "Cuadrícula de Pronóstico 12 Meses"
   - Now appears immediately below the KPI summary
   - Renamed to "Cuadrícula de Pronóstico" (removed "12 Meses" suffix)
   - Provides quick access to detailed forecast grid
4. **Monthly Snapshot Grid** - Month-by-month view
5. **Charts Panel** - Visual analytics
6. **Top Variance Tables** - Quick variance insights
7. **Resumen de todos los proyectos** - Collapsed by default
8. **Budget & Simulation Panels**
9. **Monthly Breakdown Grid**
10. **Forecast Analytics & Trends** - Moved to bottom

### 2. Specific Changes

#### Grid Movement & Rename
- **Component:** ForecastRubrosTable (the detailed rubros grid)
- **Old Position:** Second-to-last at bottom right of page
- **New Position:** Directly below Executive KPI Summary at top of page
- **Old Title:** "Cuadrícula de Pronóstico 12 Meses"
- **New Title:** "Cuadrícula de Pronóstico"
- **Rationale:** This grid is frequently accessed, so placing it at the top reduces scrolling

#### Collapsed Panels
- **Resumen de todos los proyectos** is now collapsed by default in the new layout
- **Rationale:** Progressive disclosure - keeps the page less cluttered while maintaining accessibility

#### Compact Spacing
- Reduced padding and spacing in cards and grid rows for a cleaner, more compact appearance
- Applied via `space-y-2`, `pb-2 pt-4` classes

### 3. Backwards Compatibility

The old layout is preserved when the feature flag is `false` or unset. This ensures:
- Production environments remain unchanged until explicitly enabled
- Smooth rollout with ability to rollback
- Testing can validate both layouts

## Preview Instructions

### Development Mode

To preview the new layout in development:

```bash
# Set the feature flag in .env.local
echo "VITE_FINZ_NEW_FORECAST_LAYOUT=true" >> .env.local

# Start dev server
pnpm run dev

# Navigate to: http://localhost:5173/finanzas/sdmt/cost/forecast
# Select "TODOS" from the project dropdown to see portfolio view
```

### Production Build

To build with the new layout:

```bash
# Set flag and build
VITE_FINZ_NEW_FORECAST_LAYOUT=true pnpm run build:finanzas

# Preview the build
VITE_FINZ_NEW_FORECAST_LAYOUT=true pnpm run preview:finanzas
```

### Testing Both Layouts

```bash
# Test new layout
VITE_FINZ_NEW_FORECAST_LAYOUT=true pnpm run dev

# Test old layout (in a new terminal)
VITE_FINZ_NEW_FORECAST_LAYOUT=false pnpm run dev --port 5174
```

## Implementation Details

### File Changes

**Main Component:**
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
  - Added `NEW_FORECAST_LAYOUT_ENABLED` constant
  - Conditional rendering based on flag and `isPortfolioView`
  - Duplicate "Cuadrícula de Pronóstico" section for new layout position
  - Original section hidden when new layout is active in portfolio view
  - `defaultOpen` prop on "Resumen de todos los proyectos" respects flag

**Environment Files:**
- `.env.example` - Added flag documentation
- `.env.development` - Set to `true` by default for development
- `.env.production` - Should remain `false` or unset until rollout

### Code Structure

```tsx
// Feature flag detection
const NEW_FORECAST_LAYOUT_ENABLED = import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';

// New layout: Grid below KPI Summary
{NEW_FORECAST_LAYOUT_ENABLED && isPortfolioView && !loading && forecastData.length > 0 && (
  <Collapsible defaultOpen={true}>
    <Card className="space-y-2">
      <CardTitle>Cuadrícula de Pronóstico</CardTitle>
      <ForecastRubrosTable {...props} />
    </Card>
  </Collapsible>
)}

// Old layout: Grid at original position (hidden in new layout for portfolio view)
{!loading && forecastData.length > 0 && !(NEW_FORECAST_LAYOUT_ENABLED && isPortfolioView) && (
  <Collapsible>
    <CardTitle>
      {NEW_FORECAST_LAYOUT_ENABLED ? "Cuadrícula de Pronóstico" : "Cuadrícula de Pronóstico 12 Meses"}
    </CardTitle>
    <ForecastRubrosTable {...props} />
  </Collapsible>
)}

// Collapsed summary in new layout
<Collapsible defaultOpen={!NEW_FORECAST_LAYOUT_ENABLED}>
  <CardTitle>Resumen de todos los proyectos</CardTitle>
  ...
</Collapsible>
```

## Accessibility

- All collapsible sections maintain proper ARIA attributes (`aria-expanded`, `aria-label`)
- Keyboard navigation works for all collapsed/expanded sections
- Screen reader support maintained
- Focus management when expanding/collapsing panels

## Testing

### Manual Testing Checklist

- [ ] With flag `true`:
  - [ ] Cuadrícula appears below KPI Summary
  - [ ] Title is "Cuadrícula de Pronóstico" (no "12 Meses")
  - [ ] "Resumen de todos los proyectos" is collapsed by default
  - [ ] All other sections render correctly
  - [ ] Spacing appears more compact
  
- [ ] With flag `false` or unset:
  - [ ] Cuadrícula appears at original position (near bottom)
  - [ ] Title is "Cuadrícula de Pronóstico 12 Meses"
  - [ ] "Resumen de todos los proyectos" defaults to original state
  - [ ] Layout matches pre-change behavior

- [ ] Both layouts:
  - [ ] No console errors
  - [ ] Data loads correctly
  - [ ] Expand/collapse works smoothly
  - [ ] Navigation to other pages works

### Unit Tests

See `src/features/sdmt/cost/Forecast/__tests__/` for test coverage:
- Layout order verification when flag is enabled
- Collapsed state verification
- Title text verification
- Backwards compatibility verification

## Rollout Plan

1. **Development (Current):** Flag enabled by default
2. **Staging:** Test with real data, gather feedback
3. **Production Preview:** Enable for specific users/roles
4. **Production Rollout:** Enable for all users
5. **Cleanup:** Remove flag and old layout code (future)

## Screenshots

### New Layout (VITE_FINZ_NEW_FORECAST_LAYOUT=true)

*Screenshot showing:*
- Executive KPI Summary at top
- Cuadrícula de Pronóstico immediately below
- Compact spacing
- Collapsed "Resumen de todos los proyectos"

### Old Layout (VITE_FINZ_NEW_FORECAST_LAYOUT=false)

*Screenshot showing:*
- Original component order
- "Cuadrícula de Pronóstico 12 Meses" near bottom
- Default spacing

## Support

For questions or issues:
- Check `.env.local` has the correct flag value
- Verify environment variable is being read (`console.log(import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT)`)
- Review browser console for errors
- Compare with `PHASE5_VISUAL_GUIDE.md` for expected layout

## References

- Original requirements: `PHASE5_VISUAL_GUIDE.md`
- Implementation PR: `copilot/ci-guards-and-forecast-layout`
- Related tests: `__tests__/monthlySnapshotGrid.integration.test.ts`
