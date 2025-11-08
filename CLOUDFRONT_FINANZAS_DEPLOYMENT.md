# CloudFront Finanzas UI Deployment - Configuration Complete

**Status**: ✅ **PRODUCTION READY**  
**Date**: 2025-11-08  
**Distribution**: EPQU7PVDLQXUA (d7t9x3j66yd8k.cloudfront.net)

---

## Executive Summary

The Finanzas SPA is now fully integrated into the CloudFront distribution serving both the PMO and Finanzas portals via a dual-SPA architecture. The module is accessible at `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` with all routing, authentication, and API integration configured.

---

## Configuration Deployed

### 1. Origin Access Control (OAC)

| Property | Value |
|----------|-------|
| **OAC ID** | `EN0UUH7BKI39I` |
| **Name** | `finanzas-ui-oac` |
| **Type** | S3 |
| **Signing Protocol** | sigv4 |
| **Signing Behavior** | always |

**Purpose**: Provides secure, signed access from CloudFront to the S3 bucket without requiring public bucket policies.

---

### 2. CloudFront Origin

| Property | Value |
|----------|-------|
| **Origin ID** | `finanzas-ui-s3` |
| **Domain Name** | `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com` |
| **Origin Access Control** | `EN0UUH7BKI39I` |
| **Region** | us-east-2 |
| **Protocol** | HTTPS only |

**Purpose**: Routes CloudFront requests for the `/finanzas/*` path to the Finanzas UI S3 bucket.

---

### 3. CloudFront Cache Behavior

| Property | Value |
|----------|-------|
| **Path Pattern** | `/finanzas/*` |
| **Target Origin** | `finanzas-ui-s3` |
| **Viewer Protocol** | Redirect HTTP → HTTPS |
| **Allowed Methods** | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| **Cached Methods** | GET, HEAD |
| **Compression** | ✅ Enabled |
| **Cache Policy** | Managed-CachingDisabled (4135ea2d-6df8-44a3-9df3-4b5a84be39ad) |
| **Origin Request Policy** | Managed-AllViewerExceptHostHeader (88a5eaf4-2fd4-4709-b370-b4c650ea3fcf) |

**Purpose**: Directs all requests under `/finanzas/*` to the Finanzas UI origin with appropriate SPA caching and request forwarding policies.

---

### 4. S3 Bucket Policy

**Bucket**: `ukusi-ui-finanzas-prod`

**Policy Statement**:

```json
{
  "Sid": "AllowCloudFrontOACRead",
  "Effect": "Allow",
  "Principal": {"Service": "cloudfront.amazonaws.com"},
  "Action": ["s3:GetObject"],
  "Resource": ["arn:aws:s3:::ukusi-ui-finanzas-prod/*"],
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::703671891952:distribution/EPQU7PVDLQXUA"
    }
  }
}
```

**Purpose**: Restricts S3 access to only the CloudFront distribution via OAC.

---

### 5. Cognito Callback URLs

| Type | URL |
|------|-----|
| **Callback** | `https://d7t9x3j66yd8k.cloudfront.net/` |
| **Callback** | `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` |
| **Logout** | `https://d7t9x3j66yd8k.cloudfront.net/` |
| **Logout** | `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` |

**User Pool**: `us-east-2_FyHLtOhiY`  
**App Client**: `dshos5iou44tuach7ta3ici5m`

**Purpose**: Allows Cognito to redirect users back to Finanzas portal after authentication.

---

## Deployment Verification ✅

### HTTP Smoke Tests

```
🌐 CloudFront Domain: d7t9x3j66yd8k.cloudfront.net

📍 PMO Portal (/)
   URL: https://d7t9x3j66yd8k.cloudfront.net/
   Status: 200 OK ✅

📍 Finanzas Portal (/finanzas/)
   URL: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   Status: 200 OK ✅

📍 Finanzas Catalog (public endpoint)
   URL: https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
   Status: 200 OK ✅ (via direct API call)
```

### Configuration Verification

```
✅ PASS: /finanzas/* behavior configured
   Pattern: /finanzas/*
   Origin: finanzas-ui-s3
   Protocol: redirect-to-https

✅ PASS: finanzas-ui-s3 origin configured
   Domain: ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com
   OAC: EN0UUH7BKI39I

✅ PASS: Cognito callbacks include Finanzas URL
   URLs: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    CloudFront Distribution                      │
│                     EPQU7PVDLQXUA                              │
│                d7t9x3j66yd8k.cloudfront.net                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Viewer Request → Route Decision                              │
│                      │                                         │
│                      ├─ /* (default)                          │
│                      │   ↓                                    │
│                      ├→ acta-ui-frontend-prod (PMO Portal)   │
│                      │                                        │
│                      └─ /finanzas/*                          │
│                          ↓                                    │
│                          └→ finanzas-ui-s3 Origin           │
│                              ↓                              │
│                         S3 Bucket                           │
│                   ukusi-ui-finanzas-prod                    │
│                      (OAC: EN0UUH7BKI39I)                   │
│                                                            │
└────────────────────────────────────────────────────────────────┘

Frontend Origin Requests:
   /finanzas/ → Serves /finanzas/index.html (Finanzas SPA)
   /finanzas/catalog/rubros → Vite handles routing → API call

API Requests (Direct):
   Browser → https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   (CloudFront not involved - Mode A deployment)
```

---

## Mode A: Direct API Gateway Integration

As planned in the R1 execution document, the Finanzas UI calls the API **directly** via API Gateway, not through CloudFront. This is the "Mode A" approach:

```
Finanzas UI (CloudFront at /finanzas/)
    ↓
finanzasClient.getRubros()
    ↓
fetch("https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros")
    ↓
API Gateway
    ↓
Lambda Handler
    ↓
DynamoDB (rubros)
```

**Benefits of Mode A**:

- ✅ Simpler CloudFront configuration
- ✅ No need for API origin in CloudFront
- ✅ Direct API calls reduce latency
- ✅ Easier to manage CORS (already whitelisted for CloudFront domain)
- ✅ Faster iteration on API changes

**Future**: Mode B (CloudFront API proxy) can be added later if needed for:

- Unified caching of API responses
- Centralized WAF/DDoS protection
- Single domain cookies

---

## Files Modified

### Infrastructure

- **S3 Bucket Policy** (`ukusi-ui-finanzas-prod`): Updated to allow CloudFront OAC access
- **CloudFront Distribution** (`EPQU7PVDLQXUA`):
  - Added origin: `finanzas-ui-s3`
  - Added behavior: `/finanzas/*` → `finanzas-ui-s3`
- **Cognito App Client** (`dshos5iou44tuach7ta3ici5m`):
  - Added callback URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - Added logout URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

### CI/CD Pipeline

- **`.github/workflows/deploy-ui.yml`**:
  - Added **CRITICAL guard**: Fails build if `/finanzas/*` behavior missing
  - Enhanced invalidation: Ensures `/finanzas/*` and `/finanzas/index.html` cleared
  - Added comprehensive evidence pack with health checks

---

## Testing & Validation

### Manual Testing Steps

1. **Access Finanzas Portal**

   ```
   URL: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   Expected: Cognito login page OR authenticated app if already logged in
   ```

2. **Login (if not authenticated)**

   ```
   Email: christian.valencia@ikusi.com
   Password: Velatia@2025
   Expected: Redirect to Finanzas home page with 2 action cards
   ```

3. **Verify Module Tabs**

   ```
   Expected Navigation: "Rubros" and "Rules" tabs visible
   Location: Top navigation bar
   ```

4. **Test Rubros Catalog**

   ```
   Action: Click "Rubros" tab
   Expected: Navigate to /catalog/rubros
   Expected: Table with 71 rubros loads from /catalog/rubros endpoint
   Status: HTTP 200
   ```

5. **Test Rules Preview**

   ```
   Action: Click "Rules" tab
   Expected: Navigate to /rules
   Expected: Cards with allocation rules load
   Auth: Requires Bearer JWT token from localStorage.finz_jwt
   Status: HTTP 200
   ```

### DevTools Verification

```javascript
// Check localStorage token
localStorage.getItem('finz_jwt')
// Returns: eyJhbGciOiJIUzI1NiIs... (JWT string)

// Monitor Network tab:
// GET /dev/catalog/rubros → 200 OK (no Authorization header)
// GET /dev/allocation-rules → 200 OK (Authorization: Bearer ...)

// Check CloudFront cache:
// Response Headers should include:
// CloudFront-Version: ...
// Age: ... (cache hit indicator)
```

---

## Troubleshooting

### Issue: "Finanzas portal returns 404"

**Root Causes**:

1. Cache invalidation not complete (wait 30-60 seconds)
2. S3 content not uploaded to `/finanzas/` prefix
3. CloudFront behavior misconfigured

**Fix**:

```bash
# Check S3 content
aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive

# Verify CloudFront behavior
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`]'

# Force cache invalidation
aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*' '/finanzas/index.html'
```

### Issue: "Module tabs not showing"

**Root Causes**:

1. `VITE_FINZ_ENABLED` not set to `true` in build
2. Build used wrong base path (not `/finanzas/`)
3. Feature flag not deployed

**Fix**:

```bash
# Verify build includes feature flag
grep -r "VITE_FINZ_ENABLED" dist-finanzas/

# Expected: embedded in JS as true value
```

### Issue: "API returns 401 Unauthorized on /allocation-rules"

**Root Causes**:

1. Token expired
2. Cognito callback URLs not updated
3. Bearer header not injected

**Fix**:

```bash
# Logout and re-login
# Navigate to /finanzas/ fresh
# Token will be re-fetched from Cognito

# Verify callback URL
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-2_FyHLtOhiY \
  --client-id dshos5iou44tuach7ta3ici5m \
  --query 'UserPoolClient.CallbackURLs'
```

---

## Rollback Procedure

If you need to remove Finanzas from CloudFront temporarily:

```bash
# 1. Disable behavior (but keep origin/OAC)
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern!=`/finanzas/*`]' > config.json
# Edit config.json to remove behavior, then:
aws cloudfront update-distribution --id EPQU7PVDLQXUA --distribution-config file://config.json

# 2. Invalidate
aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*'
```

---

## Next Steps

### Immediate (Today)

- [ ] Access <https://d7t9x3j66yd8k.cloudfront.net/finanzas/>
- [ ] Login and verify Finanzas tabs visible
- [ ] Test Rubros and Rules navigation
- [ ] Confirm API calls succeed

### Short-term (This Week)

- [ ] Share portal with team for UAT
- [ ] Gather feedback on module functionality
- [ ] Monitor CloudWatch logs for errors
- [ ] Document any issues for R2 planning

### Medium-term (R2 Sprint)

- [ ] Implement `/projects` POST endpoint
- [ ] Add adjustment recording functionality
- [ ] Build E2E tests (Playwright/Cypress)
- [ ] Consider Mode B API proxy if needed
- [ ] Add more detailed allocation rules UI

---

## Support & Questions

**Infrastructure**:

- CloudFront: EPQU7PVDLQXUA (d7t9x3j66yd8k.cloudfront.net)
- S3: ukusi-ui-finanzas-prod
- API Gateway: m3g6am67aj
- Cognito: us-east-2_FyHLtOhiY

**Team Contact**: <christian.valencia@ikusi.com>  
**Repository**: valencia94/financial-planning-u  
**Branch**: main

---

## Deployment Timeline

| Date | Event | Status |
|------|-------|--------|
| 2025-11-07 | Code fixes (auth, routing, navigation) | ✅ Complete |
| 2025-11-07 | Deployment diagnostics created | ✅ Complete |
| 2025-11-08 | CloudFront /finanzas/* behavior added | ✅ Complete |
| 2025-11-08 | S3 bucket policy updated for OAC | ✅ Complete |
| 2025-11-08 | Cognito callbacks added | ✅ Complete |
| 2025-11-08 | CI/CD guards implemented | ✅ Complete |
| 2025-11-08 | Verification tests passed | ✅ Complete |

---

**Status**: ✅ **READY FOR PRODUCTION**

All infrastructure components are configured and verified. The Finanzas SPA is now accessible via CloudFront and integrated with the PMO Portal in a dual-SPA architecture.

```
🚀 Go to: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```
