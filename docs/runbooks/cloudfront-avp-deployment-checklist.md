# CloudFront & AVP Integration - Quick Checklist

Use this quick checklist when executing the unified CloudFront and AVP deployment. For detailed instructions, see [cloudfront-avp-unified-deployment.md](./cloudfront-avp-unified-deployment.md).

## Pre-Deployment Checklist

- [ ] Verify all required GitHub repository variables are configured
- [ ] Verify all required GitHub secrets are configured
- [ ] Confirm AWS OIDC role has necessary permissions
- [ ] Verify branch `infra/cloudfront-avp-sync` exists or is created
- [ ] Review existing CloudFront configuration (backup if needed)

## Phase 1: CloudFront Distribution Update

- [ ] Run workflow: `update-cloudfront.yml` with environment `dev`
- [ ] Wait for workflow completion (~10-15 minutes)
- [ ] Verify distribution status: `aws cloudfront get-distribution --id EPQU7PVDLQXUA`
- [ ] Check origins include `ApiGwOrigin`
- [ ] Check cache behaviors include `finanzas/api/*`
- [ ] Test health endpoint: `curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health`
- [ ] Verify response: `{"ok": true, "stage": "dev", ...}`

## Phase 2: AVP Policy Store Deployment

- [ ] Run workflow: `deploy-avp.yml` with stage `dev`
- [ ] Wait for workflow completion (~5 minutes)
- [ ] Capture Policy Store ID from workflow output
- [ ] Verify policy store exists: `aws verifiedpermissions get-policy-store --policy-store-id <ID>`
- [ ] Update GitHub variable: `POLICY_STORE_ID` = `<captured ID>`

## Phase 3: Cognito Identity Source Binding

⚠️ **Manual Step - Cannot be skipped!**

- [ ] Prepare command with actual values:
  - `POLICY_STORE_ID` from Phase 2
  - `COGNITO_USER_POOL_ARN` from repository variables
  - `COGNITO_APP_CLIENT_ID` from repository variables
- [ ] Execute: `aws verifiedpermissions create-identity-source ...`
- [ ] Verify identity source created successfully
- [ ] List identity sources: `aws verifiedpermissions list-identity-sources --policy-store-id <ID>`
- [ ] Confirm output shows Cognito User Pool configuration

## Phase 4: API Redeployment with AVP

- [ ] Run workflow: `deploy-api.yml`
- [ ] Wait for workflow completion (~10-15 minutes)
- [ ] Verify workflow shows: `✅ AVP Policy Store verified`
- [ ] Check Lambda environment has `POLICY_STORE_ID`
- [ ] Review smoke test results in workflow output
- [ ] Check Lambda logs for AVP authorization messages

## Post-Deployment Verification

### Basic Smoke Tests

- [ ] UI loads: `curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] Health check: `curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health`
- [ ] Public catalog: `curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/catalog/rubros`

### Authenticated Tests

- [ ] Generate JWT token: `aws cognito-idp initiate-auth ...`
- [ ] Test protected endpoint: `curl -H "Authorization: Bearer $JWT" .../projects`
- [ ] Verify 200 response (if user has permissions)
- [ ] Or verify 403 response (if user lacks permissions)
- [ ] Check Lambda logs show: `[AVP] Authorization decision: ALLOW/DENY`

### CORS Verification

- [ ] Test OPTIONS preflight: `curl -X OPTIONS -H "Origin: ..." .../projects`
- [ ] Verify CORS headers present in response
- [ ] Confirm browser-based calls work without CORS errors

## Evidence Collection

- [ ] Save CloudFront distribution config
- [ ] Save AVP policy store details
- [ ] Save Lambda environment variables
- [ ] Capture smoke test results
- [ ] Save CloudWatch log samples showing AVP decisions

## Common Issues - Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| CloudFront update fails (ETag) | Wait 5 min, retry workflow |
| AVP store not found | Verify `POLICY_STORE_ID` variable set correctly |
| All endpoints return 403 | Check identity source binding (Phase 3) |
| Path rewrite not working | Re-run Phase 1 workflow |
| CORS errors | Verify `AllowedCorsOrigin` in API stack |

## Rollback Quick Reference

| Phase | Rollback Command |
|-------|-----------------|
| Phase 4 | Remove `POLICY_STORE_ID` variable, redeploy API |
| Phase 3 | `aws verifiedpermissions delete-identity-source ...` |
| Phase 2 | `aws cloudformation delete-stack --stack-name finanzas-avp-dev` |
| Phase 1 | Manually remove API cache behavior from CloudFront |

## Success Criteria

✅ Deployment is successful when:

- [ ] CloudFront serves both UI (`/finanzas/`) and API (`/finanzas/api/*`)
- [ ] Health endpoint returns 200 OK via CloudFront
- [ ] Public catalog endpoint returns data via CloudFront
- [ ] Authenticated endpoints work with valid JWT
- [ ] Lambda logs show AVP authorization decisions (ALLOW/DENY)
- [ ] Users with correct groups can access protected resources
- [ ] Users without correct groups receive 403 Forbidden
- [ ] No CORS errors in browser console

## Time Estimate

| Phase | Time | Notes |
|-------|------|-------|
| Phase 1 | 15-20 min | Includes CloudFront propagation |
| Phase 2 | 5-10 min | CloudFormation stack creation |
| Phase 3 | 2-5 min | Manual CLI command |
| Phase 4 | 10-15 min | SAM build and deploy |
| Verification | 10-15 min | Smoke tests and log review |
| **Total** | **45-60 min** | End-to-end deployment |

## Resources

- **Detailed Guide:** [cloudfront-avp-unified-deployment.md](./cloudfront-avp-unified-deployment.md)
- **CloudFront Details:** [cdn-proxy.md](./cdn-proxy.md)
- **AVP Details:** [../../services/finanzas-api/AVP_DEPLOYMENT_GUIDE.md](../../services/finanzas-api/AVP_DEPLOYMENT_GUIDE.md)

## Key Values (Dev Environment)

```bash
CLOUDFRONT_DIST_ID=EPQU7PVDLQXUA
CLOUDFRONT_DOMAIN=d7t9x3j66yd8k.cloudfront.net
API_GATEWAY_ID=m3g6am67aj
API_STAGE=dev
AWS_REGION=us-east-2
API_STACK_NAME=finanzas-sd-api-dev
AVP_STACK_NAME=finanzas-avp-dev
```

---

**Last Updated:** 2025-11-09

**Maintained By:** DevOps Team

**Related PRs:** #70 (Cognito integration), #71 (Module cleanup)
