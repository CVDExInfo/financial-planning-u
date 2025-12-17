# Budget Simulator Feature - Implementation Documentation

## Overview

The Budget Simulator is a front-end-only feature that adds interactive budget visualization and analysis to the SDMTForecast page. It appears **only** when viewing "TODOS LOS PROYECTOS" (the consolidated portfolio view).

## Key Characteristics

### ✅ Front-End Only
- **No API calls**: All calculations happen in the browser
- **No persistence**: State resets when page is refreshed
- **No localStorage**: Nothing is saved locally
- **Pure functions**: All simulation logic is deterministic and side-effect-free

### 🎯 Scope Limited
- **Only in Portfolio View**: Widget only appears when `selectedProjectId === ALL_PROJECTS_ID`
- **Visual Overlay**: Does not modify underlying forecast data
- **Disabled by Default**: Users must explicitly enable the simulation

## User Interface

### Budget Simulator Card

The simulator card appears at the top of the forecast page (after the Baseline Status Panel) and includes:

1. **Enable/Disable Toggle**
   - Label: "Habilitar Simulación"
   - Default: OFF (disabled)
   - When disabled, no budget metrics are shown

2. **Budget Total Input**
   - Label: "Presupuesto Anual ($)"
   - Accepts: Numbers with optional formatting ($, commas, spaces)
   - Example: "1,000,000" or "$1000000"
   - Required for simulation to work

3. **Projection Factor Slider**
   - Label: "Factor de Proyección"
   - Range: 50% - 200%
   - Default: 100%
   - Step: 5%
   - Used to adjust forecast projections
   - Disabled if "Estimated Projection Override" is filled

4. **Estimated Projection Override (Optional)**
   - Label: "Estimación Proyectada (opcional)"
   - When filled, overrides factor-based calculation
   - Leave blank to use factor-based calculation

### Budget KPI Cards

When simulation is **enabled** and budget is valid, four additional KPI cards appear:

1. **Presupuesto Total**
   - Shows the entered budget amount
   - Border color: Primary (to indicate it's from simulation)

2. **Variación vs Presupuesto**
   - Formula: `budgetTotal - totalForecast`
   - Green: Under budget (positive variance)
   - Red: Over budget (negative variance)

3. **Utilización de Presupuesto**
   - Formula: `(totalForecast / budgetTotal) * 100`
   - Shows what % of budget is being used by forecast
   - Green: < 90%
   - Yellow: 90-100%
   - Red: > 100%

4. **Real vs Presupuesto**
   - Formula: `(totalActual / budgetTotal) * 100`
   - Shows what % of budget has been spent
   - Color coding same as utilization

### Chart Enhancements

When simulation is enabled, the forecast trends chart includes:

- **Budget Line**: Dashed magenta line showing flat budget distributed evenly across 12 months
- Formula: Each month gets `budgetTotal / 12`
- Visual style: Dashed line (8 4 pattern), 2px width

### Analytics Panel Enhancement

When simulation is enabled, an additional insight appears:

- **Budget Utilization**: Shows utilization percentage with color-coded status
  - Positive (green): < 90%
  - Neutral (gray): 90-100%
  - Negative (red): > 100%

## Technical Implementation

### File Structure

```
src/features/sdmt/cost/Forecast/
├── budgetSimulation.ts              # Pure functions (213 lines)
├── BudgetSimulatorCard.tsx          # UI component (220 lines)
├── SDMTForecast.tsx                 # Modified (added ~90 lines)
└── __tests__/
    └── budgetSimulation.test.ts     # Tests (187 lines)
```

### Key Functions

#### `sanitizeNumericInput(input: string | number | ''): number`
Cleans user input to extract numeric values:
- Removes: `$`, commas, spaces
- Returns: Numeric value or 0 if invalid
- Example: `"$1,000"` → `1000`

#### `clampFactor(factor: number): number`
Prevents chart issues by limiting projection factor:
- Min: 0.5 (50%)
- Max: 2.0 (200%)
- Example: `2.5` → `2.0`

#### `calculateBudgetMetrics(baseMetrics, budgetTotal): SimulatedMetrics`
Calculates budget-related KPIs:
- Budget variance (projected and planned)
- Budget utilization percentage
- Actual vs budget percentage

#### `applyBudgetToTrends(monthlyTrends, budgetTotal): SimulatedMonthlyTrend[]`
Adds budget line to chart data:
- Distributes budget evenly across 12 months
- Returns new array with `Budget` property added

#### `applyBudgetSimulation(baseMetrics, simState): SimulatedMetrics`
Main entry point that orchestrates simulation:
- Returns base metrics if simulation disabled
- Applies factor or override to forecast
- Calculates all budget metrics
- Pure function with no side effects

### State Management

```typescript
interface BudgetSimulationState {
  enabled: boolean;           // Toggle state
  budgetTotal: number | '';   // Annual budget input
  factor: number;             // Projection factor (0.5-2.0)
  estimatedOverride?: number | ''; // Optional override
}
```

State is managed in `SDMTForecast` component using `useState`:
```typescript
const [budgetSimulation, setBudgetSimulation] = useState<BudgetSimulationState>({
  enabled: false,
  budgetTotal: '',
  factor: 1.0,
  estimatedOverride: '',
});
```

### Data Flow

```
1. User enables simulation in BudgetSimulatorCard
   ↓
2. User enters budget and optionally adjusts factor
   ↓
3. BudgetSimulatorCard calls onSimulationChange(newState)
   ↓
4. SDMTForecast updates budgetSimulation state
   ↓
5. useMemo hooks recalculate:
   - baseMetrics (from forecastData)
   - metrics (applies simulation to baseMetrics)
   - monthlyTrends (adds budget line if enabled)
   ↓
6. Components re-render with updated metrics:
   - Existing KPI cards show simulated values
   - New budget KPI cards appear
   - Chart includes budget line
   - Analytics panel shows budget utilization
```

## Formulas

### Budget Variance (Projected)
```
budgetVarianceProjected = budgetTotal - totalForecast
```

### Budget Variance (Planned)
```
budgetVariancePlanned = budgetTotal - totalPlanned
```

### Budget Utilization
```
budgetUtilization = (totalForecast / budgetTotal) * 100
```

### Actual vs Budget
```
pctUsedActual = (totalActual / budgetTotal) * 100
```

### Estimated Projection (Factor-Based)
```
remainingPlanned = max(0, totalPlanned - totalActual)
estimatedProjection = totalActual + (remainingPlanned * factor)
```

### Budget Per Month
```
budgetPerMonth = budgetTotal / 12
```

## Testing

### Unit Tests (15 tests, all passing)

Test coverage includes:
- Input sanitization (currency formatting, empty values, invalid input)
- Factor clamping (boundary conditions)
- Budget metric calculations (utilization, variance)
- Trend transformation (budget line addition)
- Estimated projection calculation
- Full simulation application
- State validation

Run tests:
```bash
npx tsx --test src/features/sdmt/cost/Forecast/__tests__/budgetSimulation.test.ts
```

### Manual Testing Checklist

- [ ] Navigate to SDMTForecast page
- [ ] Select "TODOS (Todos los proyectos)" from project dropdown
- [ ] Verify Budget Simulator card appears
- [ ] Enable simulation toggle
- [ ] Enter budget amount (e.g., 1000000)
- [ ] Verify 4 budget KPI cards appear
- [ ] Verify budget line appears in chart
- [ ] Verify budget utilization in insights panel
- [ ] Adjust projection factor slider
- [ ] Verify metrics update immediately
- [ ] Enter estimated projection override
- [ ] Verify it overrides factor-based calculation
- [ ] Disable simulation
- [ ] Verify budget KPIs disappear
- [ ] Verify UI returns to original state
- [ ] Switch to single project view
- [ ] Verify Budget Simulator card disappears
- [ ] Open browser DevTools Network tab
- [ ] Enable/disable simulation multiple times
- [ ] Verify NO network requests are made
- [ ] Check localStorage/sessionStorage
- [ ] Verify NO data is persisted

## Security

### CodeQL Analysis
- ✅ No vulnerabilities found
- ✅ No SQL injection risks (no database queries)
- ✅ No XSS risks (all inputs sanitized)
- ✅ No unauthorized API calls

### Input Validation
- All user inputs are sanitized via `sanitizeNumericInput()`
- Factor values are clamped to safe range (0.5-2.0)
- Invalid inputs default to 0 or fall back to base values
- No user input is passed to API or stored

## Performance

### Optimizations
- `useMemo` hooks prevent unnecessary recalculations
- Pure functions allow for easy memoization
- Conditional rendering (not display:none) for budget KPIs
- Chart updates leverage existing React rendering optimization

### Memory Footprint
- Minimal: Only adds ~4KB of state to component
- No memory leaks: No subscriptions or timers
- State clears on component unmount

## Limitations & Known Issues

### Current Limitations
1. **Portfolio View Only**: Does not work for single projects
   - Reason: Business requirement specifies consolidated view only
   - Could be extended to single projects if needed

2. **Ephemeral State**: Simulation resets on page refresh
   - Reason: No persistence requirement (by design)
   - Users must re-enter budget each session

3. **Linear Budget Distribution**: Budget is split evenly across 12 months
   - Reason: Simplification for v1
   - Could be enhanced to support custom distribution

### Future Enhancements (Out of Scope)
- Persist simulation settings to localStorage (user preference)
- Support custom budget distribution per month
- Add budget vs actual variance alerts/notifications
- Export simulation results to Excel/PDF
- Multiple budget scenarios (optimistic/pessimistic)
- Historical budget tracking

## Deployment Checklist

- [x] Code complete
- [x] Unit tests passing (15/15)
- [x] Lint passing
- [x] CodeQL security scan passing
- [x] Code review completed
- [x] No API changes required
- [x] No database migrations required
- [x] No environment variables needed
- [ ] Manual testing in dev environment
- [ ] Screenshots/GIF captured
- [ ] PR opened as DRAFT
- [ ] Evidence pack prepared

## Support & Troubleshooting

### Budget Simulator Not Appearing
**Symptom**: Card doesn't show up
**Check**: Are you in "TODOS LOS PROYECTOS" view?
**Fix**: Select "TODOS (Todos los proyectos)" from project dropdown

### Metrics Not Updating
**Symptom**: KPIs don't change when adjusting budget
**Check**: Is simulation enabled? Is budget value valid?
**Fix**: Toggle simulation ON and enter a valid budget > 0

### Chart Missing Budget Line
**Symptom**: Budget line doesn't appear in forecast trends
**Check**: Is simulation enabled? Is budget > 0?
**Fix**: Enable simulation and enter valid budget

### Type Errors in Development
**Symptom**: TypeScript errors about BudgetSimulationState
**Check**: Are all files using the imported types?
**Fix**: Import types from `budgetSimulation.ts`

## Contact

For questions or issues related to this feature:
- Review PR comments
- Check implementation notes in code
- Run unit tests for examples
- Refer to this documentation

---

**Last Updated**: 2025-01-17
**Version**: 1.0.0
**Status**: ✅ Complete and Ready for Review
