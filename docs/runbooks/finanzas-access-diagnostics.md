# Finanzas CloudFront Access Diagnostics

**Generated:** 2025-11-09  
**Purpose:** Root-cause analysis and remediation guide for Finanzas module accessibility via CloudFront  
**Status:** 🔍 AUDIT COMPLETE

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

## Root-Cause Summary

### Critical Issues (Fixed)

1. **❌ Wrong VITE_API_BASE_URL in .env.production**
   - Current: `https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod`
   - Expected: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
   - **Impact:** UI calls wrong API (PMO/acta-ui instead of Finanzas)
   - **Fix:** Removed conflicting entries, added documentation

2. **❌ Duplicate VITE_API_BASE_URL entries**
   - `.env.production` had conflicting values at lines 14 and 50
   - **Impact:** Build-time confusion, last value wins
   - **Fix:** Removed duplicate, documented proper configuration

---

## Repository Variables Required

| Variable | Expected Value | Status |
|----------|----------------|--------|
| `DEV_API_URL` | `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` | ❌ Must be set |
| `S3_BUCKET_NAME` | `ukusi-ui-finanzas-prod` | ⚠️ Must be set |
| `CLOUDFRONT_DIST_ID` | `EPQU7PVDLQXUA` | ⚠️ Must be set |
| `COGNITO_USER_POOL_ID` | `us-east-2_FyHLtOhiY` | ⚠️ Must be set |
| `COGNITO_WEB_CLIENT` | `dshos5iou44tuach7ta3ici5m` | ⚠️ Must be set |

---

## Green Criteria Checklist

- [ ] VITE_API_BASE_URL points to correct Finanzas API (`m3g6am67aj` + `dev`)
- [ ] CloudFront `/finanzas/` returns HTTP 200
- [ ] CloudFront `/finanzas/_diag` shows green status for all checks
- [ ] API health endpoint returns `{"ok":true,"stage":"dev"}`
- [ ] Catalog endpoint returns 71 rubros
- [ ] No CORS errors in browser console
- [ ] Deep-links work (e.g., `/finanzas/catalog/rubros`)
- [ ] Newman smoke tests pass

---

## References

- [CLOUDFRONT_FINANZAS_DEPLOYMENT.md](../../CLOUDFRONT_FINANZAS_DEPLOYMENT.md)
- [FINANZAS-DEPLOYMENT-COMPLETE.md](../../FINANZAS-DEPLOYMENT-COMPLETE.md)
