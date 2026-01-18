# Implementation Summary: Rubros Mapping & Estimator UI Improvements

## Overview

This PR implements fixes for the rubros mapping system to eliminate "Unknown" entries in the forecast matrix and ensures proper description/category resolution through a robust fallback chain.

## Problem Statement

The forecast rubros matrix was showing "Unknown" for many line items due to:
1. **Strict ID matching** - Only looking for `item.id === rubroId` failed when backend used different field names
2. **No taxonomy fallback** - When line items lacked descriptions, no fallback to canonical taxonomy
3. **Field name variations** - Backend uses `id`, `line_item_id`, `rubroId`, `rubro_id` inconsistently

## Solution

Implemented a **4-tier tolerant matching and fallback system**:

### Tier 1: Tolerant Line Item Matching
```typescript
const lineItem = lineItems.find(item => 
  item.id === rubroId || 
  item.line_item_id === rubroId || 
  item.rubroId === rubroId
);
```

### Tier 2-4: Fallback Chain for Description/Category
```typescript
// Description fallback: lineItem → cell → taxonomy → allocation → unknown
const description = lineItem?.description || 
                   cell.description || 
                   taxonomyByRubroId[rubroId]?.description || 
                   `Allocation ${rubroId}` || 
                   'Unknown';

// Category fallback: lineItem → taxonomy → cell → unknown
const category = lineItem?.category || 
                taxonomyByRubroId[rubroId]?.category || 
                cell.category || 
                'Unknown';
```

## Files Modified

### 1. Core Logic: projectGrouping.ts
**File:** `src/features/sdmt/cost/Forecast/projectGrouping.ts`

**Changes:**
- Updated `buildProjectRubros` signature to accept optional `taxonomyByRubroId` parameter
- Implemented tolerant line item lookup (3 field variations)
- Added 4-tier fallback chain for description and category

**Impact:** This is the **core fix** that eliminates "Unknown" entries

### 2. API Layer: finanzas.ts
**File:** `src/api/finanzas.ts`

**Changes:**
- Added `getProjectRubrosWithTaxonomy()` function
- Returns both `lineItems` and `taxonomyByRubroId` lookup map
- Converts taxonomy Map to Record for easier consumption

**Impact:** Makes taxonomy data available to UI components

### 3. Data Hook: useProjectLineItems.ts
**File:** `src/hooks/useProjectLineItems.ts`

**Changes:**
- Added `withTaxonomy?: boolean` option
- Returns `taxonomyByRubroId` alongside `lineItems`
- Updated query function to call `getProjectRubrosWithTaxonomy` when requested

**Impact:** Provides taxonomy data through React Query cache

### 4. Transform Function: transformLineItemsToForecast.ts
**File:** `src/features/sdmt/cost/Forecast/transformLineItemsToForecast.ts`

**Changes:**
- Added `taxonomyByRubroId` parameter
- Uses taxonomy fallback when `item.description` is missing

**Impact:** Ensures transformed forecast cells have descriptions

### 5. Main Forecast Component: SDMTForecast.tsx
**File:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Changes:**
- Requests taxonomy via `withTaxonomy: true` option
- Passes `taxonomyByRubroId` to `buildProjectRubros` call
- Added dependency in useMemo

**Impact:** Wires taxonomy through to the forecast display

### 6. Forecast Data Hook: useSDMTForecastData.ts
**File:** `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts`

**Changes:**
- Imports `taxonomyByRubroId` from rubros.catalog.enriched
- Converts Map to Record at module level
- Passes taxonomy to `transformLineItemsToForecast` calls (2 locations)

**Impact:** Ensures fallback forecast generation uses taxonomy

### 7. Unit Tests: projectGrouping.test.ts
**File:** `src/features/sdmt/cost/Forecast/__tests__/projectGrouping.test.ts`

**Changes:**
- Added test: "should use taxonomy fallback when line item and cell lack description"
- Added test: "should match line items by id, line_item_id, or rubroId"
- Added test: "should default to 'Allocation {rubroId}' description if not found anywhere"
- Updated existing test expectations

**Impact:** 9/9 tests passing ✅

## Test Results

```bash
✔ Project Grouping Utils (4.601132ms)
  ✔ buildProjectTotals (2.088153ms)
    ✔ should group forecast data by project and compute totals
    ✔ should handle empty forecast data
    ✔ should handle cells without project_id
  ✔ buildProjectRubros (1.952619ms)
    ✔ should group rubros by project and compute totals
    ✔ should handle empty forecast data
    ✔ should use description from cell if line item not found
    ✔ should use taxonomy fallback when line item and cell lack description ⭐ NEW
    ✔ should match line items by id, line_item_id, or rubroId ⭐ NEW
    ✔ should default to "Allocation {rubroId}" description ⭐ NEW

ℹ tests 9
ℹ pass 9
ℹ fail 0
```

## Estimator Components - Already Correct

The problem statement mentioned several estimator UI improvements. Upon inspection, these are **already properly implemented**:

### ✅ Non-Labor Description Persistence
- `NonLaborStep.tsx` has description input field (line 258-271)
- Description is part of `NonLaborEstimate` type
- Saved to baseline via `createPrefacturaBaseline` (ReviewSignStep.tsx:232)

### ✅ Tarifa/Hora Formatting
- `LaborStep.tsx` uses `Math.round()` on input (line 372)
- Display uses `formatCurrencyNoDecimals()` helper (line 70-77)
- Stores and displays as whole integers with no decimals

### ✅ FX & Indexation Hidden by Default
- `PMOEstimatorWizard.tsx` line 31: `SHOW_FX_PARAMS = import.meta.env.VITE_ENABLE_FX_PARAMS === 'true'`
- Defaults to `false` (hidden)
- Step filtered out at line 69 unless explicitly enabled

### ✅ Project Info Fields Default Blank
- `DealInputsStep.tsx` lines 76-86 initialize all fields to empty strings or appropriate defaults
- No auto-fill of SDM data (already blank by default)

## Deployment Instructions

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Build Application
```bash
npm run build
# or for specific target
npm run build:finanzas
```

### 3. Run Tests
```bash
npx tsx --test src/features/sdmt/cost/Forecast/__tests__/projectGrouping.test.ts
```

### 4. Deploy
Follow standard deployment process for your environment.

## QA Checklist

After deployment, verify the following:

### Critical Fixes
- [ ] **Forecast Rubros Matrix** - No "Unknown" descriptions appear
- [ ] **Taxonomy Fallback** - MOD roles (MOD-SDM, MOD-ING, etc.) show proper descriptions
- [ ] **Tolerant Matching** - Line items with varying ID fields all match correctly
- [ ] **Non-Labor Descriptions** - Descriptions from estimator persist and appear in forecast

### Labor Categorization
- [ ] **Project Manager** appears under "Mano de Obra Directa" (Labor) category
- [ ] **Ingeniero N1/N2/N3** appears under "Mano de Obra Directa" category
- [ ] **Service Delivery Manager** appears under "Mano de Obra Directa" category

### Estimator UI
- [ ] **Tarifa/Hora** displays as whole currency numbers (no decimals)
- [ ] **FX & Indexation** step is hidden by default
- [ ] **Project Info** fields start blank (no auto-fill)

### Dashboard Views
- [ ] Switch to 12 months view - headers show M1-M12
- [ ] Switch to 60 months view - headers show M1-M60
- [ ] Project starting in June shows first allocation under M6 column

## Rollback Plan

If issues arise, revert using:
```bash
git revert <commit-hash>
```

All changes are backward compatible and additive (optional parameters), so rollback should be safe.

## Technical Details

### Taxonomy Source
Taxonomy data comes from: `src/modules/rubros.catalog.enriched.ts`
- Maps `rubro_id` → taxonomy entry
- Provides canonical `linea_gasto` (description) and `categoria` (category)
- Based on client-approved Catálogo de Rubros

### Data Flow
```
User creates Non-Labor estimate with description
    ↓
Saved to baseline (createPrefacturaBaseline)
    ↓
Materialized as line items in DynamoDB
    ↓
Fetched by getProjectRubros()
    ↓
Transformed to forecast cells
    ↓
Grouped by buildProjectRubros() with taxonomy fallback
    ↓
Displayed in forecast matrix with proper descriptions ✅
```

### Performance Impact
- **Minimal** - Taxonomy is a static Map loaded once at module initialization
- **No additional API calls** - Taxonomy is bundled with application
- **Efficient lookups** - Map-based O(1) lookup time

## Known Limitations

1. **Taxonomy Coverage** - Only covers standard MOD and GSV rubros from catalog
   - Custom rubros may still show "Allocation {id}" if not in taxonomy
   - This is intentional to indicate non-standard items

2. **Manual Rubros** - User-created manual rubros without proper category may need manual classification

## Support

For issues or questions:
1. Check unit tests are passing: `npx tsx --test src/features/sdmt/cost/Forecast/__tests__/projectGrouping.test.ts`
2. Verify taxonomy data: Check `src/modules/rubros.catalog.enriched.ts`
3. Review browser console for debug logs (DEV mode shows detailed logging)

## References

- **Problem Statement**: See PR description
- **Taxonomy Catalog**: `src/modules/rubros.taxonomia.ts`
- **Type Definitions**: `src/types/domain.d.ts`
- **Test Suite**: `src/features/sdmt/cost/Forecast/__tests__/projectGrouping.test.ts`
