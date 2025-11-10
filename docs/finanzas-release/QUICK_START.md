# Finanzas Deployment - Quick Start Guide

**For:** DevOps engineers, deployment teams, and operations staff  
**Purpose:** Fast-track guide to verify a Finanzas deployment  
**Time Required:** 15-30 minutes

---

## 🚀 Quick Deployment Verification (5 Minutes)

### Step 1: Run Infrastructure Check
```bash
cd /path/to/repository
./scripts/verify-deployment.sh
```

**✅ Success Criteria:** All checks show ✅  
**❌ If Failed:** See [Troubleshooting](#troubleshooting-quick-reference)

### Step 2: Run API/DB Check
```bash
export USERNAME="your-test-user@example.com"
export PASSWORD="your-test-password"
./scripts/finanzas-e2e-smoke.sh
```

**✅ Success Criteria:** All sections show ✅  
**❌ If Failed:** See [Troubleshooting](#troubleshooting-quick-reference)

### Step 3: Quick UI Test
1. Open: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
2. Click "Sign In"
3. Verify redirect to /finanzas/ after login
4. Click "Rubros" → verify 71 entries load
5. Check browser console for errors (F12)

**✅ Success Criteria:** All pages load, no errors  
**❌ If Failed:** See [Troubleshooting](#troubleshooting-quick-reference)

---

## 📋 Full Deployment Verification (30 Minutes)

For complete verification before production go-live:

### Pre-Flight Checklist
- [ ] AWS CLI installed and configured
- [ ] Access to AWS Console (CloudFront, S3, Cognito, DynamoDB)
- [ ] Test user credentials available
- [ ] Repository cloned locally

### Complete Verification Steps

1. **Read Documentation (5 min)**
   - Review [README.md](./README.md) for context
   - Skim [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md)

2. **Run Automated Scripts (5 min)**
   - Execute `verify-deployment.sh`
   - Execute `finanzas-e2e-smoke.sh`
   - Save outputs for evidence

3. **Manual AWS Console Checks (10 min)**
   - CloudFront: Verify /finanzas/* behavior exists
   - S3: Verify finanzas/index.html exists
   - Cognito: Verify callback URLs include /finanzas/
   - DynamoDB: Verify tables exist and have data

4. **Manual UI Testing (10 min)**
   - Test login flow
   - Test navigation
   - Test data display (Rubros, Rules)
   - Check browser console for errors

5. **Collect Evidence**
   - Save script outputs
   - Take screenshots of UI pages
   - Take screenshots of AWS configurations
   - Complete [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md)

---

## 📚 Documentation Quick Links

### For First-Time Setup
- **[README.md](./README.md)** ← Start here for overview
- **[FINANZAS-DEPLOYMENT-COMPLETE.md](./FINANZAS-DEPLOYMENT-COMPLETE.md)** ← Infrastructure ground truth

### For Running Tests
- **[VERIFICATION_SCRIPTS_GUIDE.md](./VERIFICATION_SCRIPTS_GUIDE.md)** ← Detailed script usage
- **[TEST_EVIDENCE_SUMMARY.md](./TEST_EVIDENCE_SUMMARY.md)** ← Test coverage and evidence

### For Configuration Issues
- **[FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md)** ← CloudFront, S3, Cognito setup
- **[FINANZAS_DEPLOYMENT_VERIFICATION.md](./FINANZAS_DEPLOYMENT_VERIFICATION.md)** ← Manual verification steps

### For Production Go-Live
- **[DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md)** ← Complete checklist

---

## 🔧 Troubleshooting Quick Reference

### ❌ CloudFront behavior not found
**Fix:** Add /finanzas/* behavior in CloudFront Console  
**Doc:** [FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md) - Section: Step 4

### ❌ S3 finanzas/index.html not found
**Fix:** Re-deploy Finanzas build
```bash
npm run build:finanzas
aws s3 sync dist-finanzas/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete
aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA --paths '/finanzas/*'
```

### ❌ Cognito authentication fails
**Fix:** Check user credentials and Cognito configuration  
**Doc:** [FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md) - Section: Cognito App Client

### ❌ API returns 401 Unauthorized
**Fix:** Verify Bearer token is included in requests  
**Doc:** [VERIFICATION_SCRIPTS_GUIDE.md](./VERIFICATION_SCRIPTS_GUIDE.md) - Troubleshooting section

### ❌ Rubros count not 71
**Fix:** Seed DynamoDB tables
```bash
cd scripts/ts-seeds/
npm install
npm run seed:rubros
```

### ❌ UI shows 404 on subdirectories
**Fix:** Configure CloudFront custom error responses (403/404 → /finanzas/index.html)  
**Doc:** [FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md) - Section: Error Responses

---

## 🎯 Critical Configuration Points

### CloudFront
- **Distribution ID:** EPQU7PVDLQXUA
- **Domain:** d7t9x3j66yd8k.cloudfront.net
- **MUST HAVE:** /finanzas/* behavior configured
- **MUST HAVE:** Error responses (403/404 → /finanzas/index.html)

### S3
- **Bucket:** ukusi-ui-finanzas-prod
- **Region:** us-east-2
- **Structure:**
  ```
  /index.html                (PMO)
  /assets/                   (PMO assets)
  /finanzas/index.html       (Finanzas)
  /finanzas/assets/          (Finanzas assets)
  ```

### Cognito
- **User Pool:** us-east-2_FyHLtOhiY
- **App Client:** dshos5iou44tuach7ta3ici5m
- **Callback URLs MUST include:**
  - https://d7t9x3j66yd8k.cloudfront.net/
  - https://d7t9x3j66yd8k.cloudfront.net/finanzas/

### API
- **Base URL:** https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
- **Region:** us-east-2
- **Auth:** Cognito JWT Bearer token

### DynamoDB
- **Tables:** finz_rubros, finz_projects, finz_adjustments, finz_rules, finz_audit_log
- **Region:** us-east-2
- **MUST HAVE:** 71 rubros in finz_rubros table

---

## ✅ Success Indicators

### All Systems Green
- ✅ Both verification scripts pass
- ✅ All UI pages load without errors
- ✅ Login flow redirects to /finanzas/
- ✅ Rubros page shows 71 entries
- ✅ Rules page shows 2+ entries
- ✅ No 404 errors on assets
- ✅ No JavaScript console errors
- ✅ All API calls return 200/201

### Ready for Production
When you see all green indicators above:
1. Complete [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md)
2. Collect evidence (screenshots, logs)
3. Obtain stakeholder sign-off
4. Archive evidence for compliance
5. Communicate deployment success

---

## 🆘 Need Help?

### Documentation Resources
1. **[README.md](./README.md)** - Comprehensive overview
2. **[VERIFICATION_SCRIPTS_GUIDE.md](./VERIFICATION_SCRIPTS_GUIDE.md)** - Detailed script guide
3. **[FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md)** - Configuration guides
4. **[TEST_EVIDENCE_SUMMARY.md](./TEST_EVIDENCE_SUMMARY.md)** - Test coverage details

### AWS Resources
- CloudFront Console: AWS Console → CloudFront → EPQU7PVDLQXUA
- S3 Console: AWS Console → S3 → ukusi-ui-finanzas-prod
- Cognito Console: AWS Console → Cognito → us-east-2_FyHLtOhiY
- DynamoDB Console: AWS Console → DynamoDB → Tables

### Log Locations
- **Lambda logs:** CloudWatch → Log Groups → /aws/lambda/finanzas-api-*
- **API Gateway logs:** CloudWatch → Log Groups → API-Gateway-Execution-Logs
- **Browser logs:** Browser DevTools → Console (F12)

---

## 🔄 Daily Operations

### Morning Health Check (2 min)
```bash
./scripts/verify-deployment.sh
```
**Expected:** All ✅  
**If failed:** Investigate immediately

### Weekly Full Test (5 min)
```bash
export USERNAME="test-user@example.com"
export PASSWORD="test-password"
./scripts/finanzas-e2e-smoke.sh
```
**Expected:** All ✅  
**If failed:** Document and investigate

---

## 📊 Deployment Metrics

Track these metrics for each deployment:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Infrastructure check time | < 30 sec | Time for verify-deployment.sh |
| E2E test time | < 60 sec | Time for finanzas-e2e-smoke.sh |
| Page load time | < 3 sec | Browser DevTools Performance tab |
| API response time | < 500ms | finanzas-e2e-smoke.sh output |
| Test pass rate | 100% | All ✅ in script outputs |

---

**Last Updated:** 2025-11-10  
**Version:** 1.0  
**Status:** Active
