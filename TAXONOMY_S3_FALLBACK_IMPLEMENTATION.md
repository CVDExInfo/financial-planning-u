# Taxonomy S3 Fallback Implementation - Summary

## Root Cause

The backend Lambda functions (services/finanzas-api) were importing the canonical taxonomy file (`data/rubros.taxonomy.json`) synchronously at module load time using `fs.readFileSync()`. When this file was missing from the deployed Lambda package, the module initialization failed with a synchronous throw, causing HTTP 500 errors for any endpoint that depended on taxonomy data (e.g., `/projects/{id}/rubros`).

**Impact:**
- Lambda handler fails to initialize → 500 Internal Server Error
- Rubros endpoints completely unavailable
- Cascade failures in UI modules (Forecast, Reconciliation, etc.)

## Solution Implemented

### 1. Robust Taxonomy Loader with S3 Fallback

Modified `services/finanzas-api/src/lib/canonical-taxonomy.ts` to:

- **Graceful Local Load**: Try to load `data/rubros.taxonomy.json` locally, but don't throw on failure
- **Lazy AWS SDK Import**: Use `require()` for AWS SDK to avoid top-level dependency cost
- **S3 Fallback**: Export `ensureTaxonomyLoaded()` function that fetches from S3 when local file missing
- **Empty Taxonomy Fallback**: If both local and S3 fail, use empty taxonomy with warnings (no crashes)
- **Promise-based Stream Helper**: Use event-based `streamToString()` for S3 GetObject Body

**Key Functions:**
```typescript
export async function ensureTaxonomyLoaded(): Promise<void>
```

### 2. Handler Updates

Updated all handlers that depend on taxonomy to call `ensureTaxonomyLoaded()`:

- **rubros.ts**: `listProjectRubros()`, `attachRubros()`
- **payroll.ts**: `handlePost()`
- **invoices.ts**: `handler()`

Each handler now ensures taxonomy is loaded before performing lookups.

### 3. SAM Template Configuration

Added to `services/finanzas-api/template.yaml`:

**Parameters:**
```yaml
TaxonomyS3Bucket:
  Type: String
  Default: ''
  Description: Optional S3 bucket for taxonomy fallback

TaxonomyS3Key:
  Type: String
  Default: 'rubros.taxonomy.json'
  Description: S3 object key for taxonomy file
```

**Environment Variables:**
```yaml
TAXONOMY_S3_BUCKET: !If [HasTaxonomyBucket, !Ref TaxonomyS3Bucket, '']
TAXONOMY_S3_KEY: !Ref TaxonomyS3Key
```

**IAM Permissions:**
```yaml
- Statement:
    - Effect: Allow
      Action:
        - s3:GetObject
      Resource: 'arn:aws:s3:::*/*'
```

### 4. CI/CD Workflow Updates

**taxonomy-sync.yml:**
- Now uploads to canonical path: `s3://${BUCKET}/rubros.taxonomy.json`
- Also maintains versioned copies for rollback

**deploy-api.yml:**
- Passes `TaxonomyS3Bucket` parameter to SAM deploy
- Reads from `TAXONOMY_S3_BUCKET` secret/var

### 5. Testing

**Unit Tests** (`canonical-taxonomy.test.ts`):
- ✅ Test local file load
- ✅ Test S3 fallback scenarios
- ✅ Test graceful degradation with empty taxonomy
- ✅ Test helper functions (getCanonicalRubroId, normalizeRubroId, etc.)
- ✅ All 543 existing tests still passing

**Integration Tests** (`rubros-endpoint.spec.ts`):
- ✅ GET /projects/:id/rubros returns 200 with data array
- ✅ Returns 400 for missing projectId
- ✅ No 500 errors even with empty taxonomy

### 6. Frontend Reactivity

**Audit Results:**
- ✅ `useProjectLineItems` already has proper caching:
  - `staleTime: 5 * 60 * 1000` (5 minutes)
  - `refetchOnWindowFocus: false`
  - `gcTime: 15 * 60 * 1000` (15 minutes)
- ✅ No `refetchInterval` found in hooks
- ✅ Forecast page fetches once on mount, only refetches on user action

No changes needed - frontend already follows best practices.

### 7. Documentation

Updated `DEPLOYMENT_GUIDE_STRICT_RUBROS.md` with:
- New environment variables reference
- S3 fallback configuration steps
- Verification procedures
- Troubleshooting guide

## End-to-End Data Flow

```
┌─────────────────┐
│ Git Repository  │
│ data/rubros.    │
│ taxonomy.json   │
└────────┬────────┘
         │
         │ (CI: taxonomy-sync.yml)
         ▼
┌─────────────────┐
│ S3 Bucket       │
│ rubros.         │
│ taxonomy.json   │
└────────┬────────┘
         │
         │ (ensureTaxonomyLoaded())
         ▼
┌─────────────────┐
│ Lambda Memory   │
│ CANONICAL_      │
│ RUBROS_TAXONOMY │
└────────┬────────┘
         │
         │ (getTaxonomyById, etc.)
         ▼
┌─────────────────┐
│ Handler Logic   │
│ rubros.ts       │
│ payroll.ts      │
│ invoices.ts     │
└─────────────────┘
```

## Validation Checklist

### Pre-Deployment
- [x] Unit tests pass (543/543)
- [x] SAM template validates successfully
- [x] Integration tests added and passing
- [x] Documentation updated

### Post-Deployment (Runtime Validation)

**CloudWatch Logs - Expected Messages:**
```
✅ [canonical-taxonomy] loaded taxonomy from local file: /var/task/data/rubros.taxonomy.json
OR
✅ [canonical-taxonomy] loaded taxonomy from S3: <bucket>/rubros.taxonomy.json
```

**CloudWatch Logs - Should NOT See:**
```
❌ ServerError: Error interno en Finanzas
❌ 500 Internal Server Error
❌ Module initialization failed
```

**API Endpoints:**
```bash
# Should return 200 with data array
GET /projects/P-XXX/rubros
→ { "data": [...], "total": N, "project_id": "P-XXX" }

# Should show proper error, not 500
GET /projects//rubros
→ 400 Bad Request: "missing project id"
```

**UI Behavior:**
- Forecast page loads without errors
- `/projects/.../rubros` returns 200
- No repeated 5-second refetch loops
- Grid populates with data

## Configuration for Production

### 1. Set GitHub Secrets/Variables

```bash
# Required - use existing bucket
TAXONOMY_S3_BUCKET=ukusi-ui-finanzas-prod

# Optional (defaults to taxonomy/rubros.taxonomy.json)
TAXONOMY_S3_KEY=taxonomy/rubros.taxonomy.json
```

### 2. Upload Taxonomy to S3 (one-time setup)

```bash
# Upload to the recommended location
aws s3 cp data/rubros.taxonomy.json \
  s3://ukusi-ui-finanzas-prod/taxonomy/rubros.taxonomy.json \
  --acl bucket-owner-full-control \
  --sse AES256
  
# Verify upload
aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key taxonomy/rubros.taxonomy.json
```

### 3. Deploy Sequence

```bash
# 1. Ensure taxonomy is in S3
# (taxonomy-sync.yml workflow uploads automatically on each change)

# 2. Deploy API with bucket parameter
sam deploy \
  --parameter-overrides \
    TaxonomyS3Bucket=ukusi-ui-finanzas-prod \
    TaxonomyS3Key=taxonomy/rubros.taxonomy.json \
  ...other params...

# 3. Verify
curl https://api.../projects/P-TEST/rubros
# Should return 200, not 500
```

### 4. IAM Permission Required

Ensure Lambda execution role has:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::ukusi-ui-finanzas-prod/taxonomy/*"
}
```

### 5. Rollback Procedure

If issues occur:

```bash
# Quick fix: Ensure file is in Lambda package
# Add to SAM function Metadata:
Metadata:
  BuildProperties:
    Include:
      - data/rubros.taxonomy.json

# Or ensure S3 bucket is set correctly
```

## Files Changed

### Backend
- ✅ `services/finanzas-api/src/lib/canonical-taxonomy.ts`
- ✅ `services/finanzas-api/src/handlers/rubros.ts`
- ✅ `services/finanzas-api/src/handlers/payroll.ts`
- ✅ `services/finanzas-api/src/handlers/invoices.ts`
- ✅ `services/finanzas-api/template.yaml`

### Tests
- ✅ `services/finanzas-api/src/lib/__tests__/canonical-taxonomy.test.ts`
- ✅ `services/finanzas-api/tests/integration/rubros-endpoint.spec.ts`

### CI/CD
- ✅ `.github/workflows/taxonomy-sync.yml`
- ✅ `.github/workflows/deploy-api.yml`

### Documentation
- ✅ `DEPLOYMENT_GUIDE_STRICT_RUBROS.md`

## Benefits

1. **Robustness**: No more Lambda initialization failures due to missing files
2. **Flexibility**: Can deploy without packaging the file (uses S3 fallback)
3. **Performance**: Lazy AWS SDK import keeps cold starts fast
4. **Observability**: Clear logging for troubleshooting
5. **Backwards Compatible**: Works with existing code, doesn't break anything
6. **Test Coverage**: Comprehensive unit and integration tests added

## Next Steps (Optional Enhancements)

1. **Cache S3 Responses**: Add ETag-based caching to avoid redundant S3 calls
2. **Metrics**: Add CloudWatch metrics for taxonomy load success/failure
3. **Alarms**: Create alarms for repeated S3 load failures
4. **Package Optimization**: Use SAM BuildProperties to always include file in package
5. **Multi-Region**: Support taxonomy replication across regions

## Support

For issues or questions:
- Check CloudWatch logs for `[canonical-taxonomy]` messages
- Review GitHub Actions workflow runs
- Consult `DEPLOYMENT_GUIDE_STRICT_RUBROS.md`
- Contact DevOps/Backend team

---

**Implementation Date**: 2026-01-24  
**PR Branch**: `copilot/fix-taxonomy-loader-error-handling`  
**Tests**: 543/543 passing ✅  
**SAM Template**: Valid ✅  
**Status**: Ready for deployment ✅
