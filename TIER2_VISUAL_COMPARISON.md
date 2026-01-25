# Tier 2 UX Refactor - Visual Comparison

## Before Changes

```
SDMTForecast.tsx (when NEW_FORECAST_LAYOUT_ENABLED = true)

┌─────────────────────────────────────────────────────────────┐
│ Position #1: Resumen Ejecutivo (ForecastSummaryBar)        │
│ ✅ Always visible                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #2: Cuadrícula de Pronóstico 12m                  │
│ ✅ ForecastRubrosTable #1                                   │
│ ✅ Expanded (defaultOpen=true)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #3: Matriz del Mes (MonthlySnapshotGrid)          │
│ ✅ Always visible                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #4: Resumen de Portafolio                         │
│ ❌ EXPANDED (defaultOpen=true) <- INCORRECT                │
│ Should be COLLAPSED per spec                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #5: Simulador de Presupuesto                      │
│ ✅ Collapsed (defaultOpen=false)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #6: Gráficos de Tendencias                        │
│ ✅ Collapsed (defaultOpen=false)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #7: Monitoreo mensual                             │
│ ❌ MISSING <- REQUIRED                                      │
│ Should show ForecastRubrosTable #2                          │
└─────────────────────────────────────────────────────────────┘

Status: 5/7 positions correct ❌
Issue: Missing Position #7 and incorrect collapsed state for Position #4
```

## After Changes

```
SDMTForecast.tsx (when NEW_FORECAST_LAYOUT_ENABLED = true)

┌─────────────────────────────────────────────────────────────┐
│ Position #1: Resumen Ejecutivo (ForecastSummaryBar)        │
│ ✅ Always visible                                           │
│ Line: 2907-2922                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #2: Cuadrícula de Pronóstico 12m                  │
│ ✅ ForecastRubrosTable #1                                   │
│ ✅ Expanded (defaultOpen=true)                              │
│ Line: 3417-3463                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #3: Matriz del Mes (MonthlySnapshotGrid)          │
│ ✅ Always visible                                           │
│ Line: 3465-3517                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #4: Resumen de Portafolio                         │
│ ✅ COLLAPSED (defaultOpen=false) <- FIXED ✅                │
│ Line: 3522 (changed from defaultOpen=true)                 │
│ Lines: 3519-3562                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #5: Simulador de Presupuesto                      │
│ ✅ Collapsed (defaultOpen=false)                            │
│ Lines: 3568-3757                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #6: Gráficos de Tendencias                        │
│ ✅ Collapsed (defaultOpen=false)                            │
│ Lines: 3759-3770                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Position #7: Monitoreo mensual de proyectos               │
│ ✅ ADDED ✅                                                 │
│ ✅ ForecastRubrosTable #2                                   │
│ ✅ Expanded (defaultOpen=true)                              │
│ ✅ Badge: "Por Proyecto"                                    │
│ Lines: 3772-3816 (45 new lines)                            │
└─────────────────────────────────────────────────────────────┘

Status: 7/7 positions correct ✅
All requirements met!
```

## Detailed Changes

### Change #1: Position #4 Collapsed State
```diff
File: src/features/sdmt/cost/Forecast/SDMTForecast.tsx
Line: 3522

- <Collapsible defaultOpen={true}>
+ <Collapsible defaultOpen={false}>
```

**Impact:**
- PortfolioSummaryView now starts collapsed
- User must click to expand it
- Reduces initial page clutter
- Matches FINAL_FORECAST_LAYOUT.md spec line 43

### Change #2: Position #7 Addition
```diff
File: src/features/sdmt/cost/Forecast/SDMTForecast.tsx
Lines: 3772-3816 (after ForecastChartsPanel)

+          {/* Position #7: Monitoreo mensual de proyectos vs. presupuesto */}
+          {/* Second instance of ForecastRubrosTable for project-level monitoring */}
+          {/* Must render EXPANDED by default (defaultOpen=true) per FINAL_FORECAST_LAYOUT.md */}
+          {NEW_FORECAST_LAYOUT_ENABLED && !loading && (
+            <Collapsible defaultOpen={true}>
+              <Card className="space-y-2">
+                <CardHeader className="pb-2 pt-4">
+                  <div className="flex items-center justify-between">
+                    <div className="flex items-center gap-2">
+                      <CardTitle className="text-lg">
+                        Monitoreo mensual de proyectos vs. presupuesto
+                      </CardTitle>
+                      <Badge variant="secondary" className="ml-2">Por Proyecto</Badge>
+                    </div>
+                    <CollapsibleTrigger asChild>
+                      <Button
+                        variant="ghost"
+                        size="sm"
+                        className="h-8 w-8 p-0"
+                        aria-label="Expandir/Colapsar Monitoreo mensual"
+                      >
+                        <ChevronDown className="h-4 w-4" />
+                      </Button>
+                    </CollapsibleTrigger>
+                  </div>
+                </CardHeader>
+                <CollapsibleContent>
+                  <CardContent className="pt-0">
+                    <ForecastRubrosTable
+                      categoryTotals={categoryTotals}
+                      categoryRubros={categoryRubros}
+                      projectTotals={projectTotals}
+                      projectRubros={projectRubros}
+                      portfolioTotals={portfolioTotalsForCharts}
+                      monthlyBudgets={monthlyBudgets}
+                      onSaveBudget={handleSaveBudgetFromTable}
+                      formatCurrency={formatCurrency}
+                      canEditBudget={canEditBudget}
+                      defaultFilter="labor"
+                    />
+                  </CardContent>
+                </CollapsibleContent>
+              </Card>
+            </Collapsible>
+          )}
```

**Impact:**
- Adds missing Position #7 section
- Second instance of ForecastRubrosTable
- Expanded by default for visibility
- Supports project-level monitoring view
- Matches FINAL_FORECAST_LAYOUT.md spec lines 63-71

## Component Instance Count

### Before
```
ForecastRubrosTable: 1 instance ❌ (should be 2)
ForecastSummaryBar:  1 instance ✅
MonthlySnapshotGrid: 1 instance ✅
PortfolioSummaryView: 1 instance ✅
BudgetSimulatorCard: 1 instance ✅
ForecastChartsPanel: 1 instance ✅
```

### After
```
ForecastRubrosTable: 2 instances ✅ (Position #2 and #7)
ForecastSummaryBar:  1 instance ✅
MonthlySnapshotGrid: 1 instance ✅
PortfolioSummaryView: 1 instance ✅
BudgetSimulatorCard: 1 instance ✅
ForecastChartsPanel: 1 instance ✅
```

## Collapsed/Expanded States

### Before
```
Position #1 (ForecastSummaryBar):     Always visible ✅
Position #2 (ForecastRubrosTable #1): Expanded ✅
Position #3 (MonthlySnapshotGrid):    Always visible ✅
Position #4 (PortfolioSummaryView):   Expanded ❌ (should be collapsed)
Position #5 (BudgetSimulatorCard):    Collapsed ✅
Position #6 (ForecastChartsPanel):    Collapsed ✅
Position #7 (Monitoreo):              MISSING ❌
```

### After
```
Position #1 (ForecastSummaryBar):     Always visible ✅
Position #2 (ForecastRubrosTable #1): Expanded ✅
Position #3 (MonthlySnapshotGrid):    Always visible ✅
Position #4 (PortfolioSummaryView):   Collapsed ✅ FIXED
Position #5 (BudgetSimulatorCard):    Collapsed ✅
Position #6 (ForecastChartsPanel):    Collapsed ✅
Position #7 (ForecastRubrosTable #2): Expanded ✅ NEW
```

## User Experience Impact

### Position #4 Fix (Collapsed by default)
**Before:**
- User sees expanded Portfolio Summary on page load
- More scrolling required to see other sections
- Visual clutter

**After:**
- Portfolio Summary starts collapsed
- Cleaner initial view
- User expands when needed
- Reduces cognitive load

### Position #7 Addition (Monitoreo mensual)
**Before:**
- No dedicated monitoring section
- Users had to use Position #2 grid for everything

**After:**
- Dedicated monitoring section for project-level analysis
- Expanded by default for visibility
- Clear "Por Proyecto" badge
- Better separation of concerns

## Accessibility Improvements

All new sections include proper accessibility:
- ✅ `aria-label="Expandir/Colapsar Monitoreo mensual"` on trigger button
- ✅ Semantic HTML with proper CardHeader/CardTitle structure
- ✅ Keyboard navigable collapse/expand
- ✅ Screen reader friendly

## Performance Impact

- ✅ No performance degradation
- ✅ Minimal DOM additions (45 lines)
- ✅ Lazy rendering via Collapsible (collapsed sections don't render content)
- ✅ Same data loading logic

## Backwards Compatibility

- ✅ Feature flag controlled (`NEW_FORECAST_LAYOUT_ENABLED`)
- ✅ No changes when flag is false
- ✅ No breaking changes to existing components
- ✅ All existing tests pass
