# Finanzas Deployment Verification Checklist

**Purpose:** This checklist ensures all aspects of the Finanzas deployment are verified and functioning correctly before considering the deployment complete.

**Status:** Use this as a go/no-go checklist for production releases.

---

## Pre-Deployment Verification

### Code & Build
- [ ] All code changes reviewed and merged
- [ ] Build succeeds for both PMO and Finanzas targets
  - [ ] `npm run build:pmo` completes without errors
  - [ ] `npm run build:finanzas` completes without errors
- [ ] Linting passes: `npm run lint`
- [ ] TypeScript compilation succeeds
- [ ] No hardcoded URLs or credentials in code
- [ ] Environment variables properly configured

### Infrastructure Prerequisites
- [ ] AWS credentials configured with appropriate permissions
- [ ] CloudFront distribution exists (EPQU7PVDLQXUA)
- [ ] S3 bucket exists (ukusi-ui-finanzas-prod)
- [ ] Cognito User Pool exists (us-east-2_FyHLtOhiY)
- [ ] API Gateway deployed (m3g6am67aj)
- [ ] DynamoDB tables created:
  - [ ] finz_rubros
  - [ ] finz_projects
  - [ ] finz_adjustments
  - [ ] finz_rules
  - [ ] finz_audit_log

---

## 1. CloudFront Configuration

### Distribution Settings
- [ ] Distribution ID confirmed: EPQU7PVDLQXUA
- [ ] Domain name: d7t9x3j66yd8k.cloudfront.net
- [ ] SSL certificate configured (HTTPS only)
- [ ] Distribution status: Deployed

### Origin Configuration
- [ ] Origin points to S3 bucket: ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com
- [ ] Origin Access Control (OAC) configured: finanzas-ui-oac
- [ ] S3 bucket policy allows CloudFront access

### Behaviors Configuration
- [ ] **Default behavior** configured for PMO root
  - [ ] Path pattern: Default (*)
  - [ ] Origin: S3 bucket
  - [ ] Default root object: index.html
  - [ ] HTTPS redirect enabled

- [ ] **Finanzas behavior** configured
  - [ ] Path pattern: `/finanzas/*`
  - [ ] Origin: S3 bucket origin
  - [ ] Viewer protocol policy: Redirect HTTP to HTTPS
  - [ ] Cache policy: CachingOptimized
  - [ ] Compress objects: On

### Error Responses
- [ ] Custom error responses configured for /finanzas/* behavior:
  - [ ] 403 → Response: /finanzas/index.html, HTTP Status: 200
  - [ ] 404 → Response: /finanzas/index.html, HTTP Status: 200

**Verification Command:**
```bash
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CacheBehaviors[*].[PathPattern,OriginId]' \
  --output table
```

**Expected Output:** Should show `/finanzas/*` behavior listed

---

## 2. S3 Content Validation

### Bucket Structure
- [ ] Bucket accessible: s3://ukusi-ui-finanzas-prod
- [ ] PMO files at root:
  - [ ] index.html exists at root
  - [ ] assets/ directory exists with JS/CSS bundles
- [ ] Finanzas files under /finanzas/:
  - [ ] finanzas/index.html exists
  - [ ] finanzas/assets/ directory exists with JS/CSS bundles

### File Timestamps
- [ ] Files recently uploaded (check LastModified date)
- [ ] Timestamps match latest deployment

**Verification Commands:**
```bash
# Check PMO root
aws s3api head-object --bucket ukusi-ui-finanzas-prod --key index.html

# Check Finanzas
aws s3api head-object --bucket ukusi-ui-finanzas-prod --key finanzas/index.html

# List Finanzas assets
aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive | head -10
```

### Cache Invalidation
- [ ] CloudFront cache invalidated after deployment
  - [ ] Invalidation created for `/*`
  - [ ] Invalidation created for `/finanzas/*`
  - [ ] Invalidation status: Completed

**Verification Command:**
```bash
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/*' '/finanzas/*'
```

---

## 3. Cognito Configuration

### User Pool Settings
- [ ] User Pool ID: us-east-2_FyHLtOhiY
- [ ] Region: us-east-2
- [ ] App Client ID: dshos5iou44tuach7ta3ici5m

### App Client Configuration
- [ ] Allowed Callback URLs include:
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/`
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  
- [ ] Allowed Sign-out URLs include:
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/`
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

- [ ] Allowed OAuth Flows:
  - [ ] Authorization code grant enabled
  - [ ] Implicit grant enabled (if needed)

- [ ] Allowed OAuth Scopes:
  - [ ] openid
  - [ ] email
  - [ ] profile

### Test User Verification
- [ ] Test user exists with appropriate groups
- [ ] User groups configured: SDT, admin, FIN, AUD
- [ ] Test credentials verified and working

**Verification:** Log into AWS Cognito Console and verify settings manually

---

## 4. Data Seeding (DynamoDB)

### Rubros Table (finz_rubros)
- [ ] Table exists
- [ ] All 71 rubros seeded
- [ ] Sample rubro verified with correct schema:
  - [ ] rubro_id
  - [ ] nombre
  - [ ] categoria
  - [ ] tipo_ejecucion

**Verification Command:**
```bash
aws dynamodb scan --table-name finz_rubros --select COUNT --region us-east-2
```
**Expected:** Count: 71

### Allocation Rules
- [ ] finz_rules table exists
- [ ] Minimum 2 default rules seeded
- [ ] Rules have correct schema:
  - [ ] rule_id
  - [ ] linea_codigo
  - [ ] driver (percent, fixed, tickets, hours)
  - [ ] priority

**Verification Command:**
```bash
aws dynamodb scan --table-name finz_rules --region us-east-2 | jq '.Count'
```
**Expected:** Count: 2 or more

### Other Tables
- [ ] finz_projects table exists and accessible
- [ ] finz_adjustments table exists and accessible
- [ ] finz_audit_log table exists and accessible

---

## 5. Automated Verification Scripts

### Basic Deployment Verification
- [ ] Script runs without errors: `./scripts/verify-deployment.sh`
- [ ] CloudFront behaviors verified: ✅
- [ ] S3 content verified: ✅
- [ ] Web accessibility verified: ✅
- [ ] All checks pass

### End-to-End Smoke Test
- [ ] Script runs without errors: `./scripts/finanzas-e2e-smoke.sh`
- [ ] Cognito authentication: ✅ IdToken obtained
- [ ] API health check: ✅ /health → 200
- [ ] Catalog retrieval: ✅ /catalog/rubros → 200 (71 items)
- [ ] Rules retrieval: ✅ /allocation-rules → 200
- [ ] Lambda write test: ✅ POST /adjustments → 201
- [ ] DynamoDB verification: ✅ Record persisted
- [ ] Audit log verification: ✅ Entries found

**Run Commands:**
```bash
# Basic verification
./scripts/verify-deployment.sh

# E2E smoke test (requires credentials)
export USERNAME="christian.valencia@ikusi.com"
export PASSWORD="your-password"
./scripts/finanzas-e2e-smoke.sh
```

---

## 6. UI Functional Checks

### Login Flow
- [ ] Navigate to: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- [ ] Login button visible
- [ ] Click "Sign In" redirects to Cognito
- [ ] Enter credentials and authenticate
- [ ] After successful auth, redirected to /finanzas/ home page (NOT root)
- [ ] Finanzas dashboard displays correctly
- [ ] No errors in browser console

### Navigation
- [ ] Navigation bar displays
- [ ] Finanzas menu items visible (for users in SDT/FIN groups)
- [ ] "Rubros" link navigates to /finanzas/catalog/rubros
- [ ] "Rules" link navigates to /finanzas/rules
- [ ] User profile accessible
- [ ] Sign out functionality works
- [ ] After sign out, user redirected to login page

### Catalog/Rubros Page
- [ ] Page loads: /finanzas/catalog/rubros
- [ ] Browser console shows API call: GET /catalog/rubros
- [ ] API returns 200 status
- [ ] Data displays in table/list format
- [ ] All 71 rubros visible (may be paginated)
- [ ] Rubro fields display correctly:
  - [ ] Rubro ID
  - [ ] Nombre
  - [ ] Categoria
  - [ ] Tipo de Ejecución
- [ ] Search/filter functionality works (if implemented)
- [ ] Sorting functionality works (if implemented)
- [ ] No 404 errors on assets (JS/CSS)

### Rules Page
- [ ] Page loads: /finanzas/rules
- [ ] Browser console shows API call: GET /allocation-rules
- [ ] API returns 200 status
- [ ] Rules data displays correctly
- [ ] Rule details visible:
  - [ ] Rule ID
  - [ ] Linea Código
  - [ ] Driver Type
  - [ ] Priority
- [ ] No errors in console

### Assets & Resources
- [ ] All JavaScript bundles load (no 404)
- [ ] All CSS files load (no 404)
- [ ] Images/icons load correctly
- [ ] Fonts load correctly
- [ ] No mixed content warnings (HTTPS)

---

## 7. API Response Verification

### Health Endpoint (Public)
```bash
curl -i https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
```
- [ ] Status: 200 OK
- [ ] Response body: `{"status":"ok"}` or similar

### Catalog Rubros (Protected)
```bash
TOKEN="<your-id-token>"
curl -i -H "Authorization: Bearer $TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros
```
- [ ] Status: 200 OK
- [ ] Response includes `data` array
- [ ] Array contains 71 items
- [ ] Each item has: rubro_id, nombre, categoria, tipo_ejecucion

### Allocation Rules (Protected)
```bash
TOKEN="<your-id-token>"
curl -i -H "Authorization: Bearer $TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/allocation-rules
```
- [ ] Status: 200 OK
- [ ] Response includes rules array
- [ ] Array contains at least 2 items
- [ ] Each item has: rule_id, linea_codigo, driver, priority

---

## 8. Security & Authentication

### Token Validation
- [ ] Bearer token required for protected endpoints
- [ ] Requests without token return 401 Unauthorized
- [ ] Invalid/expired tokens rejected
- [ ] Token aud claim matches App Client ID
- [ ] Token iss claim matches Cognito User Pool

### Access Control
- [ ] Users without FIN/SDT groups cannot access Finanzas pages
- [ ] Appropriate 403 responses for unauthorized access
- [ ] Cross-site request forgery (CSRF) protections in place

### HTTPS & Certificates
- [ ] All requests use HTTPS
- [ ] SSL certificate valid
- [ ] No certificate warnings in browser
- [ ] HTTP automatically redirects to HTTPS

---

## 9. Performance & UX

### Page Load Times
- [ ] Finanzas home page loads < 3 seconds
- [ ] Rubros page loads < 3 seconds
- [ ] Rules page loads < 3 seconds

### Responsive Design
- [ ] UI displays correctly on desktop (1920x1080)
- [ ] UI displays correctly on tablet (768x1024)
- [ ] UI displays correctly on mobile (375x667)
- [ ] No horizontal scrolling issues

### Loading States
- [ ] Loading indicators display during API calls
- [ ] Skeleton screens or spinners visible
- [ ] User feedback during data fetching

### Error Handling
- [ ] Error messages are user-friendly
- [ ] Network errors handled gracefully
- [ ] 404 pages display correctly
- [ ] API errors show toast notifications

---

## 10. Evidence Collection

### Screenshots Required
- [ ] Finanzas home page after login
- [ ] Rubros catalog page with data
- [ ] Rules page with data
- [ ] Browser DevTools Network tab showing API calls
- [ ] CloudFront behaviors configuration
- [ ] Cognito callback URLs configuration

### Console Outputs
- [ ] verify-deployment.sh output (all ✅)
- [ ] finanzas-e2e-smoke.sh output (all ✅)
- [ ] DynamoDB count queries output
- [ ] Browser console logs (no errors)

### Documentation
- [ ] Update FINANZAS-DEPLOYMENT-COMPLETE.md with latest deployment date
- [ ] Document any configuration changes
- [ ] Note any issues encountered and resolutions
- [ ] Update version history

---

## Final Sign-Off

### Deployment Team
- [ ] All checklist items completed
- [ ] All verification scripts pass
- [ ] All manual tests pass
- [ ] Evidence collected and documented
- [ ] Known issues documented (if any)

**Deployed by:** _________________  
**Date:** _________________  
**Deployment verified:** ☐ Yes ☐ No

### Stakeholder Approval
- [ ] Technical lead reviewed
- [ ] QA team approved
- [ ] Product owner notified

**Approved by:** _________________  
**Date:** _________________

---

## Rollback Plan

If any critical issues are found:

1. **Immediate Actions:**
   - [ ] Document the issue
   - [ ] Notify stakeholders
   - [ ] Assess impact and severity

2. **Rollback Steps:**
   - [ ] Revert CloudFront behavior to previous version
   - [ ] Roll back S3 bucket to previous files
   - [ ] Invalidate CloudFront cache
   - [ ] Notify users of temporary service interruption

3. **Post-Rollback:**
   - [ ] Conduct root cause analysis
   - [ ] Fix issues in development/staging
   - [ ] Re-test thoroughly
   - [ ] Plan new deployment

---

## Notes & Observations

_Use this space to document any observations, warnings, or notes during verification:_

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-10  
**Status:** Active
