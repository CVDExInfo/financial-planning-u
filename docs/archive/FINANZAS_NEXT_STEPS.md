# Finanzas Deployment - Next Steps

## Current Status

✅ **Web Accessibility Verified**

- PMO Portal: `https://d7t9x3j66yd8k.cloudfront.net/` → HTTP 200
- Finanzas Portal: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` → HTTP 200
- Finanzas Catalog: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros` → HTTP 200

✅ **Code Fixes Applied**

- Dynamic basename routing for dual-SPA (PMO / Finanzas)
- Navigation module detection updated
- Links fixed to use relative paths
- `/catalog/rubros` endpoint auth disabled

✅ **Deployment Tools Created**

- `DEPLOYMENT_DIAGNOSTICS.md` - Comprehensive troubleshooting guide
- `scripts/verify-deployment.sh` - Automated verification script
- Enhanced `deploy-ui.yml` with CloudFront behavior checks

## To Verify Complete Setup

You need AWS console access to confirm these CloudFront settings. Here's what to check:

### 1. CloudFront Distribution (`d7t9x3j66yd8k`)

**Path:** AWS Console → CloudFront → Distributions → `d7t9x3j66yd8k`

**Check Origins tab:**

- Verify S3 bucket exists and is accessible
- Domain should be: `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com` (or similar)

**Check Behaviors tab:**

- Default behavior should serve S3 bucket with default root object: `index.html`
- **CRITICAL:** Look for `/finanzas/*` behavior
  - If EXISTS: Good ✅
  - If MISSING: Need to add one (see Fix 1 below)

### 2. S3 Bucket Content

**Path:** AWS Console → S3 → Buckets → `ukusi-ui-finanzas-prod`

Verify these files exist:

```
/
├── index.html (PMO Portal)
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── finanzas/
    ├── index.html (Finanzas Portal)
    └── assets/
        ├── index-[hash].js
        └── index-[hash].css
```

### 3. Cognito App Client

**Path:** AWS Console → Cognito → User pools → `us-east-2_FyHLtOhiY` → App integration → App client settings

Current app client: `dshos5iou44tuach7ta3ici5m`

**Update these fields:**

**Allowed callback URLs:**

```
https://d7t9x3j66yd8k.cloudfront.net/
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

**Allowed sign-out URLs:**

```
https://d7t9x3j66yd8k.cloudfront.net/
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

## If Finanzas Module Still Doesn't Show

If you're still seeing the old UI at `/finanzas/`, follow these steps:

### Step 1: Force Cache Clear

```bash
# Hard refresh in browser (Dev Tools → Network tab)
# Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)

# Or invalidate via CLI:
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/*' '/finanzas/*' '/finanzas/index.html'
```

### Step 2: Check S3 Sync Completed

```bash
# List Finanzas directory contents
aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive | head -20

# Verify recent timestamp (should match today's deployment)
aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key finanzas/index.html \
  --query 'LastModified'
```

### Step 3: Verify CloudFront Behavior

```bash
# Check CloudFront config
aws cloudfront get-distribution-config \
  --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CacheBehaviors[*].[PathPattern,OriginId]' \
  --output table
```

Expected output should include:

```
/finanzas/*   s3-origin-name
```

### Step 4: Add Missing `/finanzas/*` Behavior (If Needed)

**Using AWS Console:**

1. CloudFront → Distributions → `d7t9x3j66yd8k`
2. Click "Behaviors" tab
3. Click "Create behavior"
4. Fill in:
   - **Path Pattern:** `/finanzas/*`
   - **Origin:** Select the S3 bucket origin
   - **Viewer protocol policy:** Redirect HTTP to HTTPS
   - **Cache policy:** CachingOptimized
   - **Compress objects:** On
5. Click "Create"
6. Then add error responses:
   - Edit the new `/finanzas/*` behavior
   - Add Error responses:
     - 403 → `/finanzas/index.html` (HTTP 200)
     - 404 → `/finanzas/index.html` (HTTP 200)

**Using AWS CLI:**

```bash
# Get current distribution config (requires jq installed)
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA > dist-config.json

# Edit dist-config.json to add new behavior under CacheBehaviors array:
# Then update:
aws cloudfront update-distribution \
  --distribution-config file://dist-config.json \
  --id EPQU7PVDLQXUA
```

## Testing After Fix

1. **Hard refresh** the CloudFront URL:
   - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` (Cmd+Shift+R)

2. **Check browser console** for errors

3. **Verify login flow**:
   - Click Sign In
   - Should redirect to Cognito
   - After login, should land on `/finanzas/` (not PMO home)

4. **Test navigation**:
   - Click "Rubros" → should go to `/finanzas/catalog/rubros`
   - Click "Rules" → should go to `/finanzas/rules`

## Repository Diagnostics

You can run the verification script locally:

```bash
cd /workspaces/financial-planning-u
./scripts/verify-deployment.sh
```

This checks:

- ✅ CloudFront behaviors
- ✅ S3 bucket contents
- ✅ Web accessibility (HTTP status)
- ✅ Finanzas endpoints

## Recent Commits

```
5820222 - docs: add comprehensive deployment diagnostics and verification script
65cae1e - fix: Finanzas module display in navigation and links
f1ecc5c - fix: dynamic basename routing for dual-SPA (PMO and Finanzas)
3d82a89 - fix: disable auth on /catalog/rubros endpoint (public catalog read)
```

## Deployment Summary

| Component | Status | URL |
|-----------|--------|-----|
| PMO Portal | ✅ HTTP 200 | <https://d7t9x3j66yd8k.cloudfront.net/> |
| Finanzas Portal | ✅ HTTP 200 | <https://d7t9x3j66yd8k.cloudfront.net/finanzas/> |
| Finanzas Catalog | ✅ HTTP 200 | <https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros> |
| API Health | ✅ Live | <https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health> |
| Build: PMO | ✅ dist-pmo/ | BUILD_TARGET=pmo npm run build |
| Build: Finanzas | ✅ dist-finanzas/ | BUILD_TARGET=finanzas npm run build |

---

**Last Updated:** 2025-11-07
**Prepared for:** <christian.valencia@ikusi.com>
