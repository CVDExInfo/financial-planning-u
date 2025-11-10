# Finanzas Portal - Production Release Documentation

## Overview

This directory contains critical documentation and resources for the Finanzas Financial Planning & Management module deployment and verification. These documents are maintained separately to highlight their importance for production operations and troubleshooting.

## Purpose

The Finanzas module is a separate Single Page Application (SPA) that runs alongside the main PMO portal, accessible at the `/finanzas/` path. This documentation ensures that:

- Deployment configurations are properly documented
- Verification procedures are standardized
- Future maintainers can quickly understand the system architecture
- Troubleshooting guides are readily available

## Contents

### Core Documents

1. **[FINANZAS-DEPLOYMENT-COMPLETE.md](./FINANZAS-DEPLOYMENT-COMPLETE.md)**
   - Complete deployment status and checklist
   - Ground truth values for all infrastructure components
   - Source of truth for CloudFront, S3, API Gateway, Cognito, and DynamoDB configurations
   - Use this as the primary reference for infrastructure details

2. **[FINANZAS_DEPLOYMENT_VERIFICATION.md](./FINANZAS_DEPLOYMENT_VERIFICATION.md)**
   - Step-by-step verification procedures
   - Manual testing checklists
   - Expected responses and behaviors
   - Troubleshooting common issues

3. **[FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md)**
   - Configuration checklist for CloudFront, S3, and Cognito
   - AWS Console navigation guides
   - Cache invalidation procedures
   - Post-deployment verification steps

## Quick Start

### For New Deployments

1. Review **[FINANZAS-DEPLOYMENT-COMPLETE.md](./FINANZAS-DEPLOYMENT-COMPLETE.md)** for infrastructure ground truth
2. Follow configuration steps in **[FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md)**
3. Run verification scripts (see below)
4. Use **[FINANZAS_DEPLOYMENT_VERIFICATION.md](./FINANZAS_DEPLOYMENT_VERIFICATION.md)** for manual testing

### For Troubleshooting

1. Start with **[FINANZAS_NEXT_STEPS.md](./FINANZAS_NEXT_STEPS.md)** - Check CloudFront behavior, S3 content, and Cognito settings
2. Run automated verification (see Verification Scripts below)
3. Review **[FINANZAS_DEPLOYMENT_VERIFICATION.md](./FINANZAS_DEPLOYMENT_VERIFICATION.md)** for specific test cases

## Verification Scripts

### Location
All verification scripts are in the `/scripts` directory at the repository root.

### Available Scripts

#### 1. Basic Deployment Verification
```bash
./scripts/verify-deployment.sh
```

**Purpose:** Quick infrastructure check
**Checks:**
- CloudFront distribution behaviors
- S3 bucket contents
- Web accessibility (HTTP status codes)
- Finanzas endpoint availability

**Expected Output:**
```
✅ CloudFront distribution accessible
✅ /finanzas/* behavior found
✅ S3 bucket accessible
✅ PMO Portal: HTTP 200
✅ Finanzas Portal: HTTP 200
✅ Finanzas Catalog: HTTP 200
```

#### 2. End-to-End Smoke Test
```bash
export USERNAME="your-test-user@example.com"
export PASSWORD="your-test-password"
./scripts/finanzas-e2e-smoke.sh
```

**Purpose:** Complete API → Lambda → DynamoDB verification
**Tests:**
- Cognito authentication flow
- API health endpoint
- Catalog/Rubros data retrieval (71 rubros expected)
- Allocation rules retrieval
- DynamoDB write operations
- Audit log verification

**Expected Output:**
```
✅ Auth: IdToken obtained from Cognito
✅ API Health: Responding
✅ Catalog: GET /catalog/rubros → 200 (count: 71)
✅ Rules: GET /allocation-rules → 200
✅ Lambda: POST /adjustments → 201
✅ DynamoDB: Record persisted
```

## Architecture Quick Reference

### Frontend
- **Technology:** React 19 SPA with Vite
- **Base Path:** `/finanzas/`
- **CloudFront URL:** https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- **S3 Location:** s3://ukusi-ui-finanzas-prod/finanzas/

### Backend
- **API Gateway:** https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
- **Runtime:** Node.js 18 Lambda with ESM
- **Authentication:** Cognito JWT (Bearer token)
- **Database:** DynamoDB tables (finz_rubros, finz_projects, finz_adjustments, finz_audit_log)

### Authentication
- **User Pool:** us-east-2_FyHLtOhiY
- **App Client:** dshos5iou44tuach7ta3ici5m
- **Region:** us-east-2

## Critical Configuration Points

### 1. CloudFront Behaviors
- **MUST HAVE:** `/finanzas/*` path pattern behavior
- **Origin:** Points to ukusi-ui-finanzas-prod S3 bucket
- **Error Responses:** 403/404 → /finanzas/index.html (SPA fallback)

### 2. S3 Structure
```
ukusi-ui-finanzas-prod/
├── index.html              (PMO Portal root)
├── assets/                 (PMO assets)
└── finanzas/
    ├── index.html          (Finanzas SPA)
    └── assets/             (Finanzas assets)
```

### 3. Cognito Callback URLs
Must include both:
- `https://d7t9x3j66yd8k.cloudfront.net/`
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

### 4. DynamoDB Seed Data
- **finz_rubros:** 71 budget categories (rubros)
- **finz_projects:** Project data
- **finz_rules:** Allocation rules (minimum 2 expected)

## Acceptance Criteria Checklist

Use this checklist to verify a complete deployment:

- [ ] CloudFront `/finanzas/*` behavior exists
- [ ] S3 bucket contains finanzas/index.html
- [ ] Cognito callback URLs include /finanzas/ path
- [ ] DynamoDB tables are seeded with initial data
- [ ] `/catalog/rubros` returns 71 rubros
- [ ] `/allocation-rules` returns expected rules
- [ ] Login flow redirects to /finanzas/ home page
- [ ] Navigation items are visible and functional
- [ ] No 404 errors on JS/CSS assets
- [ ] No 401 errors on authenticated API calls
- [ ] All verification scripts pass with ✅

## Related Documentation

- **[QA Full Review](../QA-FullReview-Finanzas.md)** - Comprehensive testing checklist
- **[Architecture Diagrams](../architecture/finanzas-architecture.md)** - System architecture overview
- **[API Contracts](../api-contracts.md)** - API endpoint specifications
- **[UI-API Action Map](../ui-api-action-map.md)** - Complete UI-API integration mapping

## Support & Troubleshooting

### Common Issues

**Issue:** Finanzas page shows old/cached content
- **Solution:** Create CloudFront invalidation for `/finanzas/*`

**Issue:** 404 on /finanzas/ subdirectories
- **Solution:** Verify CloudFront error responses are configured for 403/404 → /finanzas/index.html

**Issue:** API returns 401 Unauthorized
- **Solution:** Check Cognito token is being sent in Authorization header, verify token aud/iss claims

**Issue:** Rubros count is not 71
- **Solution:** Re-run DynamoDB seed scripts in `/scripts/ts-seeds/`

### Getting Help

1. Check troubleshooting sections in the documents above
2. Review CloudFront and S3 configurations per FINANZAS_NEXT_STEPS.md
3. Run verification scripts to identify specific failures
4. Review API and browser console logs for detailed error messages

## Maintenance

### Updating This Documentation

When making changes to Finanzas infrastructure:
1. Update ground truth values in FINANZAS-DEPLOYMENT-COMPLETE.md
2. Add new verification steps to FINANZAS_DEPLOYMENT_VERIFICATION.md
3. Update this README if new documents are added
4. Keep verification scripts in sync with documentation

### Version History

- **2025-11-10:** Initial release documentation organization
- **2025-11-08:** Production deployment completed and verified
- **2025-11-07:** CloudFront and authentication configuration finalized

---

**Last Updated:** 2025-11-10  
**Maintained by:** DevOps Team  
**Status:** 🟢 Production Active
