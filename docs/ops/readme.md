# Operations Guide - Financial Planning UI

This document provides operational procedures, troubleshooting guides, and reference information for the Financial Planning UI infrastructure.

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [S3 Bucket Management](#s3-bucket-management)
3. [CloudFront Configuration](#cloudfront-configuration)
4. [IAM and OIDC](#iam-and-oidc)
5. [Cache Management](#cache-management)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Troubleshooting](#troubleshooting)

## Infrastructure Overview

### AWS Resources

| Resource | Name/ID | Region | Purpose |
|----------|---------|--------|---------|
| S3 Bucket | ukusi-ui-finanzas-prod | us-east-2 | Static asset hosting |
| CloudFront Distribution | EPQU7PVDLQXUA | Global | CDN and routing |
| IAM Role | (OIDC_AWS_ROLE_ARN) | us-east-2 | CI/CD authentication |
| OAC | finanzas-ui-oac | Global | S3 access control |

### Naming Conventions

- **S3 Buckets**: `ukusi-ui-{app}-{env}` (e.g., ukusi-ui-finanzas-prod)
- **IAM Roles**: `github-actions-{app}-{env}` (e.g., github-actions-finanzas-prod)
- **CloudFront OAC**: `{app}-oac` (e.g., finanzas-ui-oac)
- **Cache Policies**: `{app}-{type}-cache-policy` (e.g., finanzas-assets-cache-policy)

### Access URLs

- **Production**: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- **S3 Origin**: https://ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com (private)

## S3 Bucket Management

### Bucket Configuration

```bash
# View bucket details
aws s3api head-bucket --bucket ukusi-ui-finanzas-prod

# List bucket contents
aws s3 ls s3://ukusi-ui-finanzas-prod/ --recursive

# Check bucket size
aws s3 ls s3://ukusi-ui-finanzas-prod/ --recursive --summarize --human-readable
```

### Security Settings

**Public Access Block** (all enabled):
```bash
aws s3api get-public-access-block --bucket ukusi-ui-finanzas-prod
```

**Versioning** (enabled):
```bash
aws s3api get-bucket-versioning --bucket ukusi-ui-finanzas-prod
```

**Encryption** (AES256):
```bash
aws s3api get-bucket-encryption --bucket ukusi-ui-finanzas-prod
```

**Bucket Policy** (CloudFront OAC only):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ukusi-ui-finanzas-prod/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::703671891952:distribution/EPQU7PVDLQXUA"
        }
      }
    }
  ]
}
```

### Version Management

```bash
# List all versions of a file
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html

# Restore a specific version
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID" \
  --key index.html

# Delete a specific version (use with caution)
aws s3api delete-object \
  --bucket ukusi-ui-finanzas-prod \
  --key index.html \
  --version-id VERSION_ID
```

### Lifecycle Policies

Current lifecycle rules:
- **Old Versions**: Deleted after 90 days
- **Incomplete Uploads**: Aborted after 7 days

```bash
# View lifecycle configuration
aws s3api get-bucket-lifecycle-configuration \
  --bucket ukusi-ui-finanzas-prod
```

## CloudFront Configuration

### Distribution Details

```bash
# Get distribution configuration
aws cloudfront get-distribution --id EPQU7PVDLQXUA

# Get distribution config (for updates)
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA
```

### Behavior Specification for /finanzas/*

**Path Pattern**: `/finanzas/*`

**Origin**: S3-ukusi-ui-finanzas-prod
- Domain: ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com
- Origin Access: Origin Access Control (finanzas-ui-oac)

**Viewer Protocol Policy**: Redirect HTTP to HTTPS

**Allowed Methods**: GET, HEAD, OPTIONS

**Cached Methods**: GET, HEAD

**Cache Policy**: finanzas-assets-cache-policy
- Default TTL: 31536000 seconds (1 year)
- Min TTL: 31536000 seconds
- Max TTL: 31536000 seconds
- Compression: Enabled (Gzip, Brotli)

**Compress Objects**: Yes

**Custom Headers**: None (can be added if needed)

### Custom Error Responses

Required for SPA deep linking:

```json
[
  {
    "ErrorCode": 403,
    "ResponseCode": 200,
    "ResponsePagePath": "/finanzas/index.html",
    "ErrorCachingMinTTL": 0
  },
  {
    "ErrorCode": 404,
    "ResponseCode": 200,
    "ResponsePagePath": "/finanzas/index.html",
    "ErrorCachingMinTTL": 0
  }
]
```

**Important**: These apply to the entire distribution, not just the /finanzas/* behavior.

### Origin Access Control (OAC)

```bash
# List OACs
aws cloudfront list-origin-access-controls

# Get specific OAC details
aws cloudfront get-origin-access-control --id OAC_ID
```

OAC Configuration:
- **Name**: finanzas-ui-oac
- **Signing Protocol**: sigv4
- **Signing Behavior**: always
- **Origin Type**: s3

## IAM and OIDC

### OIDC Trust Relationship

Example IAM role trust policy for GitHub Actions OIDC:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::703671891952:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:valencia94/financial-planning-u:*"
        }
      }
    }
  ]
}
```

### Required IAM Permissions

The OIDC role needs these permissions:

**S3 Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::ukusi-ui-finanzas-prod"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListObjectVersions"
      ],
      "Resource": "arn:aws:s3:::ukusi-ui-finanzas-prod/*"
    }
  ]
}
```

**CloudFront Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::703671891952:distribution/EPQU7PVDLQXUA"
    }
  ]
}
```

### Testing OIDC Authentication

```bash
# Test assume role (from local machine, won't work without GitHub Actions context)
aws sts assume-role-with-web-identity \
  --role-arn $OIDC_AWS_ROLE_ARN \
  --role-session-name github-actions-test \
  --web-identity-token $GITHUB_TOKEN

# From GitHub Actions, credentials are automatically configured
aws sts get-caller-identity
```

## Cache Management

### Cache Invalidation

```bash
# Invalidate all /finanzas/* content
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# Invalidate specific files
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/index.html" "/finanzas/assets/*"

# List invalidations
aws cloudfront list-invalidations \
  --distribution-id EPQU7PVDLQXUA

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --id INVALIDATION_ID
```

### Cache Strategy

| Content Type | Cache-Control Header | TTL | Reason |
|--------------|---------------------|-----|--------|
| Hashed Assets (JS/CSS) | `public,max-age=31536000,immutable` | 1 year | Content-based hash |
| Images | `public,max-age=31536000,immutable` | 1 year | Content-based hash |
| HTML Files | `public,max-age=0,must-revalidate` | 0 | Always fetch latest |
| API Responses | Not cached | N/A | Dynamic content |

### Cache Hit Ratio

Monitor in CloudFront Console:
- **Target**: >85% cache hit ratio
- **Low ratio**: May indicate cache policy issues or frequent invalidations

## Rollback Procedures

### Option 1: S3 Version Restore (Fast)

**Timeline**: ~5-10 minutes

```bash
# 1. List versions
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --max-items 10

# 2. Identify previous version ID for index.html

# 3. Restore previous version
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=PREVIOUS_VERSION_ID" \
  --key index.html

# 4. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

### Option 2: Re-deploy Previous Commit (Complete)

**Timeline**: ~5-15 minutes

```bash
# 1. Find previous working commit
git log --oneline

# 2. Checkout previous commit
git checkout PREVIOUS_COMMIT_SHA

# 3. Build
npm ci
npm run build

# 4. Deploy (requires AWS credentials)
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/ --delete

# 5. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# 6. Return to main branch
git checkout main
```

### Option 3: Manual Workflow Dispatch (Easiest)

**Timeline**: ~10-20 minutes

1. Go to GitHub Actions
2. Select "Deploy Financial UI" workflow
3. Click "Run workflow"
4. Select previous commit or branch
5. Wait for deployment to complete

## Monitoring and Alerts

### CloudWatch Metrics

Available metrics:
- **Requests**: Total requests to /finanzas/*
- **BytesDownloaded**: Data transfer
- **ErrorRate**: 4xx and 5xx errors
- **CacheHitRate**: Cache efficiency

```bash
# Get request count (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=EPQU7PVDLQXUA \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### Recommended Alarms

1. **High Error Rate**: ErrorRate > 5% for 5 minutes
2. **Low Cache Hit**: CacheHitRate < 80% for 15 minutes
3. **Failed Deployments**: GitHub Actions failure notifications

### Access Logs

If enabled, CloudFront access logs provide:
- Request timestamp
- Client IP
- HTTP method and path
- Status code
- Bytes transferred

## Troubleshooting

### Issue: 403 Forbidden on /finanzas/*

**Possible Causes**:
1. S3 bucket policy doesn't allow CloudFront OAC
2. CloudFront behavior not configured
3. Origin Access Control not attached

**Resolution**:
```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket ukusi-ui-finanzas-prod

# Verify OAC is attached to origin in CloudFront console
# Ensure behavior path pattern is /finanzas/*
```

### Issue: 404 on Deep Links

**Possible Causes**:
1. Custom error responses not configured
2. Wrong response page path

**Resolution**:
1. Go to CloudFront Console → Distribution → Error Pages
2. Verify custom error responses exist for 403 and 404
3. Ensure response page path is `/finanzas/index.html` (not just `index.html`)

### Issue: Stale Content After Deployment

**Possible Causes**:
1. CloudFront cache not invalidated
2. Browser cache
3. Intermediate proxy cache

**Resolution**:
```bash
# Force invalidation
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/*"

# Check browser (force refresh)
# Chrome/Firefox: Ctrl+Shift+R or Cmd+Shift+R
```

### Issue: Deployment Fails - S3 Access Denied

**Possible Causes**:
1. OIDC role doesn't have S3 permissions
2. OIDC trust relationship incorrect
3. Bucket doesn't exist

**Resolution**:
```bash
# Verify role from GitHub Actions
aws sts get-caller-identity

# Check role permissions
aws iam get-role --role-name github-actions-finanzas-prod

# Verify bucket exists
aws s3 ls s3://ukusi-ui-finanzas-prod/
```

### Issue: Assets Not Loading (404)

**Possible Causes**:
1. Incorrect base path in Vite config
2. CloudFront behavior path pattern mismatch
3. Assets not uploaded to S3

**Resolution**:
1. Verify `vite.config.ts` has `base: '/finanzas/'`
2. Check CloudFront behavior path is `/finanzas/*`
3. Verify assets exist in S3: `aws s3 ls s3://ukusi-ui-finanzas-prod/`

### Issue: Slow Deployment

**Possible Causes**:
1. Large bundle size
2. CloudFront invalidation delay
3. Many files to sync

**Resolution**:
1. Optimize bundle size (code splitting, tree shaking)
2. Wait for invalidation to complete (~5-15 minutes)
3. Use `--size-only` for S3 sync to skip unchanged files

## Maintenance Tasks

### Weekly

- [ ] Review CloudFront metrics
- [ ] Check error rates
- [ ] Verify deployments successful

### Monthly

- [ ] Review S3 costs and storage
- [ ] Audit IAM role permissions
- [ ] Check for security updates

### Quarterly

- [ ] Review and update documentation
- [ ] Test rollback procedures
- [ ] Audit CloudFront configuration

## Emergency Contacts

- **AWS Support**: Enterprise support plan
- **Repository Owner**: valencia94
- **DevOps Team**: (Add contact info)

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
