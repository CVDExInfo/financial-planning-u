# SDMT Forecast Page - UI Layout Changes

## Before (Old UI)
```
┌─────────────────────────────────────────────────────────┐
│ Header: Gestión de Pronóstico                          │
│ Project: [Name] | Change #[N]                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Baseline Status Panel                                   │
└─────────────────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬────────────┐
│ Planned    │ Forecast   │ Actual     │ FTE        │
│ De Planview│ Ajustado   │            │            │
│            │ PMO ❌     │            │            │
└────────────┴────────────┴────────────┴────────────┘

┌─────────────────────────────────────────────────────────┐
│ Actions:                                                │
│ [Guardar] (Actuals only) [Share]                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Forecast Grid (12 months)                               │
│ P / F / A columns per month                             │
│ ❌ Forecast cells not editable                          │
└─────────────────────────────────────────────────────────┘
```

## After (New UI)
```
┌─────────────────────────────────────────────────────────┐
│ Header: Gestión de Pronóstico                          │
│ Project: [Name] | Change #[N]                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Baseline Status Panel                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🆕 Annual Budget Widget (SDMT/EXEC_RO only)            │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Year: [2025 ▼]                                   │   │
│ │ Budget: [$5,000,000] Currency: [USD ▼]          │   │
│ │ [Save Budget]                                    │   │
│ │                                                  │   │
│ │ Budget Total:        $5,000,000                 │   │
│ │ Forecast Adjusted:   $4,750,000                 │   │
│ │ Available:           $250,000 (5%)              │   │
│ │ [████████████████░░] 95% consumed               │   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬────────────┬────────────┐
│ Planned    │ Forecast       │ Actual     │ FTE        │
│ De Planview│ Ajustado (SDMT)│            │            │
│ (Read-only)│ (Editable) ✅  │            │            │
└────────────┴────────────────┴────────────┴────────────┘

┌─────────────────────────────────────────────────────────┐
│ Actions:                                                │
│ 🆕 [Ajustar Pronóstico] 3 ajustes                      │
│    [Guardar Reales] 2 pendientes [Share]               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Forecast Grid (12 months)                               │
│ P / F / A columns per month                             │
│ ✅ Forecast cells clickable and editable               │
│ ✅ Changed cells highlighted                            │
└─────────────────────────────────────────────────────────┘
```

## Key UI Changes Summary

### 1. Label Changes
| Old Label | New Label | Location |
|-----------|-----------|----------|
| "Pronóstico Total Ajustado PMO" | "Pronóstico Ajustado (SDMT)" | Summary card |
| "Total Planeado" | "Total Planeado De Planview (Read-only)" | Summary card |
| - | "(Editable)" | Forecast card hint |

### 2. New Components
- **Annual Budget Widget**: Full-featured budget input and comparison
  - Year selector dropdown
  - Budget amount input
  - Currency selector (USD/EUR/MXN)
  - Save button
  - Comparison display
  - Progress bar
  - Alert on budget exceeded
  - Visible only to SDMT and EXEC_RO roles

### 3. New Actions
- **"Ajustar Pronóstico" button**: Saves forecast adjustments
  - Shows count badge (e.g., "3 ajustes")
  - Primary blue styling
  - Disabled when no changes pending
  - Success/error toast messages

- **"Guardar Reales" button**: Saves actual values (renamed, moved)
  - Shows count badge (e.g., "2 pendientes")
  - Outline styling (secondary)
  - Separated from forecast save for clarity

### 4. Grid Enhancements
- **Forecast cells now editable**
  - Click to edit inline
  - Enter or blur to commit
  - Highlights show unsaved changes
  - Uses same pattern as actual cell editing

### 5. Visual Indicators
- **Unsaved changes highlighting**
  - Forecast cells: Primary blue background when dirty
  - Count badges on save buttons
  - Clear visual feedback

- **Status indicators**
  - Read-only labels on non-editable fields
  - Editable labels on editable fields
  - Loading spinners during save operations

## User Flows

### Flow 1: Adjust Forecast Values
```
1. User clicks on a Forecast (F) cell in the grid
   ↓
2. Input field appears with current value
   ↓
3. User types new value and presses Enter
   ↓
4. Cell updates in UI, "Ajustar Pronóstico" button shows count
   ↓
5. User clicks "Ajustar Pronóstico"
   ↓
6. Loading spinner shows, API call made
   ↓
7. Success toast appears, data reloads
   ↓
8. Grid shows updated values, count badge resets to 0
```

### Flow 2: Set Annual Budget
```
1. SDMT user lands on Forecast page
   ↓
2. Annual Budget Widget visible below Baseline panel
   ↓
3. User selects year from dropdown (defaults to current year)
   ↓
4. Widget loads existing budget if available
   ↓
5. User enters budget amount and selects currency
   ↓
6. User clicks "Save Budget"
   ↓
7. Loading spinner shows, API call made
   ↓
8. Success toast appears
   ↓
9. Widget shows comparison:
   - Budget Total
   - Forecast Adjusted (from totalForecast)
   - Available/Excess amount
   - Progress bar
   - Alert if exceeded
```

### Flow 3: Role-Based Access
```
┌─────────┬────────────────────┬─────────────────┐
│ Role    │ Can Edit Forecast  │ See Budget      │
├─────────┼────────────────────┼─────────────────┤
│ SDMT    │ ✅ Yes             │ ✅ Yes          │
│ PMO     │ ✅ Yes             │ ❌ No           │
│ EXEC_RO │ ❌ No              │ ✅ Yes (view)   │
│ PM      │ ❌ No              │ ❌ No           │
│ Auditor │ ❌ No              │ ❌ No           │
└─────────┴────────────────────┴─────────────────┘
```

## Responsive Behavior

### Desktop (>1024px)
- Full 6-column grid for summary cards
- Budget widget full width
- Grid scrolls horizontally for 12 months

### Tablet (768px-1024px)
- 3-column grid for summary cards (2 rows)
- Budget widget full width, stacked inputs
- Grid scrolls horizontally

### Mobile (<768px)
- 1-column grid for summary cards (6 rows)
- Budget widget inputs stack vertically
- Grid scrolls horizontally with sticky first column

## Accessibility

### Keyboard Navigation
- Tab order: Header → Budget Widget → Summary Cards → Action Buttons → Grid
- Enter key commits cell edits
- Escape key cancels cell edits
- Arrow keys navigate grid (future enhancement)

### Screen Reader Support
- Budget widget labeled with ARIA attributes
- Save buttons announce pending count
- Grid cells have descriptive labels
- Success/error toasts read aloud

### Color Contrast
- All text meets WCAG AA standards
- Budget progress bar colors meet contrast requirements
- Alert messages have sufficient contrast

## Performance Considerations

### Load Time
- Budget widget loads asynchronously (no blocking)
- Grid renders incrementally (virtualization for large datasets)
- Summary cards calculate from memoized data

### Save Operations
- Forecast save: Batches up to 25 adjustments per API call
- Budget save: Single API call
- Optimistic UI updates where safe

### Data Refresh
- After forecast save: Full reload of forecast data
- After budget save: Widget state updates, no full reload needed
- Smart invalidation of React Query caches

## Error States

### API Errors
```
Forecast Save Failed:
┌────────────────────────────────────────┐
│ ⚠️ Error                               │
│ No pudimos guardar los ajustes de     │
│ pronóstico. Por favor intenta de      │
│ nuevo.                                 │
│ [Retry]                                │
└────────────────────────────────────────┘
```

### Validation Errors
```
Budget Input Invalid:
┌────────────────────────────────────────┐
│ ⚠️ Por favor ingresa un monto válido  │
└────────────────────────────────────────┘
```

### Network Errors
```
No Connection:
┌────────────────────────────────────────┐
│ 🔌 Sin conexión                        │
│ Verifica tu conexión a internet       │
└────────────────────────────────────────┘
```

## Success States

### Forecast Saved
```
Toast Notification:
┌────────────────────────────────────────┐
│ ✅ 12 ajustes de pronóstico guardados │
│    correctamente                       │
└────────────────────────────────────────┘
```

### Budget Saved
```
Toast Notification:
┌────────────────────────────────────────┐
│ ✅ Presupuesto anual 2025 guardado    │
│    exitosamente                        │
└────────────────────────────────────────┘
```

## Testing Scenarios

### Happy Path
1. ✅ Load page → Budget widget loads with current data
2. ✅ Edit forecast cell → Cell updates in UI
3. ✅ Click save → API succeeds, data reloads
4. ✅ Edit budget → Save succeeds, comparison updates

### Edge Cases
1. ⚠️ No existing budget → Widget allows new budget input
2. ⚠️ Budget exceeded → Red alert shows with excess amount
3. ⚠️ No internet → Error message with retry option
4. ⚠️ Concurrent edits → Last save wins (eventual consistency)
5. ⚠️ Invalid input → Validation message, save disabled

### Error Recovery
1. 🔄 Save fails → Data preserved in UI, user can retry
2. 🔄 Network timeout → Retry with exponential backoff
3. 🔄 Auth error → Redirect to login page
4. 🔄 Validation error → Clear message, focus on problem field
