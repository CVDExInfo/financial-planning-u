# Visual Guide: MonthlySnapshotGrid UX Improvements

## Before and After

### Component Location
**Path:** `/finanzas/sdmt/cost/forecast` when Project is set to "TODOS" (portfolio view)
**Section:** "Matriz del Mes — Vista Ejecutiva" card

---

## Feature 1: Compact Summary Strip

### BEFORE
```
┌─────────────────────────────────────────────────────────────┐
│ 📅 Matriz del Mes — Vista Ejecutiva              M12       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Large empty red box area]                                 │
│                                                              │
│                                                              │
│  Período: [Mes actual ▼]  Agrupar por: [Por Proyecto ▼]    │
│  Buscar: [___________]  ☑ Solo con variación               │
│                                                              │
│  Table starts here...                                       │
└─────────────────────────────────────────────────────────────┘
```

### AFTER
```
┌─────────────────────────────────────────────────────────────┐
│ 📅 Matriz del Mes — Vista Ejecutiva              M12       │
├─────────────────────────────────────────────────────────────┤
│ ╔══════════╦═══════════╦═══════╦════════════════╦══════════╗│
│ ║Presupuest║Pronóstico ║ Real  ║% Consumo       ║Var vs Pre║│
│ ║   o      ║           ║       ║(Real/Budget)   ║supuesto  ║│
│ ╟──────────╫───────────╫───────╫────────────────╫──────────╢│
│ ║$500,000  ║ $480,000  ║$450K  ║     90.0%      ║ -$50,000 ║│
│ ║          ║           ║       ║                ║ (-10.0%) ║│
│ ╚══════════╩═══════════╩═══════╩════════════════╩══════════╝│
│                                                              │
│  Período: [Mes actual ▼]  Agrupar: [Por Proyecto ▼]        │
│  Buscar: [___________]  ☑ Solo con variación               │
│  Tipo de costo: [Ambos][Mano de obra][Gastos directos]    │
│                                                              │
│  Table starts here...                                       │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ 5 compact digital cards showing key metrics
- ✅ Responsive grid layout (2 cols mobile → 5 cols desktop)
- ✅ % Consumo (Real/Budget) metric added
- ✅ Variance displayed with both absolute and percentage values
- ✅ Color coding (red for over budget, green for under budget)

---

## Feature 2: Project-Level Action Icons

### BEFORE
```
Table Header:
┌──────────────┬──────────┬──────────┬─────┬────────────┬────────────┬───────┬─────────┐
│Proyecto/Rubro│Presupuest│Pronóstico│Real │Var vs Pres.│Var vs Pron.│Estado │Acciones │
├──────────────┼──────────┼──────────┼─────┼────────────┼────────────┼───────┼─────────┤
│▼ Project A   │ $100,000 │ $95,000  │$90K │ -$10,000   │ -$5,000    │En Meta│[📋][✏️] │
└──────────────┴──────────┴──────────┴─────┴────────────┴────────────┴───────┴─────────┘

Actions:
[📋] Ver detalle mensual
[✏️] Solicitar ajuste
```

### AFTER
```
Table Header:
┌──────────────┬──────────┬──────────┬─────┬────────────┬────────────┬───────┬───────────────┐
│Proyecto/Rubro│Presupuest│Pronóstico│Real │Var vs Pres.│Var vs Pron.│Estado │Acciones       │
├──────────────┼──────────┼──────────┼─────┼────────────┼────────────┼───────┼───────────────┤
│▼ Project A   │ $100,000 │ $95,000  │$90K │ -$10,000   │ -$5,000    │En Meta│[👁️][📋][🏗️][✏️]│
└──────────────┴──────────┴──────────┴─────┴────────────┴────────────┴───────┴───────────────┘

Actions:
[👁️] Ver detalle mensual (scrolls to detail grid)
[📋] Ir a conciliación (navigate to reconciliation)
[🏗️] Estructura de costos (navigate to catalog) ← NEW!
[✏️] Solicitar ajuste de presupuesto
```

**Key Changes:**
- ✅ Added "Estructura de costos" icon (Layers icon)
- ✅ Changed detail icon from FileSpreadsheet to Eye for clarity
- ✅ Catalog navigation wired to `/sdmt/cost/catalog?projectId={id}`
- ✅ All icons have proper tooltips
- ✅ Catalog icon only appears in "Por Proyecto" grouping mode

---

## Feature 3: Labor / Non-Labor / Ambos Filter

### BEFORE
```
Controls Row:
┌───────────────────────────────────────────────────────────────┐
│ Período: [Mes actual ▼]  Agrupar por: [Por Proyecto ▼]      │
│ Buscar: [___________]  ☑ Solo con variación                  │
└───────────────────────────────────────────────────────────────┘
```

### AFTER
```
Controls Row:
┌───────────────────────────────────────────────────────────────┐
│ Período: [Mes actual ▼]  Agrupar: [Por Proyecto ▼]          │
│ Buscar: [___________]  ☑ Solo con variación                  │
│ Tipo de costo: ┌─────────────────────────────────────┐       │
│                 │[Ambos][Mano de obra][Gastos directos]│     │
│                 └─────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────┘

When "Mano de obra" is selected:
┌───────────────────────────────────────────────────────────────┐
│ Tipo de costo: ┌─────────────────────────────────────┐       │
│                 │[Ambos][●Mano de obra●][Gastos directos]│   │
│                 └─────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ Three-way segmented button control
- ✅ "Ambos" (all), "Mano de obra" (labor), "Gastos directos" (non-labor)
- ✅ Filters table rows based on category type
- ✅ Uses `isLabor()` utility for accurate categorization
- ✅ Summary metrics update automatically when filter changes
- ✅ Active state clearly indicated with different button style

**Filter Behavior:**
```
"Ambos" selected:
  → Shows ALL projects/rubros (no filtering)
  → Summary strip shows total across all cost types

"Mano de obra" selected:
  → Shows ONLY labor costs (engineers, PM, SDM, etc.)
  → Hides non-labor rows
  → Summary strip recalculates for labor only

"Gastos directos" selected:
  → Shows ONLY non-labor costs (equipment, licenses, travel, etc.)
  → Hides labor rows
  → Summary strip recalculates for non-labor only
```

---

## Feature 4: Consolidated Info Banners

### BEFORE
```
┌───────────────────────────────────────────────────────────────┐
│ 📅 Mostrando solo el mes en curso (M12) - Dec 2025          │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ ℹ️ Presupuesto mensual no configurado. Active el presupuesto │
│    mensual para ver métricas precisas.                        │
└───────────────────────────────────────────────────────────────┘

[Large vertical gap]
```

### AFTER
```
┌───────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────┐ ┌──────────────────────────────┐│
│ │📅 Mostrando solo el mes │ │ℹ️ Presupuesto mensual no    ││
│ │   actual (M12)           │ │   configurado. Active el    ││
│ │                          │ │   presupuesto mensual para  ││
│ │                          │ │   ver métricas precisas.    ││
│ └──────────────────────────┘ └──────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘

[Minimal vertical gap]
```

**Key Changes:**
- ✅ Side-by-side layout in flex container
- ✅ Reduced padding (p-1.5 instead of px-3 py-2)
- ✅ Only shown when relevant
- ✅ Cleaner, more compact visual presentation
- ✅ Responsive: stacks on mobile, side-by-side on desktop

---

## Complete Visual Flow

### User Journey: Filtering Labor Costs
```
1. User loads page with "Ambos" selected
   ┌────────────────────────────────────────────┐
   │ Summary: $500K budget, $480K forecast      │
   │ Filter: [●Ambos●][Mano de obra][Gastos]   │
   │ Table: 10 projects shown                   │
   └────────────────────────────────────────────┘

2. User clicks "Mano de obra"
   ┌────────────────────────────────────────────┐
   │ Summary: $300K budget, $285K forecast ← Updated!
   │ Filter: [Ambos][●Mano de obra●][Gastos]   │
   │ Table: 6 projects shown (labor only) ← Filtered!
   └────────────────────────────────────────────┘

3. User clicks Layers icon on "Project Alpha"
   → Navigates to /sdmt/cost/catalog?projectId=alpha
   → Shows detailed cost structure for that project
```

---

## Responsive Behavior

### Desktop (1440px+)
```
Summary Cards: [Card1][Card2][Card3][Card4][Card5]  (5 columns)
Banners:       [Banner1                ] [Banner2                ]
Filters:       [Period][Group][Search           ][Variance][CostType]
```

### Laptop (1280px)
```
Summary Cards: [Card1][Card2][Card3][Card4][Card5]  (5 columns, slightly narrower)
Banners:       [Banner1                ] [Banner2                ]
Filters:       [Period][Group][Search      ][Variance]
               [CostType                              ]
```

### Tablet (768px)
```
Summary Cards: [Card1][Card2]
               [Card3][Card4]
               [Card5]
Banners:       [Banner1            ]
               [Banner2            ]
Filters:       [Period][Group]
               [Search         ]
               [Variance][CostType]
```

---

## Technical Implementation Notes

### Component Structure
```
MonthlySnapshotGrid
├── CardHeader (title + collapse button)
└── CardContent
    ├── Collapsed View
    │   └── MonthlySnapshotSummary (existing)
    └── Expanded View
        ├── Summary Strip (5 cards) ← NEW
        ├── Controls Row
        │   ├── Period selector
        │   ├── Grouping selector
        │   ├── Search input
        │   ├── Variance checkbox
        │   └── Cost Type Filter ← NEW
        ├── Consolidated Banners ← UPDATED
        └── Data Table
            └── Action Icons ← UPDATED
```

### Data Flow
```
forecastData (all months)
    ↓
Filter by selected month
    ↓
Group by project/rubro
    ↓
Apply cost type filter ← NEW
    ↓
Apply search filter
    ↓
Apply variance filter
    ↓
Calculate summaries ← UPDATED
    ↓
Render filtered rows + summary
```

---

## Testing Scenarios

### Scenario 1: Summary Updates with Filters
1. Load page with all data
2. Note summary values (e.g., $500K budget)
3. Select "Mano de obra" filter
4. ✓ Summary should show ONLY labor budget (e.g., $300K)
5. Select "Gastos directos" filter
6. ✓ Summary should show ONLY non-labor budget (e.g., $200K)
7. Select "Ambos"
8. ✓ Summary should return to original total ($500K)

### Scenario 2: Action Icons Work
1. Find a project row in the table
2. Click Eye icon → ✓ Page scrolls to detail section
3. Click FileSpreadsheet icon → ✓ Navigate to reconciliation
4. Click Layers icon → ✓ Navigate to catalog with projectId
5. Click Edit icon → ✓ Budget request modal opens

### Scenario 3: Banners Display Correctly
1. Select "Mes actual" period → ✓ Current month banner appears
2. When budget not configured → ✓ Budget banner appears
3. Both conditions true → ✓ Both banners side-by-side
4. Select specific month (not current) → ✓ Current month banner hidden

---

## Success Criteria

✅ Summary strip visible and shows all 5 metrics
✅ Metrics update when filters change
✅ Cost type filter has 3 options and filters correctly
✅ All 4 action icons work and navigate properly
✅ Catalog navigation includes projectId parameter
✅ Banners are consolidated and compact
✅ Responsive layout works at all screen sizes
✅ No TypeScript errors
✅ No console errors in browser
✅ Performance is smooth (no lag on filter changes)
