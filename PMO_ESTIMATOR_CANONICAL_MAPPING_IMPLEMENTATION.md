# PMO Estimator Canonical Rubro Mapping Implementation

## Overview

This implementation fixes the PMO Estimator to use canonical rubro IDs from the taxonomy and auto-populate descriptions, ensuring proper reconciliation with DynamoDB.

## Problem Statement

Previously, the PMO Estimator was:
- Storing inconsistent rubro IDs (e.g., `"mod-lead-ingeniero-delivery"` instead of canonical `"MOD-LEAD"`)
- Not auto-populating descriptions from the canonical taxonomy
- Missing category information from taxonomy
- Causing reconciliation mismatches in DynamoDB

## Solution

### 1. Core Changes

#### Added `getRubroById` Helper (`src/lib/rubros/taxonomyHelpers.ts`)
```typescript
export function getRubroById(id: string): RubroTaxonomyItem | null
```
- Looks up taxonomy entries by canonical `linea_codigo`
- Returns full taxonomy item with `descripcion`, `categoria`, etc.
- Used for auto-population in UI components

#### Enhanced `mapModRoleToRubroId` (`src/api/helpers/rubros.ts`)
```typescript
export function mapModRoleToRubroId(role: MODRole): string | null
```
- Now ensures canonical ID is returned
- Double-checks via `getCanonicalRubroId()`
- Maps roles like "Ingeniero Delivery" → "MOD-LEAD"

#### Created Normalization Utility (`src/features/pmo/prefactura/Estimator/utils/normalizeEstimates.ts`)
```typescript
export function normalizeLaborEstimate(item: LaborEstimate): NormalizedLaborEstimate
export function normalizeNonLaborEstimate(item: NonLaborEstimate): NormalizedNonLaborEstimate
```
- Normalizes UI state to canonical DB shape before submission
- Populates `line_item_id`, `descripcion`, `categoria`, `rubro_canonical`
- Preserves user overrides

### 2. UI Component Updates

#### LaborStep.tsx
**Changes:**
1. Auto-populate description and category when role is selected
2. Store canonical `rubroId` in state
3. Validate canonical IDs before navigation
4. Normalize data before passing to next step

**Code Flow:**
```typescript
// When user selects role
if (field === "role") {
  const alias = mapModRoleToRubroId(value); // Get canonical ID
  const canonical = getCanonicalRubroId(alias) || alias;
  const tax = getRubroById(canonical); // Fetch taxonomy
  
  // Auto-populate
  updated[index].rubroId = canonical;
  updated[index].description = tax?.descripcion || tax?.linea_gasto;
  updated[index].category = tax?.categoria;
}

// On submit
const normalized = normalizeLaborEstimates(laborEstimates);
setData(normalized);
```

#### NonLaborStep.tsx
**Changes:**
1. Auto-populate description and category when rubro is selected
2. Canonicalize rubroId on selection
3. Validate canonical IDs before navigation
4. Quick-add button uses canonical IDs
5. Normalize data before passing to next step

**Code Flow:**
```typescript
// When user selects rubro
if (field === "rubroId") {
  const canonical = getCanonicalRubroId(value);
  const tax = getRubroById(canonical);
  
  // Auto-populate
  updated[index].rubroId = canonical;
  updated[index].description = tax?.descripcion || tax?.linea_gasto;
  updated[index].category = tax?.categoria;
}

// On submit
const normalized = normalizeNonLaborEstimates(nonLaborEstimates);
setData(normalized);
```

### 3. Data Flow

```
User Action (Select Role/Rubro)
  ↓
mapModRoleToRubroId() / getCanonicalRubroId()
  ↓
Canonical ID (e.g., "MOD-LEAD", "INF-CLOUD")
  ↓
getRubroById()
  ↓
Taxonomy Entry (descripcion, categoria, etc.)
  ↓
Auto-populate UI fields
  ↓
User edits/confirms
  ↓
normalizeLaborEstimate() / normalizeNonLaborEstimate()
  ↓
Normalized Payload with:
  - line_item_id: canonical
  - linea_codigo: canonical
  - descripcion: from taxonomy or user
  - categoria: from taxonomy
  - rubro_canonical: canonical
  ↓
Submit to Server/DynamoDB
```

## Testing

### Unit Tests (`normalizeEstimates.test.ts`)
- ✅ 9 tests covering normalization functions
- Tests canonical ID resolution
- Tests description/category population
- Tests user override preservation
- Tests array handling

### Integration Tests (`canonicalMapping.integration.test.ts`)
- ✅ 12 tests covering end-to-end flows
- Tests role → canonical ID mapping
- Tests taxonomy lookup
- Tests legacy ID resolution
- Tests complete labor/non-labor flows
- Tests validation

**Total: 21 tests, 100% passing**

## Benefits

### 1. Data Consistency
- All rubro IDs are now canonical (e.g., `"MOD-LEAD"` not `"mod-lead-ingeniero"`)
- DynamoDB receives consistent `line_item_id` values
- Reconciliation module can match invoice/allocation rows to forecast

### 2. Improved UX
- Descriptions auto-populate from taxonomy
- Categories auto-populate from taxonomy
- Less manual data entry
- Fewer errors

### 3. Maintainability
- Single source of truth: `data/rubros.taxonomy.json`
- Clear normalization logic in one place
- Easy to add new rubros to taxonomy
- Clear mapping from roles to canonical IDs

### 4. Backward Compatibility
- Legacy IDs still resolve to canonical (via `getCanonicalRubroId`)
- Existing data continues to work
- Migration path for old entries

## Files Changed

### Core Logic
1. `src/lib/rubros/taxonomyHelpers.ts` - Added `getRubroById()`
2. `src/api/helpers/rubros.ts` - Enhanced `mapModRoleToRubroId()`
3. `src/features/pmo/prefactura/Estimator/utils/normalizeEstimates.ts` - New normalization utility

### UI Components
4. `src/features/pmo/prefactura/Estimator/steps/LaborStep.tsx` - Auto-populate & normalize
5. `src/features/pmo/prefactura/Estimator/steps/NonLaborStep.tsx` - Auto-populate & normalize

### Tests
6. `src/features/pmo/prefactura/Estimator/__tests__/normalizeEstimates.test.ts` - Unit tests
7. `src/features/pmo/prefactura/Estimator/__tests__/canonicalMapping.integration.test.ts` - Integration tests

## Usage Example

### Labor Estimate
```typescript
// User selects "Ingeniero Delivery" role
// Component automatically:
// 1. Sets rubroId = "MOD-LEAD" (canonical)
// 2. Sets description = "Ingeniero de Delivery / Líder Técnico"
// 3. Sets category = "Mano de Obra Directa"

// On submit, normalized payload:
{
  rubroId: "MOD-LEAD",
  role: "Ingeniero Delivery",
  description: "Ingeniero de Delivery / Líder Técnico",
  category: "Mano de Obra Directa",
  // ... other fields ...
  
  // Added by normalization:
  line_item_id: "MOD-LEAD",
  linea_codigo: "MOD-LEAD",
  descripcion: "Ingeniero de Delivery / Líder Técnico",
  categoria: "Mano de Obra Directa",
  rubro_canonical: "MOD-LEAD"
}
```

### Non-Labor Estimate
```typescript
// User selects "Infraestructura Cloud AWS" rubro
// Component automatically:
// 1. Sets rubroId = "INF-CLOUD" (canonical)
// 2. Sets description = "Servicios de nube AWS/Azure/GCP"
// 3. Sets category = "Infraestructura Nube & Data Center"

// On submit, normalized payload:
{
  rubroId: "INF-CLOUD",
  description: "Servicios de nube AWS/Azure/GCP",
  category: "Infraestructura Nube & Data Center",
  // ... other fields ...
  
  // Added by normalization:
  line_item_id: "INF-CLOUD",
  descripcion: "Servicios de nube AWS/Azure/GCP",
  categoria: "Infraestructura Nube & Data Center",
  rubro_canonical: "INF-CLOUD"
}
```

## Deployment Notes

1. **No database migration required** - Changes only affect new data
2. **Backward compatible** - Existing data continues to work via legacy ID resolution
3. **No breaking API changes** - Server already expects canonical IDs
4. **Frontend-only changes** - No backend deployment needed

## Future Improvements

1. Add suggested hourly rates to taxonomy and auto-populate
2. Add validation messages in UI for invalid rubros
3. Add visual indicator showing when fields are auto-populated
4. Add ability to manually override auto-populated values with visual diff
5. Add analytics to track which rubros are most commonly used

## Related Documentation

- Canonical Taxonomy: `data/rubros.taxonomy.json`
- Taxonomy Helpers: `src/lib/rubros/taxonomyHelpers.ts`
- Canonical Mapping: `src/lib/rubros/canonical-taxonomy.ts`
- Reconciliation: See reconciliation module docs
