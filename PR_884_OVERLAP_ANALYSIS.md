# PR #884 Feature Overlap Analysis

## Context

This document tracks the implementation status of features from PR #884 to avoid duplication and ensure proper integration.

**PR #884 Status:** Open, not yet merged
**PR #884 Features:**
1. Executive summary
2. Cost-type filter (Labor/Non-Labor/Ambos)
3. Catalog navigation
4. Two-zone header to MonthlySnapshotGrid

## Current Implementation Status

### ✅ Already Implemented in This PR

#### 1. Catalog Navigation
**Status:** ✅ IMPLEMENTED in commit `1965a2c`

**Implementation Details:**
- Added `onNavigateToCostCatalog` prop to `MonthlySnapshotGrid`
- Added handler: `handleNavigateToCostCatalog(row)`
- Added UI button with FolderTree icon in actions column
- Wired to SDMTForecast to navigate to `/sdmt/cost/catalog?projectId=X&rubroId=Y`

**Files Changed:**
- `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Potential Conflict:** If PR #884 also implements this, we may have duplicate code.

#### 2. Executive Summary (5 KPI Cards)
**Status:** ✅ ALREADY EXISTS in base MonthlySnapshotGrid

**Existing Implementation:**
- MonthlySnapshotSummary component shows 5 KPI cards when collapsed:
  - Budget
  - Forecast  
  - Real (Actual)
  - % Consumo
  - Var vs Presupuesto
- Toggle between collapsed summary and expanded detail grid

**Note:** This was already in the codebase before PR #884, so likely not a conflict.

### ❌ NOT Yet Implemented

#### 3. Cost-Type Filter (Labor/Non-Labor/Ambos)
**Status:** ❌ NOT IMPLEMENTED

**What's Needed:**
- Add filter state for cost type: `'labor' | 'non-labor' | 'ambos'`
- Add UI toggle/select for filter (likely radio buttons or tabs)
- Filter `forecastData` based on line item categories
  - Labor: Filter to labor-related categories
  - Non-Labor: Filter to non-labor categories
  - Ambos: Show all (default)
- Recalculate summary metrics based on filtered data
- Ensure filter persists across persona modes

**Where to Implement:**
- `MonthlySnapshotGrid.tsx` - Add filter state and UI
- Filter logic in `snapshotRows` useMemo
- Update summary calculations to use filtered data

**Action:** Wait for PR #884 to see their implementation, or implement if needed.

#### 4. Two-Zone Header
**Status:** ❌ NOT CLEAR / NOT IMPLEMENTED

**Current Header:**
```tsx
<CardHeader className="pb-3">
  <div className="flex items-center justify-between flex-wrap gap-3">
    <div className="flex items-center gap-3">
      <CardTitle>Matriz del Mes — Vista Ejecutiva</CardTitle>
      <Badge>M{actualMonthIndex}</Badge>
    </div>
    <Button onClick={toggleCollapsed}>...</Button>
  </div>
</CardHeader>
```

**Unclear:** What does "two-zone header" mean?
- Zone 1: Title + metadata?
- Zone 2: Actions/controls?
- Or: Header + sub-header?

**Action:** Review PR #884 to understand the two-zone header design.

## Recommendations

### Option 1: Wait for PR #884 to Merge First (Recommended)
**Pros:**
- Avoid duplicate work on cost-type filter
- Avoid conflicts in catalog navigation implementation
- Understand two-zone header requirements
- Cleaner merge history

**Cons:**
- Delays delivery of persona features

**Action Plan:**
1. Coordinate with PR #884 author
2. Let them merge first
3. Rebase this PR on top of #884
4. Remove duplicate catalog navigation if needed
5. Focus on persona integration only

### Option 2: Continue with This PR, Coordinate Later
**Pros:**
- Deliver persona features sooner
- Catalog navigation is already working

**Cons:**
- May need to refactor catalog navigation later
- Need to manually add cost-type filter
- Potential merge conflicts

**Action Plan:**
1. Merge this PR with catalog navigation
2. When PR #884 merges, handle conflicts:
   - Keep their catalog navigation if different
   - Adopt their cost-type filter implementation
   - Integrate two-zone header
3. Test persona defaults with PR #884 features

### Option 3: Implement Missing Features from PR #884 Now
**Pros:**
- Complete feature parity
- No waiting for other PR

**Cons:**
- Risk of different implementation approach
- Wasted effort if PR #884 has better implementation
- More complex merge later

**Not Recommended** - Better to coordinate or wait.

## My Implementation Summary

### What I've Added (Persona Features - PR #883 Equivalent)
1. ✅ PersonaContext (SDM vs Gerente)
2. ✅ PersonaTabs UI component
3. ✅ Persona-based defaults for collapsible sections
4. ✅ Integration with App.tsx
5. ✅ Tests for PersonaTabs
6. ✅ Documentation

### What I've Added (PR #884 Overlap)
1. ✅ Catalog navigation (`onNavigateToCostCatalog`)

### What I Haven't Added (PR #884 Features)
1. ❌ Cost-type filter (Labor/Non-Labor/Ambos)
2. ❌ Two-zone header (unclear requirements)

## Suggested Next Steps

1. **Reach out to PR #884 author** to coordinate merge strategy
2. **Review PR #884 branch** (if accessible) to understand:
   - Cost-type filter implementation details
   - Two-zone header design
   - Catalog navigation approach (compare with mine)
3. **Decide on merge order:**
   - **Recommended:** #884 merges first → this PR rebases and integrates
   - **Alternative:** This PR merges first → #884 rebases (may require more work on their side)
4. **Document the merge strategy** in the PR description

## Files That May Have Merge Conflicts

If both PRs modify these files:
- `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx` ⚠️ HIGH RISK
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` ⚠️ MEDIUM RISK

My changes:
- MonthlySnapshotGrid: Added `defaultCollapsed` prop, `onNavigateToCostCatalog` prop, catalog button
- SDMTForecast: Added `usePersona()` hook, PersonaTabs, catalog navigation handler

## Questions for PR #884 Author

1. What is the "two-zone header" design?
2. How is the cost-type filter implemented?
3. What's the catalog navigation approach? (Compare with my implementation)
4. Should we merge #884 first, or can we coordinate on features?
5. Are there any other features in #884 not mentioned in the problem statement?
