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
