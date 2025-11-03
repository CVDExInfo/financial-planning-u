# Runbook — Finanzas SD (API & UI)

This runbook provides operational procedures for deploying, testing, and troubleshooting the Finanzas Service Delivery (SD) module.

## Table of Contents

1. [Deploy API (dev)](#deploy-api-dev)
2. [Smoke Test API](#smoke-test-api)
3. [Rollback API](#rollback-api)
4. [Deploy UI](#deploy-ui)
5. [Smoke Test UI](#smoke-test-ui)
6. [Rollback UI](#rollback-ui)
7. [Troubleshooting](#troubleshooting)

## Deploy API (dev)

### Prerequisites

Ensure the following GitHub repository Variables are configured:

- `AWS_REGION`: us-east-2
- `FINZ_API_STACK`: finanzas-sd-api-dev
- `FINZ_API_STAGE`: dev
- `COGNITO_USER_POOL_ID`: (Your Cognito User Pool ID)
- `COGNITO_USER_POOL_ARN`: (Your Cognito User Pool ARN)

Ensure the following GitHub repository Secret is configured:

- `OIDC_AWS_ROLE_ARN`: (IAM role ARN for OIDC authentication)

### Deployment Steps

1. **Trigger Workflow**: Navigate to GitHub Actions → "Deploy Finanzas API (dev)" → "Run workflow"
2. **Verify OIDC**: Check workflow logs for OIDC identity confirmation:
   ```
   ✓ OIDC authentication successful
   ✓ Assumed role: arn:aws:iam::703671891952:role/github-actions-finanzas-api-dev
   ```
3. **Monitor Build**: Watch for SAM build completion:
   ```
   Building codeuri: /src/handlers/health runtime: nodejs18.x ...
   Build Succeeded
   ```
4. **Monitor Deploy**: Confirm SAM deploy success:
   ```
   CloudFormation stack changeset
   Successfully created/updated stack - finanzas-sd-api-dev in us-east-2
   ```
5. **Capture API URL**: Copy API URL from `$GITHUB_STEP_SUMMARY`:
   ```
   API Gateway URL: https://abc123xyz.execute-api.us-east-2.amazonaws.com/dev
   ```

### Manual Deployment (from local)

If GitHub Actions is unavailable:

```bash
cd services/finanzas-api

# Install dependencies
npm ci

# Build
sam build

# Deploy
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_xxxxxx \
    CognitoUserPoolId=us-east-2_xxxxxx \
    StageName=dev \
  --region us-east-2

# Get API URL
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

## Smoke Test API

### Health Check (Public)

```bash
# Set API URL (from deployment output)
export API_URL=https://abc123xyz.execute-api.us-east-2.amazonaws.com/dev

# Test health endpoint
curl -sS ${API_URL}/health

# Expected output (200 OK):
{
  "status": "healthy",
  "timestamp": "2025-11-03T01:18:05.378Z",
  "version": "1.0.0"
}
```

### Catalog Endpoint (Public)

```bash
# Test rubros catalog
curl -sS ${API_URL}/catalog/rubros

# Expected output (200 OK):
{
  "rubros": [
    {
      "id": "rubro-001",
      "name": "Salarios",
      "category": "Personal"
    },
    ...
  ]
}
```

### Authenticated Endpoints

For authenticated endpoints, you need a valid JWT token:

```bash
# Obtain JWT token (replace with actual Cognito credentials)
# This typically comes from your frontend login flow

export JWT_TOKEN="eyJraWQiOiJ..."

# Test projects list
curl -sS \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  ${API_URL}/projects

# Expected output (200 OK):
{
  "projects": [...]
}

# Test create project
curl -sS -X POST \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","code":"TST001"}' \
  ${API_URL}/projects

# Expected output (201 Created):
{
  "id": "proj-abc123",
  "name": "Test Project",
  "code": "TST001",
  "createdAt": "2025-11-03T01:18:05.378Z"
}
```

### Automated Smoke Tests

Run the API test suite (from `services/finanzas-api/`):

```bash
cd services/finanzas-api
npm ci
npm test

# Or run specific smoke tests
npm test -- --grep "smoke"
```

## Rollback API

### Option 1: CloudFormation Rollback (Recommended)

Use CloudFormation to rollback to the previous stack revision:

```bash
aws cloudformation rollback-stack \
  --stack-name finanzas-sd-api-dev \
  --region us-east-2

# Monitor rollback status
aws cloudformation describe-stack-events \
  --stack-name finanzas-sd-api-dev \
  --region us-east-2 \
  --max-items 20
```

**Timeline**: ~5-10 minutes

### Option 2: Re-deploy Previous Revision

Deploy the previous SAM template revision:

```bash
cd services/finanzas-api

# Checkout previous commit
git log --oneline
git checkout <previous-commit-sha>

# Build and deploy
sam build
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_xxxxxx \
    CognitoUserPoolId=us-east-2_xxxxxx \
    StageName=dev \
  --region us-east-2

# Return to main branch
git checkout main
```

**Timeline**: ~10-15 minutes

### Post-Rollback Actions

1. **Document Reason**: Open a GitHub issue describing the rollback reason
2. **Attach Logs**: Include CloudWatch logs and error messages
3. **Create Defect**: Link to the failed deployment PR
4. **Notify Team**: Alert stakeholders via Slack/email

## Deploy UI

### Prerequisites

Ensure the following GitHub repository Variables are configured:

- `AWS_REGION`: us-east-2
- `S3_BUCKET_NAME`: ukusi-ui-finanzas-prod
- `CLOUDFRONT_DIST_ID`: EPQU7PVDLQXUA
- `DISTRIBUTION_DOMAIN_NAME`: d7t9x3j66yd8k.cloudfront.net
- `VITE_API_BASE_URL`: https://abc123xyz.execute-api.us-east-2.amazonaws.com/dev
- `VITE_ACTA_API_ID`: (Your ACTA API ID)

Ensure the following GitHub repository Secret is configured:

- `OIDC_AWS_ROLE_ARN`: (IAM role ARN for OIDC authentication)

### Deployment Steps

1. **Trigger Workflow**: Navigate to GitHub Actions → "Deploy Financial UI" → "Run workflow"
2. **Verify Build**: Check workflow logs for Vite build completion:
   ```
   vite v5.x.x building for production...
   ✓ 1234 modules transformed.
   dist/index.html                   1.5 kB
   dist/assets/index-abc123.js     123.4 kB
   dist/assets/index-abc123.css     12.3 kB
   ```
3. **Verify S3 Sync**: Confirm S3 sync completion:
   ```
   upload: dist/index.html to s3://ukusi-ui-finanzas-prod/index.html
   upload: dist/assets/index-abc123.js to s3://ukusi-ui-finanzas-prod/assets/index-abc123.js
   ```
4. **Verify Invalidation**: Confirm CloudFront invalidation created:
   ```
   Invalidation created: I2ABCDEFGHIJKL
   Status: InProgress
   ```

### Manual Deployment (from local)

If GitHub Actions is unavailable:

```bash
# Install dependencies
npm ci

# Build
npm run build

# Sync to S3
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/ --delete --region us-east-2

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

**Timeline**: ~3-5 minutes (build) + ~5-15 minutes (invalidation propagation)

## Smoke Test UI

### Root Path Test

```bash
# Test root path
curl -sS https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep "<title>"

# Expected output:
<title>Finanzas - Financial Planning</title>
```

### Deep Link Test

Test SPA routing (should return index.html with 200 status):

```bash
# Test deep link
curl -sS https://d7t9x3j66yd8k.cloudfront.net/finanzas/projects/123 | grep "<title>"

# Expected output:
<title>Finanzas - Financial Planning</title>
```

### Manual Browser Test

1. Open https://d7t9x3j66yd8k.cloudfront.net/finanzas/
2. Verify page loads without errors
3. Check browser console for JavaScript errors
4. Test navigation (click through main routes)
5. Verify API calls succeed (Network tab)

### Asset Loading Test

```bash
# Test CSS loading
curl -sS -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/assets/index-abc123.css

# Expected output:
HTTP/2 200
content-type: text/css
cache-control: public,max-age=31536000,immutable

# Test JS loading
curl -sS -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/assets/index-abc123.js

# Expected output:
HTTP/2 200
content-type: application/javascript
cache-control: public,max-age=31536000,immutable
```

## Rollback UI

### Option 1: S3 Version Restore (Fastest)

Restore a previous version of key files from S3 versioning:

```bash
# List versions of index.html
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html \
  --max-items 5

# Identify previous version ID
export PREVIOUS_VERSION_ID=abc123xyz

# Restore previous version
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=${PREVIOUS_VERSION_ID}" \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

**Timeline**: ~5-10 minutes (restore) + ~5-15 minutes (invalidation)

**Note**: This only restores index.html. If assets (JS/CSS) are also broken, use Option 2.

### Option 2: Re-deploy Previous Commit (Complete)

Deploy the entire UI from a previous commit:

```bash
# Find previous working commit
git log --oneline

# Checkout previous commit
git checkout <previous-commit-sha>

# Build
npm ci
npm run build

# Deploy
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/ --delete --region us-east-2

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"

# Return to main branch
git checkout main
```

**Timeline**: ~10-20 minutes (build + sync + invalidation)

### Option 3: Manual Workflow Dispatch (Easiest)

Re-run a previous successful deployment workflow:

1. Go to GitHub Actions
2. Select "Deploy Financial UI" workflow
3. Find a previous successful run
4. Click "Re-run all jobs"

**Timeline**: ~10-20 minutes (automated)

### Post-Rollback Actions

1. **Document Reason**: Open a GitHub issue describing the rollback reason
2. **Attach Evidence**: Include screenshots, console errors, or network traces
3. **Create Defect**: Link to the failed deployment PR or commit
4. **Notify Team**: Alert stakeholders via Slack/email

## Troubleshooting

### API: 5xx Errors

**Symptoms**: API returns 500 Internal Server Error

**Diagnosis**:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/finanzas-sd-api-dev-health --follow --region us-east-2

# Check API Gateway logs (if enabled)
aws logs tail /aws/apigateway/finanzas-sd-api-dev --follow --region us-east-2

# Get recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-sd-api-dev-health \
  --filter-pattern "ERROR" \
  --region us-east-2
```

**Resolution**:
- Check Lambda execution role permissions (DynamoDB access)
- Verify environment variables are set correctly
- Review Lambda code for unhandled exceptions
- Check DynamoDB table exists and is accessible

### API: 401 Unauthorized

**Symptoms**: API returns 401 when JWT token is provided

**Diagnosis**:

```bash
# Verify JWT token is valid (decode at jwt.io)
echo $JWT_TOKEN | cut -d '.' -f2 | base64 -d 2>/dev/null | jq

# Check Cognito configuration
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Parameters' \
  --region us-east-2
```

**Resolution**:
- Verify Cognito User Pool ID and ARN are correct in SAM parameters
- Check JWT token includes `cognito:groups` claim with `SDT` group
- Ensure JWT token is not expired
- Verify API Gateway authorizer is configured correctly

### API: CORS Errors

**Symptoms**: Browser console shows CORS error (blocked by CORS policy)

**Diagnosis**:

```bash
# Test OPTIONS request (preflight)
curl -sS -X OPTIONS \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  ${API_URL}/projects

# Check for CORS headers in response
```

**Resolution**:
- Verify CORS configuration in SAM template (`Cors` property)
- Ensure `AllowOrigin` includes CloudFront domain exactly (no trailing slash)
- Check `AllowHeaders` includes `Authorization` and `Content-Type`
- Redeploy API if CORS config was changed

### UI: 404 on Deep Links

**Symptoms**: Navigating to `/finanzas/projects/123` returns 404

**Diagnosis**:

```bash
# Check CloudFront custom error responses (CloudFront is a global service)
aws cloudfront get-distribution-config \
  --id EPQU7PVDLQXUA \
  --query 'DistributionConfig.CustomErrorResponses'
```

**Resolution**:
- Verify custom error responses exist for 403 and 404
- Ensure response page path is `/finanzas/index.html` (not just `/index.html`)
- Check CloudFront behavior path pattern is `/finanzas/*`
- Wait for CloudFront distribution update to complete (~15 minutes)

### UI: Assets Not Loading (404)

**Symptoms**: CSS or JS files return 404 in browser

**Diagnosis**:

```bash
# Check S3 bucket contents
aws s3 ls s3://ukusi-ui-finanzas-prod/ --recursive

# Verify Vite base path
grep "base:" vite.config.ts
```

**Resolution**:
- Verify `vite.config.ts` has `base: '/finanzas/'`
- Rebuild and redeploy UI
- Check CloudFront invalidation completed
- Verify assets were uploaded to S3 (check workflow logs)

### UI: Stale Content (Old Version Showing)

**Symptoms**: UI shows old version after deployment

**Diagnosis**:

```bash
# Check CloudFront cache
curl -sS -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html

# Look for X-Cache header:
X-Cache: Hit from cloudfront  # Cached (stale)
X-Cache: Miss from cloudfront # Not cached (fresh)

# Check invalidation status
aws cloudfront list-invalidations \
  --distribution-id EPQU7PVDLQXUA \
  --max-items 5
```

**Resolution**:
- Force browser refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Wait for CloudFront invalidation to complete (~5-15 minutes)
- If stuck, create new invalidation: `aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA --paths "/*"`

### Deployment: OIDC Authentication Failed

**Symptoms**: GitHub Actions workflow fails with "Unable to assume role"

**Diagnosis**:

Check workflow logs for error:
```
Error: Unable to assume role with OIDC: Access denied
```

**Resolution**:
- Verify `OIDC_AWS_ROLE_ARN` secret is set correctly
- Check IAM role trust policy allows GitHub Actions OIDC provider
- Verify trust policy includes repository name: `repo:valencia94/financial-planning-u:*`
- Check IAM role has required permissions (S3, CloudFront, Lambda, CloudFormation)

## References

- [Architecture Documentation](../architecture/finanzas-architecture.md)
- [ADR-0002: Separate API Gateway](../adr/ADR-0002-separate-api-gateway-finanzas.md)
- [Operations Guide (UI)](readme.md)
- [Deployment Guide](../deploy.md)
- [API Contracts](../api-contracts.md)
