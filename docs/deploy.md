# Financial Planning UI - Deployment Guide

This document provides deployment instructions for the Financial Planning UI on AWS CloudFront and S3.

## Overview

The Financial Planning UI is deployed as a Single Page Application (SPA) under the `/finanzas/*` path on an existing CloudFront distribution.

### Architecture

- **Frontend**: React SPA built with Vite
- **Hosting**: AWS S3 (private bucket)
- **CDN**: AWS CloudFront (existing distribution)
- **Path**: `/finanzas/*`
- **Region**: us-east-2 (S3, IAM, SSM)
- **Domain**: d7t9x3j66yd8k.cloudfront.net
- **Distribution ID**: EPQU7PVDLQXUA

## Prerequisites

### Required GitHub Variables

Configure these in your repository or organization settings:

- `AWS_ACCOUNT_ID`: 703671891952
- `AWS_REGION`: us-east-2
- `S3_BUCKET_NAME`: ukusi-ui-finanzas-prod
- `CLOUDFRONT_DIST_ID`: EPQU7PVDLQXUA
- `DISTRIBUTION_DOMAIN_NAME`: d7t9x3j66yd8k.cloudfront.net
- `VITE_API_BASE_URL`: (Your API base URL)
- `VITE_ACTA_API_ID`: (Your ACTA API ID)
- `COGNITO_CLIENT_ID`: (Optional - if using Cognito)
- `COGNITO_POOL_ID`: (Optional - if using Cognito)
- `COGNITO_DOMAIN`: (Optional - if using Cognito)

### Required GitHub Secrets

- `OIDC_AWS_ROLE_ARN`: ARN of the IAM role for OIDC authentication (required)
- `AWS_ACCESS_KEY_ID`: Static AWS access key (optional, fallback only)
- `AWS_SECRET_ACCESS_KEY`: Static AWS secret key (optional, fallback only)

### Optional GitHub Variables

- `FALLBACK_STATIC_KEYS`: Set to `'true'` to enable static key fallback if OIDC fails (default: not set)

### AWS Authentication Methods

The deployment workflow supports two authentication methods with automatic fallback:

#### Method 1: OIDC (Preferred)

**Advantages:**
- No long-lived credentials stored
- Temporary credentials (1-hour duration)
- Automatic credential rotation
- Better security posture

**Requirements:**
1. AWS account has GitHub OIDC provider configured
2. IAM role with trust policy for GitHub Actions
3. `OIDC_AWS_ROLE_ARN` secret configured
4. Workflow has `id-token: write` permission

**Setup:**

```bash
# Create OIDC provider (if not exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create IAM role with trust policy
# See docs/ops/readme.md for the complete trust policy example
```

#### Method 2: Static Keys (Fallback)

**Use only when:**
- OIDC setup is incomplete or blocked
- Temporary workaround during migration
- Emergency access needed

**Enabling fallback:**
1. Set repository variable `FALLBACK_STATIC_KEYS='true'`
2. Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets are set
3. Workflow will use static keys only if OIDC fails

**Disabling fallback:**
1. Remove the `FALLBACK_STATIC_KEYS` variable or set to `'false'`
2. Workflow will fail if OIDC doesn't work (safer default)

⚠️ **Security Note:** Static keys should be temporary. Always migrate to OIDC when possible.

### AWS Infrastructure

The CI/CD pipeline will automatically create the S3 bucket if it doesn't exist with:
- Public access blocked
- Versioning enabled (for rollback)
- Server-side encryption (AES256)

**Manual bucket creation (optional):**
```bash
./scripts/create-s3-bucket.sh
```

**Additional requirements:**
1. CloudFront distribution has a behavior for `/finanzas/*`
2. Origin Access Control (OAC) is configured
3. Custom error responses (403/404 → /finanzas/index.html) are set

See `docs/ops/readme.md` for detailed infrastructure configuration.

## Deployment Methods

### Automatic Deployment (CI/CD)

The application deploys automatically via GitHub Actions:

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Process:**
1. **Preflight Checks**: Verify AWS region, CloudFront distribution ID, and required secrets
2. **Checkout Code**: Clone repository
3. **Setup Node.js 20**: Install Node.js and restore npm cache
4. **Install Dependencies**: `npm ci`
5. **Build Application**: `npm run build`
6. **Configure AWS Credentials**: 
   - Primary: OIDC authentication (local composite action)
   - Fallback: Static keys (if enabled and OIDC fails)
7. **Verify/Create S3 Bucket**: Create if missing with proper security settings
8. **Upload to S3**: Sync files with appropriate cache headers
9. **Invalidate CloudFront**: Clear cache for `/finanzas/*` path
10. **Deployment Summary**: Generate report with access URLs and rollback instructions

**Workflow File:** `.github/workflows/deploy.yml`

**Authentication Flow:**
```
┌─────────────────┐
│  Start Deploy   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Try OIDC Auth          │
│  (Local Action)         │
└────────┬────────────────┘
         │
    Success? ─────No────► ┌──────────────────────────┐
         │                │ FALLBACK_STATIC_KEYS=true?│
        Yes               └────────┬─────────────────┘
         │                         │
         │                    Yes  │  No
         │                         ▼  │
         │                ┌─────────────┐
         │                │ Static Keys │
         │                └─────┬───────┘
         │                      │
         ▼                      ▼
┌────────────────────────────────┐
│  Continue with AWS Operations  │
└────────────────────────────────┘
```

### Manual Deployment

If needed, deploy manually:

```bash
# Build the application
npm ci
npm run build

# Configure AWS credentials (use OIDC or temporary credentials)
export AWS_REGION=us-east-2
export S3_BUCKET=ukusi-ui-finanzas-prod
export DIST_ID=EPQU7PVDLQXUA

# Upload to S3 with appropriate cache headers
# Immutable assets (hashed files)
aws s3 sync dist/ s3://$S3_BUCKET/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.html"

# HTML files (short cache)
aws s3 sync dist/ s3://$S3_BUCKET/ \
  --cache-control "public,max-age=0,must-revalidate" \
  --exclude "*" \
  --include "index.html" \
  --include "*.html"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/finanzas/*"
```

## SPA Deep Linking

The application supports deep linking (e.g., `/finanzas/pmo/prefactura/estimator`) through CloudFront custom error responses.

### How It Works

1. User navigates to `/finanzas/pmo/prefactura/estimator`
2. CloudFront attempts to fetch the file from S3
3. S3 returns 404 (file doesn't exist)
4. CloudFront maps 404 → 200 and returns `/finanzas/index.html`
5. React Router handles the path on the client side

### Required CloudFront Configuration

Custom error responses must be configured:

- **Error Code 403** → Response Code: 200, Response Page: `/finanzas/index.html`
- **Error Code 404** → Response Code: 200, Response Page: `/finanzas/index.html`

### Testing Deep Links

```bash
# Test deep link (should return HTML, not 404)
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/pmo/prefactura/estimator

# Should return:
# HTTP/2 200
# Content-Type: text/html
```

### Smoke Test Checklist

After deployment:

- [ ] Root path loads: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- [ ] Deep link works: https://d7t9x3j66yd8k.cloudfront.net/finanzas/pmo/prefactura/estimator
- [ ] Assets load correctly (check browser DevTools)
- [ ] Navigation within app works
- [ ] Browser refresh on nested routes works
- [ ] No console errors

## Cache Strategy

### Immutable Assets (JS, CSS, Images)

Files with content hashes (e.g., `index-XtWnc_4H.js`):
- **Cache-Control**: `public,max-age=31536000,immutable`
- **TTL**: 1 year
- **Rationale**: Content hash changes when file changes, safe to cache forever

### HTML Files (index.html)

Entry point HTML files:
- **Cache-Control**: `public,max-age=0,must-revalidate`
- **TTL**: 0 (always revalidate)
- **Rationale**: Must fetch latest version to get new asset references

### CloudFront Cache Policies

- **Assets Policy**: 1-year TTL with compression
- **HTML Policy**: 0 TTL with revalidation

## Rollback Procedure

The deployment supports multiple rollback strategies depending on urgency and requirements.

### Option 1: Quick Rollback via S3 Versioning (Fastest)

**Timeline:** 5-10 minutes  
**Best for:** Immediate rollback needed

S3 versioning is automatically enabled for rollback capability:

```bash
# 1. List versions of index.html to find previous version
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html

# 2. Copy previous version to current (replace VERSION_ID_HERE)
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID_HERE" \
  --key index.html

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# 4. Wait 5-15 minutes for invalidation to complete
```

**Note:** This only rolls back the index.html. If assets changed significantly, use Option 2 or 3.

### Option 2: Full Rollback via Manual Re-deploy

**Timeline:** 10-15 minutes  
**Best for:** Complete rollback with all assets

```bash
# 1. Find previous working commit
git log --oneline

# 2. Checkout previous commit
git checkout PREVIOUS_COMMIT_SHA

# 3. Build application
npm ci
npm run build

# 4. Deploy to S3 (see Manual Deployment section)
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/ --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html"
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/ \
  --cache-control "public,max-age=0,must-revalidate" \
  --exclude "*" --include "*.html"

# 5. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# 6. Return to main branch
git checkout main
```

### Option 3: GitHub Actions Rollback (Easiest)

**Timeline:** 10-20 minutes  
**Best for:** Non-technical team members

1. Go to GitHub Actions: https://github.com/valencia94/financial-planning-u/actions
2. Select "Deploy Financial UI" workflow
3. Click "Run workflow"
4. Select the previous working commit or branch from history
5. Click "Run workflow"
6. Wait for deployment to complete
7. Verify at https://d7t9x3j66yd8k.cloudfront.net/finanzas/

### Rollback Timeline

- **S3 sync**: ~30 seconds
- **CloudFront invalidation**: ~5-15 minutes
- **Full propagation**: ~15-30 minutes

## Monitoring

### Deployment Status

Check GitHub Actions:
- https://github.com/valencia94/financial-planning-u/actions

### CloudFront Metrics

CloudFront Console → Distribution → Monitoring:
- Requests
- Error rate
- Cache hit ratio

### Access Logs

If enabled, CloudFront access logs are stored in a separate S3 bucket.

## Troubleshooting

### Build Fails

```bash
# Check Node.js version
node --version  # Should be 20.x

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Deployment Fails (S3 Access)

**Symptoms:** Error accessing S3 bucket during deployment

**Possible Causes:**
1. OIDC authentication failed
2. IAM role lacks permissions
3. Bucket doesn't exist

**Resolution:**

```bash
# Check which authentication method was used
# Look at workflow logs for "Using OIDC authentication" or "Using static credentials"

# If OIDC failed, check:
# 1. OIDC provider exists in AWS
aws iam list-open-id-connect-providers

# 2. Role trust policy is correct
aws iam get-role --role-name github-actions-finanzas-prod

# 3. Role has S3 permissions
aws iam list-attached-role-policies --role-name github-actions-finanzas-prod

# If static keys fallback is needed temporarily:
# 1. Set FALLBACK_STATIC_KEYS='true' as repository variable
# 2. Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets are set
# 3. Re-run the workflow

# Verify credentials work
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://ukusi-ui-finanzas-prod/
```

### OIDC Authentication Fails

**Symptoms:** "Failed to assume role with web identity" error

**Possible Causes:**
1. OIDC provider not configured in AWS
2. IAM role trust policy incorrect
3. Repository not allowed in trust policy
4. Workflow missing `id-token: write` permission

**Resolution:**

```bash
# Check OIDC provider exists
aws iam list-open-id-connect-providers | grep token.actions.githubusercontent.com

# Create OIDC provider if missing
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Verify role trust policy allows your repository
aws iam get-role --role-name github-actions-finanzas-prod \
  --query 'Role.AssumeRolePolicyDocument'

# Expected trust policy should include:
# "StringLike": {
#   "token.actions.githubusercontent.com:sub": "repo:valencia94/financial-planning-u:*"
# }
```

**Temporary Workaround:**
If OIDC setup is blocked or incomplete, enable static key fallback:

1. Go to repository Settings → Secrets and Variables → Actions → Variables
2. Add variable: `FALLBACK_STATIC_KEYS` = `true`
3. Ensure secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
4. Re-run workflow

⚠️ **Remove fallback once OIDC is working**

### Deployment Fails (CloudFront)

```bash
# Verify distribution exists
aws cloudfront get-distribution --id EPQU7PVDLQXUA

# Check invalidation status
aws cloudfront list-invalidations --distribution-id EPQU7PVDLQXUA
```

### 404 on Deep Links

1. Verify custom error responses are configured in CloudFront
2. Check that response page path is `/finanzas/index.html`
3. Clear CloudFront cache and retry

### Assets Not Loading

1. Check browser DevTools Network tab
2. Verify base path is `/finanzas/` in `vite.config.ts`
3. Verify CloudFront behavior path pattern is `/finanzas/*`
4. Check S3 bucket policy allows CloudFront OAC access

### Stale Content

```bash
# Create invalidation for all content
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# Wait for invalidation to complete (5-15 minutes)
```

## Security

### AWS Authentication Architecture

The deployment workflow implements a dual-path authentication system:

#### Primary Path: OIDC (Default)

The workflow uses a **local composite action** (`.github/actions/oidc-configure-aws/`) to authenticate:

**How it works:**
1. Workflow requests GitHub OIDC token
2. Calls AWS STS `assume-role-with-web-identity`
3. Receives temporary credentials (1-hour duration)
4. Exports credentials for subsequent steps

**Benefits:**
- ✅ No long-lived credentials in GitHub
- ✅ Automatic credential rotation
- ✅ Scoped to specific IAM role
- ✅ Audit trail via CloudTrail
- ✅ No external Marketplace actions (repository restriction compliant)

**Implementation:** See `.github/actions/oidc-configure-aws/README.md`

#### Fallback Path: Static Credentials (Gated)

Used only when:
- OIDC authentication fails **AND**
- Repository variable `FALLBACK_STATIC_KEYS` is set to `'true'`

**Enabling fallback:**
```bash
# Via GitHub UI:
# Settings → Secrets and Variables → Actions → Variables
# Add: FALLBACK_STATIC_KEYS = true

# Via GitHub CLI:
gh variable set FALLBACK_STATIC_KEYS --body "true"
```

**Disabling fallback:**
```bash
# Remove the variable or set to 'false'
gh variable delete FALLBACK_STATIC_KEYS
```

⚠️ **Security Best Practice:** Keep fallback disabled unless temporarily needed during OIDC setup.

### Managing Authentication

**Check current authentication method:**
1. Go to latest workflow run
2. Look for step "Verify Authentication Method"
3. Should show: "✅ Using OIDC authentication (preferred)"

**Switching from static keys to OIDC:**
1. Set up OIDC provider and IAM role (see troubleshooting section)
2. Add `OIDC_AWS_ROLE_ARN` secret
3. Remove or disable `FALLBACK_STATIC_KEYS` variable
4. Run workflow - it will use OIDC
5. Once verified working, rotate/delete static keys

**Emergency access:**
If OIDC is completely broken and immediate deployment needed:
1. Temporarily enable fallback: `FALLBACK_STATIC_KEYS=true`
2. Deploy
3. Fix OIDC configuration
4. Disable fallback again

### S3 Security

- Bucket is **private** (all public access blocked)
- CloudFront uses **Origin Access Control** (OAC)
- Server-side encryption with **AES256**
- Versioning enabled for **audit trail** and rollback
- Bucket policy restricts access to CloudFront only

### CloudFront Security

- HTTPS only (redirect-to-https)
- Origin Access Control restricts S3 access to CloudFront only
- Custom headers (if needed) can be configured
- Cache policies prevent exposure of sensitive headers

## Performance

### Build Time

- **Dependencies**: ~60 seconds (cached)
- **Build**: ~15-30 seconds
- **Total**: ~2-3 minutes

### Deployment Time

- **S3 upload**: ~10-30 seconds
- **CloudFront invalidation**: ~5-15 minutes
- **Total**: ~5-15 minutes

### Optimization Tips

1. **Lazy Loading**: Use React.lazy() for route-based code splitting
2. **Tree Shaking**: Vite automatically removes unused code
3. **Asset Optimization**: Images should be optimized before commit
4. **Bundle Analysis**: Run `npm run build` and check bundle sizes

## Support

### Resources

- **Repository**: https://github.com/valencia94/financial-planning-u
- **Infrastructure**: `infra/README.md`
- **Operations**: `docs/ops/readme.md`

### Common Commands

```bash
# Local development
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Preview production build locally
npm run preview
```
