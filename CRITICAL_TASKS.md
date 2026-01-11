# Critical Implementation Tasks - SDMT Forecast Fix

## Summary
This document captures the minimal, surgical changes needed to fix the critical production issues in SDMT Forecast as specified in the problem statement.

## Task 1: Enhanced Rubros Fallback (CRITICAL)

### Current Behavior
- `loadSingleProjectForecast` uses `safeLineItems` from `useProjectLineItems` hook as fallback
- Fallback is basic: just transforms line items to forecast

### Required Behavior (from problem statement)
1. Fetch baseline details: `GET /baselines/:id`
2. Fetch rubros: `GET /projects/:projectId/rubros?baselineId=...`
3. If rubros.length == 0:
   - Fetch allocations: `GET /allocations?project_id=&baseline_id=`
   - Fetch prefacturas: `GET /prefacturas?projectId=&baselineId=`
   - Materialize using `rubrosFromAllocations(allocations, prefacturas)`
   - Set source flag on items
4. Compute FTE from `baseline.labor_estimates.reduce((s, l) => s + (l.fte_count || 0), 0)`

### Implementation Location
**File**: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
**Function**: `loadSingleProjectForecast` (lines 510-611)

### Changes Needed

#### Step 1: Add baseline state
```typescript
// Add after line 145 (other state declarations)
const [baselineDetail, setBaselineDetail] = useState<BaselineDetail | null>(null);
const [totalFTE, setTotalFTE] = useState<number>(0);
```

#### Step 2: Modify loadSingleProjectForecast
Replace current implementation with the pattern from problem statement:

```typescript
const loadSingleProjectForecast = async (projectId: string, months: number, requestKey: string) => {
  const abort = abortControllerRef.current;
  if (!abort) return;

  try {
    // Step 1: Fetch baseline first
    const baselineId = currentProject?.baselineId;
    if (!baselineId) {
      console.warn('[SDMTForecast] No baseline ID for project', projectId);
      // Fall back to old behavior
      const payload = await getForecastPayload(projectId, months);
      // ... existing logic
      return;
    }

    const baseline = await getBaselineById(baselineId);
    if (latestRequestKeyRef.current !== requestKey) return;
    
    setBaselineDetail(baseline);
    
    // Step 2: Compute FTE from baseline.labor_estimates
    const ftes = (baseline?.labor_estimates || []).reduce(
      (s, l) => s + Number(l.fte_count || l.fte || 0), 
      0
    );
    setTotalFTE(ftes);
    
    // Step 3: Fetch rubros
    const rubros = await finanzasClient.getRubrosForBaseline(projectId, baselineId, {
      signal: abort.signal
    });
    if (latestRequestKeyRef.current !== requestKey) return;
    
    // Step 4: If rubros empty, fallback to allocations + prefacturas
    let finalRubros = rubros;
    let rubroSource: 'api' | 'fallback' = 'api';
    
    if (rubros.length === 0) {
      const [allocResult, prefResult] = await Promise.allSettled([
        finanzasClient.getAllocationsForBaseline(projectId, baselineId, { signal: abort.signal }),
        finanzasClient.getPrefacturasForBaseline(projectId, baselineId, { signal: abort.signal })
      ]);
      
      if (latestRequestKeyRef.current !== requestKey) return;
      
      const allocations = allocResult.status === 'fulfilled' ? allocResult.value : [];
      const prefacturas = prefResult.status === 'fulfilled' ? prefResult.value : [];
      
      const materialized = rubrosFromAllocations(allocations, prefacturas);
      finalRubros = materialized;
      rubroSource = 'fallback';
      
      if (import.meta.env.DEV) {
        console.debug('[SDMTForecast] Using fallback rubros', {
          allocations: allocations.length,
          prefacturas: prefacturas.length,
          materialized: materialized.length
        });
      }
    }
    
    // Step 5: Transform to forecast (existing logic adapted)
    const normalized = transformLineItemsToForecast(finalRubros, months, projectId);
    setDataSource(rubroSource === 'fallback' ? 'mock' : 'api');
    
    // Step 6: Fetch invoices and merge actuals (existing logic)
    const invoices = await getProjectInvoices(projectId);
    if (latestRequestKeyRef.current !== requestKey) return;
    
    const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');
    const updatedData: ForecastRow[] = normalized.map(cell => {
      const matchedInvoice = matchedInvoices.find(inv =>
        inv.line_item_id === cell.line_item_id && inv.month === cell.month
      );
      return {
        ...cell,
        actual: matchedInvoice?.amount || cell.actual || 0,
        variance: cell.forecast - cell.planned,
        projectId,
        projectName: currentProject?.name,
      };
    });
    
    if (latestRequestKeyRef.current !== requestKey) return;
    setForecastData(updatedData);
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    throw error;
  }
};
```

#### Step 3: Add imports
```typescript
// Add to existing imports at top of file
import { getBaselineById, type BaselineDetail } from '@/api/finanzas';
import finanzasClient from '@/api/finanzasClient';
import { rubrosFromAllocations } from '@/utils/rubrosFromAllocations';
```

#### Step 4: Add source badge to UI
In the forecast grid table cell rendering (around lines 2970-3095), add source badge:

```typescript
{lineItem.description}
{/* Add source badge if from fallback */}
{lineItem.source && lineItem.source !== 'api' && (
  <Badge variant="outline" className="text-[10px] ml-2">
    {lineItem.source}
  </Badge>
)}
```

## Task 2: Update PMOBaselinesQueuePage (ENHANCEMENT)

### Current State
Basic table with project name, client, baseline status

### Required Additions
- Column: Accepted/Rejected By (string)
- Column: Rubros Count (labor + non-labor)  
- Column: Accepted/Rejected At (datetime)
- Sort controls: Status, Date, Rubros
- "View Rubros" link → opens Cost Structure page

### Implementation
**File**: `src/features/pmo/baselines/PMOBaselinesQueuePage.tsx`

Already partially implemented. Need to add:
1. Sorting by rubros_count
2. Accepted/rejected by and timestamp columns
3. View Rubros link

## Task 3: Add Baseline Details Panel to ProjectDetails

### Required
- "Valores Originales del Baseline" panel
- Show `baseline.labor_estimates` table
- Show `baseline.non_labor_estimates` table
- Display Accepted by/at
- Add "Materializar Ahora" button → calls `POST /baselines/materialize`

### Implementation
**File**: `src/features/pmo/projects/ProjectDetails.tsx` or equivalent

Need to locate the file first and add the panel.

## Implementation Order

1. ✅ Create utilities and API client methods (DONE)
2. ⏳ Implement enhanced rubros fallback in SDMTForecast (NEXT - CRITICAL)
3. ⏳ Add FTE calculation display
4. ⏳ Add source badges to UI
5. ⏩ Update PMOBaselinesQueuePage columns
6. ⏩ Add baseline details panel to ProjectDetails
7. ⏩ Month Matrix dynamic selection
8. ⏩ Navigation renames

## Testing Plan

1. Manual test: Project with empty rubros → should show allocations/prefacturas with badges
2. Manual test: FTE in header → should match baseline.labor_estimates sum
3. Manual test: Rapid project switching → no stale data, no crashes
4. Unit test: rubrosFromAllocations (DONE)
5. Component test: SDMTForecast fallback scenario (TODO)

## Notes

- Must maintain backwards compatibility
- No database writes in fallback (in-memory only)
- Use existing AbortController patterns
- Follow existing code style and patterns
- Make minimal changes to reduce risk
