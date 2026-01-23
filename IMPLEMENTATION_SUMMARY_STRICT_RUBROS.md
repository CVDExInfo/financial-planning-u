# Strict Canonical Rubros Taxonomy - Implementation Summary

## Executive Summary

This implementation establishes `/data/rubros.taxonomy.json` as the **single source of truth** for all rubro (cost line item) definitions across the financial planning application. It eliminates ~1000 lines of hardcoded taxonomy data, implements strict validation with a feature flag, creates user-friendly UI components, and adds comprehensive CI/CD automation.

## Key Achievements

✅ **Single Source of Truth**: Both client and server now dynamically load from the JSON file  
✅ **Strict Validation**: Server-side validation with audit/strict modes via feature flag  
✅ **User Experience**: SearchableSelectRubro component prevents free-text input  
✅ **CI Protection**: Automated checks prevent non-canonical IDs from being introduced  
✅ **Automated Sync**: GitHub Actions pipeline for taxonomy updates and deployments  
✅ **Audit Trail**: Nightly job scans DynamoDB for non-canonical rubros  
✅ **Zero Polling**: QueryClient configured to prevent unnecessary API calls  
✅ **Comprehensive Testing**: Unit tests for all validation logic  

## Changed Files Inventory

### Core Infrastructure (Phase 1)

#### 1. `src/lib/rubros/canonical-taxonomy.ts` (MAJOR REFACTOR)
**Lines changed:** ~850 lines removed, 250 lines added  
**Rationale:**
- Replaced hardcoded taxonomy array with dynamic JSON import
- Eliminates duplication between client and server
- Makes taxonomy updates as simple as editing one JSON file
- Added helper functions: `getAllCanonicalIds()`, `getAllCategories()`, `getRubrosByCategory()`

**Changes:**
- Import taxonomy from `/data/rubros.taxonomy.json`
- Build indexes (Maps) for O(1) lookup performance
- Support case-insensitive matching
- Maintain legacy ID mappings for backwards compatibility

#### 2. `services/finanzas-api/src/lib/canonical-taxonomy.ts` (MAJOR REFACTOR)
**Lines changed:** ~200 lines removed, 150 lines added  
**Rationale:**
- Mirror client-side implementation on server
- Load JSON using `fs.readFileSync` at module load time
- Ensure both client and server use identical canonical IDs

**Changes:**
- Import and parse `data/rubros.taxonomy.json`
- Build CANONICAL_IDS set dynamically
- Add `normalizeKey()` for case-insensitive comparisons
- Export helper functions matching client API

#### 3. `services/finanzas-api/src/lib/validateRubro.ts` (NEW)
**Lines:** 150  
**Rationale:**
- Centralized validation logic for all API handlers
- Feature flag support (STRICT_RUBRO_VALIDATION)
- Provides helpful error messages citing valid examples
- Supports both single and batch validation

**Functions:**
- `validateCanonicalRubro()` - Main validation with strict/audit modes
- `validateCanonicalRubros()` - Batch validation
- `checkRubroValidity()` - Non-throwing check
- `getValidRubroIds()` - Helper for UI/errors
- `buildRubroValidationError()` - Consistent error responses

### Testing (Phase 2)

#### 4. `services/finanzas-api/src/lib/__tests__/validateRubro.test.ts` (NEW)
**Lines:** 200  
**Rationale:**
- Comprehensive test coverage for validation logic
- Tests both audit and strict modes
- Verifies environment variable precedence
- Ensures correct error handling

**Test Coverage:**
- Canonical ID acceptance
- Case-insensitive matching
- Legacy ID mapping in audit mode
- Strict mode rejections
- Error messages and status codes
- Batch validation
- Helper functions

### UI Components (Phase 3)

#### 5. `src/components/SelectRubro.tsx` (NEW)
**Lines:** 250  
**Rationale:**
- Prevents free-text rubro input across all forms
- Provides user-friendly, searchable dropdown
- Groups rubros by category for easy navigation
- Shows both code and description for clarity
- Client-side validation before submission

**Features:**
- Searchable/filterable by code, name, or description
- Grouped by category with badges
- Supports filtering by category or type (labor/non-labor)
- Displays metadata (cost type, execution type)
- Validates selected value against canonical IDs
- Accessible and responsive design

### CI/CD & Automation (Phase 5)

#### 6. `.github/workflows/taxonomy-sync.yml` (NEW)
**Lines:** 180  
**Rationale:**
- Automates taxonomy deployment pipeline
- Validates JSON structure on every change
- Creates versioned backups in S3
- Triggers dependent service deployments

**Jobs:**
- `validate-taxonomy` - Validates JSON structure, checks duplicates
- `deploy-artifacts` - Uploads to S3 with versioning
- `trigger-deployments` - Triggers UI and API deployments
- `notify` - Sends success/failure notifications

#### 7. `.github/workflows/nightly-audit-rubros.yml` (NEW)
**Lines:** 200  
**Rationale:**
- Proactive monitoring for data quality
- Identifies non-canonical rubros in DynamoDB
- Generates audit reports with actionable insights
- Prevents data drift over time

**Jobs:**
- `audit-dynamodb` - Scans all relevant DynamoDB tables
- Compares against canonical taxonomy
- Generates detailed report with item IDs
- Uploads report to S3 and GitHub artifacts
- Sends alerts if non-canonical data found

#### 8. `.github/workflows/finanzas-ci.yml` (UPDATED)
**Lines changed:** +60 lines  
**Rationale:**
- Prevents reintroduction of forbidden rubro literals
- Fails build if legacy IDs found in production code
- Protects against accidental hardcoding of non-canonical IDs

**Changes:**
- Added `check-forbidden-rubros` job
- Reads forbidden literals from `ci/forbidden-rubros.txt`
- Scans codebase with `git grep`
- Excludes canonical-taxonomy.ts and test files
- Provides clear error messages with remediation steps

#### 9. `ci/forbidden-rubros.txt` (NEW)
**Lines:** 25  
**Rationale:**
- Configuration file for CI guard
- Lists legacy IDs that should not appear in code
- Easily extensible as new forbidden patterns discovered

**Contents:**
- MOD-PM variants (replaced with MOD-LEAD)
- MOD-PMO variants
- Documentation on adding new forbidden patterns

### Configuration & Documentation

#### 10. `src/lib/queryClient.ts` (UPDATED)
**Lines changed:** +15 lines (comments and new options)  
**Rationale:**
- Prevents automatic data refetching that causes polling
- Explicitly disables all automatic refetch mechanisms
- Documents the no-polling policy

**Changes:**
- Added `refetchInterval: false`
- Added `refetchOnReconnect: false`
- Added comprehensive documentation explaining the policy
- Existing `refetchOnWindowFocus: false` maintained

#### 11. `DEPLOYMENT_GUIDE_STRICT_RUBROS.md` (NEW)
**Lines:** 380  
**Rationale:**
- Provides step-by-step deployment instructions
- Documents audit mode → strict mode transition
- Includes rollback procedures
- Troubleshooting guide for common issues

**Sections:**
- Deployment phases (audit mode, strict mode, maintenance)
- Monitoring and logging
- Environment variables and secrets
- Testing checklist
- Rollback procedures
- Troubleshooting guide

## Files NOT Modified (Intentional)

### API Handlers (Deferred to Phase 2 Integration)
The following files currently use `getCanonicalRubroId()` but do not yet enforce `validateCanonicalRubro()`:

- `services/finanzas-api/src/handlers/invoices.ts` - Already uses canonical mapping on read
- `services/finanzas-api/src/handlers/rubros.ts` - Uses `normalizeRubroId()`
- `services/finanzas-api/src/handlers/allocations.ts` - Stores canonical IDs
- `services/finanzas-api/src/handlers/baseline.ts` - Creates line items

**Rationale for deferring:**
- These handlers need careful integration to avoid breaking existing workflows
- Should be done in coordination with API contract testing
- Current implementation already uses canonical IDs (just not strictly validated)
- Phase 1 establishes infrastructure; Phase 2 will add strict validation calls

**Recommended approach for Phase 2:**
```typescript
// Example: Update invoices POST handler
import { validateCanonicalRubro } from '../lib/validateRubro';

// In createInvoice function:
const canonicalRubroId = validateCanonicalRubro(payload.lineItemId);
// Use canonicalRubroId for DynamoDB persistence
```

### UI Forms (Deferred to Phase 3 Integration)
The following components will use SelectRubro in future iterations:

- `src/modules/pmo/*` - Baseline forms
- `src/components/finanzas/RubroFormModal.tsx` - Rubro editing
- Invoice/reconciliation upload forms

**Rationale:**
- SelectRubro component is ready for integration
- Forms need careful UX review before changing
- Existing forms can continue working with legacy ID mapping
- Gradual rollout prevents disruption

## Impact Analysis

### Performance Impact
- **Positive**: O(1) lookup performance with Map indexes
- **Neutral**: JSON loaded once at module initialization
- **Positive**: No additional runtime API calls for mapping

### User Experience Impact
- **Positive**: Searchable dropdown is easier than free-text
- **Positive**: Prevents typos and invalid entries
- **Neutral**: Users must adapt to dropdown (vs free-text)

### Development Impact
- **Positive**: Taxonomy updates only require JSON changes
- **Positive**: No code changes needed for new rubros
- **Positive**: CI catches forbidden literals early

### Operations Impact
- **Positive**: Nightly audits provide proactive monitoring
- **Positive**: Automated deployment reduces manual work
- **Positive**: Feature flag allows gradual rollout

## Security Considerations

### Validation Security
- ✅ Server-side validation prevents injection of invalid rubros
- ✅ Error messages don't leak sensitive information
- ✅ Input normalization prevents case-based bypasses

### CI/CD Security
- ✅ GitHub Actions use OIDC (no long-lived credentials)
- ✅ Secrets properly configured in GitHub
- ✅ S3 uploads use metadata for audit trail

## Next Steps

### Immediate (Ready to Deploy)
1. Merge this PR to main
2. Deploy in audit mode (STRICT_RUBRO_VALIDATION=false)
3. Monitor logs and nightly audits for 1-2 weeks

### Short-term (Phase 2 Integration)
1. Integrate `validateCanonicalRubro()` into API handlers
2. Integrate `SelectRubro` into all forms that accept rubros
3. Write integration tests for strict validation
4. Update API documentation

### Medium-term (Phase 4)
1. Add Forecast refresh guards (lastTriggeredRef)
2. Add debug instrumentation to loadForecastData
3. Write E2E test for single-load behavior
4. Verify no polling occurs in production

### Long-term (Maintenance)
1. Enable strict mode after audit period
2. Monitor for 400 errors and adjust legacy mappings as needed
3. Gradually migrate all legacy data to canonical IDs
4. Remove legacy mappings once data migration complete

## Verification Checklist

Before deploying to production:

- [x] Taxonomy JSON validates and has no duplicates
- [x] Client and server both import from the same JSON file
- [x] Unit tests pass for validateRubro module
- [x] SelectRubro component renders correctly
- [x] CI guard catches forbidden literals
- [ ] Integration tests pass with strict validation
- [ ] E2E tests verify form submission
- [ ] Nightly audit runs successfully in dev/staging
- [ ] Deployment guide reviewed by DevOps

## Evidence Collection

### Build Artifacts
- TypeScript compiles without errors
- JSON import works in both Vite (client) and Node (server)
- No circular dependency warnings

### Test Results
- validateRubro.test.ts: All tests passing
- Covers audit mode, strict mode, batch validation
- Covers error handling and edge cases

### CI/CD Validation
- taxonomy-sync workflow validates on JSON changes
- finanzas-ci workflow includes forbidden literal check
- nightly-audit workflow ready for scheduling

## Metrics to Monitor

After deployment, track:

1. **Audit Logs**: Frequency of legacy ID usage
2. **400 Errors**: Count of validation rejections (should be 0 with proper rollout)
3. **Nightly Audit**: Number of non-canonical rubros in DynamoDB
4. **API Latency**: Verify no performance degradation from validation
5. **User Complaints**: Monitor for UX issues with SelectRubro dropdown

## Conclusion

This implementation provides a robust, scalable, and maintainable solution for canonical rubros taxonomy management. It balances strictness with flexibility through the feature flag, prevents future data quality issues through CI automation, and provides comprehensive monitoring through nightly audits.

The gradual rollout strategy (audit mode → strict mode) minimizes risk while ensuring data quality improvements.

---

**Implementation Date:** 2026-01-23  
**Last Updated:** 2026-01-23  
**Status:** Ready for Review and Deployment
