# CloudFront Deployment - Implementation Checklist

This checklist covers all the steps required to deploy the Financial Planning UI to CloudFront under the `/finanzas` path.

## AWS Infrastructure Setup

### 1. S3 Bucket Configuration

- [ ] **Create S3 bucket** (us-east-2)
  - Bucket name: `<org>-financial-planning-ui-prod`
  - Region: us-east-2
  - Block all public access: Enabled
  - Versioning: Enabled (recommended)
  - Encryption: SSE-S3 or SSE-KMS

- [ ] **Configure bucket policy** for CloudFront OAC access
  ```bash
  # See docs/ops/readme.md for policy template
  ```

### 2. CloudFront Distribution Setup

- [ ] **Create or update CloudFront distribution**
  - Origin: S3 bucket from step 1
  - Origin Access: Origin Access Control (OAC)

- [ ] **Configure CloudFront behavior** for `/finanzas/*`
  - Path pattern: `/finanzas/*`
  - Viewer protocol policy: Redirect HTTP to HTTPS
  - Allowed methods: GET, HEAD, OPTIONS
  - Compress objects: Yes

- [ ] **Configure custom error responses** (Critical for SPA routing!)
  - 403 → `/finanzas/index.html` (HTTP 200)
  - 404 → `/finanzas/index.html` (HTTP 200)
  - Without this, deep links will not work

- [ ] **Note distribution details**
  - Distribution ID: `______________`
  - Distribution domain: `______________`

### 3. IAM Configuration

- [ ] **Create/verify OIDC provider** for GitHub Actions
  - Provider URL: `https://token.actions.githubusercontent.com`
  - Audience: `sts.amazonaws.com`
  ```bash
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
  ```

- [ ] **Create IAM role** for GitHub Actions
  - Role name: `GitHubActionsFinancialPlanningDeploy`
  - Trust policy: GitHub OIDC (see docs/ops/readme.md)
  - Attach deployment policy with S3 and CloudFront permissions

- [ ] **Note IAM role ARN**
  - Role ARN: `arn:aws:iam::<AWS_ACCOUNT_ID>:role/______________`

### 4. Optional: SSM Parameter Store

- [ ] **Create parameters** (if using runtime configuration)
  - `/financial-planning/prod/api-base-url`
  - `/financial-planning/prod/cognito-client-id`
  - `/financial-planning/prod/cognito-pool-id`
  - `/financial-planning/prod/cognito-domain`
  - `/financial-planning/prod/acta-api-id`

## GitHub Configuration

### 1. Organization/Repository Variables

Navigate to: Settings → Secrets and variables → Actions → Variables

- [ ] `AWS_ACCOUNT_ID` = `<your-aws-account-id>` (e.g., 703671891952)
- [ ] `AWS_REGION` = `us-east-2`
- [ ] `S3_BUCKET_NAME` = `______________`
- [ ] `CLOUDFRONT_DIST_ID` = `______________`
- [ ] `DISTRIBUTION_DOMAIN_NAME` = `______________`
- [ ] `VITE_API_BASE_URL` = `______________`
- [ ] `VITE_ACTA_API_ID` = `______________`
- [ ] `COGNITO_CLIENT_ID` = `______________`
- [ ] `COGNITO_POOL_ID` = `______________`
- [ ] `COGNITO_DOMAIN` = `______________`

### 2. Organization/Repository Secrets

Navigate to: Settings → Secrets and variables → Actions → Secrets

- [ ] `OIDC_AWS_ROLE_ARN` = `arn:aws:iam::<AWS_ACCOUNT_ID>:role/______________`

## Pre-Deployment Validation

### 1. Test Build Locally

```bash
# Clone the repository
git clone https://github.com/valencia94/financial-planning-u.git
cd financial-planning-u
git checkout feature/cloudfront-finanzas

# Install dependencies
npm ci

# Test build
NODE_ENV=production npm run build

# Verify output
ls -la dist/
cat dist/index.html  # Should show /finanzas/ in asset paths
```

- [ ] Build completes successfully
- [ ] `dist/index.html` contains `/finanzas/` in asset paths
- [ ] Assets are in `dist/assets/` directory

### 2. Test with Non-Production Resources (Recommended)

Before deploying to production:

- [ ] Create a test S3 bucket or use a test prefix (e.g., `/finanzas-test/`)
- [ ] Create a test CloudFront behavior
- [ ] Run a dry-run deployment:
  ```bash
  # Set AWS credentials
  export AWS_PROFILE=your-profile
  
  # Dry run S3 sync
  aws s3 sync dist/ s3://<test-bucket>/finanzas-test/ --dryrun
  
  # If looks good, do actual sync
  aws s3 sync dist/ s3://<test-bucket>/finanzas-test/ --delete
  ```
- [ ] Test the application at test URL
- [ ] Verify deep links work correctly

## Initial Deployment

### 1. Merge to Main Branch

- [ ] Create pull request from `feature/cloudfront-finanzas` to `main`
- [ ] Review all changes
- [ ] Merge pull request

### 2. Monitor Deployment

- [ ] Go to GitHub Actions tab
- [ ] Watch "Deploy to CloudFront" workflow
- [ ] Verify all steps complete successfully:
  - [ ] Checkout
  - [ ] AWS authentication
  - [ ] Build
  - [ ] S3 sync
  - [ ] CloudFront invalidation

### 3. Verify Deployment

- [ ] Wait for CloudFront invalidation (1-3 minutes)
- [ ] Test main URL: `https://<distribution-domain>/finanzas/`
- [ ] Test deep links:
  - [ ] `https://<distribution-domain>/finanzas/pmo/prefactura/estimator`
  - [ ] `https://<distribution-domain>/finanzas/sdmt/cost/catalog`
  - [ ] `https://<distribution-domain>/finanzas/profile`
- [ ] Test browser refresh on deep links (should not 404)
- [ ] Verify application functionality:
  - [ ] Login works
  - [ ] Navigation works
  - [ ] API calls work
  - [ ] Assets load correctly

## Post-Deployment Checks

### 1. Performance & Caching

- [ ] Use browser DevTools to verify cache headers:
  - `index.html`: `cache-control: public,max-age=0,must-revalidate`
  - Assets: `cache-control: public,max-age=31536000,immutable`
- [ ] Check CloudFront cache hit ratio in AWS console

### 2. Security

- [ ] Verify HTTPS is enforced (no HTTP access)
- [ ] Check S3 bucket is private (no public access)
- [ ] Verify OAC is configured correctly
- [ ] No AWS credentials in GitHub repository

### 3. Monitoring

- [ ] Set up CloudFront alarms (optional)
- [ ] Enable CloudFront logging (optional)
- [ ] Document monitoring procedures

## Rollback Plan

If issues occur:

### Option 1: Revert Git Commit

```bash
git revert <commit-hash>
git push origin main
# Wait for automatic redeployment
```

### Option 2: Restore S3 Version

```bash
# List versions
aws s3api list-object-versions \
  --bucket <bucket-name> \
  --prefix finanzas/

# Restore previous version
aws s3api copy-object \
  --bucket <bucket-name> \
  --copy-source <bucket-name>/finanzas/index.html?versionId=<version-id> \
  --key finanzas/index.html

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/finanzas/*"
```

## Troubleshooting

### Build Fails

- Check GitHub Actions logs
- Run `npm run lint` locally to check for errors
- Verify all environment variables are set

### Deployment Fails

**AWS Authentication Error:**
- Verify `OIDC_AWS_ROLE_ARN` secret is correct
- Check IAM role trust policy allows GitHub OIDC
- Ensure role has necessary permissions

**S3 Sync Error:**
- Verify `S3_BUCKET_NAME` variable is correct
- Check IAM role has S3 permissions
- Ensure bucket exists

**CloudFront Invalidation Error:**
- Verify `CLOUDFRONT_DIST_ID` variable is correct
- Check IAM role has CloudFront permissions

### Application Errors

**404 on Routes:**
- Verify custom error responses are configured
- Check `/finanzas/index.html` exists in S3
- Confirm 403/404 → `/finanzas/index.html` (200)

**Assets Not Loading:**
- Check browser console for errors
- Verify base path in build output
- Check CloudFront behavior matches `/finanzas/*`

**API Calls Fail:**
- Verify `VITE_API_BASE_URL` is correct
- Check CORS on API Gateway
- Verify Cognito configuration

## Success Criteria

Deployment is successful when:

- [ ] Build completes without errors
- [ ] Files sync to S3 successfully
- [ ] CloudFront invalidation completes
- [ ] Application loads at `https://<distribution-domain>/finanzas/`
- [ ] Deep links work correctly
- [ ] Browser refresh on any route works
- [ ] Login/authentication works
- [ ] API calls succeed
- [ ] All features function as expected
- [ ] No console errors in browser

## Documentation

- [ ] Review [docs/deploy.md](./deploy.md) for deployment procedures
- [ ] Review [docs/ops/readme.md](./ops/readme.md) for infrastructure details
- [ ] Share access with team members
- [ ] Document any environment-specific configurations

## Support

For issues or questions:
- GitHub Actions: Check workflow logs
- AWS Issues: Review CloudWatch Logs and CloudTrail
- Application Issues: Check browser console and network tab
- Infrastructure: See docs/ops/readme.md

---

**Implementation Date**: ______________
**Completed By**: ______________
**Production URL**: https://______________/finanzas/
