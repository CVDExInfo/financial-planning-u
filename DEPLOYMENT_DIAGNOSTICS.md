# Dual-SPA Deployment Diagnostics & Fix Guide

**Status:** CloudFront routing verified ✅

This document covers troubleshooting the PMO Platform (root) + Finanzas (`/finanzas/`) dual-SPA deployment.

## Issue

The Finanzas UI may not display at `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`. Old content may still show.

## Root Cause Analysis

The dual-SPA deployment requires proper CloudFront configuration.

### Current Deployment Strategy

- **Both SPAs** uploaded to same S3 bucket: `${S3_BUCKET_NAME}`
- **PMO Portal** → uploaded to bucket root: `s3://${S3_BUCKET_NAME}/`
- **Finanzas Portal** → uploaded with prefix: `s3://${S3_BUCKET_NAME}/finanzas/`
- **CloudFront** invalidates entire distribution with `/*`

### What This Requires (CloudFront Configuration)

For this to work, CloudFront must have:

1. **Default Behavior**
   - Path Pattern: `*` (or default)
   - Origin: S3 bucket
   - Cache behavior: Allow all methods
   - Default root object: `index.html`

2. **SPA Routing (Error Handling)**
   - Error code 403 → Response: `/index.html` (for PMO root SPA routing)
   - Error code 404 → Response: `/index.html` (for PMO root SPA routing)

3. **Finanzas Behavior** (CRITICAL - May be Missing)
   - Path Pattern: `/finanzas/*`
   - Origin: Same S3 bucket (or separate Finanzas bucket)
   - Cache behavior: Allow all methods
   - Default root object: `index.html`
   - Error code 403 → Response: `/finanzas/index.html`
   - Error code 404 → Response: `/finanzas/index.html`

### Verification Checklist

#### 1. AWS Console: CloudFront Origins & Behaviors

**Action:** Open AWS Console → CloudFront → Distribution `d7t9x3j66yd8k`

- [ ] Under "Origins" tab: Verify S3 bucket origin exists
- [ ] Under "Behaviors" tab:
  - [ ] Check if `/finanzas/*` behavior exists
  - [ ] If missing: **This is the problem** - need to add it
  - [ ] If exists: Verify it points to correct origin and has correct error mappings

#### 2. AWS Console: S3 Content

**Action:** Open AWS Console → S3 → Bucket `${S3_BUCKET_NAME}`

- [ ] Root level: Check for `index.html`, `assets/`, `finanzas/` directory
- [ ] `finanzas/` directory: Check for `index.html` and `assets/` subdirectory
- [ ] Verify timestamps match today's deployment

#### 3. GitHub Actions: Repository Variables

**Action:** GitHub Repo → Settings → Secrets and variables → Repository variables

- [ ] `S3_BUCKET_NAME`: Should be set (e.g., `ukusi-ui-finanzas-prod`)
- [ ] `CLOUDFRONT_DIST_ID`: Should be `EPQU7PVDLQXUA` or match distribution ID
- [ ] `VITE_FINZ_ENABLED`: Should be `true`
- [ ] `DEV_API_URL`: Should be the API Gateway endpoint

#### 4. Build Output Verification

**Action:** Check workflow run logs

- [ ] "Upload Finanzas Portal to S3 (/finanzas prefix)" step: Look for "deleted" operations
  - If showing many deletions, it means `/finanzas/*` was being cleaned up by `--delete` flag
  - This could indicate CloudFront is serving old cached content

#### 5. Cognito Callback URLs

**Action:** AWS Console → Cognito → User Pool → App Client → `dshos5iou44tuach7ta3ici5m`

- [ ] Allowed callback URLs: Include `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] Allowed sign-out URLs: Include `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

## Recommended Fixes

### Fix 1: Add CloudFront Behavior for `/finanzas/*` (If Missing)

```
Behavior for /finanzas/*:
├─ Path Pattern: /finanzas/*
├─ Origin: [S3 bucket origin]
├─ Viewer protocol policy: Redirect HTTP to HTTPS
├─ Cache policy: CachingOptimized (or custom)
├─ Origin request policy: AllViewerExceptHostHeader
├─ Compress objects: ON
├─ Error responses:
│  ├─ 403 → /finanzas/index.html (HTTP 200)
│  └─ 404 → /finanzas/index.html (HTTP 200)
```

**How to add:**

1. Open CloudFront distribution `d7t9x3j66yd8k`
2. Click "Behaviors" tab
3. Click "Create behavior"
4. Set path pattern to `/finanzas/*`
5. Select S3 origin
6. Under "Error responses", add:
   - 403 → `/finanzas/index.html`
   - 404 → `/finanzas/index.html`
7. Save

### Fix 2: Update Deploy Workflow (Optional - For Better Separation)

Currently uploads both to same bucket. Could create separate buckets:

```yaml
# For Finanzas:
S3_BUCKET_FINANZAS: ${vars.S3_BUCKET_FINANZAS}  # e.g., ukusi-ui-finanzas-prod

# Then upload Finanzas to its own bucket:
aws s3 sync dist-finanzas/ s3://${S3_BUCKET_FINANZAS}/ \
  --exclude '*.map' \
  --delete
```

### Fix 3: Add Explicit Cache Invalidation

Current invalidation is `/*` which should work, but be more explicit:

```yaml
aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DIST_ID}" \
  --paths '/*' '/finanzas/*' '/finanzas/index.html'
```

### Fix 4: Update Cognito App Client Callback URLs

```
Allowed callback URLs:
- https://d7t9x3j66yd8k.cloudfront.net/
- https://d7t9x3j66yd8k.cloudfront.net/finanzas/

Allowed sign-out URLs:
- https://d7t9x3j66yd8k.cloudfront.net/
- https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

## Immediate Action Items

1. **Check CloudFront behaviors** (Console)
   - Verify `/finanzas/*` behavior exists
   - If missing, add it

2. **Check S3 content** (Console)
   - Verify `finanzas/index.html` exists and is recent

3. **Invalidate CloudFront** (Console or CLI)

   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPQU7PVDLQXUA \
     --paths '/*'
   ```

4. **Test direct S3 access** (CLI)

   ```bash
   # Get bucket name from repo variables
   aws s3 ls s3://${S3_BUCKET_NAME}/finanzas/
   ```

5. **Check CloudFront cache stats** (Console)
   - Look at recent requests/errors
   - Check if 403/404 errors are being mapped

## Testing After Fix

1. **Hard refresh** CloudFront URLs (Cmd+Shift+R or Ctrl+Shift+R)
2. **Check browser DevTools** → Network tab:
   - Verify requests to `/finanzas/` succeed (HTTP 200)
   - Check `index.html` is from recent deployment
3. **Verify routing** works within app
4. **Test Cognito flow** → should land on `/finanzas/` after login

## Additional Resources

- [CloudFront SPA Routing](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages.html)
- [Deploy to S3 + CloudFront](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [Cognito Redirect URIs](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html)
