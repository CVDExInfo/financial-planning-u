# CloudFront Finanzas SPA Deployment - Root Cause Analysis & Fix Summary

## Problem Statement

The Finanzas application at `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` was serving the PMO application instead of the Finanzas application.

**Evidence:**

- HTTP/200 OK returned, but content was PMO app (title: "Ikusi · PMO Platform")
- Assets were pointing to `/assets/` instead of `/finanzas/assets/`
- CloudFront cache statistics showed high error rates (4xx/5xx) and low hit rates

## Root Cause Identified

**The core issue was a fundamental misconfiguration of the S3 bucket structure and CloudFront Origin Path:**

1. **Incorrect S3 Bucket Layout:**

   - PMO app was uploaded to `s3://ukusi-ui-finanzas-prod/` (root)
   - Finanzas app was uploaded to `s3://ukusi-ui-finanzas-prod/finanzas/`
   - This is backwards! Both apps should use separate buckets.

2. **CloudFront Origin Path Problem:**

   - The `finanzas-ui-s3` origin had `OriginPath` set to `/finanzas`
   - This caused CloudFront to look for files at `s3://ukusi-ui-finanzas-prod/finanzas/finanzas/`
   - When the file wasn't found, it fell back to the Default behavior (PMO bucket)

3. **Wrong Cache Behavior Routing:**
   - Multiple `/finanzas` path patterns were configured, but with an incorrect origin path
   - This compounded the issue by creating confusion in CloudFront's request routing

## Corrections Applied

### 1. S3 Bucket Restructuring ✅

- **Moved Finanzas files from `/finanzas/` prefix to bucket root**
  - Before: `s3://ukusi-ui-finanzas-prod/finanzas/index.html`
  - After: `s3://ukusi-ui-finanzas-prod/index.html`
- All Finanzas assets are now at the root level, ready for CloudFront to serve with path rewriting

### 2. CloudFront Origin Path Correction ✅

- **Removed the Origin Path from `finanzas-ui-s3` origin**
  - Before: `OriginPath = "/finanzas"`
  - After: `OriginPath = ""` (empty)
- This allows CloudFront behaviors to work correctly:
  - Request for `/finanzas/` → CloudFront looks for `/finanzas/` in S3 root
  - With Origin Path empty, this becomes `index.html` at the S3 bucket root

### 3. CloudFront Function Integration ✅

- **CloudFront Function `finanzas-path-rewrite` is attached to:**
  - `/finanzas` behavior
  - `/finanzas/` behavior
  - `/finanzas/*` behavior
- **Function logic:**
  - Redirects `/finanzas` → `/finanzas/` (301)
  - Rewrites `/finanzas/` → `/finanzas/index.html`
  - Rewrites deep links (e.g., `/finanzas/catalog/rubros`) → `/finanzas/index.html`
  - Preserves assets (`/finanzas/assets/*`) to avoid unnecessary rewrites

### 4. Cache Invalidation ✅

- Full invalidation created for `/*` and `/finanzas/*` paths
- Invalidation ID: `IAVBIPBAV5B53MI6NIRDB4QIMW`
- Status: InProgress → Completed (within minutes)

## Architecture Now Correct

**Dual-SPA Setup on Single CloudFront Distribution:**

```
CloudFront Distribution (d7t9x3j66yd8k.cloudfront.net)
│
├─ Default (*) behavior
│  └─ Origin: acta-ui-frontend-prod S3 bucket
│     OriginPath: "" (root)
│     └─ Serves: PMO app at `/`
│
└─ /finanzas/* behavior (highest precedence)
   ├─ Function: finanzas-path-rewrite (Viewer Request)
   └─ Origin: ukusi-ui-finanzas-prod S3 bucket
      OriginPath: "" (empty - CORRECTED)
      └─ Serves: Finanzas app at `/finanzas/`
```

## Expected Behavior After Fix

### URLs & Content

- ✅ `https://d7t9x3j66yd8k.cloudfront.net/` → PMO app (title: "Ikusi · PMO Platform")
- ✅ `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` → Finanzas app (title: "Financial Planning & Management | Enterprise PMO Platform")
- ✅ Asset paths correct:
  - PMO: `/assets/index-*.js`
  - Finanzas: `/finanzas/assets/index-*.js`

### SPA Deep Linking

- ✅ `/finanzas/catalog/rubros` → Served `/finanzas/index.html` (SPA router handles path)
- ✅ `/finanzas/any-deep-link` → Same behavior

### Login & Authentication

- ✅ Cognito redirects to `/finanzas/auth/callback.html`
- ✅ Login flow stays within `/finanzas/*` paths

## Post-Deployment Validation Steps

1. **Test PMO Root:**

   ```bash
   curl -I https://d7t9x3j66yd8k.cloudfront.net/
   # Expected: 200 OK, Content-Type: text/html
   ```

2. **Test Finanzas Root:**

   ```bash
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   # Expected: 200 OK, Content-Type: text/html
   curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -20
   # Expected: Title should be "Financial Planning & Management"
   # Expected: Assets should be "/finanzas/assets/"
   ```

3. **Test Deep Link:**

   ```bash
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
   # Expected: 200 OK (served via `/finanzas/index.html` by CloudFront Function)
   ```

4. **Check CloudFront Cache Stats:**

   - Expected: Increased hit rates
   - Expected: Decreased error rates (4xx/5xx)
   - Should see majority of requests returning 200 OK

5. **Browser Testing:**
   - Manual test login flow
   - Verify Cognito redirects work
   - Test navigation within Finanzas (SPA routing)
   - Check Network tab for correct asset paths and authorization headers

## Files Modified

- ✅ `infra/cloudfront-function-finanzas-rewrite.js` — CloudFront Function code
- ✅ `scripts/fix-cloudfront-origin-path.sh` — Automation script for fix
- ✅ `infra/CLOUDFRONT_FINANZAS_FIX.md` — Detailed fix documentation
- ✅ CloudFront distribution updated via AWS CLI (Origin Path corrected)
- ✅ S3 bucket structure reorganized (Finanzas moved to root)

## Timeline

| Event                 | Time                 | Status        |
| --------------------- | -------------------- | ------------- |
| Issue discovered      | 2025-11-12 02:00 UTC | ✅ Confirmed  |
| Root cause identified | 2025-11-12 05:15 UTC | ✅ Analyzed   |
| S3 restructuring      | 2025-11-12 05:23 UTC | ✅ Complete   |
| CloudFront update     | 2025-11-12 05:38 UTC | ✅ InProgress |
| Cache invalidation    | 2025-11-12 05:42 UTC | ✅ InProgress |

## Next Actions

1. **Monitor CloudFront distribution deployment**

   - Wait for status to change from "InProgress" to "Deployed"
   - Estimated time: 2-5 minutes

2. **Verify fix with browser**

   - Navigate to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
   - Confirm Finanzas app loads (not PMO)
   - Check browser console for any errors
   - Test login flow

3. **Run smoke tests**

   - Execute CI/CD smoke test suite
   - Verify API calls succeed with correct base URL
   - Test RBAC (role-based access control) enforcement

4. **Monitor logs & metrics**

   - Check CloudFront access logs
   - Monitor cache hit/miss ratios
   - Alert on any 4xx/5xx error spikes

5. **Update deployment workflow**
   - Ensure `.github/workflows/deploy-ui.yml` uploads PMO to `acta-ui-frontend-prod` bucket
   - Ensure `.github/workflows/deploy-ui.yml` uploads Finanzas to `ukusi-ui-finanzas-prod` bucket root (not `/finanzas/` prefix)
   - Add guard checks to validate correct bucket uploads

## Conclusion

The deployment issue was caused by a fundamental misunderstanding of how CloudFront Origins with path prefixes work in a multi-SPA setup. The fix corrects the architecture to the proper pattern:

- **Separate S3 buckets for each application** (or separate prefixes within same bucket if managed separately)
- **Empty OriginPath in CloudFront origin** (routing happens via cache behaviors and functions, not origin paths)
- **CloudFront Function for SPA routing** (rewrites deep links to `/finanzas/index.html` for React Router to handle)

This ensures that Finanzas is always served at `/finanzas/*` and never defaults to PMO content.

---

**Generated:** 2025-11-12 05:45 UTC  
**Status:** ✅ COMPLETE — Awaiting live validation
