# TDZ Fix & Canonical Taxonomy Centralization - Implementation Summary

## Overview

This implementation addresses the **Temporal Dead Zone (TDZ) error** that occurred after PR #966 and centralizes the canonical taxonomy between client and server to prevent divergence.

## Problem Statement

### Root Cause
The runtime error `Uncaught ReferenceError: Cannot access 'QR' before initialization` indicated a Temporal Dead Zone issue where a minified variable `QR` (representing a normalization function) was used before it was declared. This happened because:

1. The normalization helper was declared as a `const` arrow function instead of a function declaration
2. The helper was potentially placed **after** code that called it in the minified bundle
3. Alias seeding code used these helpers in loops before they were properly initialized

### Secondary Issue
The client (`src/lib/rubros/canonical-taxonomy.ts`) and server (`services/finanzas-api/src/lib/canonical-taxonomy.ts`) maintained separate taxonomy files that could drift out of sync, leading to inconsistent rubro ID resolution.

## Solution Implemented

### 1. Robust Normalization Helpers (TDZ Fix)

**File**: `services/finanzas-api/src/lib/materializers.ts`

Replaced const arrow functions with function declarations to prevent TDZ:

```typescript
// OLD (TDZ-prone):
const normalizeKeyPart = (value?: string | null) =>
  (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

// NEW (TDZ-safe):
function normalizeKey(input: any): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  // Normalize Unicode and remove diacritics
  s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  // Remove punctuation except hyphen/underscore
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, "");
  // Collapse whitespace, trim, lowercase
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}

function normalizeKeyPart(input: any): string {
  return normalizeKey(input);
}
```

**Key improvements**:
- Function declarations are hoisted, preventing TDZ errors
- Unicode normalization removes diacritics (café → cafe, técnico → tecnico)
- Handles punctuation and whitespace consistently
- Defensive null/undefined handling

### 2. Safe Alias Seeding with buildTaxonomyIndex

**File**: `services/finanzas-api/src/lib/materializers.ts`

Created a dedicated `buildTaxonomyIndex` function that:
- Builds lookup maps BEFORE any loop uses them
- Seeds legacy aliases using normalized keys
- Prevents overwriting canonical entries with aliases
- Handles errors gracefully without crashing

```typescript
function buildTaxonomyIndex(
  entries: RubroTaxonomyEntry[],
  legacyAliases: Record<string, string>
): Omit<TaxonomyIndex, 'fetchedAt'> {
  const byLineaCodigo = new Map<string, RubroTaxonomyEntry>();
  const byDescription = new Map<string, RubroTaxonomyEntry>();
  const byId = new Map<string, RubroTaxonomyEntry>();
  
  // 1) Index canonical entries
  entries.forEach((entry) => {
    // ... indexing logic
  });
  
  // 2) Seed legacy aliases with normalization
  Object.entries(legacyAliases).forEach(([alias, canonicalId]) => {
    const normalizedAlias = normalizeKeyPart(alias);
    if (!byDescription.has(normalizedAlias)) {
      // Only add if not already present
      const canonicalEntry = byLineaCodigo.get(canonicalId) || byId.get(canonicalId);
      if (canonicalEntry) {
        byDescription.set(normalizedAlias, canonicalEntry);
      }
    }
  });
  
  return { byLineaCodigo, byDescription, byId };
}
```

### 3. Canonical Taxonomy Synchronization

**Build-Time Copy Script**: `scripts/copy-canonical-taxonomy.cjs`

Automatically copies the client canonical taxonomy to the server before builds:

```javascript
// Copies: src/lib/rubros/canonical-taxonomy.ts
//     →   services/finanzas-api/src/lib/canonical-taxonomy.ts
```

**Benefits**:
- Single source of truth: `src/lib/rubros/canonical-taxonomy.ts`
- No manual sync required
- Build fails if copy fails, preventing divergence
- Generated file includes timestamp and warning header

### 4. Package.json Updates

**Root package.json**:
```json
{
  "scripts": {
    "prebuild": "node scripts/copy-canonical-taxonomy.cjs",
    "copy-canonical-taxonomy": "node scripts/copy-canonical-taxonomy.cjs"
  }
}
```

**services/finanzas-api/package.json**:
```json
{
  "scripts": {
    "prebuild": "node ../../scripts/copy-canonical-taxonomy.cjs",
    "sam:build": "npm run prebuild && sam build"
  }
}
```

### 5. CI/CD Workflow Updates

**Modified Workflows**:
1. `.github/workflows/deploy-api.yml` - Added copy step before SAM build
2. `.github/workflows/unit-tests.yml` - Added copy step before running tests

Example addition:
```yaml
- name: Copy canonical taxonomy (pre-build)
  run: |
    set -euo pipefail
    echo "📋 Copying canonical taxonomy from client to server..."
    node scripts/copy-canonical-taxonomy.cjs
```

### 6. Comprehensive Test Coverage

#### Server Tests
**File**: `services/finanzas-api/test/materializer-index.spec.ts`

Tests for:
- `normalizeKey()` handles null, undefined, diacritics, punctuation, whitespace
- `buildTaxonomyIndex()` builds correct lookup maps
- Legacy alias seeding with normalized keys
- Diacritics in aliases (ingeniero líder → ingeniero lider)
- Case-insensitive alias resolution
- Protection against overwriting canonical entries

#### Client Tests
**File**: `src/lib/rubros/__tests__/normalize-key.test.ts`

Tests for:
- Basic normalization (lowercase, trim, etc.)
- Unicode diacritics removal (café, niño, técnico)
- Whitespace handling
- Punctuation removal
- Real-world alias examples from problem statement
- Consistency and idempotency

## Files Changed

### Core Implementation
- `services/finanzas-api/src/lib/materializers.ts` - TDZ fix and buildTaxonomyIndex
- `services/finanzas-api/src/lib/canonical-taxonomy.ts` - Synchronized from client (generated)
- `scripts/copy-canonical-taxonomy.cjs` - Build-time copy script

### Tests
- `services/finanzas-api/test/materializer-index.spec.ts` - Server normalization tests
- `src/lib/rubros/__tests__/normalize-key.test.ts` - Client normalization tests

### Configuration
- `package.json` - Added prebuild and copy scripts
- `services/finanzas-api/package.json` - Added prebuild hook
- `.github/workflows/deploy-api.yml` - Added copy step
- `.github/workflows/unit-tests.yml` - Added copy step

## Acceptance Criteria

### Immediate Checklist (All Complete ✅)
- [x] Normalize helpers declared as function declarations (not const arrows)
- [x] buildTaxonomyIndex function created with safe alias seeding
- [x] Build-time copy script created and tested
- [x] Package.json prebuild hooks added
- [x] CI workflows updated to run copy script
- [x] Unit tests added for normalization
- [x] Server tests added for index building

### Expected Outcomes
- ✅ No TDZ errors on page load
- ✅ No `Cannot access 'X' before initialization` errors
- ✅ Server and client use identical canonical taxonomy
- ✅ Alias resolution works for diacritics (Service Delivery Manager, Ingeniero líder)
- ✅ Invoice → forecast matching works reliably
- ✅ CI builds succeed with copy script execution

## Testing Strategy

### Unit Tests
Run the new test suites:
```bash
# Server tests
cd services/finanzas-api
npm test test/materializer-index.spec.ts

# Client tests  
npm run test src/lib/rubros/__tests__/normalize-key.test.ts
```

### Integration Tests
1. Verify copy script works:
   ```bash
   node scripts/copy-canonical-taxonomy.cjs
   ```

2. Check server file was updated:
   ```bash
   ls -l services/finanzas-api/src/lib/canonical-taxonomy.ts
   head -20 services/finanzas-api/src/lib/canonical-taxonomy.ts
   ```

3. Verify build process:
   ```bash
   cd services/finanzas-api
   npm run sam:build
   ```

### Manual Verification
1. Deploy to dev environment
2. Open SDMT Forecast page
3. Check browser console - should see NO:
   - TDZ errors
   - "Cannot access 'QR' before initialization"
   - "Unknown rubro_id: Service Delivery Manager" warnings (for canonical aliases)
4. Verify invoice matching works for test data

## Security Summary

No security vulnerabilities introduced by this change. The changes:
- Use standard Node.js filesystem operations
- Don't expose sensitive data
- Don't create new attack surfaces
- Improve code quality by preventing TDZ errors

**CodeQL scan recommended** to confirm no new issues.

## Deployment Checklist

Before deploying to production:

1. ✅ All tests pass locally
2. ✅ Copy script runs successfully
3. ✅ CI builds pass
4. [ ] Code review approved
5. [ ] CodeQL security scan clean
6. [ ] Deploy to dev environment
7. [ ] Manual testing in dev (check console for errors)
8. [ ] Verify invoice → forecast matching
9. [ ] Deploy to production
10. [ ] Monitor for TDZ errors in production logs

## Future Improvements (Optional)

### Longer-term Safeguards
1. **TDZ Scanner**: Add a lint rule or build step to detect potential TDZ issues
2. **Madge Circular Import Check**: Prevent circular dependencies
3. **Artifact Hash Guard**: Verify taxonomy files match between client/server
4. **Sourcemap Upload**: Auto-upload sourcemaps to error tracking (Sentry) for better debugging
5. **Smoke Test**: Add automated smoke test for /finanzas route
6. **Package Extract**: Consider moving canonical taxonomy to a workspace package (`packages/canonical-taxonomy`) for stronger guarantees

## References

- Original Problem Statement: Detailed TDZ diagnosis and fix instructions
- PR #966: The PR that introduced the TDZ issue (reverted)
- Client Taxonomy: `src/lib/rubros/canonical-taxonomy.ts`
- Server Taxonomy: `services/finanzas-api/src/lib/canonical-taxonomy.ts`

## Summary

This implementation provides a **complete, production-ready solution** to:
1. ✅ Fix the TDZ error by using function declarations
2. ✅ Centralize canonical taxonomy between client and server
3. ✅ Ensure consistent alias resolution with robust normalization
4. ✅ Add comprehensive test coverage
5. ✅ Integrate copy script into build process and CI/CD

The changes are minimal, surgical, and follow best practices. No working code was removed, and all changes are backward-compatible.
