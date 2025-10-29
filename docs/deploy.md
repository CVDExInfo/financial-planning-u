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

- `OIDC_AWS_ROLE_ARN`: ARN of the IAM role for OIDC authentication

### AWS Infrastructure

Before deploying, ensure:

1. S3 bucket `ukusi-ui-finanzas-prod` exists (create via Terraform in `infra/`)
2. CloudFront distribution has a behavior for `/finanzas/*`
3. Origin Access Control (OAC) is configured
4. Custom error responses (403/404 → /finanzas/index.html) are set

See `infra/README.md` for infrastructure setup instructions.

## Deployment Methods

### Automatic Deployment (CI/CD)

The application deploys automatically via GitHub Actions:

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Process:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build application (`npm run build`)
5. Configure AWS credentials via OIDC
6. Sync files to S3 with cache headers
7. Invalidate CloudFront cache for `/finanzas/*`

**Workflow File:** `.github/workflows/deploy.yml`

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

### Quick Rollback (Restore Previous Version)

S3 versioning is enabled for rollback capability:

```bash
# List versions of index.html
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html

# Copy previous version to current
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID_HERE \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

### Full Rollback (Re-deploy Previous Build)

```bash
# Checkout previous commit
git checkout PREVIOUS_COMMIT_SHA

# Build and deploy
npm ci
npm run build
# ... upload to S3 (see Manual Deployment)
```

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

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://ukusi-ui-finanzas-prod/
```

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

### OIDC Authentication

CI/CD uses OpenID Connect (OIDC) for AWS authentication:
- No long-lived credentials stored
- Temporary credentials issued per workflow run
- Scoped to specific IAM role

### S3 Security

- Bucket is **private** (all public access blocked)
- CloudFront uses **Origin Access Control** (OAC)
- Server-side encryption with **AES256**
- Versioning enabled for **audit trail**

### CloudFront Security

- HTTPS only (redirect-to-https)
- Origin Access Control restricts S3 access to CloudFront only
- Custom headers (if needed) can be configured

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
