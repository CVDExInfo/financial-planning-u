# Finanzas Deployment - Implementation Checklist ✅

## Document Status

**Date**: November 8, 2025  
**Status**: 🟢 IMPLEMENTATION COMPLETE  
**Deployment Type**: Dual-SPA (PMO + Finanzas) to CloudFront  
**API Gateway**: https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

---

## 🎯 Objective Achieved

Serve Finanzas SPA from CloudFront `/finanzas/*` and call API Gateway directly, with NO Codespaces/GitHub domain leakage, enforced by automated build guards.

---

## A. Source of Truth (HARD VALUES) ✅

- [x] CloudFront distribution: `EPQU7PVDLQXUA`
- [x] CloudFront domain: `https://d7t9x3j66yd8k.cloudfront.net`
- [x] Finanzas UI bucket: `ukusi-ui-finanzas-prod`
- [x] Finanzas SPA path in CF: `/finanzas/*` (behavior → origin `finanzas-ui-s3`)
- [x] Finanzas API (dev): `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- [x] Cognito callback/sign-out: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

---

## B. Frontend Build Fixes ✅

### Vite Configuration (VERIFIED)

- [x] File: `vite.config.ts`
- [x] Setting: `base: isPmo ? "/" : "/finanzas/"`
  - For `BUILD_TARGET=finanzas`: `base: "/finanzas/"`
  - Effect: Assets resolve to `/finanzas/assets/*`
  - Location: Lines 19-20
  ```typescript
  base: isPmo ? "/" : "/finanzas/",
  ```

### React Router Basename (VERIFIED)

- [x] File: `src/App.tsx`
- [x] Setting: Dynamic basename from `VITE_APP_BASENAME` env
  - Fallback: `/finanzas` when `VITE_FINZ_ENABLED=true`
  - Effect: All routes prefixed with `/finanzas`
  - Location: Lines 60-68
  ```typescript
  const basename =
    import.meta.env.VITE_APP_BASENAME ||
    (import.meta.env.VITE_FINZ_ENABLED === "false"
      ? "/"
      : "/finanzas/"
    ).replace(/\/$/, "");
  ```

### API Client Configuration (VERIFIED)

- [x] File: `src/api/finanzasClient.ts`
- [x] Reading: `import.meta.env.VITE_API_BASE_URL`
  - NO `window.location.origin` usage
  - Effect: Always targets API Gateway URL
  - Location: Lines 3-4
  ```typescript
  const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  ```

### Code Leakage Audit (VERIFIED)

- [x] Searched: `grep -R "github.dev|codespaces|window.location.origin" src/`
- [x] Results: 1 match found in `src/lib/pdf-export.ts` line 337
- [x] Fixed: Removed `window.location.origin` default parameter

  ```typescript
  // BEFORE:
  static createShareableURL(data: PDFReportData, baseUrl: string = window.location.origin): string {

  // AFTER:
  static createShareableURL(data: PDFReportData, baseUrl: string = ''): string {
  ```

- [x] Verification: URL defaults to relative path or uses provided CloudFront domain

---

## C. Pipeline Configuration ✅

### Build Environment Variables (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Build Finanzas SDT Portal"
- [x] Implementation: Printf-based env export (no blank lines)
  ```bash
  printf '%s\n' "VITE_PUBLIC_BASE=/finanzas/" >> "$GITHUB_ENV"
  printf '%s\n' "VITE_FINZ_ENABLED=true" >> "$GITHUB_ENV"
  printf '%s\n' "VITE_USE_MOCKS=false" >> "$GITHUB_ENV"
  printf '%s\n' "VITE_API_BASE_URL=${VITE_API_BASE_URL%/}" >> "$GITHUB_ENV"
  printf '%s\n' "VITE_AWS_REGION=us-east-2" >> "$GITHUB_ENV"
  sed -i 's/\r$//' "$GITHUB_ENV"
  ```

### Build Guards (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Guard - Build artifact validation"
- [x] Guard 1: Asset path check
  ```bash
  if grep -R -nE 'src="/assets/|href="/assets/' dist-finanzas/index.html; then
    echo "❌ FAILED: Uses /assets/* instead of /finanzas/assets/*"; exit 1;
  fi
  ```
- [x] Guard 2: GitHub domain check
  ```bash
  if grep -R -i 'github\.dev\|codespaces' dist-finanzas/ 2>/dev/null; then
    echo "❌ FAILED: Build contains github.dev/codespaces"; exit 1;
  fi
  ```
- [x] Guard 3: Hardcoded GitHub check
  ```bash
  if grep -i 'githubusercontent\|github\.com' dist-finanzas/index.html; then
    echo "❌ FAILED: index.html has hardcoded GitHub domains"; exit 1;
  fi
  ```

### S3 Upload with Caching (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Upload Finanzas Portal to S3 (/finanzas prefix)"
- [x] Immutable assets uploaded with:
  - Prefix: `s3://ukusi-ui-finanzas-prod/finanzas/`
  - Cache-Control: `public,max-age=31536000,immutable`
  - Exclusion: `*.map` files
  - Effect: Aggressive caching for versioned assets
- [x] SPA entry uploaded with:
  - Path: `s3://ukusi-ui-finanzas-prod/finanzas/index.html`
  - Cache-Control: `no-store`
  - Content-Type: `text/html; charset=utf-8`
  - Effect: Always fresh index, preventing stale deployments

### CloudFront Behavior Verification (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Guard - Verify CloudFront /finanzas/\* Behavior (CRITICAL)"
- [x] Checks performed:
  1. Behavior exists: Query for `/finanzas/*` path pattern
  2. Target origin: Verify points to `finanzas-ui-s3`
  3. SmoothStreaming: Verify disabled (false)
  ```bash
  BEHAVIOR_COUNT=$(aws cloudfront get-distribution-config \
    --id "${CLOUDFRONT_DIST_ID}" \
    --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`] | length(@)' \
    --output text)
  ```

### CloudFront Invalidation (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Invalidate CloudFront (all paths + Finanzas SPA)"
- [x] Paths invalidated:
  - `/finanzas/*` - All SPA paths
  - `/finanzas/index.html` - SPA entry point
  ```bash
  aws cloudfront create-invalidation \
    --distribution-id EPQU7PVDLQXUA \
    --paths "/finanzas/*" "/finanzas/index.html"
  ```

---

## D. Post-Deployment Verification ✅

### UI Smoke Tests (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "UI Smoke (PMO root /)"
- [x] Step: "UI Smoke (Finanzas /finanzas/)"
- [x] Checks:
  - HTTP status verification (200 expected)
  - Asset path verification (/finanzas/assets/ expected)
  - Leakage detection (github.dev/codespaces should not exist)
  - HTML structure inspection
  ```bash
  curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
  curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep '/finanzas/assets/'
  ```

### API Smoke Tests (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "API Smokes (if DEV_API_URL set)"
- [x] Health check (public):
  ```bash
  curl -sS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
  ```
- [x] Protected endpoints documentation:

  ```bash
  # Get IdToken (not AccessToken!)
  aws cognito-idp initiate-auth --region us-east-2 \
    --auth-flow USER_PASSWORD_AUTH --client-id dshos5iou44tuach7ta3ici5m \
    --auth-parameters USERNAME=$USER PASSWORD=$PASS \
    --query 'AuthenticationResult.IdToken' --output text

  # Test protected endpoints
  curl -H "Authorization: Bearer $ID_TOKEN" $API/catalog/rubros
  curl -H "Authorization: Bearer $ID_TOKEN" $API/allocation-rules
  ```

### CloudFront Sanity Check (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Guard - Verify CloudFront /finanzas/\* Behavior"
- [x] Post-patch verification query:
  ```bash
  aws cloudfront get-distribution --id EPQU7PVDLQXUA \
    --query "Distribution.DistributionConfig.CacheBehaviors.Items[?PathPattern=='/finanzas/*'].[TargetOriginId,SmoothStreaming]" \
    --output text
  # Expected: finanzas-ui-s3   false
  ```

---

## E. Evidence & Documentation ✅

### Deployment Guide (CREATED)

- [x] File: `FINANZAS_DEPLOYMENT_VERIFICATION.md`
- [x] Contents:
  - Source of truth values
  - Pre-deployment checklist
  - Deployment steps
  - Post-deployment verification procedures
  - Troubleshooting guide
  - Final verification script

### Smoke Test Script (CREATED)

- [x] File: `scripts/finanzas-smoke-tests.sh`
- [x] Features:
  - CloudFront configuration verification
  - S3 bucket validation
  - UI accessibility checks
  - Asset path verification
  - Leakage detection
  - API connectivity tests
  - Optional Cognito authentication tests
- [x] Usage:
  ```bash
  bash scripts/finanzas-smoke-tests.sh [username] [password]
  ```

### GitHub Actions Summary (IMPLEMENTED)

- [x] File: `.github/workflows/deploy-ui.yml`
- [x] Step: "Summary & Evidence Pack"
- [x] Evidence provided in `$GITHUB_STEP_SUMMARY`:
  - Deployment checklist status
  - Access points (UI + API)
  - Verification commands
  - Build information
  - Environment variables
  - Cache configuration

---

## F. Deployment Readiness Checklist

### Code ✅

- [x] Vite base = `/finanzas/` (finanzas build)
- [x] Router basename = `/finanzas`
- [x] API client uses `VITE_API_BASE_URL` only
- [x] No `window.location.origin` hardcoded
- [x] No github.dev/codespaces references
- [x] No GitHub domain hardcodes

### Build ✅

- [x] Environment variables set via printf
- [x] Build guards implemented (assets, github.dev, domains)
- [x] CloudFront behavior validation
- [x] Build target selection logic

### Deployment ✅

- [x] S3 upload with correct paths and cache headers
- [x] CloudFront invalidation of /finanzas/\*
- [x] Behavior verification post-deploy

### Testing ✅

- [x] UI smoke tests in workflow
- [x] API smoke tests in workflow
- [x] Asset path verification
- [x] Leakage detection
- [x] Stand-alone smoke test script

### Documentation ✅

- [x] Deployment verification guide
- [x] Smoke test script
- [x] GitHub Actions summary evidence
- [x] Troubleshooting procedures
- [x] Cognito callback URLs specified

---

## G. Critical URLs & IDs

| Component                  | Value                                                        |
| -------------------------- | ------------------------------------------------------------ |
| CloudFront Distribution ID | `EPQU7PVDLQXUA`                                              |
| CloudFront Domain          | `https://d7t9x3j66yd8k.cloudfront.net`                       |
| S3 Bucket                  | `ukusi-ui-finanzas-prod`                                     |
| S3 Prefix for Finanzas     | `/finanzas/`                                                 |
| CloudFront Behavior Path   | `/finanzas/*`                                                |
| CloudFront Origin          | `finanzas-ui-s3`                                             |
| API Gateway Base           | `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` |
| API Gateway Region         | `us-east-2`                                                  |
| API Host ID                | `m3g6am67aj`                                                 |
| Cognito Client ID          | `dshos5iou44tuach7ta3ici5m`                                  |
| Cognito Region             | `us-east-2`                                                  |
| Cognito Callback URL       | `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`             |
| Cognito Sign-out URL       | `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`             |

---

## H. How to Use This Implementation

### For Developers

1. **Local Build**: Set `BUILD_TARGET=finanzas npm run build`
2. **Verify Assets**: Check `dist-finanzas/index.html` contains `/finanzas/assets/` paths
3. **Run Smoke Tests**: Execute `bash scripts/finanzas-smoke-tests.sh` after deployment

### For CI/CD

1. **Trigger**: Merge to `main` branch
2. **Workflow**: `.github/workflows/deploy-ui.yml` automatically runs
3. **Guards**: All checks run automatically; build fails if guards fail
4. **Summary**: Review `$GITHUB_STEP_SUMMARY` for evidence

### For Operations

1. **Monitor**: Check CloudFront cache metrics and invalidation status
2. **Verify**: Run `scripts/finanzas-smoke-tests.sh username password` post-deploy
3. **Troubleshoot**: Follow procedures in `FINANZAS_DEPLOYMENT_VERIFICATION.md`

---

## I. Deployment Workflow Summary

```
┌─────────────────────────────────────┐
│  Trigger: Push to main/r1-finanzas  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Preflight: Validate env vars       │
│  - S3_BUCKET_NAME                   │
│  - CLOUDFRONT_DIST_ID               │
│  - DEV_API_URL                      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Build Phase                        │
│  - Build PMO (BUILD_TARGET=pmo)     │
│  - Build Finanzas (BUILD_TARGET=...) │
│  - Set VITE_* env vars via printf   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Guard Phase (CRITICAL)             │
│  ✓ Asset paths use /finanzas/       │
│  ✓ No github.dev/codespaces         │
│  ✓ No GitHub domains                │
│  ✓ /finanzas/* behavior exists      │
│  ✓ API endpoint ID matches          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  AWS Auth (OIDC)                    │
│  - Assume ProjectplaceLambdaRole    │
│  - Region: us-east-2                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Deploy Phase                       │
│  - Upload PMO to s3://bucket/       │
│  - Upload Finanzas to s3://.../fx/  │
│  - Set cache headers                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Invalidation                       │
│  - Invalidate /finanzas/*           │
│  - Invalidate /finanzas/index.html  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Smoke Tests                        │
│  ✓ UI HTTP 200                      │
│  ✓ Asset paths correct              │
│  ✓ No leakage detected              │
│  ✓ API health check                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Summary & Evidence                 │
│  - Deployment checklist             │
│  - Access URLs                      │
│  - Verification commands            │
│  - Build info                       │
└─────────────────────────────────────┘
```

---

## J. Rollback Procedure (if needed)

1. **Identify Last Good Build**: Check GitHub Actions history
2. **Revert S3**: Sync previous build to S3
3. **Invalidate CloudFront**: `aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA --paths "/finanzas/*"`
4. **Verify**: Run smoke tests to confirm rollback

---

## K. Known Limitations & Notes

1. **Cognito Tokens**: Must use **IdToken** (not AccessToken) for API calls
2. **Cache Timing**: CloudFront invalidation takes 30-60 seconds to propagate
3. **Asset Versioning**: Immutable assets only change on rebuild
4. **Local Development**: Test with `VITE_API_BASE_URL` env var set

---

## Final Sign-Off ✅

- [x] All code changes implemented
- [x] All build guards added
- [x] All deployment steps configured
- [x] All verification procedures documented
- [x] Smoke test scripts created
- [x] Evidence documentation complete

**Status**: 🟢 **READY FOR DEPLOYMENT**

---

**Last Updated**: November 8, 2025  
**Implementation**: Complete  
**Testing**: Ready  
**Deployment**: Ready
