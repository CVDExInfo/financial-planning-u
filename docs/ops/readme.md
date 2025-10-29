# Operations & Infrastructure Guide

This document covers the AWS infrastructure setup and operational procedures for the Financial Planning UI.

## AWS Account & Region Configuration

- **AWS Account**: 703671891952
- **Primary Region**: us-east-2 (Ohio) - for S3, IAM, SSM
- **CloudFront**: Global (us-east-1 for ACM certificates if needed)

## Infrastructure Components

### 1. S3 Bucket

#### Requirements

- **Region**: us-east-2
- **Name Convention**: `<org>-financial-planning-ui-<env>` (e.g., `acme-financial-planning-ui-prod`)
- **Access**: Private (block all public access)
- **Versioning**: Enabled (recommended for rollback capability)
- **Encryption**: SSE-S3 or SSE-KMS

#### Bucket Policy

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
      "Resource": "arn:aws:s3:::<bucket-name>/finanzas/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::703671891952:distribution/<distribution-id>"
        }
      }
    }
  ]
}
```

#### CORS Configuration

If the SPA makes client-side calls to the bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://<distribution-domain>"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. CloudFront Distribution

#### Origin Configuration

- **Origin Domain**: `<bucket-name>.s3.us-east-2.amazonaws.com`
- **Origin Path**: Leave empty (path managed by behavior)
- **Origin Access**: Origin Access Control (OAC)
- **Origin Protocol Policy**: HTTPS only

#### OAC Configuration

Create an OAC for the S3 origin:

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  Name=financial-planning-oac,\
  SigningProtocol=sigv4,\
  SigningBehavior=always,\
  OriginAccessControlOriginType=s3
```

#### Behavior Configuration for `/finanzas/*`

Create or update a behavior:

- **Path Pattern**: `/finanzas/*`
- **Origin**: S3 origin configured above
- **Viewer Protocol Policy**: Redirect HTTP to HTTPS
- **Allowed HTTP Methods**: GET, HEAD, OPTIONS
- **Cached HTTP Methods**: GET, HEAD
- **Cache Policy**: Managed-CachingOptimized or custom policy
- **Compress Objects**: Yes

#### Custom Cache Policy (Optional)

For better control:

```json
{
  "Name": "FinancialPlanningCachePolicy",
  "MinTTL": 0,
  "MaxTTL": 31536000,
  "DefaultTTL": 86400,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "QueryStringsConfig": {
      "QueryStringBehavior": "none"
    },
    "HeadersConfig": {
      "HeaderBehavior": "none"
    },
    "CookiesConfig": {
      "CookieBehavior": "none"
    }
  }
}
```

#### Custom Error Responses (SPA Fallback)

Configure these custom error responses for SPA routing:

| HTTP Error Code | Custom Error Response | Response Page Path | HTTP Response Code |
|-----------------|----------------------|-------------------|-------------------|
| 403 | Yes | /finanzas/index.html | 200 |
| 404 | Yes | /finanzas/index.html | 200 |

This ensures deep links work correctly by serving `index.html` for all routes.

**Important**: Without this configuration, direct navigation to routes like `/finanzas/pmo/prefactura/estimator` will result in 403/404 errors.

#### CLI Command to Update Error Responses

```bash
aws cloudfront update-distribution \
  --id <distribution-id> \
  --if-match <etag> \
  --distribution-config file://distribution-config.json
```

Example `distribution-config.json` snippet for custom error responses:

```json
{
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/finanzas/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/finanzas/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  }
}
```

### 3. IAM Configuration

#### OIDC Provider

GitHub OIDC provider must be configured in IAM:

- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

Create if not exists:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### IAM Role for GitHub Actions

Create a role with this trust policy:

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

#### IAM Policy for Deployment

Attach this policy to the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DeployAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::<bucket-name>",
        "arn:aws:s3:::<bucket-name>/finanzas/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::703671891952:distribution/<distribution-id>"
    },
    {
      "Sid": "SSMParameterReadOptional",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-2:703671891952:parameter/financial-planning/*"
    }
  ]
}
```

#### Create Role via CLI

```bash
# 1. Create role with trust policy
aws iam create-role \
  --role-name GitHubActionsFinancialPlanningDeploy \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for GitHub Actions to deploy Financial Planning UI"

# 2. Create and attach policy
aws iam create-policy \
  --policy-name FinancialPlanningDeployPolicy \
  --policy-document file://deploy-policy.json

aws iam attach-role-policy \
  --role-name GitHubActionsFinancialPlanningDeploy \
  --policy-arn arn:aws:iam::703671891952:policy/FinancialPlanningDeployPolicy

# 3. Get role ARN for GitHub secret
aws iam get-role \
  --role-name GitHubActionsFinancialPlanningDeploy \
  --query 'Role.Arn' \
  --output text
```

### 4. AWS Systems Manager (SSM) Parameter Store

Optional: Store runtime configuration in SSM for dynamic fetching.

#### Parameter Naming Convention

```
/financial-planning/prod/api-base-url
/financial-planning/prod/cognito-client-id
/financial-planning/prod/cognito-pool-id
/financial-planning/prod/cognito-domain
/financial-planning/prod/acta-api-id
```

#### Create Parameters

```bash
aws ssm put-parameter \
  --region us-east-2 \
  --name "/financial-planning/prod/api-base-url" \
  --value "https://api.example.com" \
  --type String \
  --tier Standard

aws ssm put-parameter \
  --region us-east-2 \
  --name "/financial-planning/prod/cognito-client-id" \
  --value "<client-id>" \
  --type SecureString \
  --tier Standard
```

#### Fetch at Runtime (Optional)

To use SSM parameters at runtime instead of build-time environment variables:

1. Add SSM fetch to application initialization
2. Store in runtime configuration
3. Update IAM policy to allow SSM reads

Note: Build-time environment variables (current approach) are recommended for better performance and simpler deployment.

## GitHub Configuration Checklist

### Organization-Level Variables

Set these at Settings → Secrets and variables → Actions → Variables:

- [ ] `AWS_ACCOUNT_ID` = `703671891952`
- [ ] `AWS_REGION` = `us-east-2`
- [ ] `S3_BUCKET_NAME` = `<bucket-name>`
- [ ] `CLOUDFRONT_DIST_ID` = `<distribution-id>`
- [ ] `DISTRIBUTION_DOMAIN_NAME` = `<cloudfront-domain>`
- [ ] `VITE_API_BASE_URL` = `<api-gateway-url>`
- [ ] `VITE_ACTA_API_ID` = `<acta-api-id>`
- [ ] `COGNITO_CLIENT_ID` = `<cognito-app-client-id>`
- [ ] `COGNITO_POOL_ID` = `<cognito-user-pool-id>`
- [ ] `COGNITO_DOMAIN` = `<cognito-domain>`

### Organization-Level Secrets

Set these at Settings → Secrets and variables → Actions → Secrets:

- [ ] `OIDC_AWS_ROLE_ARN` = `arn:aws:iam::703671891952:role/<role-name>`

## SPA Fallback Checklist

Ensure these are configured for proper SPA routing:

- [ ] CloudFront custom error response: 403 → `/finanzas/index.html` (200)
- [ ] CloudFront custom error response: 404 → `/finanzas/index.html` (200)
- [ ] Vite config `base` set to `/finanzas/` in production
- [ ] React Router `basename` set to `/finanzas` in production
- [ ] S3 bucket is private (no static website hosting)
- [ ] OAC configured between CloudFront and S3

## Monitoring & Logging

### CloudFront Logs

Enable standard logging:

```bash
aws cloudfront update-distribution \
  --id <distribution-id> \
  --logging-config \
    Enabled=true,\
    IncludeCookies=false,\
    Bucket=<logs-bucket>.s3.amazonaws.com,\
    Prefix=cloudfront/finanzas/
```

### S3 Access Logs

Enable on the bucket:

```bash
aws s3api put-bucket-logging \
  --bucket <bucket-name> \
  --bucket-logging-status \
    LoggingEnabled={
      TargetBucket=<logs-bucket>,
      TargetPrefix=s3/financial-planning/
    }
```

### CloudWatch Alarms

Monitor key metrics:

- CloudFront 4xx/5xx error rate
- CloudFront request count
- S3 4xx/5xx error rate

## Disaster Recovery

### Backup Strategy

- **S3 Versioning**: Enabled for rollback
- **Cross-Region Replication**: Optional for critical deployments
- **Git History**: Source of truth for all deployments

### Recovery Procedures

1. **Rollback via Git**: Revert commit and redeploy
2. **S3 Version Restore**: Restore previous S3 object versions
3. **CloudFront Invalidation**: Clear cache after recovery

## Cost Optimization

### S3 Lifecycle Policies

Archive old versions:

```json
{
  "Rules": [
    {
      "Id": "ArchiveOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 365
      }
    }
  ]
}
```

### CloudFront Cost

- Use cache policies to maximize cache hit ratio
- Consider CloudFront price class for regional optimization
- Monitor data transfer costs

## Security Best Practices

### Regular Audits

- Review IAM policies quarterly
- Rotate OIDC trust configurations annually
- Monitor AWS CloudTrail for unauthorized access
- Review S3 bucket policies and access

### Principle of Least Privilege

- IAM role has minimal permissions
- S3 bucket is not publicly accessible
- CloudFront enforces HTTPS
- OAC replaces legacy Origin Access Identity

### Secrets Management

- Never commit secrets to Git
- Use GitHub Secrets for sensitive values
- Consider AWS Secrets Manager for complex configurations
- Rotate credentials regularly

## Troubleshooting

### CloudFront Not Serving Updated Content

1. Check invalidation status:
   ```bash
   aws cloudfront get-invalidation \
     --distribution-id <dist-id> \
     --id <invalidation-id>
   ```
2. Verify cache policy settings
3. Check object metadata in S3

### 403 Errors

1. Verify OAC is configured correctly
2. Check S3 bucket policy allows CloudFront
3. Ensure files exist in S3 at `/finanzas/` prefix

### SPA Routes Return 404

1. Verify custom error responses are configured
2. Check `/finanzas/index.html` exists in S3
3. Verify CloudFront behavior matches `/finanzas/*`

## Support Contacts

- **AWS Account**: Contact AWS Support for infrastructure issues
- **GitHub**: Use repository issues for deployment pipeline questions
- **Application**: See main README for application support

## Appendix: Console Steps

### Creating OAC in AWS Console

1. Go to CloudFront → Origin Access
2. Click "Create control setting"
3. Name: `financial-planning-oac`
4. Signing behavior: Sign requests (recommended)
5. Click "Create"
6. Associate with origin in distribution settings

### Configuring Custom Error Pages in Console

1. Go to CloudFront → Distributions → Select distribution
2. Click "Error pages" tab
3. Click "Create custom error response"
4. HTTP error code: 403
5. Customize error response: Yes
6. Response page path: `/finanzas/index.html`
7. HTTP response code: 200
8. Click "Create"
9. Repeat for 404 error code

### Setting GitHub Secrets/Variables in Console

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository variable" or "New repository secret"
3. Enter name and value
4. Click "Add variable" or "Add secret"

For organization-level (recommended):
1. Go to Organization settings → Secrets and variables → Actions
2. Configure at organization level
3. Select repositories that can access
