# Pull Request Checklist - CloudFront /finanzas Deployment

## Part D: Acceptance Checklist

This checklist must be completed and verified before merging this PR.

### Infrastructure

- [ ] S3 bucket created in us-east-2, private, versioned, encrypted
  - Bucket name: `ukusi-ui-finanzas-prod`
  - Region: us-east-2
  - Public access: Blocked
  - Versioning: Enabled
  - Encryption: AES256
  - Verify: `aws s3api head-bucket --bucket ukusi-ui-finanzas-prod`

- [ ] CloudFront behavior `/finanzas/*` added; existing behaviors untouched
  - Distribution ID: EPQU7PVDLQXUA
  - Origin: S3-ukusi-ui-finanzas-prod
  - Path pattern: /finanzas/*
  - Verify: Check CloudFront console or AWS CLI

- [ ] Error mapping: 403/404 → /finanzas/index.html (200)
  - Custom error response for 403
  - Custom error response for 404
  - Response page: /finanzas/index.html
  - Response code: 200
  - Verify: `curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/nonexistent`

### CI/CD Pipeline

- [ ] OIDC-only workflow; no static keys referenced
  - Uses `aws-actions/configure-aws-credentials@v4`
  - Role ARN from `secrets.OIDC_AWS_ROLE_ARN`
  - No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in workflow
  - Verify: Review `.github/workflows/deploy.yml`

- [ ] Deep links to /finanzas/* render via SPA fallback
  - Should return 200 and serve index.html
  - React Router handles client-side routing
  - Verify: Test multiple deep link paths

- [ ] Cache policy: immutable for assets; HTML short TTL
  - Hashed assets: 1-year TTL with immutable flag
  - HTML files: 0 TTL with must-revalidate
  - Compression enabled (Gzip, Brotli)
  - Verify: Check response headers with `curl -I`

### Configuration

- [ ] All env from org/repo variables (no secrets in code)
  - AWS_REGION
  - S3_BUCKET_NAME
  - CLOUDFRONT_DIST_ID
  - DISTRIBUTION_DOMAIN_NAME
  - VITE_API_BASE_URL
  - VITE_ACTA_API_ID
  - Verify: Check GitHub repository/organization variables

- [ ] Preflight checks in workflow
  - Region verification (us-east-2)
  - Distribution ID verification (EPQU7PVDLQXUA)
  - Domain verification (d7t9x3j66yd8k.cloudfront.net)
  - Secret existence check
  - Verify: Review workflow file

### Documentation

- [ ] Rollback one-liner (restore previous S3 state)
  - S3 versioning enabled
  - Documented in `docs/deploy.md`
  - Documented in `docs/ops/readme.md`
  - Verify: Review documentation

- [ ] Plan shows no change to other origins/behaviors
  - Terraform plan output reviewed
  - Only new resources created (S3, OAC, cache policies)
  - Existing CloudFront distribution read-only
  - Verify: Run `terraform plan` and review output

### Testing

- [ ] Build succeeds locally
  - `npm ci` completes successfully
  - `npm run build` completes successfully
  - `dist/` directory contains built assets
  - Base path `/finanzas/` in index.html

- [ ] Linting passes
  - `npm run lint` runs without new errors
  - Only existing warnings (not related to changes)

- [ ] Application routes correctly configured
  - BrowserRouter basename: `/finanzas`
  - Vite config base: `/finanzas/`
  - All relative paths use base correctly

### Safety Verification

- [ ] No breaking changes to current UI/paths
  - Only `/finanzas/*` path added
  - No changes to existing CloudFront behaviors
  - No changes to other origins
  - Existing application paths unaffected

- [ ] Terraform state management
  - Local state for initial setup
  - Remote state documentation provided
  - State location documented

- [ ] Security best practices
  - S3 bucket private (all public access blocked)
  - CloudFront uses HTTPS only
  - Origin Access Control (OAC) for S3 access
  - No credentials in code or configuration files
  - OIDC for CI/CD authentication

### Post-Merge Actions

- [ ] Monitor first deployment
  - Check GitHub Actions logs
  - Verify S3 sync completes
  - Verify CloudFront invalidation
  - Check deployment summary

- [ ] Smoke test after deployment
  - Root path: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
  - Deep links work
  - Assets load correctly
  - No console errors
  - Navigation works

- [ ] Verify existing paths still work
  - Test non-finanzas paths
  - Verify no impact to other applications
  - Check acta-ui remains functional

## Notes

- **Manual CloudFront Configuration Required**: After Terraform creates resources, CloudFront origin, behavior, and error responses must be added manually via AWS Console or CLI.

- **Deployment Timeline**: 
  - Terraform: ~2-5 minutes
  - CloudFront config: ~5-15 minutes propagation
  - First deployment: ~5-10 minutes
  - Total: ~15-30 minutes

- **Rollback Available**: S3 versioning is enabled for quick rollback if needed.

## Reviewer Checklist

- [ ] Code changes reviewed and approved
- [ ] Infrastructure configuration reviewed
- [ ] Documentation is complete and accurate
- [ ] Security considerations addressed
- [ ] No hardcoded secrets or credentials
- [ ] Workflow configuration is correct
- [ ] All acceptance criteria met

## Deployment Plan

1. **Pre-Merge**: 
   - Configure GitHub variables and secrets
   - Run Terraform to create infrastructure
   - Manually configure CloudFront

2. **Merge**: 
   - Merge PR to main branch

3. **Post-Merge**: 
   - Monitor automatic deployment
   - Run smoke tests
   - Verify metrics

4. **If Issues**: 
   - Use rollback procedure
   - Review logs
   - Fix and redeploy

---

**Sign-off**: All checklist items completed and verified.
