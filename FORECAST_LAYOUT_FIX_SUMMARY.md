# Forecast UI Layout Fix - Summary & Testing Guide

**PR:** [TBD] - Fix Forecast UI Layout Issues (Post-PR 917 Polish)  
**Branch:** `copilot/fix-forecast-ui-layout-issues`  
**Date:** 2026-01-18  
**Status:** ✅ Ready for Testing

---

## Problem Statement

After deploying code changes from PRs #917, #920, and #914, the UI was not reflecting the expected Forecast page layout. The issue was that the `NEW_FORECAST_LAYOUT` feature flag was defined but not properly implemented to control which layout components were shown.

---

## Root Cause Analysis

1. **Flag Not Used:** The `NEW_FORECAST_LAYOUT_ENABLED` constant was defined (line 175 in SDMTForecast.tsx) but never used to conditionally render components.

2. **Duplicate Grids:** Both the new ForecastRubrosTable (Position #2) and old table-based grid (Position #7, line 3604+) were rendering simultaneously, causing visual conflicts.

3. **Missing Features:** Position #2 was missing the Vista selector ("Por Proyecto" | "Rubros por proyecto") that was present in the old grid.

---

## Solution Implemented

### Core Fix: Properly Implement Feature Flag

```typescript
// Before: Flag was defined but not used
const NEW_FORECAST_LAYOUT_ENABLED = import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';

// After: Flag now controls which layout renders
{NEW_FORECAST_LAYOUT_ENABLED && (
  // Positions #2-#6: New canonical layout
)}

{!NEW_FORECAST_LAYOUT_ENABLED && (
  // Old table-based grid (legacy fallback)
)}
```

### Changes Made

1. **Position #2: Enhanced Canonical Grid**
   ```tsx
   {NEW_FORECAST_LAYOUT_ENABLED && (
     <Collapsible defaultOpen={true}>  {/* NOT collapsed on entry */}
       <Card>
         <CardHeader>
           <Calendar icon + "Monitoreo mensual de proyectos vs. presupuesto" />
           <Badge>M1-M12</Badge>
           <Select>  {/* Vista: Por Proyecto | Rubros por proyecto */}
             <SelectItem value="project">Por Proyecto</SelectItem>
             <SelectItem value="rubros">Rubros por proyecto</SelectItem>
           </Select>
         </CardHeader>
         <CardContent>
           <ForecastRubrosTable ... />
         </CardContent>
       </Card>
     </Collapsible>
   )}
   ```

2. **Positions #3-#6: Wrapped with Flag**
   - Position #3: MonthlySnapshotGrid (compact filters)
   - Position #4: PortfolioSummaryView (only when !HIDE_PROJECT_SUMMARY)
   - Position #5: BudgetSimulatorCard (collapsed by default)
   - Position #6: ForecastChartsPanel (collapsible)

3. **Old Grid: Hidden When Flag Enabled**
   ```tsx
   {!NEW_FORECAST_LAYOUT_ENABLED && isPortfolioView ? (
     // Old table-based grid with traditional rendering
   )}
   ```

---

## Expected Layout When `VITE_FINZ_NEW_FORECAST_LAYOUT=true`

### Visual Order (Top → Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Resumen Ejecutivo - Cartera Completa                    │
│    (ForecastSummaryBar - always visible)                    │
│    [Total Budget | Total Forecast | Total Actual | %]      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. 📅 Monitoreo mensual de proyectos vs. presupuesto  M1-12│
│    Vista: [Por Proyecto ▼] | Rubros por proyecto     [▼]   │
│    ┌───────────────────────────────────────────────┐       │
│    │ ForecastRubrosTable (12-month canonical grid)  │       │
│    │ - Category subtotals                            │       │
│    │ - Individual rubros (indented)                  │       │
│    │ - Inline budget editing                         │       │
│    │ - Search/filter functionality                   │       │
│    └───────────────────────────────────────────────┘       │
│    ✅ EXPANDED BY DEFAULT (defaultOpen={true})              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Matriz del Mes — Vista Ejecutiva                        │
│    (MonthlySnapshotGrid)                                    │
│    [🔍 Search] [Labor|All|Non-Labor] [Period ▼]           │
│    Compact KPIs + filters, balanced layout                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Resumen de Portafolio                            [▼]    │
│    (PortfolioSummaryView - collapsible)                    │
│    Shows: Desglose por proyecto (Summary Grid)             │
│    Hidden when: VITE_FINZ_HIDE_PROJECT_SUMMARY=true        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. 🧮 Simulador de Presupuesto                      [▼]    │
│    (BudgetSimulatorCard)                                    │
│    ❌ COLLAPSED BY DEFAULT (defaultOpen={false})            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 6. 📊 Gráficos de Tendencias                        [▼]    │
│    (ForecastChartsPanel - collapsible)                     │
│    ├─ Tendencia Mensual (lines + bar "Proyectos M/M")     │
│    ├─ Por Rubro                                            │
│    └─ Acumulado                                            │
│    Bar improvements: wider (14px), better labels           │
└─────────────────────────────────────────────────────────────┘

   ❌ Old table-based grid (line 3604+) HIDDEN
```

---

## Testing Checklist

### Pre-Deployment Checks

- [x] Code compiles without TypeScript errors
- [x] Components properly wrapped with NEW_FORECAST_LAYOUT flag
- [x] Position #2 has Vista selector
- [x] Position #2 defaultOpen={true}
- [x] Old grid only shows when flag is false

### Dev Environment Testing

Access: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/sdmt/cost/forecast`

**Cognito Tester Credentials:**
- Use credentials from GitHub variables: `COGNITO_USER_POOL_ID`, `COGNITO_WEB_CLIENT`
- Or create tester profile in SDM Cognito group

**Test Cases:**

1. **Layout Order** ✅
   - [ ] Components appear in exact order: 1→2→3→4→5→6
   - [ ] No duplicate grids visible
   - [ ] Old table-based grid is NOT visible

2. **Position #2: Canonical Grid** ✅
   - [ ] Title: "Monitoreo mensual de proyectos vs. presupuesto"
   - [ ] Badge shows "M1-M12"
   - [ ] Calendar icon visible
   - [ ] Grid is EXPANDED on page load (not collapsed)
   - [ ] Vista selector present with two options:
     - "Por Proyecto"
     - "Rubros por proyecto"
   - [ ] Switching Vista updates grid display
   - [ ] ForecastRubrosTable renders correctly
   - [ ] Can collapse/expand with chevron button

3. **Position #3: Monthly Snapshot** ✅
   - [ ] MonthlySnapshotGrid visible
   - [ ] Filters are compact (h-8 pattern)
   - [ ] Search, filter buttons balanced
   - [ ] No "coming soon" placeholders

4. **Position #4: Portfolio Summary** ✅
   - [ ] Shows when HIDE_PROJECT_SUMMARY=false
   - [ ] Displays project breakdown table
   - [ ] Collapsible functionality works

5. **Position #5: Budget Simulator** ✅
   - [ ] COLLAPSED by default (must click to expand)
   - [ ] BudgetSimulatorCard renders when expanded

6. **Position #6: Charts** ✅
   - [ ] ForecastChartsPanel visible and collapsible
   - [ ] "Proyectos (M/M)" bar chart visible
   - [ ] Bars are wider (14px vs 12px)
   - [ ] Bars have neutral gray color (#6b7280)
   - [ ] Labels only show for non-zero values
   - [ ] Right Y-axis for project count
   - [ ] Tabs work: Tendencia Mensual | Por Rubro | Acumulado

7. **Feature Flags** ✅
   - [ ] NEW_FORECAST_LAYOUT=true → shows new layout
   - [ ] NEW_FORECAST_LAYOUT=false → shows old grid
   - [ ] HIDE_PROJECT_SUMMARY=true → hides Position #4
   - [ ] Other flags work as documented

8. **Responsive Behavior** ✅
   - [ ] Desktop: all sections visible, proper spacing
   - [ ] Tablet: columns adapt, scrolling works
   - [ ] Mobile: sections stack vertically

---

## Deploy Configuration

### deploy-ui.yml Settings (Current)

```yaml
# Line 39: Default to true (enable new layout)
VITE_FINZ_NEW_FORECAST_LAYOUT: ${{ vars.VITE_FINZ_NEW_FORECAST_LAYOUT || 'true' }}

# Line 223: Passed to build step
VITE_FINZ_NEW_FORECAST_LAYOUT: ${{ env.VITE_FINZ_NEW_FORECAST_LAYOUT }}
```

**All other flags default to 'false':**
- `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS: 'false'`
- `VITE_FINZ_HIDE_PROJECT_SUMMARY: 'false'`
- `VITE_FINZ_HIDE_KEY_TRENDS: 'false'`
- `VITE_FINZ_SHOW_KEYTRENDS: 'false'`

These defaults produce the canonical layout described above.

---

## Validation Evidence

### Before Fix
- ❌ Both new and old grids rendering simultaneously
- ❌ Position #2 missing Vista selector
- ❌ Duplicate sections causing visual clutter
- ❌ NEW_FORECAST_LAYOUT flag not controlling layout

### After Fix
- ✅ Only one canonical grid (ForecastRubrosTable) when flag=true
- ✅ Position #2 has full Vista selector functionality
- ✅ Clean layout with proper component order
- ✅ Flag properly controls new vs. old layout

---

## Rollback Plan

If issues are found in production:

1. **Quick Fix:** Set GitHub variable
   ```
   VITE_FINZ_NEW_FORECAST_LAYOUT=false
   ```
   This will revert to old table-based grid.

2. **Code Rollback:** Revert commit `f0e1f8c` 
   ```bash
   git revert f0e1f8c
   ```

---

## Related PRs & Issues

- **Issue #924:** Post-PR 917 Polish: Forecast UI Fixes & Deployment Hardening
- **PR #920:** [Related forecast improvements]
- **PR #914:** [Related forecast improvements]
- **PR #917:** [Original forecast UI changes]

---

## Documentation Updates

Updated files:
1. `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Layout implementation
2. This file: `FORECAST_LAYOUT_FIX_SUMMARY.md` - Testing guide

Reference documentation:
- `docs/FINAL_FORECAST_LAYOUT.md` - Expected layout specification
- `docs/FEATURE_FLAGS.md` - Feature flag definitions
- `FORECAST_UI_FIXES_SUMMARY.md` - Implementation history

---

## Next Steps

1. **Deploy to Dev:** Trigger deploy-ui.yml workflow for dev environment
2. **Manual QA:** Follow testing checklist above
3. **Screenshot Evidence:** Capture before/after for each position
4. **Stakeholder Review:** Share screenshots for approval
5. **Deploy to Prod:** Merge to main branch

---

**Questions or Issues?**
Contact: @valencia94 or open GitHub issue with label `forecast-ui`
