# Finanzas UI Production Deployment Guide

## Overview

This guide documents the deployment process for the Finanzas UI to production, including configuration, verification steps, and troubleshooting.

## Architecture

```
CloudFront Distribution (EPQU7PVDLQXUA)
├── / (PMO Portal)
│   └── Origin: S3 bucket (ukusi-ui-finanzas-prod)
└── /finanzas/* (Finanzas Portal)
    └── Origin: S3 bucket (ukusi-ui-finanzas-prod/finanzas/)
```

## Deployment Configuration

### Environment-Based Configuration

The deployment workflow (`deploy-ui.yml`) uses branch-based environment detection:

| Branch | Environment | S3 Bucket | CloudFront | API Endpoint |
|--------|-------------|-----------|------------|--------------|
| `main` | **prod** | ukusi-ui-finanzas-prod | EPQU7PVDLQXUA | .../prod |
| Others | **dev** | (from vars) | (from vars) | .../dev |

### Production Configuration

- **S3 Bucket**: `ukusi-ui-finanzas-prod` (us-east-2)
- **CloudFront Distribution**: `EPQU7PVDLQXUA` (d7t9x3j66yd8k.cloudfront.net)
- **API Gateway**: `m3g6am67aj` (us-east-2)
- **API Endpoint**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod`
- **Region**: us-east-2

### Cognito Configuration

- **User Pool ID**: us-east-2_FyHLtOhiY
- **App Client ID**: dshos5iou44tuach7ta3ici5m
- **Domain**: us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com
- **Callback URL**: https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
- **Sign-out URL**: https://d7t9x3j66yd8k.cloudfront.net/finanzas/

## Deployment Process

### Automated Deployment (GitHub Actions)

1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: 
   - PMO Portal (base: /)
   - Finanzas Portal (base: /finanzas/)
3. **Upload to S3**:
   - PMO: `s3://ukusi-ui-finanzas-prod/`
   - Finanzas: `s3://ukusi-ui-finanzas-prod/finanzas/`
4. **CloudFront Invalidation**: `/*, /finanzas/*, /finanzas/index.html`
5. **Verification**: Smoke tests for UI and API

### Manual Deployment (Emergency)

If GitHub Actions deployment fails:

```bash
# 1. Build locally
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod
export BUILD_TARGET=finanzas
npm run build

# 2. Upload to S3
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/finanzas/ \
  --exclude '*.map' \
  --delete \
  --region us-east-2

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*' '/finanzas/index.html' \
  --region us-east-2
```

## Verification Steps

### 1. CloudFront Configuration

Verify the `/finanzas/*` behavior exists:

```bash
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query "DistributionConfig.CacheBehaviors.Items[?PathPattern=='/finanzas/*']" \
  --output json | jq '.[0] | {TargetOriginId, SmoothStreaming}'
```

Expected output:
```json
{
  "TargetOriginId": "finanzas-ui-s3",
  "SmoothStreaming": false
}
```

### 2. UI Deployment

Test the Finanzas portal is accessible:

```bash
# Check HTTP status
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/

# Verify asset paths use /finanzas/ prefix
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | \
  grep -o '/finanzas/assets/[^"]*' | head -3

# Ensure no development references
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | \
  grep -i 'github.dev\|codespaces' || echo '✅ No dev references'
```

### 3. API Connectivity

Test API endpoints with Cognito authentication:

```bash
# Get Cognito ID token
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME=$USERNAME PASSWORD=$PASSWORD \
  --query 'AuthenticationResult.IdToken' --output text)

# Test public endpoint
curl -fsS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/health | jq '.'

# Test protected endpoints
curl -fsS -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/catalog/rubros | \
  jq '.data | length'

curl -fsS -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/allocation-rules | \
  jq '.data | length'
```

### 4. End-to-End Test

1. Navigate to https://d7t9x3j66yd8k.cloudfront.net/finanzas/
2. Login with Cognito credentials
3. Verify JWT token in browser DevTools Network tab (Authorization header)
4. Navigate to /finanzas/catalog/rubros
5. Verify catalog data is displayed
6. Check browser console for errors

## Troubleshooting

### Issue: UI shows old content after deployment

**Cause**: CloudFront cache not invalidated or browser cache

**Solution**:
1. Check CloudFront invalidation status in AWS Console
2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Wait 30-60 seconds for cache propagation
4. Manual invalidation:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPQU7PVDLQXUA \
     --paths '/*'
   ```

### Issue: API calls failing with CORS errors

**Cause**: Incorrect API endpoint or missing CORS configuration

**Solution**:
1. Verify API endpoint in build:
   ```bash
   # After build, check the compiled JS
   grep -o "m3g6am67aj.*amazonaws\.com/[a-z]*" dist/assets/*.js
   ```
2. Should show `/prod`, not `/dev`
3. Check API Gateway CORS settings in AWS Console

### Issue: Authentication redirects fail

**Cause**: Incorrect Cognito callback URL configuration

**Solution**:
1. Verify callback URL in Cognito App Client settings:
   - Should be: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
2. Verify sign-out URL:
   - Should be: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
3. Update if needed in AWS Console → Cognito → User Pool → App Clients

### Issue: 404 errors on deep links (e.g., /finanzas/catalog/rubros)

**Cause**: CloudFront not configured to handle SPA routing

**Solution**:
1. Add Custom Error Response in CloudFront:
   - HTTP Error Code: 403
   - Response Page Path: /finanzas/index.html
   - HTTP Response Code: 200
2. Add another for 404 → /finanzas/index.html

### Issue: Build fails with "vite: not found"

**Cause**: Dependencies not installed

**Solution**:
```bash
npm install
# Then retry build
BUILD_TARGET=finanzas npm run build
```

## Configuration Files

### Key Files for Production

- `.github/workflows/deploy-ui.yml` - Deployment workflow
- `vite.config.ts` - Build configuration (sets base path)
- `src/config/aws.ts` - AWS/Cognito configuration
- `.env.production` - Production environment variables
- `src/App.tsx` - Router basename configuration

### Environment Variables

**Build-time** (injected by Vite, prefixed with `VITE_`):
- `VITE_API_BASE_URL` - API Gateway endpoint
- `VITE_FINZ_ENABLED` - Enable Finanzas module
- `VITE_COGNITO_*` - Cognito configuration
- `VITE_CLOUDFRONT_URL` - CloudFront domain

**Runtime** (GitHub Actions):
- `DEPLOYMENT_ENV` - Environment (prod/dev)
- `S3_BUCKET_NAME` - S3 bucket for deployment
- `CLOUDFRONT_DIST_ID` - CloudFront distribution ID

## Cache Strategy

| Resource Type | Cache-Control | CloudFront TTL |
|--------------|---------------|----------------|
| index.html | no-store | 0s (always revalidate) |
| Assets (/finanzas/assets/*) | public, max-age=31536000 | 1 year (immutable) |
| API Responses | Depends on API headers | Varies |

## Monitoring

### GitHub Actions

- View deployment logs: https://github.com/valencia94/financial-planning-u/actions
- Check workflow run summary for deployment evidence

### AWS CloudWatch

- CloudFront access logs
- API Gateway logs (if enabled)
- Lambda function logs (for API backend)

### Browser DevTools

- Check Network tab for:
  - Correct API endpoint (`/prod` not `/dev`)
  - Authorization header with JWT token
  - HTTP status codes (should be 200 for successful calls)

## Rollback Procedure

If deployment causes issues:

1. **Quick rollback** (use previous S3 version):
   ```bash
   # List versions
   aws s3api list-object-versions \
     --bucket ukusi-ui-finanzas-prod \
     --prefix finanzas/index.html
   
   # Copy previous version
   aws s3api copy-object \
     --bucket ukusi-ui-finanzas-prod \
     --copy-source ukusi-ui-finanzas-prod/finanzas/index.html?versionId=VERSION_ID \
     --key finanzas/index.html
   ```

2. **Invalidate cache**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPQU7PVDLQXUA \
     --paths '/finanzas/*'
   ```

3. **Deploy previous commit**:
   - Revert commit in git
   - Push to main branch
   - GitHub Actions will redeploy automatically

## References

- [GitHub Actions Workflow](.github/workflows/deploy-ui.yml)
- [Vite Environment Variables](https://vite.dev/guide/env-and-mode)
- [AWS CloudFront Cache Behaviors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesCacheBehavior)
- [AWS Cognito Hosted UI](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [S3 Sync Documentation](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html)

---

## Finanzas API Deployment

### API Architecture

```
API Gateway (m3g6am67aj)
├── /dev (Development stage)
│   └── Stack: finanzas-sd-api-dev
└── /prod (Production stage)
    └── Stack: finanzas-sd-api-prod
```

### API Deployment Configuration

The API deployment workflow (`deploy-api.yml`) uses branch-based environment detection:

| Branch | Environment | Stack Name | Stage | API URL |
|--------|-------------|------------|-------|---------|
| `main` | **prod** | finanzas-sd-api-prod | prod | .../prod |
| Others | **dev** | finanzas-sd-api-dev | dev | .../dev |

### Production API Deployment

#### Automated Deployment (GitHub Actions)

1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: SAM builds Lambda functions with esbuild
3. **Deploy**: CloudFormation stack with name `finanzas-sd-api-prod`
4. **Verify**: Smoke tests for health and catalog endpoints
5. **Seed**: Populate DynamoDB tables with rubros taxonomy

#### Manual Deployment

If automated deployment fails or for initial setup:

```bash
# Navigate to API directory
cd services/finanzas-api

# Install dependencies
npm ci

# Build with SAM
sam build

# Deploy to production
sam deploy \
  --stack-name finanzas-sd-api-prod \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-2:ACCOUNT:userpool/us-east-2_FyHLtOhiY \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m \
    StageName=prod \
    PolicyStoreId=""

# Seed DynamoDB tables (if needed)
TABLE_RUBROS=finz_rubros \
TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia \
  npx ts-node --project tsconfig.node.json scripts/ts-seeds/seed_rubros.ts

TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia \
  npx ts-node --project tsconfig.node.json scripts/ts-seeds/seed_rubros_taxonomia.ts
```

### API Verification

#### 1. Validate Deployment

Run the validation script:

```bash
bash scripts/validate-prod-deployment.sh
```

This script checks:
- CloudFormation stack exists
- API Gateway stage is deployed
- Required routes are present
- CognitoJwt authorizer is configured
- Health endpoint responds correctly
- Catalog endpoint is accessible

#### 2. Test Protected Endpoints

```bash
# Set environment variables
export STAGE=prod
export STACK_NAME=finanzas-sd-api-prod
export API_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod
export CLIENT_ID=dshos5iou44tuach7ta3ici5m
export USERNAME=your_username
export PASSWORD=your_password
export USER_POOL_ID=us-east-2_FyHLtOhiY

# Run protected endpoint tests
bash scripts/test-protected-endpoints.sh
```

#### 3. Manual Endpoint Tests

```bash
# Health endpoint (public)
curl -sS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/health | jq '.'

# Expected response:
# {
#   "ok": true,
#   "stage": "prod",
#   "timestamp": "2025-11-09T..."
# }

# Catalog endpoint (public)
curl -sS https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/catalog/rubros | jq '.total'

# Allocation rules (requires JWT)
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME=$USERNAME PASSWORD=$PASSWORD \
  --query 'AuthenticationResult.IdToken' --output text)

curl -sS -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod/allocation-rules | jq '.'
```

### API Troubleshooting

#### Issue: Stage not found on API Gateway

**Cause**: Stack deployed but stage not created

**Solution**:
1. Check CloudFormation stack status:
   ```bash
   aws cloudformation describe-stacks --stack-name finanzas-sd-api-prod
   ```
2. Verify API Gateway stages:
   ```bash
   aws apigatewayv2 get-stages --api-id m3g6am67aj
   ```
3. Redeploy if needed:
   ```bash
   cd services/finanzas-api
   sam build
   sam deploy --stack-name finanzas-sd-api-prod --parameter-overrides StageName=prod
   ```

#### Issue: 401 Unauthorized on protected endpoints

**Cause**: Invalid JWT token or authorizer misconfiguration

**Solution**:
1. Verify token is valid:
   ```bash
   # Decode JWT payload (requires jq)
   echo $ID_TOKEN | cut -d '.' -f2 | base64 -d | jq '.'
   ```
2. Check token expiration (exp claim)
3. Verify authorizer configuration:
   ```bash
   aws apigatewayv2 get-authorizers --api-id m3g6am67aj
   ```

#### Issue: 403 Forbidden or Missing Authentication Token

**Cause**: Missing or malformed Authorization header

**Solution**:
1. Ensure header format is: `Authorization: Bearer <token>`
2. Verify token is not empty:
   ```bash
   echo "Token length: ${#ID_TOKEN}"
   ```
3. Check API Gateway logs:
   ```bash
   aws logs tail /aws/http-api/prod/finz-access --since 5m
   ```

#### Issue: DynamoDB tables not seeded

**Cause**: Seeding step failed or was skipped

**Solution**:
1. Check if tables exist:
   ```bash
   aws dynamodb describe-table --table-name finz_rubros
   aws dynamodb describe-table --table-name finz_rubros_taxonomia
   ```
2. Manually seed:
   ```bash
   cd /path/to/repo
   TABLE_RUBROS=finz_rubros npx ts-node --project tsconfig.node.json scripts/ts-seeds/seed_rubros.ts
   TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia npx ts-node --project tsconfig.node.json scripts/ts-seeds/seed_rubros_taxonomia.ts
   ```

### Rollback Procedure

If production deployment fails:

1. **Identify last working version**:
   ```bash
   git log --oneline -n 10
   ```

2. **Rollback stack to previous version**:
   ```bash
   # Get previous template from S3 (SAM stores them)
   aws cloudformation update-stack \
     --stack-name finanzas-sd-api-prod \
     --use-previous-template
   ```

3. **Or redeploy from a specific commit**:
   ```bash
   git checkout <previous-commit-sha>
   cd services/finanzas-api
   sam build
   sam deploy --stack-name finanzas-sd-api-prod
   ```

### Monitoring

#### CloudWatch Logs

```bash
# API Access Logs
aws logs tail /aws/http-api/prod/finz-access --follow

# Lambda Function Logs (example for CatalogFn)
FUNCTION_NAME=$(aws cloudformation describe-stack-resources \
  --stack-name finanzas-sd-api-prod \
  --query "StackResources[?LogicalResourceId=='CatalogFn'].PhysicalResourceId" \
  --output text)
aws logs tail /aws/lambda/$FUNCTION_NAME --follow
```

#### Metrics

View API Gateway metrics in CloudWatch:
- Request count
- 4XX errors
- 5XX errors
- Latency
- Integration latency

## Deployment Checklist

### Pre-Deployment

- [ ] Code changes reviewed and tested locally
- [ ] All tests pass
- [ ] Security scan completed (CodeQL, dependency check)
- [ ] Documentation updated
- [ ] Cognito configuration verified
- [ ] AWS credentials configured

### During Deployment

- [ ] GitHub Actions workflow started
- [ ] Build completes successfully
- [ ] Stack deployment succeeds
- [ ] Smoke tests pass
- [ ] DynamoDB tables seeded

### Post-Deployment

- [ ] Health endpoint responds with 200
- [ ] Catalog endpoint returns data
- [ ] Protected endpoints require JWT
- [ ] UI can authenticate and access API
- [ ] CloudWatch logs show no errors
- [ ] All checklist items verified
- [ ] Team notified of deployment

## Emergency Contacts

For production issues:
- DevOps Team: @devops
- Backend Team: @backend
- On-Call Engineer: (see PagerDuty rotation)
