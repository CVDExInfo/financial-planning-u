# UX/Analytics Improvements - Commits 5 & 6

## Commit 5: Consolidate KPIs + Make Variation Chart Interactive

### Implementation Plan

#### KPI Consolidation (SDMTForecast.tsx around line 2096-2206)
Currently shows 6 KPI tiles in a grid. Target: Show only 2 primary KPIs always visible, collapse remaining 4 into expandable "Más KPIs" section.

Changes needed:
1. Add state: `const [showMoreKpis, setShowMoreKpis] = useState(false)`
2. Always show tiles:
   - Total Planeado
   - Pronóstico Total
3. Collapse into accordion/collapsible:
   - Total Real
   - Total FTE
   - Variación Pronóstico
   - Variación Real
4. Add "Más KPIs" toggle button below primary tiles
5. Make responsive: single column on mobile, 2 columns on desktop

#### Variation Chart Improvements (ForecastChartsPanel around line 2431)
Make the variation vs budget chart interactive with toggleable legend.

Changes needed:
1. Import recharts Legend component
2. Add legend to chart with click handlers
3. Add state for toggled lines: `const [visibleLines, setVisibleLines] = useState(['forecast', 'plan', 'actual'])`
4. Reduce chart height from current to ~30% less (e.g., from 400px to 280px)
5. Add responsive height breakpoints

### Spanish Translations (es.ts)
Add:
```typescript
forecast: {
  ...
  masKpis: "Más KPIs",
  mostrarMenosKpis: "Mostrar Menos KPIs",
}
```

### Testing
- Manual QA: Verify KPI collapse/expand works
- Manual QA: Verify chart legend toggles lines on/off
- Responsive testing on mobile and desktop

---

## Commit 6: Polish Totals Row Spacing & Responsive Layout

### Implementation Plan

#### Totals Row Alignment (MonthlySnapshotGrid.tsx)
Current issue: Totals row may not align perfectly with table columns.

Changes needed:
1. Locate totals row rendering (search for "total" or "subtotal" className)
2. Ensure table layout uses `table-fixed` for consistent column widths
3. Add matching padding to totals row cells to align with table headers
4. Use CSS Grid or Tailwind's `grid-cols-[auto_1fr_auto]` pattern

Example fix:
```tsx
<Table className="table-fixed">
  {/* headers with fixed widths */}
</Table>
<div className="flex border-t sticky bottom-0 bg-background">
  {/* totals with matching column structure */}
</div>
```

#### Principales Variaciones Card Spacing
Current issue: "Principales Variaciones — M1" card may have excess whitespace.

Changes needed:
1. Locate MonthlySnapshotSummary or variance card component
2. Adjust padding: reduce from `p-6` to `p-4`
3. Adjust margins: use `mb-4` instead of `mb-6`
4. Make responsive: `p-3 md:p-4` for mobile/desktop
5. Use flexbox wrapping: `flex flex-wrap gap-2`

### CSS/Tailwind Classes to Update
- Table: add `table-fixed` for consistent widths
- Totals row: match table header column widths exactly
- Variance card: `p-4` → `p-3 md:p-4`
- Margins: `mb-6` → `mb-4` for tighter spacing
- Add `flex-wrap` for responsive content wrapping

### Testing
- Manual QA: Verify totals row aligns with table columns at all screen sizes
- Manual QA: Verify "Principales Variaciones" card has appropriate spacing
- Responsive testing: mobile, tablet, desktop

---

## Notes
These improvements are primarily CSS/styling changes with no impact on business logic or data flow. They can be implemented as polish/refinement after core functionality is stable.

## Files to Modify
- Commit 5: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`, `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`, `src/lib/i18n/es.ts`
- Commit 6: `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`, `src/features/sdmt/cost/Forecast/components/MonthlySnapshotSummary.tsx`
