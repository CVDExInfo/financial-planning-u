# PR #126 Pre-Merge Checklist

## Overview

This document contains the **pre-merge checklist** for PR #126, ensuring that the Finanzas CloudFront configuration is correct and all critical deployment requirements are met before merging.

## Important Cautions (Do These in Parallel)

These checks are **not blockers for merge**, but they ensure we don't regress on critical infrastructure:

### 1. CloudFront Function Association (CRITICAL for SPA Deep Links)

**Requirement:** The Finanzas CloudFront Function (e.g., `finanzas-path-rewrite`) **must** be associated to the following behaviors at **Viewer Request**:
- `/finanzas`
- `/finanzas/`
- `/finanzas/*`

**Why this matters:**
- Without the function, deep links (e.g., `/finanzas/catalog/rubros`) may return 404 or serve the wrong HTML
- The function rewrites SPA routes to serve `index.html` for client-side routing

**Verification:**
1. Go to CloudFront Console → Distribution → Behaviors
2. For each behavior (`/finanzas`, `/finanzas/`, `/finanzas/*`):
   - Click "Edit"
   - Scroll to "Function associations"
   - Verify that `finanzas-path-rewrite` is selected at **Viewer request** (not Viewer response)
3. Take screenshots showing the function is attached

**Note:** Infrastructure stays outside this PR. Just verify in the console after merge.

### 2. OriginPath Must Be Empty for Finanzas S3 Origin

**Requirement:** The Finanzas S3 origin **must** have `OriginPath = ""` (empty).

**Why this matters:**
- We're uploading to `s3://ukusi-ui-finanzas-prod/finanzas/…`
- CloudFront needs to forward the full path without modification
- If OriginPath is set to `/finanzas`, CloudFront will look for files at `/finanzas/finanzas/…` (wrong!)

**Expected behavior with empty OriginPath:**
- Request `/finanzas/index.html` → S3 key `finanzas/index.html` ✅
- Request `/finanzas/assets/main.js` → S3 key `finanzas/assets/main.js` ✅

**Verification:**
1. Go to CloudFront Console → Distribution → Origins
2. Find the origin with domain `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com`
3. Click "Edit"
4. Verify that **Origin path** field is **empty** (not `/finanzas`)

### 3. Finanzas HTML in Source vs. Built Output

**Source HTML (development):**
The `index.html` in the source code references `/src/main.tsx`:
```html
<script type="module" src="/src/main.tsx"></script>
```

This is **correct for development** (Vite dev server handles this).

**Built HTML (production):**
The built `dist-finanzas/index.html` will have hashed asset references:
```html
<script type="module" src="/finanzas/assets/index-{hash}.js"></script>
```

**Guard in workflow:**
The workflow already checks for this in the "Guard - Finanzas build artifacts" step:
```bash
if grep -R -nE 'src="/assets/|href="/assets/' dist-finanzas/index.html; then
  echo "❌ dist-finanzas/index.html points to /assets/* (missing base '/finanzas/')"; exit 1;
fi
```

**Reminder:** Do **not** add `aws-exports.js` into Finanzas. That's a PMO/Amplify concern only.

### 4. API Base Injection Stays As-Is

**How it works:**
The workflow computes and injects `VITE_API_BASE_URL` from:
- `FINZ_API_ID` (from repository variables)
- `FINZ_API_STAGE` (from repository variables, branch-aware)

**Formula:**
```
VITE_API_BASE_URL = https://{FINZ_API_ID}.execute-api.{AWS_REGION}.amazonaws.com/{FINZ_API_STAGE}
```

**Example:**
- Dev: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- Prod: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod`

**Action required:**
Keep these repository variables current after API redeploys:
- `FINZ_API_ID_DEV`
- `FINZ_API_ID_PROD`
- `FINZ_API_STAGE_DEV`
- `FINZ_API_STAGE_PROD`

## Pre-Merge Checklist (Fast)

Run this checklist before merging PR #126:

### ✅ Repository Variables Check

Verify the following variables are set in GitHub repository settings:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `FINANZAS_BUCKET_NAME` | ✅ Yes | `ukusi-ui-finanzas-prod` | S3 bucket for Finanzas files |
| `CLOUDFRONT_DIST_ID` | ✅ Yes | `EPQU7PVDLQXUA` | CloudFront distribution ID |
| `FINZ_API_ID_DEV` | ✅ Yes | `m3g6am67aj` | API Gateway ID for dev |
| `FINZ_API_ID_PROD` | ✅ Yes | `m3g6am67aj` | API Gateway ID for prod |
| `FINZ_API_STAGE_DEV` | ✅ Yes | `dev` | API stage name for dev |
| `FINZ_API_STAGE_PROD` | ✅ Yes | `prod` | API stage name for prod |
| `AWS_REGION` | ✅ Yes | `us-east-2` | AWS region |
| `PMO_BUCKET_NAME` | ⚠️ No longer required | N/A | PMO vars are optional |

**How to check:**
```bash
# From GitHub UI: Settings → Secrets and variables → Actions → Variables
```

### ✅ CloudFront Infrastructure Check

In the AWS CloudFront Console:

**Origin Configuration:**
- [ ] Finanzas origin `OriginPath` is **empty** (not `/finanzas`)
- [ ] Origin domain is `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com`

**Behavior Configuration:**
- [ ] Behavior exists for `/finanzas` with function attached
- [ ] Behavior exists for `/finanzas/` with function attached
- [ ] Behavior exists for `/finanzas/*` with function attached

**Function Association:**
- [ ] CloudFront function `finanzas-path-rewrite` (or similar) exists
- [ ] Function is attached at **Viewer request** (not response)
- [ ] Function is attached to **all three** `/finanzas*` behaviors

### ✅ Automated Verification

Run the automated verification script:

```bash
# From the repository root
./scripts/verify-pr126-checklist.sh --stage dev

# Or for production
./scripts/verify-pr126-checklist.sh --stage prod
```

This script will:
1. Check repository variables
2. Verify CloudFront origin path is empty
3. Verify behaviors exist
4. Check function associations
5. Verify S3 bucket structure
6. Test API endpoint
7. Guard against aws-exports.js in build

**Expected output:**
```
✅ All critical checks passed! PR #126 is ready to merge.
```

## Manual Verification Steps (Optional but Recommended)

After merging and deploying:

### 1. Test CloudFront Distribution

```bash
# Test Finanzas root
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Expected: 200 OK, HTML with /finanzas/assets/* references

# Test Finanzas deep link (SPA route)
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
# Expected: 200 OK (served via /finanzas/index.html by CloudFront Function)
```

### 2. Browser Testing

Open browser and test:
- [ ] Navigate to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] Verify Finanzas app loads (not PMO)
- [ ] Check browser console for no errors
- [ ] Test navigation within Finanzas (e.g., go to Catalog)
- [ ] Verify assets load from `/finanzas/assets/*`
- [ ] Test login flow (Cognito redirects work)

### 3. Monitor CloudFront Cache Stats

After deployment, monitor in CloudFront Console:
- [ ] Cache hit rate should increase (>70%)
- [ ] Error rates (4xx/5xx) should decrease (<5%)
- [ ] Majority of requests return 200 OK

## Troubleshooting

### Issue: Deep Links Return 404

**Symptom:** `/finanzas/catalog/rubros` returns 404

**Cause:** CloudFront function not attached or not working

**Fix:**
1. Verify function is attached at Viewer Request (not Response)
2. Check function code matches `infra/cloudfront-function-finanzas-rewrite.js`
3. Ensure function is published and associated with LIVE stage

### Issue: Assets Return 403/404

**Symptom:** `/finanzas/assets/index-{hash}.js` returns 403 or 404

**Cause:** OriginPath is set incorrectly or S3 files are at wrong location

**Fix:**
1. Verify OriginPath is empty in CloudFront origin settings
2. Check S3 bucket has files at `s3://ukusi-ui-finanzas-prod/finanzas/assets/*`
3. Verify S3 bucket policy allows CloudFront OAI to read files

### Issue: PMO App Loads Instead of Finanzas

**Symptom:** `/finanzas/` shows PMO app (title: "Ikusi · PMO Platform")

**Cause:** Cache behavior routing is incorrect or function not working

**Fix:**
1. Create/verify cache behaviors for `/finanzas`, `/finanzas/`, `/finanzas/*`
2. Ensure each behavior points to Finanzas origin (not PMO origin)
3. Attach function to all three behaviors
4. Invalidate CloudFront cache: `/*`, `/finanzas/*`

## Success Criteria

PR #126 can be merged when:

1. ✅ All repository variables are set
2. ✅ CloudFront origin has empty OriginPath
3. ✅ All three `/finanzas*` behaviors exist
4. ✅ CloudFront function is attached to all behaviors at Viewer Request
5. ✅ Automated verification script passes
6. ✅ API `/health` endpoint returns 200

## References

- [CloudFront Fix Summary](../CLOUDFRONT_FIX_SUMMARY.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [CloudFront Function Code](../infra/cloudfront-function-finanzas-rewrite.js)
- [Deploy UI Workflow](../.github/workflows/deploy-ui.yml)

## Contact

For questions or issues with this checklist, contact the platform team or review the documentation above.

---

**Last Updated:** 2025-11-14  
**Related PR:** #126
