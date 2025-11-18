# TDZ Fix: Finanzas SD Cost Catalog Route

## Issue Summary

**Route:** `/finanzas/sdmt/cost/catalog`  
**Error:** `ReferenceError: Cannot access 'B' before initialization`  
**Component:** `src/features/sdmt/cost/Catalog/SDMTCatalog.tsx`  
**Date Fixed:** 2025-11-17

## Root Cause

The component had a **Temporal Dead Zone (TDZ) violation** where a variable was referenced before its declaration:

```typescript
// ❌ BEFORE (lines 83-87): Using lineItemsError BEFORE declaration
const lineItemsErrorMessage = lineItemsError
  ? lineItemsError instanceof Error
    ? lineItemsError.message
    : String(lineItemsError)
  : "";

// Line 114: lineItemsError declared here (TOO LATE!)
const {
  error: lineItemsError,
  ...
} = useProjectLineItems();
```

## Solution

Moved the `useProjectLineItems()` hook call to execute **before** any usage of its returned values:

```typescript
// ✅ AFTER: Hook called first (lines 105-111)
const {
  lineItems: queryLineItems,
  isLoading: isLineItemsLoading,
  isFetching: isLineItemsFetching,
  error: lineItemsError,
  invalidate: invalidateLineItems,
} = useProjectLineItems();

// Then compute dependent values (lines 113-118)
const lineItemsErrorMessage = lineItemsError
  ? lineItemsError instanceof Error
    ? lineItemsError.message
    : String(lineItemsError)
  : "";
```

## Why This Happened

JavaScript/TypeScript's const and let declarations have **block scope** with a TDZ, meaning:
- The variable exists in the scope from the start
- But it cannot be accessed until the line where it's declared and initialized
- Accessing it before declaration throws `ReferenceError: Cannot access 'X' before initialization`

In minified code, variable names are shortened (e.g., `lineItemsError` → `B`), which is why the error message referenced variable `B`.

## Prevention Guidelines

To avoid similar TDZ issues in React components:

1. **Declare all hooks at the top** of the component function, following React's Rules of Hooks
2. **Order declarations properly:**
   - State hooks (`useState`, etc.)
   - Context hooks (`useContext`, custom hooks like `useProject()`)
   - Computed values that depend on hook results
3. **Never reference a variable before its declaration line**
4. **Be careful with destructuring** - ensure the source is declared first
5. **Watch for circular dependencies** between modules (though not the issue here)

## Files Modified

- `src/features/sdmt/cost/Catalog/SDMTCatalog.tsx`: Reordered hook calls and variable declarations

## Verification

- ✅ Build succeeds without errors
- ✅ TypeScript type-checking passes (no new errors)
- ✅ ESLint passes with no warnings
- ✅ Route renders without runtime errors
