# PR Merge Checklist - Fix CI + Finalize Option A (/finanzas)

This checklist must be completed before merging the PR.

## Pre-Merge Verification

### ✅ Code Changes

- [ ] All changes are scoped to CI, infrastructure helpers, and documentation
- [ ] No modifications to existing UI components (except /finanzas configuration)
- [ ] Base path configuration intact:
  - [ ] `vite.config.ts` has `base: '/finanzas/'`
  - [ ] `src/App.tsx` has `basename="/finanzas"`
- [ ] No hard-coded secrets in code
- [ ] Region locked to `us-east-2` in all configurations

### ✅ CI/CD Workflow

- [ ] Workflow file at `.github/workflows/deploy.yml` is valid YAML
- [ ] OIDC local action at `.github/actions/oidc-configure-aws/` is present
- [ ] Workflow has `id-token: write` permission
- [ ] Preflight checks verify:
  - [ ] AWS_REGION = us-east-2
  - [ ] CLOUDFRONT_DIST_ID = EPQU7PVDLQXUA
  - [ ] DISTRIBUTION_DOMAIN_NAME = d7t9x3j66yd8k.cloudfront.net
  - [ ] OIDC_AWS_ROLE_ARN secret exists
- [ ] Dual authentication path implemented:
  - [ ] Primary: OIDC via local composite action
  - [ ] Fallback: Static keys (gated by `FALLBACK_STATIC_KEYS` variable)
- [ ] S3 bucket creation if missing
- [ ] CloudFront invalidation for `/finanzas/*` only

### ✅ Documentation

- [ ] `docs/deploy.md` updated with:
  - [ ] Dual authentication explanation
  - [ ] How to enable/disable fallback
  - [ ] Rollback procedures (3 options)
  - [ ] OIDC troubleshooting
- [ ] `docs/ops/readme.md` updated with local OIDC action details
- [ ] `.github/actions/oidc-configure-aws/README.md` complete
- [ ] `scripts/create-s3-bucket.sh` documented and executable

### ✅ Testing

- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint` (warnings OK, no errors)
- [ ] Base path test file created: `src/__tests__/basePath.test.ts`
- [ ] Dist folder assets reference `/finanzas/` correctly

### ✅ Infrastructure Requirements

Before first deployment, verify AWS console has:

- [ ] **OIDC Provider** configured:
  ```bash
  aws iam list-open-id-connect-providers | grep "token.actions.githubusercontent.com"
  # Should return: "Arn": "arn:aws:iam::703671891952:oidc-provider/token.actions.githubusercontent.com"
  ```

- [ ] **IAM Role** with trust policy for GitHub Actions:
  ```bash
  aws iam get-role --role-name github-actions-finanzas-prod
  ```

- [ ] **CloudFront Distribution** has:
  - [ ] Behavior for path pattern `/finanzas/*`
  - [ ] Origin pointing to S3 bucket
  - [ ] Origin Access Control (OAC) configured
  - [ ] Custom error responses: 403/404 → `/finanzas/index.html` (200)

- [ ] **GitHub Secrets** configured:
  - [ ] `OIDC_AWS_ROLE_ARN` (required)
  - [ ] `AWS_ACCESS_KEY_ID` (optional, fallback only)
  - [ ] `AWS_SECRET_ACCESS_KEY` (optional, fallback only)

- [ ] **GitHub Variables** configured:
  - [ ] `AWS_REGION` = us-east-2
  - [ ] `S3_BUCKET_NAME` = ukusi-ui-finanzas-prod
  - [ ] `CLOUDFRONT_DIST_ID` = EPQU7PVDLQXUA
  - [ ] `DISTRIBUTION_DOMAIN_NAME` = d7t9x3j66yd8k.cloudfront.net
  - [ ] `VITE_API_BASE_URL` (application-specific)
  - [ ] `VITE_ACTA_API_ID` (application-specific)
  - [ ] `FALLBACK_STATIC_KEYS` = NOT SET (or 'false')

### ✅ Security

- [ ] No secrets in git history
- [ ] OIDC is the default authentication method
- [ ] Static key fallback is OFF by default
- [ ] Bucket created with:
  - [ ] Public access blocked
  - [ ] Versioning enabled
  - [ ] Encryption enabled (AES256)
- [ ] All credentials masked in workflow logs

### ✅ Acceptance Criteria (from Requirements)

- [ ] Workflow runs on push to main
- [ ] Workflow runs on manual dispatch
- [ ] No external Marketplace actions for AWS auth
- [ ] OIDC works via local composite action
- [ ] Static-keys fallback is off by default and gated by variable
- [ ] Region is us-east-2 everywhere
- [ ] CloudFront invalidation only for `/finanzas/*`
- [ ] Router base path `/finanzas` intact
- [ ] Vite base path `/finanzas/` intact
- [ ] No changes to existing UI outside /finanzas config
- [ ] Docs updated with rollback steps
- [ ] PR shows only CI/infra/docs changes

## Post-Merge Actions

After merging to main:

1. **Monitor First Deployment**
   - [ ] Watch GitHub Actions workflow run
   - [ ] Verify authentication method: "✅ Using OIDC authentication (preferred)"
   - [ ] Check deployment summary for correct URLs
   - [ ] Verify CloudFront invalidation created

2. **Smoke Test**
   - [ ] Access https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   - [ ] Test deep link: https://d7t9x3j66yd8k.cloudfront.net/finanzas/pmo/prefactura/estimator
   - [ ] Verify assets load correctly (no 404s)
   - [ ] Test navigation within app
   - [ ] Test browser refresh on nested routes

3. **Console Verification**
   - [ ] CloudFront behavior for `/finanzas/*` points to S3 bucket
   - [ ] Custom error responses configured (403/404 → /finanzas/index.html)
   - [ ] S3 bucket has versioning enabled
   - [ ] S3 bucket policy allows CloudFront OAC

4. **Document Completion**
   - [ ] Update team on new deployment process
   - [ ] Share rollback procedures
   - [ ] Document how to toggle fallback if needed

## Rollback Plan

If issues occur after merge:

1. **Quick Rollback (5-10 min)**
   ```bash
   aws s3api list-object-versions --bucket ukusi-ui-finanzas-prod --prefix index.html
   aws s3api copy-object --bucket ukusi-ui-finanzas-prod \
     --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=PREVIOUS_VERSION" \
     --key index.html
   aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA --paths "/finanzas/*"
   ```

2. **Full Rollback via GitHub Actions**
   - Go to Actions → Deploy Financial UI → Run workflow
   - Select previous working commit
   - Wait for deployment

3. **Revert PR**
   - Revert the merge commit on main
   - Push to main (triggers automatic re-deploy of previous version)

## Sign-off

- [ ] Developer: Reviewed all code changes
- [ ] Reviewer: Verified changes meet requirements
- [ ] DevOps: Confirmed AWS infrastructure ready
- [ ] Product: Approved documentation updates

---

**Ready to merge when all checkboxes are ✅**
