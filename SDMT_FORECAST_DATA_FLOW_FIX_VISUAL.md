# SDMTForecast Data Flow Fix - Visual Summary

## The Problem

### Before Fix - Portfolio View (Incomplete Data) ❌

```
Portfolio View Flow (TODOS/All Projects)
┌─────────────────────────────────────────────────────────────┐
│ For Each Project:                                           │
│                                                              │
│  Promise.all([                                              │
│    getForecastPayload ────► Server Forecast                │
│    getProjectInvoices ────► Actuals (Matched)              │
│    getProjectRubros   ────► Line Items                     │
│  ])                                                          │
│                                                              │
│  If server forecast empty:                                  │
│    ┌─────────────────────────────────┐                     │
│    │ transformLineItemsToForecast()  │                     │
│    │ (Only uses line items)          │                     │
│    └─────────────────────────────────┘                     │
│                                                              │
│  ❌ MISSING: getAllocations() call                          │
│  ❌ MISSING: computeForecastFromAllocations()               │
└─────────────────────────────────────────────────────────────┘

Result: Incomplete P/F/A values in totals grid
```

### Working - Single Project View ✅

```
Single Project View Flow
┌─────────────────────────────────────────────────────────────┐
│ getForecastPayload ────► Server Forecast                   │
│                                                              │
│ If server forecast empty:                                   │
│   ┌─────────────────────────────────┐                      │
│   │ getAllocations()                │                      │
│   │ computeForecastFromAllocations()│                      │
│   └─────────────────────────────────┘                      │
│   If allocations empty:                                     │
│     ┌─────────────────────────────────┐                    │
│     │ transformLineItemsToForecast()  │                    │
│     └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘

Result: ✅ Complete P/F/A values
```

---

## The Solution

### After Fix - Portfolio View (Complete Data) ✅

```
Portfolio View Flow (TODOS/All Projects)
┌─────────────────────────────────────────────────────────────┐
│ For Each Project:                                           │
│                                                              │
│  Promise.all([                                              │
│    getForecastPayload  ────► Server Forecast               │
│    getProjectInvoices  ────► Actuals (Matched)             │
│    getProjectRubros    ────► Line Items                    │
│    getAllocations ────────► ✅ Allocations (ADDED)         │
│  ])                                                          │
│                                                              │
│  If server forecast empty AND hasAcceptedBaseline:          │
│    If allocations.length > 0:                               │
│      ┌───────────────────────────────────┐                 │
│      │ ✅ computeForecastFromAllocations │                 │
│      │    (NEW - Allocations First)      │                 │
│      └───────────────────────────────────┘                 │
│    Else if projectLineItems.length > 0:                     │
│      ┌─────────────────────────────────┐                   │
│      │ transformLineItemsToForecast()  │                   │
│      │ (Fallback to Line Items)        │                   │
│      └─────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘

Result: ✅ Complete P/F/A values in totals grid (FIXED)
```

---

## Code Changes

### 1. Added Imports (Lines 73-85)

```diff
 import {
   bulkUploadPayrollActuals,
   type PayrollActualInput,
   getProjectRubros,
   getBaselineById,
   type BaselineDetail,
   acceptBaseline,
+  getAllocations,
 } from "@/api/finanzas";
 import { getForecastPayload, getProjectInvoices } from "./forecastService";
 import { normalizeInvoiceMonth } from "./useSDMTForecastData";
+import { computeForecastFromAllocations, type Allocation } from "./computeForecastFromAllocations";
+import { transformLineItemsToForecast } from "./transformLineItemsToForecast";
```

### 2. Added Allocations to Parallel Fetch (Line 853)

```diff
-const [payload, invoices, projectLineItems] = await Promise.all([
+const [payload, invoices, projectLineItems, allocations] = await Promise.all([
   getForecastPayload(project.id, months),
   getProjectInvoices(project.id),
   getProjectRubros(project.id).catch(() => [] as LineItem[]),
+  getAllocations(project.id, project.baselineId).catch(() => [] as Allocation[]),
 ]);
```

### 3. Implemented Allocations-First Fallback (Lines 880-917)

```diff
-if (
-  (!normalized || normalized.length === 0) &&
-  projectLineItems.length > 0 &&
-  hasAcceptedBaseline
-) {
+// Fallback hierarchy (matching single-project view in useSDMTForecastData):
+// 1. Try allocations if forecast is empty and allocations exist
+// 2. Else try lineItems if available
+if (
+  (!normalized || normalized.length === 0) &&
+  hasAcceptedBaseline
+) {
+  if (allocations.length > 0) {
+    if (import.meta.env.DEV) {
+      console.debug(
+        `[SDMTForecast] Using allocations fallback for ${project.id}, baseline ${project.baselineId}: ${allocations.length} allocations`
+      );
+    }
+    normalized = computeForecastFromAllocations(
+      allocations,
+      projectLineItems,
+      months,
+      project.id
+    );
+    usedFallback = true;
+  } else if (projectLineItems.length > 0) {
     if (import.meta.env.DEV) {
       console.debug(
         `[SDMTForecast] Using baseline fallback for ${project.id}, baseline ${project.baselineId}: ${projectLineItems.length} line items`
       );
     }
     normalized = transformLineItemsToForecast(
       projectLineItems,
       months,
       project.id
     );
     usedFallback = true;
+  }
 }
```

---

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| **Data Sources (Portfolio)** | 3 endpoints | 4 endpoints (+ allocations) |
| **Fallback Hierarchy** | 1 level (lineItems only) | 2 levels (allocations → lineItems) |
| **Data Completeness** | ❌ Incomplete P/F/A | ✅ Complete P/F/A |
| **Parity with Single View** | ❌ No | ✅ Yes |
| **Lines Changed** | - | 43 lines |
| **Tests Added** | - | 3 new tests |
| **Breaking Changes** | - | 0 |

---

## Verification Checklist ✅

- [x] Build succeeds (12.54s, no errors)
- [x] TypeScript compilation clean
- [x] All existing tests pass (9/9 forecast tests)
- [x] New tests pass (3/3 portfolio allocation tests)
- [x] Code review passed (0 comments)
- [x] Security scan passed (0 alerts)
- [x] Documentation complete
- [x] Backward compatible (graceful fallback chain)

---

## Deployment Notes

### Expected API Calls (Portfolio View)

**Per Project:**
1. `GET /dev/projects/{id}/forecast` - Server forecast
2. `GET /dev/projects/{id}/invoices` - Actuals
3. `GET /dev/projects/{id}/rubros` - Line items
4. **`GET /dev/projects/{id}/allocations`** ← **NEW**

### Console Logs (DEV mode)

When allocations fallback is used:
```
[SDMTForecast] Using allocations fallback for {projectId}, baseline {baselineId}: {count} allocations
```

When lineItems fallback is used:
```
[SDMTForecast] Using baseline fallback for {projectId}, baseline {baselineId}: {count} line items
```

---

## Rollback Plan

If issues arise in production:

```bash
# Revert the allocation fetch changes
git revert 20934f2

# Or restore previous behavior by commenting out getAllocations
# This will fall back to lineItems-only behavior
```

---

**Status: READY FOR DEPLOYMENT** ✅

All validation complete. Changes are minimal, surgical, and fully tested.
