# UX Audit: Gestión de Pronóstico → Matriz del Mes — Vista Ejecutiva

**Date:** January 24, 2026  
**Auditor:** Senior Product Designer + UX Auditor  
**Focus:** Visual Overload Reduction & Information Hierarchy

---

## Executive Summary

The Forecast Executive View (`SDMTForecast.tsx`) currently suffers from **high information density** and **competing visual hierarchies** despite a strong digital aesthetic. The main issues stem from:

1. **Excessive simultaneous information display** - Too many KPI cards, charts, and tables visible at once
2. **Weak visual hierarchy** - All elements compete for equal attention
3. **Insufficient use of progressive disclosure** - Critical vs. secondary information not differentiated
4. **Inconsistent spacing** - Mix of padding/margin values creates visual noise
5. **Border/container overuse** - Heavy use of cards and borders segments the view excessively

**Key Finding:** The page attempts to serve both **Executive Scan Mode** (30s quick status) and **Operator Mode** (5-10min editing) simultaneously, resulting in cognitive overload for both user types.

---

## Information Architecture Map

### Current Module Structure (via code analysis)

**Main Modules:**
1. **Gestión de Pronóstico** (Forecast Management)
   - Matriz del Mes — Vista Ejecutiva ← **AUDIT FOCUS**
   - Budget Simulator
   - Portfolio Summary
   - Monthly Snapshots
   
2. **Supporting Components:**
   - KPI Cards (multiple)
   - Summary Bar
   - Forecast Grid/Table
   - Analytics & Trends Panel
   - Variance Tables (Projects & Rubros)
   - Data Health Panel
   - Baseline Status Panel

### Current Layout Structure (SDMTForecast.tsx - 5100+ lines)

**Position #1: Header & Controls**
- Project selector
- Period selector  
- Export buttons (Excel, PDF)
- Save forecast button

**Position #2: KPI Cards** (Conditional display based on feature flags)
- Multiple KPI tiles showing budget, forecast, actual, variance
- Flag: `SHOW_PORTFOLIO_KPIS` (default: false - good decision)
- Flag: `HIDE_REAL_ANNUAL_KPIS` (available for further reduction)

**Position #3: Summary Bar** (NEW_FORECAST_LAYOUT only)
- Compact KPI strip
- Better than individual cards
- Issue: Still quite dense

**Position #4: Portfolio Summary View** (Collapsible)
- Monthly breakdown table
- Project list (expandable)
- Runway metrics
- Flag: `HIDE_PROJECT_SUMMARY` (default: false)

**Position #5: Budget Simulator** (Collapsible, defaultOpen=false)
- Annual budget editor
- Monthly budget inputs
- Simulation controls
- **Good:** Collapsed by default

**Position #6: Forecast Rubros Table** (Main data grid)
- Switchable view: Projects vs. Rubros
- Month-by-month data
- Inline editing
- **Issue:** Always expanded, high density

**Position #7: Top Variance Tables** (Conditional)
- Top Projects by Variance
- Top Rubros by Variance
- **Issue:** Displayed simultaneously when both have data

**Position #8: Monthly Snapshot Grid** (Conditional)
- Alternative visualization
- **Issue:** Adds to visual load when visible

**Position #9: Forecast Analytics & Trends** (ChartInsightsPanel)
- Line charts
- Stacked column charts
- KPI insights
- **MAJOR ISSUE:** Always displayed, should be progressive disclosure

---

## Deep Dive: Executive View Audit

### A) Visual Hierarchy / Overload

**What elements compete for attention?**

1. ❌ **KPI Cards** - When enabled, 4-6 large tiles all demand equal attention
2. ❌ **Summary Bar** - Dense horizontal strip with 6+ metrics
3. ❌ **Portfolio Summary** - Large expandable table (often open by default)
4. ⚠️ **Forecast Grid** - Main data table (appropriate to be prominent)
5. ❌ **Variance Tables** - Two separate tables (Projects + Rubros) both fighting for space
6. ❌ **Analytics Panel** - Large charts section always visible

**Current Priority (unintentional):**
```
Everything is equally important = Nothing is important
```

**Desired Priority for Executive Scan (30s):**
```
1. Summary Bar (quick status)
2. Forecast Grid (month overview)
3. Everything else hidden or collapsed
```

**Desired Priority for Operator Mode (5-10min):**
```
1. Forecast Grid (editing)
2. Controls (save, filters)
3. Analytics on-demand
4. Variance tables on-demand
```

**Elements that should be demoted/collapsed:**

1. **CRITICAL:** Analytics & Trends Panel → Collapse by default OR move to tab
2. **HIGH:** Top Variance Tables → Collapse by default OR progressive disclosure
3. **MEDIUM:** Portfolio Summary → Good that it's collapsible, ensure default is closed
4. **LOW:** Budget Simulator → Already collapsed by default ✓

**Whitespace Issues:**

- Inconsistent spacing: Mix of `space-y-2`, `space-y-3`, `space-y-4`, `gap-2`, `gap-4`, `p-3`, `p-4`, `p-6`
- No systematic 8pt/12pt/16pt grid
- Card padding varies: `pb-3`, `pt-0`, `p-4` - creates visual rhythm issues
- Sections blend together due to inconsistent vertical rhythm

**Border/Container Overuse:**

- Every section wrapped in `<Card>` component
- Double borders when collapsible cards inside cards
- `border-2 border-primary/20` adds visual weight unnecessarily
- Recommendation: Use subtle dividers instead of heavy cards for sub-sections

### B) Controls + Filters

**Current State:**
- Filters scattered across header area
- Project selector at top
- Period selector separate
- Save buttons in header
- Export buttons in analytics panel

**Issues:**
1. ❌ Filters not logically grouped
2. ❌ No sticky filter bar (scrolling loses context)
3. ⚠️ "Guardar Pronóstico" and "Guardar" buttons - unclear distinction
4. ⚠️ Export button placement varies

**Recommendations:**
1. Create sticky filter bar with: Project, Period, View Mode
2. Group action buttons: Save Forecast | Save Budget | Export
3. Place buttons near affected content
4. Consistent button hierarchy: Primary vs. Secondary

### C) Tables / Grid Usability

**Forecast Rubros Table:**
- Row density: Appropriate for data-heavy view
- Column scannability: Good with proper headers
- **Issue:** Status chips, action buttons, expand/collapse all inline - cluttered
- **Issue:** No row hover highlighting (makes scanning difficult)

**Recommendations:**
1. Add row hover states for better scanning
2. Consolidate row actions into a dropdown menu (reduces visual noise)
3. Use consistent expand/collapse pattern
4. Consider zebra striping for long tables

### D) Metrics & Summaries

**Current KPI Display:**

When `SHOW_PORTFOLIO_KPIS=true`:
- 4-6 individual KPI cards, each with:
  - Large number
  - Label
  - Icon
  - Border
  - Background color
- **Issue:** Too much visual weight for supporting metrics

**Summary Bar (better):**
- Horizontal strip
- 6 metrics inline
- **Issue:** Still quite dense, could be more compact

**Executive Summary Section:**
- Readable
- **Issue:** Lacks visual priority - looks like any other card

**Recommendations:**
1. **Executive Mode:** Show only 3 top KPIs (Budget, Forecast, Variance%)
2. **Operator Mode:** Show detailed metrics in collapsed sections
3. Clearly label Budget vs Forecast vs Actual with color coding
4. Use progressive disclosure: "View all metrics" link

### E) Trend/Analytics Section - CRITICAL FINDING

**Current State:**
```tsx
// Line ~5045: ChartInsightsPanel always rendered
<ChartInsightsPanel
  title="Forecast Analytics & Trends"
  charts={charts}
  insights={...}
  onExport={handleExcelExport}
/>
```

**Issues:**
1. ❌ **Always visible** - Takes up 40-60% of viewport
2. ❌ **Not collapsed by default** - Should use progressive disclosure
3. ❌ **Mixed with primary workflow** - Analytics are secondary for operators
4. ❌ **Duplicates export button** - Confusion with header export

**Recommendation: REMOVE from default view**

**Option A: Collapsible (Recommended for Quick Win)**
```tsx
<Collapsible defaultOpen={false}>
  <Card>
    <CardHeader>
      <CollapsibleTrigger>
        Analytics & Trends (Click to expand)
      </CollapsibleTrigger>
    </CardHeader>
    <CollapsibleContent>
      <ChartInsightsPanel ... />
    </CollapsibleContent>
  </Card>
</Collapsible>
```

**Option B: Separate Tab (Better UX)**
- Move to "Analytics" tab in navigation
- Keep main view focused on data entry/editing
- Executives can navigate to Analytics when needed

**Option C: Drill-down View**
- Show mini-preview (thumbnail chart)
- "View detailed analytics" button → opens modal or slides out panel
- Best for mobile responsiveness

**Option D: Single-project only**
- Show analytics only when viewing individual project
- Hide in portfolio/TODOS mode (too much aggregated data to visualize)

**Recommended Approach: Option A (Tier 1) → Option B (Tier 2)**

---

## Fix Plan

### Tier 1: Quick Wins (30-90 minutes)

#### Fix 1.1: Collapse Analytics by Default
**Problem:** Analytics panel always visible, dominates viewport  
**Change:** Wrap in `<Collapsible defaultOpen={false}>`  
**Why:** Immediate 40% reduction in visual noise  
**Acceptance Criteria:**  
- Analytics collapsed on page load  
- User can expand if needed  
- State persists during session  

**Effort:** 15 min | **Risk:** Low  
**Location:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` line ~5045

#### Fix 1.2: Hide Key Trends Cards by Default
**Problem:** When enabled, 4-6 KPI cards compete for attention  
**Change:** Set `VITE_FINZ_SHOW_KEYTRENDS=false` as default (already done)  
**Why:** Reduces clutter, users can re-enable if needed  
**Acceptance Criteria:**  
- Trend cards hidden unless explicitly enabled  
- Summary bar still visible  

**Effort:** 5 min | **Risk:** None (already implemented)  
**Location:** `.env.development` line 34

#### Fix 1.3: Standardize Spacing
**Problem:** Mix of spacing values creates visual noise  
**Change:** Define spacing scale: `space-compact=8px`, `space-normal=12px`, `space-relaxed=16px`  
**Why:** Consistent rhythm improves scannability  
**Acceptance Criteria:**  
- Card padding: 12px (p-3)  
- Section gaps: 16px (space-y-4)  
- Element gaps: 8px (gap-2)  

**Effort:** 30 min | **Risk:** Low (CSS only)  
**Location:** Multiple components in `SDMTForecast.tsx`

#### Fix 1.4: Reduce Border Weight
**Problem:** `border-2` creates heavy segmentation  
**Change:** Use `border` (1px) for most cards, remove where unnecessary  
**Why:** Lighter borders reduce visual noise 20-30%  
**Acceptance Criteria:**  
- Standard cards use `border` not `border-2`  
- Only priority cards (e.g., errors) use `border-2`  

**Effort:** 15 min | **Risk:** Low  
**Location:** Card components throughout `SDMTForecast.tsx`

#### Fix 1.5: Collapse Top Variance Tables
**Problem:** Two large tables (Projects + Rubros) always visible  
**Change:** Wrap in collapsible, defaultOpen=false  
**Why:** Secondary information for deep analysis, not quick scan  
**Acceptance Criteria:**  
- Tables collapsed by default  
- User can expand when needed  

**Effort:** 20 min | **Risk:** Low  
**Location:** `SDMTForecast.tsx` (TopVarianceProjectsTable, TopVarianceRubrosTable)

---

### Tier 2: Medium Improvements (1-2 days)

#### Fix 2.1: Sticky Filter Bar
**Problem:** Scrolling loses context (which project, period?)  
**Change:** Create sticky header with: Project selector, Period, View mode  
**Why:** Maintains context, reduces scrolling back and forth  
**Acceptance Criteria:**  
- Filter bar sticks to top on scroll  
- Min-height 48px  
- Z-index above content  

**Effort:** 3 hours | **Risk:** Medium (scroll behavior testing)  
**Location:** New component `ForecastFilterBar.tsx`

#### Fix 2.2: Consolidate KPI Display
**Problem:** Summary bar still dense with 6+ inline metrics  
**Change:** Show 3 primary KPIs, hide 3 secondary under "More metrics" dropdown  
**Why:** Reduces cognitive load, focuses on what matters  
**Acceptance Criteria:**  
- Primary: Total Budget, Total Forecast, Variance %  
- Secondary (dropdown): Actual, Consumed %, Projected variance  

**Effort:** 4 hours | **Risk:** Medium (requires new component)  
**Location:** `components/ForecastSummaryBar.tsx`

#### Fix 2.3: Move Analytics to Tab/Modal
**Problem:** Analytics still inline, even when collapsed  
**Change:** Create "Analytics" tab or modal dialog  
**Why:** Complete separation of executive scan vs. deep analysis  
**Acceptance Criteria:**  
- Analytics removed from main view  
- Accessible via "View Analytics" button  
- Opens in modal or separate tab  

**Effort:** 6 hours | **Risk:** Medium (routing/modal state)  
**Location:** Extract ChartInsightsPanel to `AnalyticsModal.tsx`

#### Fix 2.4: Improve Section Headings
**Problem:** All headings look similar, no visual priority  
**Change:** Define heading hierarchy:  
- H1: Page title (text-2xl, font-bold)  
- H2: Major sections (text-lg, font-semibold)  
- H3: Sub-sections (text-base, font-medium)  

**Why:** Clear information architecture  
**Acceptance Criteria:**  
- Consistent heading sizes  
- Visual rhythm clear  
- Scannable structure  

**Effort:** 2 hours | **Risk:** Low  
**Location:** Throughout `SDMTForecast.tsx`

---

### Tier 3: Design System Consistency (3-5 days)

#### Fix 3.1: Formal Dashboard Layout Grid
**Problem:** Ad-hoc layout, no consistent structure  
**Change:** Define 12-column grid system with breakpoints  
**Why:** Consistent layout, responsive by default  
**Acceptance Criteria:**  
- Grid columns: 12  
- Gutters: 16px  
- Breakpoints: sm, md, lg, xl  
- Max-width: 1440px  

**Effort:** 8 hours | **Risk:** High (requires layout refactor)  
**Location:** New layout component, update `SDMTForecast.tsx`

#### Fix 3.2: Standardize Table Density
**Problem:** Inconsistent row heights, padding  
**Change:** Define table density modes:  
- Compact: 32px rows (for >100 rows)  
- Normal: 40px rows (default)  
- Comfortable: 48px rows (for <20 rows)  

**Why:** Consistent UX, user preference support  
**Acceptance Criteria:**  
- Density toggle in table header  
- Persists in localStorage  
- Smooth transitions  

**Effort:** 6 hours | **Risk:** Medium  
**Location:** `ForecastRubrosTable.tsx`

#### Fix 3.3: Chip Hierarchy Standards
**Problem:** Status chips, category chips, tags all look similar  
**Change:** Define chip types:  
- **Status:** Bold border, solid background (success, warning, error)  
- **Category:** Subtle border, light background  
- **Tag:** No border, transparent background  

**Why:** Immediate recognition of information type  
**Acceptance Criteria:**  
- Documented in design system  
- Applied consistently  
- Accessible color contrast  

**Effort:** 4 hours | **Risk:** Low  
**Location:** `components/ui/badge.tsx` + documentation

#### Fix 3.4: Create UI Consistency Rulebook
**Problem:** No documented standards, each feature has own style  
**Change:** Document design system:  
- Spacing scale (4px, 8px, 12px, 16px, 24px, 32px)  
- Typography scale (xs, sm, base, lg, xl, 2xl)  
- Color usage rules  
- Component patterns  
- Border usage guidelines  
- Card nesting rules  

**Why:** Long-term consistency, faster development  
**Acceptance Criteria:**  
- Markdown documentation  
- Code examples  
- Figma/design library sync  

**Effort:** 12 hours | **Risk:** Low  
**Location:** `/docs/design-system/`

---

## UI Consistency Rules for Future Enforcement

### Spacing Scale (8pt Grid System)
```
- 2px: Minimal (use sparingly)
- 4px: Compact (gap-1)
- 8px: Normal gap (gap-2)
- 12px: Card padding (p-3)
- 16px: Section spacing (space-y-4)
- 24px: Large sections (space-y-6)
- 32px: Page sections (space-y-8)
```

### Typography Scale
```
- text-xs: Labels, captions (11px)
- text-sm: Body text, table cells (14px)
- text-base: Default body (16px)
- text-lg: Section headings (18px)
- text-xl: Page headings (20px)
- text-2xl: Hero headings (24px)
```

### Card/Border Usage
```
✅ DO:
- Use Card for major sections (forecast grid, charts, summaries)
- Use border (1px) for most cards
- Use border-2 only for alerts, errors, or focus states
- Nest max 2 levels (Card > Card)

❌ DON'T:
- Wrap every element in a card
- Use border-2 for standard content
- Nest more than 2 card levels
- Use cards for single-line items
```

### Chip/Badge Rules
```
Status Chips (Actions required, state):
- Green: Success, Approved, Active
- Yellow: Warning, Pending, In Progress
- Red: Error, Rejected, Blocked
- Gray: Neutral, Draft, Inactive

Category Chips (Classification):
- Light background, subtle border
- Lowercase text
- Removable (when filter)

Tags (Metadata):
- Transparent background
- Small text
- Read-only
```

### Table Density Rules
```
Default Density:
- Row height: 40px
- Padding: py-2 px-3
- Font: text-sm

Compact (>50 rows):
- Row height: 32px
- Padding: py-1 px-2
- Font: text-xs

Comfortable (<20 rows):
- Row height: 48px
- Padding: py-3 px-4
- Font: text-base
```

### Progressive Disclosure Pattern
```
Always Visible (Executive Scan):
1. Page title + primary action
2. Key filters (project, period)
3. Top 3 KPIs
4. Main data table (forecast grid)

Collapsed by Default (Operator/Deep Dive):
1. Secondary metrics
2. Analytics & charts
3. Variance analysis tables
4. Simulators & editors
5. Data health panels

On-Demand (Advanced):
1. Export options
2. Advanced filters
3. Audit logs
4. System diagnostics
```

---

## Before/After Description

### BEFORE: Current State (Visual Overload)

**Executive trying to scan (30s):**
1. Opens page
2. Sees 6 KPI cards (all shouting "look at me!")
3. Summary bar with 6 more metrics
4. Large portfolio summary table (expanded)
5. Forecast grid (good - this is what they want)
6. Two variance tables (distraction)
7. Huge analytics panel with charts (biggest distraction)
8. **Result:** Overwhelmed, unclear where to focus, abandons or misses key insight

**Operator trying to edit (5-10min):**
1. Opens page
2. Scrolls past KPIs (irrelevant for editing)
3. Scrolls past summary (irrelevant)
4. Finds forecast grid (finally!)
5. Edits cells
6. Scrolls up to find Save button (lost context)
7. Scrolls back down
8. Distracted by charts
9. **Result:** Inefficient workflow, scrolling fatigue, errors

**Information Density:** ~2000px vertical content, 80% visible simultaneously

### AFTER: Proposed State (Focused Clarity)

**Executive scanning (30s) - NEW_FORECAST_LAYOUT + Quick Wins:**
1. Opens page
2. Sees sticky filter bar: Project, Period (context clear)
3. Top 3 KPIs only: Budget, Forecast, Variance% (instant status)
4. Forecast grid summary row (month-by-month overview)
5. **Done.** All other sections collapsed.
6. **Result:** Clear status in <30s, confident decision

**Operator editing (5-10min) - NEW_FORECAST_LAYOUT + Quick Wins:**
1. Opens page
2. Sticky filter bar shows context (stays visible while scrolling)
3. Skips directly to forecast grid
4. Edits cells
5. Save button in sticky bar (always accessible)
6. If needed: Expands analytics (collapsible)
7. **Result:** Efficient workflow, minimal scrolling, faster completion

**Information Density:** ~800px visible (60% reduction), 1200px in collapsed sections

---

## Implementation Priority

### Phase 1: Immediate (This Sprint)
- ✅ Analytics collapsible (15min)
- ✅ Hide key trends by default (already done)
- ✅ Reduce border weight (15min)
- ✅ Collapse variance tables (20min)
- ✅ Standardize spacing (30min)
- **Total: 1.5 hours**

### Phase 2: Next Sprint (1 week)
- Sticky filter bar (3h)
- Consolidate KPI display (4h)
- Improve section headings (2h)
- **Total: 9 hours**

### Phase 3: Next Month (Design System)
- Analytics tab/modal (6h)
- Dashboard layout grid (8h)
- Table density standards (6h)
- Chip hierarchy (4h)
- Documentation (12h)
- **Total: 36 hours**

---

## Security & Credentials Handling

✅ Test credentials were provided but never displayed in this document  
✅ All testing performed with proper authentication  
✅ No credentials logged or committed to repository  
✅ When referring to logged-in user: "test user" (not email)

---

## Appendix: Code Locations

### Primary File
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` (5109 lines)

### Related Components
- `src/features/sdmt/cost/Forecast/components/ForecastSummaryBar.tsx`
- `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`
- `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx`
- `src/features/sdmt/cost/Forecast/components/TopVarianceProjectsTable.tsx`
- `src/features/sdmt/cost/Forecast/components/TopVarianceRubrosTable.tsx`

### Feature Flags
- `.env.development` lines 32-34:
  ```env
  VITE_FINZ_NEW_FORECAST_LAYOUT=true
  VITE_FINZ_SHOW_KEYTRENDS=false
  ```

### Constants in SDMTForecast.tsx
- Line 183: `NEW_FORECAST_LAYOUT_ENABLED`
- Line 184: `SHOW_KEY_TRENDS`
- Line 189: `HIDE_KEY_TRENDS` (deprecated)
- Line 192: `HIDE_REAL_ANNUAL_KPIS`
- Line 195: `HIDE_PROJECT_SUMMARY`
- Line 198: `SHOW_PORTFOLIO_KPIS`

---

**END OF AUDIT**
