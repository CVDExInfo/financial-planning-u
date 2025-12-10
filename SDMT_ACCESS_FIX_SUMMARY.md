# SDMT Access Restriction Fix - Summary

## Issue Description

Users with the **SDMT** role active were unable to access any SDMT cost management pages, seeing the error:

```
Access Restricted – You don't have permission to view this page
Required roles: Not specified
```

This occurred at URLs like:
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/sdmt/cost/catalog`
- `/finanzas/sdmt/cost/forecast`
- `/finanzas/sdmt/cost/reconciliation`
- `/finanzas/sdmt/cost/changes`

The same issue affected **EXEC_RO** users who should have had full read-only access to SDMT pages.

## Root Cause

**Critical Bug in `src/lib/auth.ts` (line 209-210):**

The `canAccessRoute` function had an incorrect glob pattern replacement order:

```typescript
// BROKEN CODE:
const regex = new RegExp(
  `^${pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")}$`
);
```

**Problem:**
1. First replacement: `**` → `.*`
2. Second replacement: `*` → `[^/]*`
3. The second replacement **corrupts** the first one: `.*` becomes `.[^/]*`

**Result:**
- Pattern `/sdmt/**` becomes regex `/sdmt/.[^/]*` (wrong!)
- This regex requires exactly one character after `/sdmt/`, preventing matches like:
  - `/sdmt/cost/catalog` ❌
  - `/sdmt/cost/forecast` ❌
  - `/sdmt/cost/reconciliation` ❌

**Expected:**
- Pattern `/sdmt/**` should become regex `/sdmt/.*` (correct!)
- This matches any route under `/sdmt/`:
  - `/sdmt/cost/catalog` ✅
  - `/sdmt/cost/forecast` ✅
  - `/sdmt/cost/reconciliation` ✅

## The Fix

**File:** `src/lib/auth.ts`

**Changed Lines:** 207-215

```typescript
export function canAccessRoute(route: string, role: UserRole): boolean {
  const normalizedRoute = normalizeAppPath(route);
  const { routes } = getRoutesForRole(role);

  return routes.some((pattern) => {
    // Convert glob pattern to regex
    // IMPORTANT: Replace ** first with placeholder to avoid conflict with single * replacement
    const regexPattern = pattern
      .replace(/\*\*/g, "___DOUBLESTAR___")  // Placeholder for **
      .replace(/\*/g, "[^/]*")               // Single * matches anything except /
      .replace(/___DOUBLESTAR___/g, ".*");   // ** matches anything including /
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedRoute);
  });
}
```

**Solution:**
1. Replace `**` with a unique placeholder (`___DOUBLESTAR___`)
2. Replace `*` with `[^/]*` (single glob wildcard)
3. Replace placeholder with `.*` (double glob wildcard)

This ensures the replacements don't interfere with each other.

## Testing

### Automated Tests

Added comprehensive unit tests in `src/lib/__tests__/auth-routes.test.ts`:

```
✔ PM role route visibility (2 tests)
  - Limited access: estimator + catalog only
  - Blocks: forecast, reconciliation, changes
  
✔ SDMT role route visibility (2 tests)
  - Full access to all SDMT cost management routes
  - Blocks: PMO-only routes
  
✔ EXEC_RO role route visibility (2 tests)
  - Full read-only access to PMO and SDMT routes
  
✔ PMO role route visibility (2 tests)
  - Restricted to PMO workspace only
  - Blocks: all SDMT routes

All 8 tests pass ✅
```

### Manual Verification

Created verification script: `scripts/verify-rbac-fix.js`

Results: **16/16 tests passed** ✅

## Impact & Security

### What Changed
- **Fixed:** Glob pattern replacement logic in `canAccessRoute` function
- **No changes to:** Route definitions, role permissions, or access control policies

### Security Posture
✅ **Improved** - Access control is now working as designed:

| Role      | Before Fix | After Fix | Expected |
|-----------|------------|-----------|----------|
| SDMT      | ❌ Blocked | ✅ Full Access | ✅ Full Access |
| EXEC_RO   | ❌ Blocked | ✅ Read-Only | ✅ Read-Only |
| PM        | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial (by design) |
| PMO       | ✅ Correct | ✅ Correct | ✅ PMO only |

### PM Restrictions Preserved
✅ PM users still have limited access (as intended):
- ✅ Can access: `/pmo/prefactura/estimator`
- ✅ Can access: `/sdmt/cost/catalog`
- ❌ Cannot access: `/sdmt/cost/forecast`
- ❌ Cannot access: `/sdmt/cost/reconciliation`
- ❌ Cannot access: `/sdmt/cost/changes`

## Deployment Notes

### No Breaking Changes
- This is a bug fix, not a feature change
- No database migrations required
- No API changes required
- No configuration changes required

### Rollback Plan
If issues arise, revert commit: `eeda042`

### Verification Steps (Post-Deploy)

1. **Login as SDMT user:**
   - Navigate to `/finanzas/sdmt/cost/catalog` ✅
   - Navigate to `/finanzas/sdmt/cost/forecast` ✅
   - Navigate to `/finanzas/sdmt/cost/reconciliation` ✅
   - Verify no "Access Restricted" errors

2. **Login as PM user:**
   - Navigate to `/finanzas/pmo/prefactura/estimator` ✅
   - Navigate to `/finanzas/sdmt/cost/catalog` ✅
   - Navigate to `/finanzas/sdmt/cost/forecast` ❌ (should be blocked)

3. **Login as EXEC_RO user:**
   - Navigate to `/finanzas/sdmt/cost/catalog` ✅
   - Navigate to `/finanzas/sdmt/cost/forecast` ✅
   - Verify read-only mode

## Related Files

- `src/lib/auth.ts` - **FIXED:** canAccessRoute function
- `src/lib/__tests__/auth-routes.test.ts` - **ADDED:** Comprehensive RBAC tests
- `src/components/AccessControl.tsx` - No changes (uses canAccessRoute)
- `scripts/verify-rbac-fix.js` - **NEW:** Verification script

## References

- Original Issue: "Access Restricted – You don't have permission to view this page"
- Affected URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/sdmt/cost/catalog`
- User Role: SDMT (also has EXEC_RO available)
- Root Cause: Glob pattern replacement bug in auth.ts

---

**Status:** ✅ FIXED  
**Impact:** High - Restores SDMT access for all SDMT and EXEC_RO users  
**Risk:** Low - Bug fix with comprehensive test coverage  
**Testing:** Automated + Manual verification complete
