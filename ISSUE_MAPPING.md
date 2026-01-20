# Issue-to-Fix Mapping: Invoice-Forecast Joining & PMO Mapping

This document maps each symptom described in the problem statement to the specific code changes that address it.

## Screenshot Set 1: Desglose Mensual vs Presupuesto with Real = $0

### Symptom
- Grid loads but the **Real** column shows `$0` on all rows
- Forecast and Planned columns populate correctly but actuals are missing

### Root Cause
- `computeForecastFromAllocations` intentionally sets `actual: 0` when creating fallback forecast cells
- Invoice matching in `matchInvoiceToCell` was too naive:
  - Only exact equality checks (no canonicalization)
  - No month format normalization
  - No projectId validation
  - Missing legacy alias support

### Fixes Applied

#### File: `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts`

1. **Enhanced `matchInvoiceToCell` function** (lines 129-184):
   - Added projectId guard to prevent cross-project matching
   - Canonicalize line_item_id using `normalizeRubroId` before comparison
   - Use `getCanonicalRubroId` to map legacy rubroIds (e.g., `mod-pm-project-manager` → `MOD-LEAD`)
   - Added taxonomy lookup fallback via `lookupTaxonomyCanonical`
   - Kept normalized description matching as final fallback

2. **Enhanced `normalizeInvoiceMonth` function** (lines 100-124):
   - Added support for M\d+ formats: `M1`, `M11`, `M12`, `m11`
   - Case-insensitive matching
   - Handles whitespace: `M 11` → `11`
   - Validates month range (1-60)

3. **New invoice joining logic** (lines 567-625):
   ```typescript
   // Fetch invoices for the project
   const invoices = await getProjectInvoices(projectId === 'ALL_PROJECTS' ? undefined : projectId);
   
   // Filter to valid statuses
   const validInvoices = invoices.filter((inv) => 
     VALID_INVOICE_STATUSES.includes((inv.status || 'matched').toLowerCase())
   );
   
   // Apply invoices to rows
   for (const inv of validInvoices) {
     for (const row of rows) {
       if (matchInvoiceToCell(inv, row, taxonomyMap, taxonomyCache)) {
         if (invMonth > 0 && row.month === invMonth) {
           row.actual = (row.actual || 0) + normalizeInvoiceAmount(inv);
           matchedInvoicesCount++;
         }
       }
     }
   }
   ```

4. **Helper functions for normalization** (lines 87-110):
   - `normalizeInvoiceAmount(invoice)` - handles `amount || total || monto`
   - `getInvoiceMonth(invoice)` - handles `month || calendar_month || period || periodKey`

5. **Diagnostic logging** (lines 571, 581, 617):
   - Logs invoice retrieval count
   - Logs valid invoice count with status filter details
   - Logs matched vs unmatched invoice summary

### Expected Result After Fix
- **Real** column will show non-zero values where invoices exist and match forecast rows
- Console will show: `"Invoice matching complete: X matched, Y unmatched"`
- Invoices with legacy rubro IDs like `mod-pm-project-manager` will match cells with canonical `MOD-LEAD`

---

## Screenshot Set 2: Charts + Tendencia Mensual with Real Series Flat at Zero

### Symptom
- Charts show Forecast/Planned series correctly
- **Real** series is completely flat at zero (no actuals data)

### Root Cause
- Same as Screenshot Set 1
- Charts consume `forecastRows` data which had `actual: 0` due to failed invoice matching

### Fixes Applied
- Same invoice joining fixes as Screenshot Set 1
- The chart components use the same `forecastRows` data that now includes properly matched actuals

### Expected Result After Fix
- Real series in charts will show actual spending patterns
- Line chart will display three distinct series: Planned, Forecast, and Real
- Bar charts will show actual values alongside forecast values

---

## Screenshot Set 3: Monitoreo Mensual - "No hay datos" for ALL_PROJECTS

### Symptom
- Grid shows: "No hay datos de pronóstico disponibles aún para TODOS (Todos los proyectos). Project ID: ALL_PROJECTS"
- Single project view works but aggregated view fails

### Root Cause
- `computeForecastFromAllocations` has a guard that returns `[]` when `resolvedProjectId` is not found
- For `ALL_PROJECTS`, the function couldn't resolve to a single projectId and bailed early
- The fallback logic expected a single project but received aggregation request

### Fixes Applied

#### File: `src/features/sdmt/cost/Forecast/computeForecastFromAllocations.ts`

**Lines 105-119**: Updated projectId resolution logic:
```typescript
const resolvedProjectId =
  projectId ||
  allocations.find((alloc) => alloc.projectId)?.projectId ||
  rubroWithProject?.projectId ||
  'ALL_PROJECTS'; // Allow ALL_PROJECTS as fallback

// Note: We now allow 'ALL_PROJECTS' as a valid projectId for aggregated views
if (!resolvedProjectId && projectId !== 'ALL_PROJECTS') {
  console.warn(
    "[computeForecastFromAllocations] Missing projectId; cannot build fallback forecast rows."
  );
  return [];
}
```

**Key changes:**
1. Added `'ALL_PROJECTS'` as a valid fallback value
2. Modified the guard to only reject when BOTH `resolvedProjectId` is falsy AND `projectId !== 'ALL_PROJECTS'`
3. This allows the function to proceed with aggregated data

#### File: `src/features/sdmt/cost/Forecast/useSDMTForecastData.ts`

**Line 567**: Updated invoice fetching to support ALL_PROJECTS:
```typescript
const invoices = await getProjectInvoices(
  projectId === 'ALL_PROJECTS' ? undefined : projectId
);
```

### Expected Result After Fix
- ALL_PROJECTS view will show aggregated forecast data across all projects
- Grid will populate with summed forecast rows by rubro + month
- No more "No hay datos" message for TODOS view
- Console will show: `"Generated X forecast cells from allocations"` even for ALL_PROJECTS

---

## Screenshot Set 4: Table Showing `mod-pm-project-manager` and `mod-lead-ingeniero-delivery`

### Symptom
- Rows display raw legacy rubro IDs like:
  - `mod-pm-project-manager` (should be `MOD-LEAD`)
  - `mod-lead-ingeniero-delivery` (should be `MOD-LEAD`)
- These appear as "Unknown" rubros with taxonomy warnings in console

### Root Cause
- Server PMO Estimator mapped `'Project Manager'` role to `'MOD-PM'`
- Client also had `'Project Manager': 'MOD-PM'` mapping
- But `MOD-PM` doesn't exist in canonical taxonomy (should be `MOD-LEAD`)
- No legacy alias existed to remap `MOD-PM` → `MOD-LEAD`
- Materialized baselines stored `MOD-PM`, causing mismatches

### Fixes Applied

#### File: `services/finanzas-api/src/lib/rubros-taxonomy.ts`

**Line 30**: Changed server MOD role mapping:
```typescript
const MOD_ROLE_TO_LINEA_CODIGO: Record<MODRole, string> = {
  'Ingeniero Delivery': 'MOD-LEAD',
  'Ingeniero Soporte N1': 'MOD-ING',
  'Ingeniero Soporte N2': 'MOD-ING',
  'Ingeniero Soporte N3': 'MOD-ING',
  'Service Delivery Manager': 'MOD-SDM',
  'Project Manager': 'MOD-LEAD', // Changed from MOD-PM
};
```

#### File: `src/api/helpers/rubros.ts`

**Line 58**: Changed client MOD role mapping:
```typescript
const MOD_ROLE_TO_LINEA_CODIGO: Record<MODRole, string> = {
  'Ingeniero Delivery': 'MOD-LEAD',
  'Ingeniero Soporte N1': 'MOD-ING',
  'Ingeniero Soporte N2': 'MOD-ING',
  'Ingeniero Soporte N3': 'MOD-ING',
  'Service Delivery Manager': 'MOD-SDM',
  'Project Manager': 'MOD-LEAD', // Changed from MOD-PM
};
```

#### File: `services/finanzas-api/src/lib/canonical-taxonomy.ts`

**Lines 154-156**: Added legacy aliases:
```typescript
'project-manager': 'MOD-LEAD',
'MOD-PM': 'MOD-LEAD', // Legacy server-generated MOD-PM mapping
'mod-pm': 'MOD-LEAD', // Lowercase variant
```

**Note**: The client already had these in `src/lib/rubros/canonical-taxonomy.ts`:
```typescript
'project-manager': 'MOD-LEAD',
'mod-pm-project-manager': 'MOD-LEAD',
```

### Expected Result After Fix
- New baselines created via PMO Estimator will use `MOD-LEAD` directly
- Existing rows with `MOD-PM` will be automatically remapped to `MOD-LEAD` on read
- Console warnings like `"Unknown rubro_id: mod-pm-project-manager"` will disappear
- UI will display canonical names: "Ingeniero líder / coordinador" instead of raw aliases

---

## Common Issues Across All Screenshots

### Month Format Mismatches

**Problem**: Invoices use various month formats:
- YYYY-MM: `"2026-11"`, `"2025-03"`
- M\d+: `"M11"`, `"M1"`, `"m12"`
- Numeric: `11`, `"11"`

**Fix**: Enhanced `normalizeInvoiceMonth` to handle all formats:
```typescript
// Try M\d+ format (M1, M11, M12, m11, etc.)
const mMatch = invoiceMonth.match(/^m\s*0?(\d{1,2})$/i);
if (mMatch) {
  const mm = parseInt(mMatch[1], 10);
  if (mm >= 1 && mm <= 60) return mm;
}
```

### Legacy Rubro ID Mismatches

**Problem**: Database stores various legacy formats:
- `mod-pm-project-manager`
- `mod-lead-ingeniero-delivery`
- `project-manager`
- `MOD-PM`

**Fix**: Multi-layer canonicalization:
1. `normalizeRubroId` - removes prefixes (RUBRO#, LINEITEM#)
2. `getCanonicalRubroId` - maps legacy IDs via LEGACY_RUBRO_ID_MAP
3. `lookupTaxonomyCanonical` - fuzzy matching with taxonomy cache

---

## Testing Coverage

### New Tests Added

#### File: `src/features/sdmt/cost/Forecast/__tests__/normalizeInvoiceMonth.test.ts`
- M\d+ format parsing (M1, M11, M12, m11)
- Case-insensitive matching
- Whitespace handling
- Extended month ranges (13-60)

#### File: `src/features/sdmt/cost/Forecast/__tests__/invoiceMatching.test.ts`
- projectId guard tests (reject when different)
- Canonical rubroId matching (MOD-ING)
- Enhanced description matching
- Priority order verification

---

## Validation Checklist

After deploying these changes, verify:

### Single Project View
- [ ] Real column shows non-zero values
- [ ] Charts display Real series (not flat)
- [ ] Console shows: "Invoice matching complete: X matched, Y unmatched"
- [ ] Fewer taxonomy warnings in console

### ALL_PROJECTS View
- [ ] Grid loads with aggregated data
- [ ] No "No hay datos" message
- [ ] Real column aggregates correctly
- [ ] Console shows allocation processing logs

### PMO Estimator
- [ ] New baselines use MOD-LEAD for Project Manager role
- [ ] Existing baselines with MOD-PM are remapped on read
- [ ] No unknown rubro warnings for project manager entries

### Invoice Matching
- [ ] Invoices with M11, M12 formats match correctly
- [ ] Legacy rubro IDs match canonical cells
- [ ] Cross-project invoices don't match (projectId guard works)
- [ ] Only valid invoice statuses are counted
