# RBAC Rollback Summary

## Overview

This document summarizes the RBAC (Role-Based Access Control) changes made to restore proper role behavior while preserving SDM manager functionality from recent PRs.

## Changes Made

### 1. PM Role Restrictions

**Problem**: PM role had access to SDMT catalog routes that should be blocked.

**Solution**: Restricted PM role to only PMO estimator routes.

#### Before
```typescript
PM: {
  routes: [
    "/",
    "/profile",
    "/pmo/**",
    "/pmo/prefactura/**",
    "/sdmt/cost/catalog",    // ❌ Should be blocked
    "/catalog/rubros",        // ❌ Should be blocked
  ],
}
```

#### After
```typescript
PM: {
  routes: [
    "/",
    "/profile",
    "/pmo/**",
    "/pmo/prefactura/**",
  ],
  description: "Acceso limitado solo al estimador PMO",
}
```

### 2. ikusi-acta-ui Group Handling

**Problem**: `ikusi-acta-ui` Cognito group was not explicitly filtered and could inadvertently grant roles.

**Solution**: Added to ignored groups list and explicitly skip in role mapping.

#### Before
```typescript
const ignoredGroups = ["acta-ui", "cognito"];
```

#### After
```typescript
const ignoredGroups = ["acta-ui", "ikusi-acta-ui", "cognito"];

// Skip ignored groups early in loop
if (ignoredGroups.some(ignored => normalized.includes(ignored))) {
  continue;
}
```

**Impact**: Users with only `ikusi-acta-ui` group now default to `EXEC_RO` (read-only).

### 3. SDMT Route Enhancements

**Problem**: Some SDMT routes weren't matching due to glob pattern limitations.

**Solution**: Added explicit routes for standalone paths.

#### Routes Added
- `/projects` (in addition to `/projects/**`)
- `/adjustments` (in addition to `/adjustments/**`)
- `/providers` (in addition to `/providers/**`)
- `/cashflow` (explicit premium route)
- `/scenarios` (explicit premium route)

### 4. Navigation Updates

**Problem**: PM appeared in `visibleFor` arrays for catalog navigation items.

**Solution**: Removed PM from catalog items in Navigation component.

#### Changed Items
- `catalogoCostos`: `visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"]` (removed PM)
- `catalogoRubros`: `visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"]` (removed PM)

### 5. PM Group Mapping Refinement

**Problem**: Groups containing "pm" could conflict with "pmo" groups.

**Solution**: Explicit check to exclude PMO-related groups from PM mapping.

```typescript
// PM access: explicit PM groups only (not PMO-related groups)
if (isPmGroup && !normalized.includes("pmo")) {
  roles.add("PM");
}
```

## Role/Route Access Matrix

### PM (Project Manager)

| Route Pattern | Access | Notes |
|--------------|--------|-------|
| `/` | ✅ Allow | Home page |
| `/profile` | ✅ Allow | User profile |
| `/pmo/**` | ✅ Allow | PMO estimator and children |
| `/pmo/prefactura/**` | ✅ Allow | Estimator wizard |
| `/sdmt/**` | ❌ Block | All SDMT routes blocked |
| `/catalog/**` | ❌ Block | Catalog routes blocked |
| `/projects/**` | ❌ Block | Projects blocked |
| `/adjustments/**` | ❌ Block | Adjustments blocked |
| `/providers/**` | ❌ Block | Providers blocked |
| `/rules` | ❌ Block | Rules blocked |
| `/cashflow` | ❌ Block | Cashflow blocked |
| `/scenarios` | ❌ Block | Scenarios blocked |

### PMO

| Route Pattern | Access | Notes |
|--------------|--------|-------|
| `/` | ✅ Allow | Home page |
| `/profile` | ✅ Allow | User profile |
| `/pmo/**` | ✅ Allow | PMO workspace |
| `/pmo/prefactura/**` | ✅ Allow | Estimator |
| All SDMT routes | ❌ Block | Isolated to PMO workspace |

### SDMT (Service Delivery Management Team)

| Route Pattern | Access | Notes |
|--------------|--------|-------|
| `/` | ✅ Allow | Home page |
| `/profile` | ✅ Allow | User profile |
| `/sdmt/**` | ✅ Allow | All SDMT routes |
| `/projects` | ✅ Allow | Projects landing |
| `/projects/**` | ✅ Allow | All project routes |
| `/catalog/**` | ✅ Allow | All catalog routes |
| `/rules` | ✅ Allow | Allocation rules |
| `/adjustments` | ✅ Allow | Adjustments landing |
| `/adjustments/**` | ✅ Allow | All adjustment routes |
| `/providers` | ✅ Allow | Providers landing |
| `/providers/**` | ✅ Allow | All provider routes |
| `/cashflow` | ✅ Allow | Cashflow dashboard (Premium) |
| `/scenarios` | ✅ Allow | Scenarios (Premium) |
| `/pmo/**` | ❌ Block | PMO-only routes |

### VENDOR

| Route Pattern | Access | Notes |
|--------------|--------|-------|
| `/` | ✅ Allow | Home page |
| `/profile` | ✅ Allow | User profile |
| `/sdmt/cost/catalog` | ✅ Allow | Cost catalog (read-only) |
| `/sdmt/cost/reconciliation` | ✅ Allow | Upload invoices |
| `/catalog/rubros` | ✅ Allow | Rubros catalog (read-only) |
| Other SDMT routes | ❌ Block | Limited access |

### EXEC_RO (Executive Read-Only)

| Route Pattern | Access | Notes |
|--------------|--------|-------|
| `/` | ✅ Allow | Home page |
| `/profile` | ✅ Allow | User profile |
| `/pmo/**` | ✅ Allow | PMO routes (read-only) |
| `/sdmt/**` | ✅ Allow | All SDMT routes (read-only) |
| `/catalog/**` | ✅ Allow | All catalog routes (read-only) |
| `/rules` | ✅ Allow | Rules (read-only) |

## Cognito Group Mapping

| Cognito Group | Application Roles | Notes |
|--------------|------------------|-------|
| `pm` | `PM` | Limited to estimator only |
| `pm-*` | `PM` | PM prefix groups (excluding pmo) |
| `pmo` | `PMO` | PMO workspace access |
| `admin` | `PMO`, `EXEC_RO` | Super-user access |
| `FIN` | `SDMT` | Finanzas team |
| `AUD` | `SDMT` | Audit team |
| `SDT` | `SDMT` | Service Delivery team |
| `vendor` | `VENDOR` | External vendors |
| `proveedor` | `VENDOR` | Spanish vendor groups |
| `partner` | `VENDOR` | Partner organizations |
| `exec` | `EXEC_RO` | Executives |
| `director` | `EXEC_RO` | Directors |
| `manager` | `EXEC_RO` | Managers |
| `ikusi-acta-ui` | **Ignored** → `EXEC_RO` | Legacy group, defaults to read-only |
| `acta-ui` | **Ignored** → `EXEC_RO` | System/utility group |
| `cognito` | **Ignored** → `EXEC_RO` | Built-in groups |
| _(no groups)_ | `EXEC_RO` | Default to read-only |

## Role Priority

When a user belongs to multiple groups, the effective role is determined by priority:

```typescript
ROLE_PRIORITY = ["SDMT", "PMO", "EXEC_RO", "VENDOR", "PM"];
```

**Examples:**
- Groups: `["FIN", "ikusi-acta-ui"]` → Roles: `{SDMT}` → Effective: `SDMT`
- Groups: `["ikusi-acta-ui"]` → Roles: `{EXEC_RO}` → Effective: `EXEC_RO`
- Groups: `["pm"]` → Roles: `{PM}` → Effective: `PM`
- Groups: `["pmo"]` → Roles: `{PMO}` → Effective: `PMO`

## Preserved Functionality

### sdm_manager_name Field

✅ **Preserved throughout stack:**

1. **Types** (`src/types/domain.d.ts`):
   - `Project.sdm_manager_name?: string | null`
   - `DealInputs.sdm_manager_name: string`
   - `BaselineCreateRequest.sdm_manager_name?: string`

2. **UI Components** (`src/features/pmo/prefactura/Estimator/`):
   - `DealInputsStep.tsx`: Form field for SDM manager name
   - `ReviewSignStep.tsx`: Displays in review step

3. **API Layer** (`src/lib/api.ts`, `src/api/finanzas.ts`):
   - Passed in baseline creation payloads
   - Mapped from project data

4. **Backend** (`services/finanzas-api/`):
   - `src/handlers/baseline.ts`: Accepts and stores field
   - `src/handlers/handoff.ts`: Includes in handoff metadata
   - `src/handlers/projects.ts`: Returns in project data
   - `src/validation/handoff.ts`: Validates field

5. **Tests**:
   - `src/lib/__tests__/createBaseline.test.ts`: Verifies field presence
   - Backend unit tests validate handoff data mapping

### Glob Pattern Fix

✅ **Preserved the correct pattern matching:**

The glob pattern fix from PR #552 that prevents `*` and `**` from interfering is maintained:

```typescript
const GLOB_DOUBLE_STAR_PLACEHOLDER = "___DOUBLESTAR___";

const regexPattern = pattern
  .replace(/\*\*/g, GLOB_DOUBLE_STAR_PLACEHOLDER)  // Step 1
  .replace(/\*/g, "[^/]*")                          // Step 2
  .replace(new RegExp(GLOB_DOUBLE_STAR_PLACEHOLDER, "g"), ".*"); // Step 3
```

This ensures patterns like `/sdmt/**` correctly match all subroutes.

## Test Results

### Unit Tests
```bash
npm run test:unit
```
✅ **All 32 tests passing**

Key test suites:
- ✅ PM role route visibility (2 tests)
- ✅ SDMT role route visibility (2 tests)
- ✅ EXEC_RO role route visibility (2 tests)
- ✅ PMO role route visibility (2 tests)
- ✅ mapGroupsToRoles (7 tests)
- ✅ ApiService.createBaseline (4 tests, including sdm_manager_name)

### Linter
```bash
npm run lint
```
✅ **No errors**

## Security Considerations

1. **No Privilege Escalation**: PM restrictions tighten access, no new privileges granted
2. **ikusi-acta-ui Properly Isolated**: Legacy group now defaults to read-only
3. **SDMT Access Restored**: Full access to cost management as intended
4. **EXEC_RO Remains Read-Only**: No write actions possible
5. **VENDOR Access Unchanged**: Still limited to catalog and reconciliation

## Manual QA Checklist

- [ ] Login as PM user
  - [ ] Verify access to `/pmo/prefactura/estimator`
  - [ ] Verify `/sdmt/cost/catalog` shows "Access Restricted"
  - [ ] Verify `/catalog/rubros` shows "Access Restricted"
  - [ ] Verify no SDMT nav items visible
  
- [ ] Login as SDMT user
  - [ ] Verify access to all SDMT routes (forecast, reconciliation, changes, cashflow, scenarios)
  - [ ] Verify access to `/projects`, `/adjustments`, `/providers`
  - [ ] Verify all SDMT nav items visible
  
- [ ] Login as PMO user
  - [ ] Verify access to `/pmo/prefactura/estimator`
  - [ ] Verify `/sdmt/**` routes blocked
  
- [ ] Login as EXEC_RO user
  - [ ] Verify read-only access to all routes
  - [ ] Verify no edit buttons visible
  
- [ ] Login as user with only `ikusi-acta-ui` group
  - [ ] Verify defaults to EXEC_RO behavior
  - [ ] Verify read-only access
  
- [ ] Test sdm_manager_name in estimator
  - [ ] Fill out estimator with SDM manager name
  - [ ] Verify appears in Review & Sign step
  - [ ] Create baseline and verify in DynamoDB

## Documentation Updates

Updated files:
- ✅ `docs/finanzas-roles-and-permissions.md`
  - Added PM role definition
  - Updated group mapping rules
  - Updated capabilities matrix
  - Updated module-level access table
  - Clarified ikusi-acta-ui handling

## Files Modified

1. `src/lib/auth.ts` - PM role restrictions, SDMT routes
2. `src/lib/jwt.ts` - ikusi-acta-ui filtering, PM/PMO distinction
3. `src/components/Navigation.tsx` - PM removed from catalog visibleFor
4. `src/lib/__tests__/auth-routes.test.ts` - Updated tests
5. `src/lib/__tests__/jwt.test.ts` - Updated tests
6. `docs/finanzas-roles-and-permissions.md` - Comprehensive updates

## Next Steps

1. **CodeQL Security Scan**: Run before final merge
2. **Manual QA**: Execute checklist above
3. **Code Review**: Request review from team
4. **Deployment**: Follow standard deployment process

## Rollback Plan

If issues are discovered:

1. Revert commit: `git revert <commit-hash>`
2. PM users will regain catalog access (acceptable temporary state)
3. SDMT access remains functional (glob fix is preserved)
4. ikusi-acta-ui users will get inconsistent role assignment (low impact)

---

**Status**: ✅ Implementation Complete | ⏳ Awaiting QA & Review
**Date**: 2025-12-11
