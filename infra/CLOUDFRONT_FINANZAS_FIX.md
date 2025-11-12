# CloudFront Configuration Fix for Finanzas SPA

## 🚨 Current Issue

**Symptom:**
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` → Serves OLD PMO build (wrong!)
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html` → Serves NEW Finanzas build (correct!)

**Root Cause:**
CloudFront `/finanzas/*` behavior is missing:
1. Default Root Object configuration
2. Trailing slash normalization
3. SPA fallback for client-side routing

---

## ✅ Required CloudFront Configuration

### Step 1: Create CloudFront Function

**Name:** `finanzas-path-rewrite`  
**Type:** Viewer request  
**Code:** See `cloudfront-function-finanzas-rewrite.js`

**Purpose:**
- Redirect `/finanzas` → `/finanzas/` (301)
- Rewrite `/finanzas/` → `/finanzas/index.html`
- SPA fallback: `/finanzas/catalog/rubros` → `/finanzas/index.html`

**To create:**
```bash
# 1. Create the function
aws cloudfront create-function \
  --name finanzas-path-rewrite \
  --function-config Comment="Finanzas SPA path normalization",Runtime=cloudfront-js-1.0 \
  --function-code fileb://infra/cloudfront-function-finanzas-rewrite.js

# 2. Publish the function
FUNCTION_ARN=$(aws cloudfront describe-function --name finanzas-path-rewrite --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)
aws cloudfront publish-function --name finanzas-path-rewrite --if-match $(aws cloudfront describe-function --name finanzas-path-rewrite --query 'ETag' --output text)
```

### Step 2: Update CloudFront Behavior Configuration

**Distribution ID:** `EPQU7PVDLQXUA`  
**Behavior:** `/finanzas/*`

**Changes needed:**

1. **Attach CloudFront Function:**
   - Event type: Viewer request
   - Function: `finanzas-path-rewrite` (ARN from Step 1)

2. **Add Custom Error Responses** (for SPA fallback):
   ```
   Error Code: 403 (Forbidden)
   → Response Page Path: /finanzas/index.html
   → HTTP Response Code: 200 (OK)
   → TTL: 0 seconds
   
   Error Code: 404 (Not Found)
   → Response Page Path: /finanzas/index.html
   → HTTP Response Code: 200 (OK)
   → TTL: 0 seconds
   ```

3. **Verify Origin Configuration:**
   - Target Origin ID: `finanzas-ui-s3`
   - Origin Path: (empty - S3 bucket root)
   - Origin Access Control: `finanzas-ui-oac` (or your OAC name)

**To apply via AWS Console:**

1. Go to CloudFront → Distribution `EPQU7PVDLQXUA`
2. **Behaviors** tab → Select `/finanzas/*` behavior → **Edit**
3. Scroll to **Function associations**:
   - Viewer request: Select `finanzas-path-rewrite`
4. Scroll to **Custom error responses** → **Create custom error response**:
   - Add 403 → /finanzas/index.html (200)
   - Add 404 → /finanzas/index.html (200)
5. **Save changes**
6. Wait for deployment (5-10 minutes)

**To apply via AWS CLI:**

```bash
# 1. Get current distribution config
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA > /tmp/dist-config.json

# 2. Edit JSON to add function association and error responses
#    (Manual edit or use jq to update)

# 3. Update distribution
aws cloudfront update-distribution \
  --id EPQU7PVDLQXUA \
  --distribution-config file:///tmp/dist-config-updated.json \
  --if-match $(jq -r '.ETag' /tmp/dist-config.json)
```

### Step 3: Invalidate Cache

After configuration changes:

```bash
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*' '/finanzas/' '/finanzas/index.html'
```

---

## 🧪 Verification

After configuration is deployed:

```bash
# 1. Check /finanzas (no trailing slash) → should redirect to /finanzas/
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas
# Expected: HTTP 301, Location: /finanzas/

# 2. Check /finanzas/ → should serve Finanzas index.html
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep '<title>'
# Expected: <title>Financial Planning & Management | Enterprise PMO Platform</title>

# 3. Check asset paths
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep -o '/finanzas/assets/[^"]*' | head -3
# Expected: /finanzas/assets/index-B-trkItH.js (or similar)

# 4. Check SPA deep link
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros | grep '<title>'
# Expected: <title>Financial Planning & Management | Enterprise PMO Platform</title>
```

---

## 📋 Manual Workaround (Temporary)

Until CloudFront configuration is updated, users can access Finanzas directly via:

**✅ Working URL:** `https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html`

**⚠️ Login Issue on `/finanzas/index.html`:**
If login fails on this URL, it's likely because:
1. Cognito callback URL doesn't include `/finanzas/index.html` (only `/finanzas/`)
2. Router basename may not handle `index.html` in path

**Recommended Action:** Update Cognito callback URLs to include:
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html` (temporary)
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`

---

## 🎯 Expected Behavior After Fix

| URL | Expected Behavior |
|-----|-------------------|
| `/finanzas` | 301 redirect → `/finanzas/` |
| `/finanzas/` | Serve `/finanzas/index.html` (Finanzas SPA) |
| `/finanzas/index.html` | Serve `/finanzas/index.html` (Finanzas SPA) |
| `/finanzas/catalog/rubros` | Serve `/finanzas/index.html` (client-side routing) |
| `/finanzas/assets/file.js` | Serve actual asset file from S3 |
| `/finanzas/auth/callback.html` | Serve actual callback file from S3 |
| `/` | Serve PMO Portal (root index.html) |
| `/dashboard` | Serve PMO Portal (PMO SPA routing) |

---

## 🚀 Priority

**CRITICAL** - This blocks all Finanzas users from accessing the application via the standard URL.

**Impact:**
- ❌ Users hitting `/finanzas/` see PMO app instead of Finanzas
- ❌ Login redirects may fail (Cognito callbacks expect `/finanzas/`)
- ❌ Browser bookmarks to `/finanzas/` are broken

**Estimated Time to Fix:** 30 minutes (console) or 15 minutes (CLI + script)

---

## 📝 Additional Notes

### Why `/finanzas/index.html` works but `/finanzas/` doesn't:

- S3 bucket has the file: `s3://ukusi-ui-finanzas-prod/finanzas/index.html`
- CloudFront `/finanzas/*` behavior matches: `/finanzas/index.html` ✅
- CloudFront `/finanzas/*` behavior DOES NOT match: `/finanzas/` (no trailing wildcard capture)
- Result: `/finanzas/` falls through to Default (*) behavior → PMO origin → wrong app

### Why we need the CloudFront Function:

CloudFront behaviors don't have a "default document" setting per behavior (only per distribution root). The function rewrites the request URI before it hits the origin, ensuring `/finanzas/` maps to the correct S3 object.

### Alternative: S3 Static Website Hosting

If using S3 as a static website origin (not OAC), you could set:
- Index document: `index.html`
- Error document: `index.html`

But since we're using OAC (private bucket), we need the CloudFront Function approach.

---

**Status:** 🚨 BLOCKING - Requires immediate CloudFront configuration update  
**Owner:** DevOps / CloudFront Administrator  
**Related:** Lane 3 (CDN CloudFront & SPA) from FINANZAS_PATH_TO_GREEN.md
