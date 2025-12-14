# SDMT Project Visibility Fix - Implementation Summary

## Executive Summary

**Issue**: SDM users could only see seeded/canonical demo projects in the UI. Real projects created by users were invisible due to RBAC regression.

**Root Cause**: GET /projects RBAC filter only matched `sdm_manager_email`, `accepted_by`, or `aceptado_por` fields. Many real projects didn't have these fields populated, making them invisible to SDM users.

**Solution**: 
1. Added `created_by` as fallback in RBAC filter
2. Required `sdm_manager_email` for new project creation
3. Created migration script to backfill existing projects
4. Updated UI to include SDM assignment field

**Status**: ✅ COMPLETE - All 306 tests passing, security scan clean

---

## Implementation Details

### Backend Changes

#### 1. projects.ts - Fixed SDM RBAC Filter
**File**: `services/finanzas-api/src/handlers/projects.ts`

**Change**: Added `created_by` to SDM user filter expression (line 1267)

```typescript
// OLD (broken)
"(#sdmEmail = :userEmail OR #acceptedBy = :userEmail OR #aceptadoPor = :userEmail)"

// NEW (fixed)
"(#sdmEmail = :userEmail OR #acceptedBy = :userEmail OR #aceptadoPor = :userEmail OR #createdBy = :userEmail)"
```

**Impact**: SDM users now see projects they created, even if `sdm_manager_email` wasn't set at creation time.

#### 2. projects.ts - Enforce SDM Assignment
**Change**: Made `sdm_manager_email` required for PMO/SDMT/ADMIN when creating projects (lines 1064-1087)

```typescript
if (userContext.isSDM) {
  sdmManagerEmail = userContext.email; // Auto-assign
} else if (userContext.isPMO || userContext.isSDMT || userContext.isAdmin) {
  sdmManagerEmail = body.sdm_manager_email || body.sdmManagerEmail;
  if (!sdmManagerEmail) {
    return bad("sdm_manager_email is required for PMO/SDMT/ADMIN users", 400);
  }
}
```

**Impact**: Prevents creation of "orphaned" projects going forward.

#### 3. projects.ts - Diagnostic Logging
**Change**: Added warning when SDM sees 0 projects but unassigned projects exist (lines 1284-1312)

**Impact**: Helps diagnose future visibility issues in CloudWatch logs.

#### 4. auth.ts - Allow SDM to Write
**File**: `services/finanzas-api/src/lib/auth.ts`

**Change**: Updated `ensureCanWrite` to include SDM role (line 273)

```typescript
// OLD
if (roles.includes("PMO") || roles.includes("SDMT")) return;

// NEW
if (roles.includes("PMO") || roles.includes("SDMT") || roles.includes("SDM")) return;
```

**Impact**: SDM users can now create projects (which auto-assign them as manager).

### Frontend Changes

#### 5. ProjectsManager.tsx - Add SDM Field
**File**: `src/modules/finanzas/ProjectsManager.tsx`

**Changes**:
- Added `sdmManagerEmail` state field
- Added required email input to Create Project form
- Updated validation to require the field
- Included in API payload

**Impact**: PMO/SDMT users must assign an SDM when creating projects.

#### 6. finanzasClient.ts - Update Schema
**File**: `src/api/finanzasClient.ts`

**Change**: Added `sdm_manager_email` to `ProjectCreateSchema`

```typescript
sdm_manager_email: z.string().email().optional()
```

**Impact**: Type-safe validation for the new field.

### Migration Script

#### 7. backfill-sdm-manager-email.ts
**File**: `services/finanzas-api/scripts/backfill-sdm-manager-email.ts`

**Features**:
- Scans all existing projects
- Derives `sdm_manager_email` from `accepted_by` or `created_by`
- Dry-run mode by default (use `--apply` to execute)
- Idempotent (never overwrites existing values)
- Creates audit trail entries
- Reports projects needing manual review

**Usage**:
```bash
# Dry run
AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects \
  ts-node scripts/backfill-sdm-manager-email.ts

# Apply changes
AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects \
  ts-node scripts/backfill-sdm-manager-email.ts --apply
```

### Documentation

#### 8. VERIFICATION_RUNBOOK_PROJECT_VISIBILITY.md
Comprehensive 9-part runbook covering:
- Pre-deployment checklist
- API deployment steps
- Migration execution (dry-run + apply)
- API verification (curl examples)
- UI verification steps
- CloudWatch monitoring
- Rollback procedures
- Success criteria

---

## Testing

### Unit Tests
- **Total**: 306 tests
- **Status**: All passing ✅
- **New Tests**: 11 RBAC regression tests

### Key Test Coverage
1. SDM sees projects with `sdm_manager_email` match
2. SDM sees projects with `accepted_by` match
3. SDM sees projects with `created_by` match (NEW - regression test)
4. SDM doesn't see unrelated projects
5. ADMIN/PMO see all projects
6. SDM user creating project gets auto-assigned
7. PMO creating project must provide `sdm_manager_email`
8. PMO creating without `sdm_manager_email` gets 400 error (NEW)

### Security Scan
- **Status**: Clean ✅
- **Alerts**: 0 vulnerabilities found

---

## Deployment Guide

### Prerequisites
- [x] All 306 tests passing
- [x] Security scan clean
- [x] Code review complete
- [x] Migration script tested locally

### Deployment Steps

#### Step 1: Deploy API
```bash
cd services/finanzas-api
sam build
sam deploy --stack-name finanzas-sd-api-<env> \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM
```

#### Step 2: Run Migration (Dry Run)
```bash
AWS_REGION=us-east-2 \
TABLE_PROJECTS=finz_projects_<env> \
TABLE_AUDIT=finz_audit_log_<env> \
npx ts-node scripts/backfill-sdm-manager-email.ts
```

Review the output. Expected results:
- Projects with `sdm_manager_email` already set: SKIP
- Projects with `accepted_by`/`created_by`: UPDATE
- Projects with no email fields: NEEDS_MANUAL_REVIEW

#### Step 3: Apply Migration
```bash
AWS_REGION=us-east-2 \
TABLE_PROJECTS=finz_projects_<env> \
TABLE_AUDIT=finz_audit_log_<env> \
npx ts-node scripts/backfill-sdm-manager-email.ts --apply
```

#### Step 4: Verify
See `VERIFICATION_RUNBOOK_PROJECT_VISIBILITY.md` for complete verification steps.

**Quick Verification**:
```bash
# As SDM user
curl -H "Authorization: Bearer $SDM_TOKEN" \
  https://<api-url>/projects | jq '.data | length'

# Should see more projects than before migration
```

#### Step 5: Deploy Frontend
```bash
# Standard UI deployment
npm run build
# Deploy to CloudFront/S3
```

---

## Rollback Plan

### If Issues Detected

#### Option 1: Rollback Lambda Only
```bash
# Lambda automatically keeps previous versions
aws lambda update-alias \
  --function-name finanzas-projects-handler-<env> \
  --name live \
  --function-version <previous-version>
```

**Impact**: Projects created after deployment may be orphaned, but backend works.

#### Option 2: Rollback Migration (Rare)
**⚠️ WARNING**: Only if data corruption detected. Migration is additive (safe).

```bash
# Query audit log
aws dynamodb query \
  --table-name finz_audit_log_<env> \
  --index-name ActionIndex \
  --key-condition-expression "action = :action" \
  --expression-attribute-values '{":action":{"S":"BACKFILL_SDM_MANAGER_EMAIL"}}'

# Review "before" states and restore if needed
```

---

## Success Criteria

### Functional Requirements
- [x] SDM users see projects they manage (sdm_manager_email match)
- [x] SDM users see projects they accepted (accepted_by match)
- [x] SDM users see projects they created (created_by match - NEW)
- [x] SDM users can create new projects (auto-assigned as manager)
- [x] PMO users must provide SDM assignment when creating projects
- [x] PMO cannot create projects without SDM assignment (400 error)
- [x] Admin/PMO/EXEC_RO see all projects (no filtering)
- [x] Downstream endpoints work (allocations, forecast, rubros)

### UI Requirements
- [x] Project dropdown shows correct projects per role
- [x] Create Project form includes SDM Manager field (required)
- [x] Form validation prevents submission without SDM
- [x] Error messages are clear and actionable

### Non-Functional Requirements
- [x] All 306 tests passing
- [x] No security vulnerabilities (CodeQL clean)
- [x] Migration script is idempotent
- [x] Audit trail created for all changes
- [x] Diagnostic logging in place
- [x] Comprehensive runbook provided

---

## Monitoring

### Key Metrics to Watch

**CloudWatch Logs - Warning Indicators**:
```
[projects] SDM user sees 0 projects, but tenant has unassigned projects
```
**Action**: If this appears after migration, check unassigned project IDs and manually assign.

**CloudWatch Logs - Success Indicators**:
```
[projects] SDM filtered projects { sdmEmail: "sdm@example.com", projectCount: N }
```
Where N > 0 for active SDMs.

**DynamoDB Metrics**:
- Watch for increased scan operations (temporary until GSI deployed)
- No impact expected on write throughput

---

## Known Limitations

1. **Scan vs Query**: Currently using Scan with filter for SDM users. Plan to migrate to GSI query for better performance once GSI on `sdm_manager_email` is deployed.

2. **Manual Review Items**: Migration may report projects needing manual SDM assignment if they have no email fields. These require PMO intervention.

3. **Legacy Field Names**: System supports both camelCase and snake_case field names for backward compatibility. Future work: normalize to single format.

---

## Files Changed

### Backend (6 files)
- `services/finanzas-api/src/handlers/projects.ts` - RBAC filter fix, SDM assignment requirement
- `services/finanzas-api/src/lib/auth.ts` - Allow SDM to write
- `services/finanzas-api/scripts/backfill-sdm-manager-email.ts` - NEW migration script
- `services/finanzas-api/tests/unit/projects.rbac.spec.ts` - 11 new tests
- `services/finanzas-api/tests/projects.spec.ts` - Updated payloads
- `services/finanzas-api/tests/unit/auth.spec.ts` - Updated error message

### Frontend (2 files)
- `src/modules/finanzas/ProjectsManager.tsx` - Added SDM field to form
- `src/api/finanzasClient.ts` - Updated schema

### Documentation (1 file)
- `VERIFICATION_RUNBOOK_PROJECT_VISIBILITY.md` - NEW comprehensive runbook

**Total**: 9 files changed, ~700 lines added

---

## Security Summary

### Security Posture: ✅ STRENGTHENED

**No Vulnerabilities Detected**:
- CodeQL scan: 0 alerts
- No SQL injection risks (DynamoDB with parameterized queries)
- No XSS risks (backend API only)
- No authentication bypass (JWT validated)

**Access Control**:
- ✅ Tenant isolation maintained (no cross-tenant leaks)
- ✅ SDM users scoped to their projects only
- ✅ Admin/PMO retain full access
- ✅ Role-based filtering enforced at API layer
- ✅ No privilege escalation vectors

**Audit Trail**:
- ✅ All project creations logged
- ✅ All migration changes logged
- ✅ User actions traceable via audit_log table

**Data Integrity**:
- ✅ Migration is idempotent
- ✅ Never overwrites existing sdm_manager_email
- ✅ Backup via audit log "before" states

---

## Future Enhancements

### Phase 2 (Recommended)
1. **Deploy GSI on sdm_manager_email**: Switch from Scan to Query for better performance
2. **Bulk Assignment UI**: Allow PMO to batch-assign SDM to multiple projects
3. **Field Normalization**: Migrate all records to consistent camelCase format
4. **Self-Service Reassignment**: Allow SDM to transfer project ownership

### Performance Optimization
- Current: Scan with filter (O(n) complexity)
- Future: Query on GSI (O(log n) complexity)
- Expected improvement: 10-100x faster for large datasets

---

## Contact

**Implementation Team**: Platform Engineering  
**Date Completed**: 2024-12-14  
**PR Branch**: `copilot/fix-visible-projects-in-ui`  
**Status**: ✅ Ready for Production Deployment

**For Issues**:
- Slack: #finanzas-platform
- Email: platform-team@example.com
- On-call: Check PagerDuty schedule

---

## Appendix: Root Cause Analysis

### Timeline
1. **Earlier**: RBAC/ABAC implementation added project visibility filtering
2. **Recent**: Filter narrowed to only projects with `sdm_manager_email` or `accepted_by`
3. **Regression**: Many real user projects lacked these fields → became invisible to SDM users
4. **Symptom**: Project dropdown only showed seeded/canonical demos

### Why This Wasn't Caught Earlier
- Seeded projects all had `accepted_by` set → worked in demos
- Real user projects often created without SDM assignment → broke in production
- Tests didn't cover "orphaned project" scenario → regression not detected

### Lessons Learned
1. **Test with real-world data**: Not just seeded demos
2. **Enforce data requirements early**: Should have required SDM assignment from day 1
3. **Add diagnostic logging**: Makes troubleshooting much faster
4. **Regression tests**: Critical for RBAC changes

### Prevention Measures Implemented
- ✅ SDM assignment now required at creation
- ✅ Diagnostic logging when visibility issues detected
- ✅ Comprehensive regression tests added
- ✅ Migration script to fix existing data
- ✅ Documentation and runbook for future reference

---

**Document Version**: 1.0  
**Last Updated**: 2024-12-14  
**Owner**: Platform Engineering Team
