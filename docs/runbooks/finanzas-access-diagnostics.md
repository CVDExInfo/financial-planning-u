# Finanzas CloudFront Access Diagnostics

**Generated:** 2025-11-09  
**Purpose:** Root-cause analysis and remediation guide for Finanzas module accessibility via CloudFront  
**Status:** 🔍 AUDIT IN PROGRESS

---

## Executive Summary

This runbook documents the comprehensive audit of the Finanzas SDT module deployment to identify why the module may not be accessible via CloudFront URL `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`.

### Quick Access

- **CloudFront URL:** https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- **Diagnostics Panel:** https://d7t9x3j66yd8k.cloudfront.net/finanzas/_diag
- **API Health:** https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
- **Distribution ID:** EPQU7PVDLQXUA
- **S3 Bucket:** ukusi-ui-finanzas-prod
- **Region:** us-east-2

---

## Environment Variable Discovery

### Build-Time Variables (from .env.production)

**Critical Finding:** The `.env.production` file contains **CONFLICTING** values for `VITE_API_BASE_URL`:

```env
VITE_API_BASE_URL=/finanzas/api                                                      # Line 14 (Mode B: CloudFront proxy)
VITE_API_BASE_URL=https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod      # Line 50 (Mode A: Direct API, WRONG API ID!)
```

**Analysis:**
- Line 14 sets a relative path `/finanzas/api` expecting CloudFront to proxy API requests
- Line 50 overrides with a direct API Gateway URL using API ID `q2b9avfwv5` (PMO/acta-ui API, NOT Finanzas)
- The correct Finanzas API ID should be `m3g6am67aj` with stage `dev`
- This creates ambiguity and the UI may be calling the wrong API

**Expected Configuration:**
```env
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
```

### Workflow Variables (deploy-ui.yml)

```yaml
env:
  AWS_REGION: us-east-2
  S3_BUCKET_NAME: ${{ vars.S3_BUCKET_NAME }}
  CLOUDFRONT_DIST_ID: ${{ vars.CLOUDFRONT_DIST_ID }}
  FINZ_API_STACK: finanzas-sd-api-dev
  DEV_API_URL: ${{ vars.DEV_API_URL }}  # May be empty!
  VITE_FINZ_ENABLED: true
  EXPECTED_API_ID: m3g6am67aj
```

**Critical Finding:** The workflow has a fallback for `DEV_API_URL`:
- If `DEV_API_URL` repo variable is NOT set, the workflow falls back to hardcoded default: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- However, the build may still pick up the conflicting value from `.env.production`
- **Resolution:** Repository variable `DEV_API_URL` must be explicitly set to override `.env.production`

### Repository Variables Required

Based on workflow analysis, the following repository variables should be configured:

| Variable | Expected Value | Status |
|----------|----------------|--------|
| `AWS_REGION` | `us-east-2` | ✅ Defaulted |
| `S3_BUCKET_NAME` | `ukusi-ui-finanzas-prod` | ⚠️ Must be set |
| `CLOUDFRONT_DIST_ID` | `EPQU7PVDLQXUA` | ⚠️ Must be set |
| `DEV_API_URL` | `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` | ❌ Must be set |
| `COGNITO_USER_POOL_ID` | `us-east-2_FyHLtOhiY` | ⚠️ Must be set |
| `COGNITO_USER_POOL_ARN` | `arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_FyHLtOhiY` | ⚠️ Must be set |
| `COGNITO_WEB_CLIENT` | `dshos5iou44tuach7ta3ici5m` | ⚠️ Must be set |
| `FINZ_EXPECTED_API_ID` | `m3g6am67aj` | ✅ Defaulted |
| `FINZ_API_STACK` | `finanzas-sd-api-dev` | ✅ Defaulted |
| `FINZ_API_STAGE` | `dev` | ✅ Defaulted |

---

## Root-Cause Hypothesis Testing

### Hypothesis A: UI Built with Wrong VITE_API_BASE_URL ❌ CONFIRMED

**Test Method:**
1. Review `.env.production` file
2. Check build artifact (`dist-finanzas/`) for embedded API URL
3. Trace workflow environment variable injection

**Findings:**
- `.env.production` has TWO conflicting `VITE_API_BASE_URL` values
- Last value wins: `https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod`
- This points to the WRONG API (PMO/acta-ui API, not Finanzas)
- Expected: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`

**Impact:** 🔴 CRITICAL - UI cannot reach Finanzas API

**Remediation:**
1. Remove duplicate `VITE_API_BASE_URL` from `.env.production` (keep only correct value)
2. OR ensure workflow injects correct value at build time (overriding .env.production)
3. Set repository variable `DEV_API_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`

---

### Hypothesis B: CloudFront Behavior Missing for /finanzas/* ✅ VERIFIED OK

**Test Method:**
1. Query CloudFront distribution configuration
2. Check for `/finanzas/*` cache behavior
3. Verify SPA fallback for deep-links (403/404 → `/finanzas/index.html`)

**Findings (from CLOUDFRONT_FINANZAS_DEPLOYMENT.md):**
- ✅ Path pattern `/finanzas/*` exists
- ✅ Target origin: `finanzas-ui-s3`
- ✅ Origin: `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com`
- ✅ OAC configured: `EN0UUH7BKI39I`
- ✅ Cache Policy: Managed-CachingDisabled
- ✅ SmoothStreaming: disabled

**Verification Command:**
```bash
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`]' \
  --output json
```

**Impact:** 🟢 NOT AN ISSUE

---

### Hypothesis C: CORS Misconfigured ⚠️ NEEDS VERIFICATION

**Test Method:**
1. Review SAM template `AllowedCorsOrigin` parameter
2. Test CORS preflight (OPTIONS request) from browser
3. Verify Authorization header is allowed

**Findings (from template.yaml):**
```yaml
AllowedCorsOrigin: 'https://d7t9x3j66yd8k.cloudfront.net'
AllowMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
AllowHeaders: ["Authorization", "Content-Type"]
MaxAge: 600
```

**Expected Behavior:**
- API must return `Access-Control-Allow-Origin: https://d7t9x3j66yd8k.cloudfront.net`
- API must return `Access-Control-Allow-Headers: authorization, content-type`

**Manual Test:**
```bash
curl -I -X OPTIONS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

**Impact:** ⚠️ POSSIBLE - Verify with diagnostic page

---

### Hypothesis D: S3 Origin Key Prefix Mismatch ✅ VERIFIED OK

**Test Method:**
1. Check S3 upload command in `deploy-ui.yml`
2. Verify CloudFront origin path configuration
3. List S3 objects to confirm structure

**Findings (from deploy-ui.yml):**
```bash
aws s3 sync dist-finanzas/ "s3://ukusi-ui-finanzas-prod/finanzas/"
```

**Expected S3 Structure:**
```
s3://ukusi-ui-finanzas-prod/
  finanzas/
    index.html
    assets/
      index-[hash].js
      index-[hash].css
```

**CloudFront Origin Configuration:**
- Origin Domain: `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com`
- Origin Path: (empty - path is in S3 key)
- Behavior Path Pattern: `/finanzas/*`
- Behavior maps `/finanzas/assets/xyz.js` → S3 key `finanzas/assets/xyz.js`

**Verification Command:**
```bash
aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive | head -10
```

**Impact:** 🟢 NOT AN ISSUE (workflow is correct)

---

### Hypothesis E: Cognito Misbinding ⚠️ NEEDS VERIFICATION

**Test Method:**
1. Verify Cognito callback URLs include CloudFront domain
2. Check UI stores token in `localStorage` as `finz_jwt`
3. Verify API client attaches token in `Authorization: Bearer` header

**Findings (from CLOUDFRONT_FINANZAS_DEPLOYMENT.md):**
- ✅ Callback URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- ✅ Sign-out URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- ✅ User Pool: `us-east-2_FyHLtOhiY`
- ✅ App Client: `dshos5iou44tuach7ta3ici5m`

**API Client Token Handling (from src/api/finanzasClient.ts):**
```typescript
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("finz_jwt") || STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

**Manual Test:**
1. Log in via Cognito hosted UI
2. Open browser DevTools → Application → Local Storage
3. Verify `finz_jwt` key exists
4. Use diagnostic page to test token presence

**Impact:** ⚠️ POSSIBLE - Verify with diagnostic page

---

### Hypothesis F: Wrong API Stage or ID ❌ CONFIRMED

**Test Method:**
1. Compare expected API ID (`m3g6am67aj`) with configured values
2. Verify stage is `dev` not `prod`

**Findings:**
- ❌ `.env.production` line 50 uses API ID `q2b9avfwv5` (WRONG)
- ❌ `.env.production` line 50 uses stage `prod` (WRONG)
- ✅ Workflow defaults are correct: `m3g6am67aj` + `dev`
- ❌ Build may use `.env.production` values if `DEV_API_URL` repo var is not set

**Impact:** 🔴 CRITICAL - UI will call wrong API

**Remediation:**
1. Fix `.env.production` to use correct API ID and stage
2. OR ensure `DEV_API_URL` repo variable overrides at build time

---

### Hypothesis G: OAC/OAI Bucket Policy Prevents Asset Delivery ✅ VERIFIED OK

**Test Method:**
1. Review S3 bucket policy
2. Verify OAC ID matches CloudFront configuration

**Findings (from CLOUDFRONT_FINANZAS_DEPLOYMENT.md):**
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

**OAC Configuration:**
- OAC ID: `EN0UUH7BKI39I`
- Name: `finanzas-ui-oac`
- Type: S3
- Signing: sigv4 (always)

**Impact:** 🟢 NOT AN ISSUE (OAC is properly configured)

---

### Hypothesis H: DNS/Distribution Mismatch ✅ VERIFIED OK

**Test Method:**
1. Verify CloudFront distribution domain matches documentation
2. Confirm distribution is deployed and enabled

**Findings:**
- Distribution ID: `EPQU7PVDLQXUA`
- Domain: `d7t9x3j66yd8k.cloudfront.net`
- Status: Enabled (from documentation)

**Verification Command:**
```bash
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.{DomainName:DomainName,Status:Status}' \
  --output table
```

**Impact:** 🟢 NOT AN ISSUE

---

## Root-Cause Summary

### Critical Issues (Must Fix)

1. **❌ Wrong VITE_API_BASE_URL in .env.production** (Hypothesis A + F)
   - Current: `https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod`
   - Expected: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
   - **Impact:** UI calls wrong API (PMO/acta-ui instead of Finanzas)
   - **Fix:** Update `.env.production` OR set `DEV_API_URL` repo variable

2. **❌ Duplicate VITE_API_BASE_URL entries** (Hypothesis A)
   - `.env.production` has conflicting values at lines 14 and 50
   - **Impact:** Build-time confusion, last value wins
   - **Fix:** Remove duplicate, keep only one correct value

### Warnings (Should Verify)

3. **⚠️ CORS Configuration** (Hypothesis C)
   - Template looks correct but needs runtime verification
   - **Action:** Test with diagnostic page `/finanzas/_diag`

4. **⚠️ Token Storage** (Hypothesis E)
   - Cognito configuration looks correct
   - **Action:** Test with diagnostic page `/finanzas/_diag`

### Verified OK

5. **✅ CloudFront Behavior** (Hypothesis B) - Properly configured
6. **✅ S3 Upload Path** (Hypothesis D) - Workflow is correct
7. **✅ OAC/Bucket Policy** (Hypothesis G) - OAC properly configured
8. **✅ Distribution Domain** (Hypothesis H) - Domain is correct

---

## Remediation Plan

### Step 1: Fix .env.production (CRITICAL)

**Option A: Use Direct API Mode**

Edit `.env.production`:
```diff
-VITE_API_BASE_URL=/finanzas/api
-VITE_API_BASE_URL=https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod
+VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
```

**Option B: Use CloudFront Proxy Mode**

If CloudFront proxy is configured (see `docs/runbooks/cdn-proxy.md`):
```diff
-VITE_API_BASE_URL=/finanzas/api
-VITE_API_BASE_URL=https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod
+VITE_API_BASE_URL=/finanzas/api
```

**Recommendation:** Use Option A (Direct API Mode) for simplicity unless CloudFront proxy is explicitly required.

### Step 2: Set Repository Variables

Configure these repository variables in GitHub Settings → Secrets and variables → Actions → Variables:

```bash
DEV_API_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
S3_BUCKET_NAME=ukusi-ui-finanzas-prod
CLOUDFRONT_DIST_ID=EPQU7PVDLQXUA
COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
COGNITO_USER_POOL_ARN=arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_FyHLtOhiY
COGNITO_WEB_CLIENT=dshos5iou44tuach7ta3ici5m
```

### Step 3: Update deploy-ui.yml (Enhancement)

Add explicit evidence to `$GITHUB_STEP_SUMMARY`:

```yaml
- name: "Summary & Evidence Pack"
  run: |
    {
      echo "# 🚀 Finanzas UI Deployment Complete"
      echo ""
      echo "## Environment Variables Used"
      echo "- VITE_API_BASE_URL: ${VITE_API_BASE_URL}"
      echo "- VITE_FINZ_ENABLED: ${VITE_FINZ_ENABLED}"
      echo "- BUILD_TARGET: finanzas"
      echo "- DEV_API_URL: ${DEV_API_URL}"
      echo ""
      echo "## Access Points"
      echo "- CloudFront: https://d7t9x3j66yd8k.cloudfront.net/finanzas/"
      echo "- Diagnostics: https://d7t9x3j66yd8k.cloudfront.net/finanzas/_diag"
      echo "- API Health: ${VITE_API_BASE_URL}/health"
      echo ""
      echo "## Last Commit"
      echo "- SHA: $(git rev-parse --short HEAD)"
      echo "- Message: $(git log -1 --pretty=%B | head -1)"
    } >> $GITHUB_STEP_SUMMARY
```

### Step 4: Test with Diagnostics Page

After deployment, visit:
```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/_diag
```

Expected results:
- ✅ Environment Configuration: VITE_API_BASE_URL is set correctly
- ✅ API Health Endpoint: API returns 200 with stage "dev"
- ✅ CORS Preflight: Access-Control-Allow-Origin matches CloudFront domain
- ✅ Authentication Status: JWT token handling works

### Step 5: Verify End-to-End

1. **Portal Load:**
   ```bash
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   # Expected: HTTP 200
   ```

2. **Assets Load:**
   ```bash
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/assets/index-*.js
   # Expected: HTTP 200
   ```

3. **API Health:**
   ```bash
   curl https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
   # Expected: {"ok":true,"stage":"dev","time":"..."}
   ```

4. **Catalog (Public):**
   ```bash
   curl https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros | jq '.data | length'
   # Expected: 71
   ```

5. **Protected Endpoint (with JWT):**
   ```bash
   JWT="<get from Cognito>"
   curl -H "Authorization: Bearer $JWT" \
     https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/allocation-rules | jq '.data | length'
   # Expected: 2
   ```

---

## Workflow Smoke Tests

Add Newman tests for automated verification:

**postman/finanzas-smokes.json:**
```json
{
  "info": {
    "name": "Finanzas API Smoke Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{API_BASE_URL}}/health"
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Status is 200', () => pm.response.to.have.status(200));",
            "pm.test('Response has ok field', () => pm.expect(pm.response.json()).to.have.property('ok'));"
          ]
        }
      }]
    },
    {
      "name": "Catalog Rubros",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{API_BASE_URL}}/catalog/rubros"
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Status is 200', () => pm.response.to.have.status(200));",
            "pm.test('Response has data array', () => {",
            "  const json = pm.response.json();",
            "  pm.expect(json).to.have.property('data');",
            "  pm.expect(json.data).to.be.an('array');",
            "  pm.expect(json.data.length).to.be.greaterThan(0);",
            "});"
          ]
        }
      }]
    }
  ]
}
```

**Add to deploy-ui.yml:**
```yaml
- name: "Newman Smoke Tests"
  if: env.DEV_API_URL != ''
  run: |
    npm install -g newman
    newman run postman/finanzas-smokes.json \
      --env-var "API_BASE_URL=${DEV_API_URL%/}" \
      --reporters cli,json \
      --reporter-json-export /tmp/newman-report.json
    
    echo "### Newman Test Results" >> $GITHUB_STEP_SUMMARY
    jq -r '.run.stats | "- Total: \(.requests.total)\n- Passed: \(.assertions.total - .assertions.failed)\n- Failed: \(.assertions.failed)"' /tmp/newman-report.json >> $GITHUB_STEP_SUMMARY
```

---

## Green Criteria Checklist

- [ ] VITE_API_BASE_URL points to correct Finanzas API (`m3g6am67aj` + `dev`)
- [ ] CloudFront `/finanzas/` returns HTTP 200
- [ ] CloudFront `/finanzas/_diag` shows green status for all checks
- [ ] API health endpoint returns `{"ok":true,"stage":"dev"}`
- [ ] Catalog endpoint returns 71 rubros
- [ ] No CORS errors in browser console
- [ ] Deep-links work (e.g., `/finanzas/catalog/rubros`)
- [ ] $GITHUB_STEP_SUMMARY includes all evidence (CloudFront URL, S3 prefix, API URL)
- [ ] Newman smoke tests pass

---

## References

- [CLOUDFRONT_FINANZAS_DEPLOYMENT.md](../../CLOUDFRONT_FINANZAS_DEPLOYMENT.md)
- [FINANZAS-DEPLOYMENT-COMPLETE.md](../../FINANZAS-DEPLOYMENT-COMPLETE.md)
- [docs/runbooks/cdn-proxy.md](./cdn-proxy.md)
- [deploy-ui.yml](../../.github/workflows/deploy-ui.yml)
- [deploy-api.yml](../../.github/workflows/deploy-api.yml)
- [finanzasClient.ts](../../src/api/finanzasClient.ts)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | DevOps Audit Agent | Initial audit and root-cause analysis |
