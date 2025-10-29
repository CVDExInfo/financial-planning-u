# Deployment Guide - Financial Planning UI

This guide covers deploying the Financial Planning UI to AWS CloudFront under the `/finanzas` path.

## Overview

- **Account**: 703671891952
- **Primary Region**: us-east-2 (S3, IAM, SSM)
- **CloudFront**: Global (certificates in us-east-1 if needed)
- **Base Path**: `/finanzas`
- **Authentication**: AWS OIDC (no static access keys)

## Prerequisites

### 1. AWS Infrastructure

Ensure the following AWS resources exist:

- **S3 Bucket** (us-east-2): Private bucket with OAC (Origin Access Control) configured
- **CloudFront Distribution**: Behavior configured for `/finanzas/*` path pattern
- **IAM Role for OIDC**: Role with trust policy for GitHub Actions OIDC provider
- **Custom Error Pages**: 403/404 → `/finanzas/index.html` (HTTP 200) for SPA deep linking

See [docs/ops/readme.md](./ops/readme.md) for detailed infrastructure setup.

### 2. GitHub Configuration

#### Organization-level Variables (Non-Secret)

Configure these at the organization or repository level:

```
AWS_ACCOUNT_ID=703671891952
AWS_REGION=us-east-2
S3_BUCKET_NAME=<your-bucket-name>
CLOUDFRONT_DIST_ID=<your-distribution-id>
DISTRIBUTION_DOMAIN_NAME=<your-cloudfront-domain>
VITE_API_BASE_URL=<api-gateway-url>
VITE_ACTA_API_ID=<acta-api-id>
COGNITO_CLIENT_ID=<cognito-app-client-id>
COGNITO_POOL_ID=<cognito-user-pool-id>
COGNITO_DOMAIN=<cognito-domain>
```

#### Organization-level Secrets

```
OIDC_AWS_ROLE_ARN=arn:aws:iam::703671891952:role/<role-name>
```

## Build Process

### Local Build

```bash
# Install dependencies
npm ci

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build for production
npm run build

# Preview locally (simulates production routing)
npm run preview
```

The build creates a `dist/` directory with:
- `index.html` - Entry point
- `assets/` - JS, CSS bundles with content hashes
- `*.json` - Manifest files

### Environment Variables

The build process requires these environment variables:

```bash
NODE_ENV=production
VITE_API_BASE_URL=<api-gateway-url>
VITE_ACTA_API_ID=<acta-api-id>
VITE_COGNITO_CLIENT_ID=<cognito-app-client-id>
VITE_COGNITO_POOL_ID=<cognito-user-pool-id>
VITE_COGNITO_DOMAIN=<cognito-domain>
```

These are automatically set by the GitHub Actions workflow from organization variables.

## Deployment

### Automated Deployment (Recommended)

Deployments are automated via GitHub Actions:

1. **Push to main branch**:
   ```bash
   git push origin main
   ```

2. **Manual trigger** (workflow_dispatch):
   - Go to GitHub Actions tab
   - Select "Deploy to CloudFront" workflow
   - Click "Run workflow"

The workflow:
1. Checks out code
2. Sets up Node.js 20
3. Authenticates to AWS via OIDC
4. Installs dependencies
5. Runs type check and lint
6. Builds the application
7. Syncs to S3 with appropriate cache headers
8. Creates CloudFront invalidation

### Manual Deployment

If needed, you can deploy manually:

```bash
# 1. Build the application
npm run build

# 2. Configure AWS credentials (via AWS CLI, SSO, or environment)
export AWS_PROFILE=your-profile
# or
aws sso login --profile your-profile

# 3. Sync to S3
# Upload assets with long-term cache
aws s3 sync dist/ s3://<bucket-name>/finanzas/ --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.json"

# Upload index.html and manifests with no-cache
aws s3 sync dist/ s3://<bucket-name>/finanzas/ \
  --cache-control "public,max-age=0,must-revalidate" \
  --include "index.html" \
  --include "*.json"

# 4. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/finanzas/*"
```

## Verification

After deployment:

1. **Check Actions logs**: Verify the workflow completed successfully
2. **Wait for invalidation**: CloudFront invalidations typically take 1-3 minutes
3. **Test the application**:
   ```
   https://<distribution-domain>/finanzas/
   ```
4. **Test deep links**:
   ```
   https://<distribution-domain>/finanzas/pmo/prefactura/estimator
   https://<distribution-domain>/finanzas/sdmt/cost/catalog
   ```
5. **Verify cache headers**: Use browser DevTools Network tab or:
   ```bash
   curl -I https://<distribution-domain>/finanzas/index.html
   curl -I https://<distribution-domain>/finanzas/assets/index-[hash].js
   ```

## Rollback

### Via S3 Versioning

If S3 versioning is enabled:

```bash
# List versions
aws s3api list-object-versions \
  --bucket <bucket-name> \
  --prefix finanzas/

# Restore a specific version
aws s3api copy-object \
  --bucket <bucket-name> \
  --copy-source <bucket-name>/finanzas/index.html?versionId=<version-id> \
  --key finanzas/index.html

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/finanzas/*"
```

### Via Git

Revert to a previous commit and redeploy:

```bash
# Find the commit hash
git log --oneline

# Revert to specific commit
git revert <commit-hash>

# Push to trigger deployment
git push origin main
```

## Troubleshooting

### Build Failures

Check the GitHub Actions logs for errors:
- TypeScript errors: Fix type issues
- Lint errors: Run `npm run lint` locally to see errors
- Dependency issues: Ensure `package-lock.json` is in sync

### Deployment Failures

**AWS authentication failed**:
- Verify `OIDC_AWS_ROLE_ARN` secret is set correctly
- Check IAM role trust policy allows GitHub OIDC
- Ensure role has necessary permissions (S3, CloudFront)

**S3 sync failed**:
- Verify `S3_BUCKET_NAME` variable is correct
- Check IAM role has `s3:PutObject`, `s3:DeleteObject` permissions
- Ensure bucket exists in us-east-2

**CloudFront invalidation failed**:
- Verify `CLOUDFRONT_DIST_ID` variable is correct
- Check IAM role has `cloudfront:CreateInvalidation` permission

### Application Errors

**404 on routes**:
- Verify CloudFront custom error pages are configured
- Check: 403 → `/finanzas/index.html` (200)
- Check: 404 → `/finanzas/index.html` (200)

**Assets not loading**:
- Check browser console for errors
- Verify base path in `vite.config.ts` is `/finanzas/`
- Check CloudFront behavior matches `/finanzas/*`

**API calls failing**:
- Verify `VITE_API_BASE_URL` is set correctly
- Check CORS configuration on API Gateway
- Verify Cognito configuration

## Cache Strategy

### Long-term Cache (Hashed Assets)

Files: `assets/*.js`, `assets/*.css`

- Cache-Control: `public,max-age=31536000,immutable`
- These files have content hashes in names
- Safe to cache indefinitely

### No-cache (Entry Points)

Files: `index.html`, `*.json`

- Cache-Control: `public,max-age=0,must-revalidate`
- Must revalidate on every request
- Ensures users get latest version

### CloudFront Cache Behavior

Configure in CloudFront:
- Default TTL: 86400 (1 day)
- Max TTL: 31536000 (1 year)
- Min TTL: 0
- Honor origin cache headers: Yes

## Security

### No Static Credentials

- Never commit AWS access keys
- Use OIDC for GitHub Actions authentication
- Use IAM roles with minimal required permissions

### Principle of Least Privilege

IAM role should only have:
- S3: `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on specific bucket
- CloudFront: `cloudfront:CreateInvalidation` on specific distribution

### Content Security

- S3 bucket must be private (no public access)
- Use OAC (Origin Access Control) for CloudFront → S3
- HTTPS only (enforce in CloudFront)

## Advanced Topics

### Runtime Configuration via SSM

To fetch configuration from AWS Systems Manager Parameter Store at runtime:

1. Store parameters in SSM (us-east-2)
2. Update IAM role with SSM permissions
3. Add fetch logic to application initialization

See [docs/ops/readme.md](./ops/readme.md) for details.

### Multi-Environment Setup

For dev/staging/prod environments:

1. Create separate S3 prefixes: `/finanzas-dev/`, `/finanzas-staging/`, `/finanzas/`
2. Use environment-specific GitHub environments
3. Configure environment-specific variables
4. Use separate CloudFront behaviors

## Support

For issues or questions:
- Check GitHub Actions logs
- Review CloudFront and S3 logs in AWS
- See [docs/ops/readme.md](./ops/readme.md) for infrastructure details
