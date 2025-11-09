# Finanzas UI Deployment Verification Guide

## 🎯 Deployment Overview

**Source of Truth (Exact Values)**

- CloudFront Distribution: `EPQU7PVDLQXUA`
- CloudFront Domain: `https://d7t9x3j66yd8k.cloudfront.net`
- Finanzas UI Bucket: `ukusi-ui-finanzas-prod`
- Finanzas SPA Path in CF: `/finanzas/*` (behavior → origin `finanzas-ui-s3`)
- Finanzas API (dev): `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- Cognito Callback/Sign-out: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

---

## ✅ Pre-Deployment Checklist

### Code Configuration

- [x] **Vite Config**: `base: "/finanzas/"` for `BUILD_TARGET=finanzas`

  - Location: `vite.config.ts`
  - When: Applied, assets resolve to `/finanzas/assets/*`

- [x] **React Router**: `basename="/finanzas"` dynamically set from `VITE_APP_BASENAME`

  - Location: `src/App.tsx`
  - When: All routes are prefixed with `/finanzas`

- [x] **API Client**: Uses `import.meta.env.VITE_API_BASE_URL` (never `window.location.origin`)

  - Location: `src/api/finanzasClient.ts`
  - When: API calls correctly target API Gateway

- [x] **No Leaks**: No github.dev, codespaces, or window.location.origin references
  - Fixed: `src/lib/pdf-export.ts` - removed default `window.location.origin`
  - Grep result: Only 1 match (now fixed)

### Build Environment Variables

The GitHub Actions workflow sets these via `printf` (no blank lines):

```bash
VITE_PUBLIC_BASE=/finanzas/
VITE_FINZ_ENABLED=true
VITE_USE_MOCKS=false
VITE_API_BASE_URL=${DEV_API_URL%/}  # e.g., https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_AWS_REGION=us-east-2
```

### Build Guards (Automated)

The workflow includes these guards to fail the build if:

1. **Asset Path Guard**: `dist-finanzas/index.html` contains `/assets/` instead of `/finanzas/assets/`

   - Indicates Vite `base` not set correctly
   - Fix: Rebuild with `BUILD_TARGET=finanzas`

2. **GitHub Domain Guard**: Build contains `github.dev` or `codespaces` references

   - Indicates Codespaces URL leakage
   - Fix: Remove hardcoded Codespaces URLs from source

3. **GitHub Content Guard**: `index.html` contains `githubusercontent.com` or `github.com` links

   - Indicates hardcoded GitHub domain references
   - Fix: Use relative URLs or CloudFront domain

4. **CloudFront Behavior Guard**: Verifies `/finanzas/*` behavior exists with:
   - Path pattern: `/finanzas/*`
   - Target origin: `finanzas-ui-s3`
   - SmoothStreaming: `false`

---

## 🚀 Deployment Steps

### 1. Build (Automated in Workflow)

```bash
# Build PMO Portal (base: /)
BUILD_TARGET=pmo npm run build
# Output: dist-pmo/

# Build Finanzas SDT Portal (base: /finanzas/)
BUILD_TARGET=finanzas npm run build
# Output: dist-finanzas/
```

### 2. Upload to S3 (Automated)

```bash
# Immutable assets (long cache)
aws s3 sync dist-finanzas/ s3://ukusi-ui-finanzas-prod/finanzas/ \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable" \
  --metadata-directive REPLACE

# SPA entry (no cache)
aws s3 cp dist-finanzas/index.html s3://ukusi-ui-finanzas-prod/finanzas/index.html \
  --cache-control "no-store" \
  --content-type "text/html; charset=utf-8" \
  --metadata-directive REPLACE
```

### 3. CloudFront Invalidation (Automated)

```bash
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*" "/finanzas/index.html"
```

---

## 🔍 Post-Deployment Verification

### 1. CloudFront Configuration Verification

**Check that /finanzas/\* behavior exists and is correctly configured:**

```bash
# Query the behavior
aws cloudfront get-distribution \
  --id EPQU7PVDLQXUA \
  --query "Distribution.DistributionConfig.CacheBehaviors.Items[?PathPattern=='/finanzas/*'].[TargetOriginId,SmoothStreaming]" \
  --output text

# Expected output:
# finanzas-ui-s3   false
```

**If output is empty or different:**

- Go to AWS CloudFront console → Distribution EPQU7PVDLQXUA
- Select "Behaviors" tab
- Verify behavior with path pattern `/finanzas/*` exists
- Check target origin is `finanzas-ui-s3`
- Check SmoothStreaming is disabled (false)

### 2. UI Smoke Tests

**Basic HTTP Check:**

```bash
# Check index is accessible
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Expected: HTTP/2 200

# Check for asset path correctness
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | \
  grep -o '/finanzas/assets/[^"]*' | head -3
# Expected: URLs like /finanzas/assets/main-XXXXX.js
```

**Verify No Leaks:**

```bash
# Check for github.dev references
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep -i github.dev
# Expected: No matches (empty output = good)

# Check for codespaces references
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep -i codespaces
# Expected: No matches
```

**HTML Structure Check:**

```bash
# View first 50 lines of HTML
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -n 50 | \
  grep -E '<script|<link' | head -5

# Should show assets with /finanzas/ prefix, e.g.:
# <script type="module" src="/finanzas/assets/main-XXXXX.js"></script>
# <link rel="stylesheet" href="/finanzas/assets/main-XXXXX.css">
```

### 3. API Smoke Tests

**Health Check (Public):**

```bash
# No auth required
curl -fsS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health | jq .
# Expected response:
# {
#   "ok": true,
#   "stage": "dev",
#   "time": "2025-11-08T12:34:56Z"
# }
```

**Protected Endpoints (Requires Cognito IdToken):**

```bash
# Step 1: Get Cognito ID token
USERNAME="your_test_user"
PASSWORD="your_test_password"

ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME="$USERNAME" PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' \
  --output text)

echo "ID_TOKEN=$ID_TOKEN"

# Step 2: Call protected endpoint /catalog/rubros
curl -fsS \
  -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros \
  | jq '.data | length'
# Expected: Integer count (e.g., 15)

# Step 3: Call protected endpoint /allocation-rules
curl -fsS \
  -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/allocation-rules \
  | jq '.data | length'
# Expected: Integer count (e.g., 8)
```

**Important**: Use **ID Token**, NOT Access Token. The HTTP API authorizer validates `aud` claim against Cognito App Client ID.

---

## 🚨 Troubleshooting

### Issue: UI loads but shows old assets

**Problem**: index.html is new but assets look old/missing

**Diagnosis**:

```bash
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html | \
  grep -o 'src="[^"]*"' | head -5
```

**Solution**:

- Check that asset paths use `/finanzas/assets/*` not `/assets/*`
- Ensure Vite build used `base: "/finanzas/"`
- Rebuild with `BUILD_TARGET=finanzas`
- Check S3 bucket contents:
  ```bash
  aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive | head -10
  # Should see /finanzas/index.html and /finanzas/assets/ files
  ```

### Issue: Finanzas returns 403/404

**Problem**: `/finanzas/` path returns 403 Forbidden or 404 Not Found

**Diagnosis**:

```bash
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Check status code
```

**Solutions**:

1. Verify S3 bucket contains files:

   ```bash
   aws s3api head-object \
     --bucket ukusi-ui-finanzas-prod \
     --key finanzas/index.html
   # Should succeed (200)
   ```

2. Verify CloudFront behavior SPA fallback:

   - Go to CloudFront distribution
   - Check `/finanzas/*` behavior has "Default root object" or error responses configured
   - Error response: 404 → `/finanzas/index.html` (200)

3. Check Origin Access Control (OAC):
   - Ensure OAC is attached to both:
     - S3 bucket policy
     - CloudFront origin

### Issue: API returns 401 Unauthorized

**Problem**: Protected endpoints return 401

**Solutions**:

1. Verify you're using **ID Token**, not Access Token:

   ```bash
   # Check token type in JWT
   echo $ID_TOKEN | cut -d'.' -f2 | base64 -d | jq '.token_use'
   # Should output: "id"
   ```

2. Verify token `aud` matches App Client ID:

   ```bash
   echo $ID_TOKEN | cut -d'.' -f2 | base64 -d | jq '.aud'
   # Should output: "dshos5iou44tuach7ta3ici5m"
   ```

3. Check API authorizer configuration in API Gateway console

### Issue: Asset links are wrong (/assets instead of /finanzas/assets)

**Problem**: Build-time issue, assets hosted in wrong location

**Root Cause**: `base` not set or not propagated correctly in vite.config.ts

**Fix**:

```typescript
// In vite.config.ts
export default defineConfig(() => ({
  base: isPmo ? "/" : "/finanzas/", // ✅ Critical!
  // ...
}));
```

Rebuild:

```bash
BUILD_TARGET=finanzas npm run build
```

---

## 📋 Final Verification Checklist

Run these in sequence to verify full deployment:

```bash
#!/bin/bash
set -euo pipefail

CF_DIST="EPQU7PVDLQXUA"
CF_DOMAIN="d7t9x3j66yd8k.cloudfront.net"
API_BASE="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"

echo "🔍 Finanzas Deployment Verification Checklist"
echo ""

# 1. CloudFront behavior
echo "1️⃣  CloudFront /finanzas/* Behavior:"
aws cloudfront get-distribution \
  --id "$CF_DIST" \
  --query "Distribution.DistributionConfig.CacheBehaviors.Items[?PathPattern=='/finanzas/*'].[TargetOriginId,SmoothStreaming]" \
  --output text | \
  awk '{if ($1=="finanzas-ui-s3" && $2=="false") print "✅ PASS"; else print "❌ FAIL"}'

# 2. S3 bucket
echo "2️⃣  S3 Bucket Contents:"
aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key finanzas/index.html >/dev/null && \
  echo "✅ PASS: index.html exists" || echo "❌ FAIL"

# 3. UI accessibility
echo "3️⃣  UI Accessibility:"
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "https://${CF_DOMAIN}/finanzas/")
[ "$STATUS" = "200" ] && echo "✅ PASS: HTTP $STATUS" || echo "❌ FAIL: HTTP $STATUS"

# 4. Asset paths
echo "4️⃣  Asset Paths:"
curl -s "https://${CF_DOMAIN}/finanzas/" | \
  grep -q '/finanzas/assets/' && \
  echo "✅ PASS: Uses /finanzas/assets/" || echo "❌ FAIL"

# 5. No github.dev
echo "5️⃣  No github.dev leakage:"
curl -s "https://${CF_DOMAIN}/finanzas/" | \
  grep -iq github.dev && echo "❌ FAIL: Found github.dev" || echo "✅ PASS"

# 6. API health
echo "6️⃣  API Health:"
curl -fsS "$API_BASE/health" >/dev/null && \
  echo "✅ PASS: API responding" || echo "❌ FAIL"

echo ""
echo "🎉 If all checks pass, deployment is GREEN!"
```

---

## 📚 References

- **Vite Deployment**: https://vitejs.dev/guide/build.html
- **AWS CloudFront**: https://docs.aws.amazon.com/cloudfront/latest/developerguide/
- **React Router**: https://reactrouter.com/start/library/start-tutorial
- **Cognito**: https://docs.aws.amazon.com/cognito/latest/developerguide/
- **API Gateway HTTP API**: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html
