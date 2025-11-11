# CloudFront /finanzas/* Deployment - Next Steps

This document outlines the manual steps required to complete the deployment setup after the Terraform infrastructure has been provisioned.

## ✅ Completed

- [x] Repository configuration for `/finanzas` base path
- [x] GitHub Actions workflow with OIDC authentication
- [x] Terraform infrastructure as code
- [x] Comprehensive documentation (deployment, operations, environment config)
- [x] DevContainer setup for consistent development environment

## 📋 Required Manual Steps

### Step 1: Set Up GitHub Variables

Configure these in GitHub repository or organization settings:

**Settings → Secrets and variables → Actions → Variables**

| Variable | Value |
|----------|-------|
| AWS_ACCOUNT_ID | 703671891952 |
| AWS_REGION | us-east-2 |
| S3_BUCKET_NAME | ukusi-ui-finanzas-prod |
| CLOUDFRONT_DIST_ID | EPQU7PVDLQXUA |
| DISTRIBUTION_DOMAIN_NAME | d7t9x3j66yd8k.cloudfront.net |
| VITE_API_BASE_URL | (Your API base URL) |
| VITE_ACTA_API_ID | (Your ACTA API ID) |

**Optional (if using Cognito):**
- COGNITO_CLIENT_ID
- COGNITO_POOL_ID
- COGNITO_DOMAIN

### Step 2: Set Up GitHub Secrets

**Settings → Secrets and variables → Actions → Secrets**

| Secret | Description |
|--------|-------------|
| OIDC_AWS_ROLE_ARN | IAM role ARN for OIDC authentication |

Example: `arn:aws:iam::703671891952:role/github-actions-finanzas-prod`

### Step 3: Provision AWS Infrastructure

Run Terraform to create the S3 bucket and supporting resources:

```bash
cd infra/

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the changes
terraform apply

# Review the outputs
terraform output
```

**Important**: The `manual_cloudfront_update_instructions` output will provide detailed steps for configuring CloudFront.

### Step 4: Configure CloudFront Distribution

⚠️ **Manual configuration required** - Terraform cannot safely modify the existing CloudFront distribution without risk to other behaviors.

1. **Go to AWS Console** → CloudFront → Distributions → EPQU7PVDLQXUA

2. **Add New Origin**:
   - Click "Origins" tab → "Create origin"
   - Origin domain: `ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com`
   - Origin ID: `S3-ukusi-ui-finanzas-prod`
   - Origin access: Origin Access Control
   - Origin access control: Select `finanzas-ui-oac` (created by Terraform)
   - Save changes

3. **Add New Behavior** (must be before default behavior):
   - Click "Behaviors" tab → "Create behavior"
   - Path pattern: `/finanzas/*`
   - Origin: `S3-ukusi-ui-finanzas-prod`
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS
   - Cached HTTP methods: GET, HEAD
   - Cache policy: `finanzas-assets-cache-policy` (created by Terraform)
   - Origin request policy: None
   - Response headers policy: (Optional - can add security headers)
   - Compress objects automatically: Yes
   - **Move this behavior UP** so it's evaluated before the default (*) behavior
   - Save changes

4. **Configure Custom Error Responses**:
   - Click "Error pages" tab
   - Create custom error response:
     - HTTP error code: 403
     - Customize error response: Yes
     - Response page path: `/finanzas/index.html`
     - HTTP response code: 200
   - Create another custom error response:
     - HTTP error code: 404
     - Customize error response: Yes
     - Response page path: `/finanzas/index.html`
     - HTTP response code: 200
   - Save changes

5. **Wait for Deployment**:
   - CloudFront will show "In Progress" status
   - Wait 5-15 minutes for changes to propagate

### Step 5: Verify CloudFront Configuration

```bash
# List behaviors (verify /finanzas/* exists)
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA | jq '.DistributionConfig.CacheBehaviors'

# List origins (verify S3-ukusi-ui-finanzas-prod exists)
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA | jq '.DistributionConfig.Origins'

# Check custom error responses
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA | jq '.DistributionConfig.CustomErrorResponses'
```

### Step 6: Deploy Application

Once infrastructure is ready, trigger the deployment:

**Option A: Automatic (on push to main)**
- Merge this PR to main branch
- GitHub Actions will automatically deploy

**Option B: Manual Trigger**
1. Go to GitHub Actions
2. Select "Deploy Financial UI" workflow
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"

### Step 7: Smoke Test

After deployment completes:

```bash
# Test root path
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Should return: HTTP/2 200

# Test deep link
# Should return: HTTP/2 200 (via error response mapping)

# Test in browser
open https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

**Checklist**:
- [ ] Root path loads correctly
- [ ] Assets load correctly (check DevTools Network tab)
- [ ] Navigation within app works
- [ ] Browser refresh on nested routes works
- [ ] No console errors
- [ ] Existing paths (not /finanzas) still work

## 🔐 Security Verification

- [ ] S3 bucket is private (no public access)
- [ ] CloudFront uses Origin Access Control (OAC)
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] OIDC authentication is working (check GitHub Actions logs)
- [ ] No static AWS credentials in use

## 📊 Monitoring Setup

After deployment, set up monitoring:

1. **CloudFront Metrics** (AWS Console):
   - Requests
   - Error rate (4xx, 5xx)
   - Cache hit ratio
   - Data transfer

2. **GitHub Actions**:
   - Enable notifications for failed deployments

3. **Optional: CloudWatch Alarms**:
   - High error rate
   - Low cache hit ratio
   - Failed deployments

## 🔄 Rollback Plan

If issues arise after deployment:

**Quick Rollback (5-10 minutes)**:
```bash
# List S3 object versions
aws s3api list-object-versions --bucket ukusi-ui-finanzas-prod --max-items 10

# Restore previous version
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID" \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

See `docs/ops/readme.md` for detailed rollback procedures.

## 📚 Documentation

- **Deployment Guide**: `docs/deploy.md`
- **Operations Guide**: `docs/ops/readme.md`
- **Environment Configuration**: `docs/environment-config.md`
- **Infrastructure README**: `infra/README.md`

## 🆘 Troubleshooting

### Issue: Workflow fails with "Variable not set"
- **Solution**: Configure required GitHub variables (Step 1)

### Issue: Workflow fails with "Cannot assume role"
- **Solution**: Configure OIDC_AWS_ROLE_ARN secret and verify IAM role trust policy

### Issue: Workflow fails with "S3 bucket not found"
- **Solution**: Run Terraform to create infrastructure (Step 3)

### Issue: 403 Forbidden on /finanzas/*
- **Solution**: Verify CloudFront behavior is configured correctly (Step 4)

### Issue: 404 on deep links
- **Solution**: Verify custom error responses are configured (Step 4, substep 4)

For more troubleshooting, see `docs/ops/readme.md`.

## ✅ Success Criteria

Deployment is successful when:
- [ ] All GitHub variables and secrets are configured
- [ ] Terraform has created S3 bucket and OAC
- [ ] CloudFront has new origin, behavior, and error responses
- [ ] Workflow runs successfully
- [ ] Application loads at https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- [ ] Deep links work correctly
- [ ] Existing paths (not /finanzas) are unaffected

## 🎉 Post-Deployment

After successful deployment:
1. Monitor CloudFront metrics for first 24 hours
2. Verify cache hit ratio is >85%
3. Check error rates are <1%
4. Document any issues or improvements needed
5. Update team on new deployment URL

---

**Questions?** See documentation in `docs/` directory or contact DevOps team.
