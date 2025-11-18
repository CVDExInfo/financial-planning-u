# API Connectivity Validation Guide

## Overview

This guide documents the comprehensive API connectivity validation infrastructure implemented to prevent "Failed to fetch" errors and ensure proper API connectivity throughout the development, build, and deployment lifecycle.

## Problem Statement

The "Failed to fetch" error typically occurs when:

1. **VITE_API_BASE_URL is not set** - The frontend has no API endpoint configured
2. **API endpoint is unreachable** - DNS, SSL, or network issues prevent connection
3. **CORS misconfiguration** - Browser blocks cross-origin requests
4. **API Gateway not deployed** - The API endpoint doesn't exist
5. **Environment drift** - Different API URLs in different environments

## Validation Infrastructure

### 1. Pre-Build Validation

**Script:** `scripts/pre-build-validate.sh`

**When it runs:** Automatically before every Finanzas build (`npm run build:finanzas`)

**What it validates:**
- ✅ `VITE_API_BASE_URL` is set and non-empty
- ✅ URL format is valid (starts with http:// or https://)
- ✅ Value is not just whitespace after trimming

**How to run manually:**
```bash
export BUILD_TARGET=finanzas
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
npm run validate:pre-build
```

**Exit codes:**
- `0` - Validation passed, safe to build
- `1` - Validation failed, DO NOT build

### 2. Comprehensive API Configuration Validation

**Script:** `scripts/validate-api-config.sh`

**When it runs:** 
- Manually via `npm run validate:api-config`
- During CI/CD before build (in `deploy-ui.yml`)

**What it validates:**
- ✅ Environment variable presence and format
- ✅ URL component extraction (protocol, host, path)
- ✅ DNS resolution for API host
- ✅ HTTP connectivity to `/health` endpoint
- ✅ CORS preflight response headers
- ✅ Critical endpoints like `/catalog/rubros`
- ✅ Environment file consistency

**How to run manually:**
```bash
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
npm run validate:api-config
```

**Skip connectivity checks (for offline builds):**
```bash
export SKIP_CONNECTIVITY_CHECK=true
npm run validate:api-config
```

**Output sections:**
1. Environment Variable Validation
2. URL Component Validation
3. Network Connectivity Tests
4. Build Environment File Validation
5. Summary with actionable recommendations

### 3. Post-Deployment Verification

**Script:** `scripts/post-deploy-verify.sh`

**When it runs:**
- Automatically after CloudFront deployment (in `deploy-ui.yml`)
- Manually after any deployment

**What it validates:**
- ✅ CloudFront UI is accessible at `/finanzas/`
- ✅ HTML contains correct base paths (`/finanzas/assets/`)
- ✅ Static assets (JS/CSS) load with HTTP 200
- ✅ API endpoints are reachable
- ✅ API URL is embedded in the frontend bundle
- ✅ S3 bucket contains expected files (optional)

**How to run manually:**
```bash
export CLOUDFRONT_DOMAIN=d7t9x3j66yd8k.cloudfront.net
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
export S3_BUCKET=ukusi-ui-finanzas-prod
bash scripts/post-deploy-verify.sh
```

## CI/CD Integration

### GitHub Actions Workflow (`deploy-ui.yml`)

The deployment workflow includes multiple validation gates:

#### Phase 1: Pre-Build Validation
```yaml
- name: Compute API base URL
  # Derives VITE_API_BASE_URL from repo variables
  
- name: Preflight API health
  # Quick check that /health returns 200
  
- name: Comprehensive API Configuration Validation
  # Runs scripts/validate-api-config.sh
  # BLOCKS build if validation fails
```

#### Phase 2: Build
```yaml
- name: Build Finanzas SDT Portal
  # Pre-build validation runs automatically
  # Build fails if VITE_API_BASE_URL is missing
```

#### Phase 3: Bundle Verification
```yaml
- name: Verify API URL embedded in Finanzas bundle
  # Searches dist-finanzas/ for VITE_API_BASE_URL
  # BLOCKS deployment if URL is not found
```

#### Phase 4: Post-Deployment Verification
```yaml
- name: Post-Deployment Comprehensive Verification
  # Runs scripts/post-deploy-verify.sh
  # Validates deployed UI and API connectivity
```

### Release Gates

**Deployment will FAIL if:**
- ❌ `VITE_API_BASE_URL` is not set or empty
- ❌ API `/health` endpoint is unreachable (non-200 status)
- ❌ API URL is not found in the built bundle
- ❌ CloudFront UI returns non-200 status
- ❌ Static assets fail to load

**This ensures:**
- ✅ Never deploy a broken frontend without API connectivity
- ✅ Catch environment configuration errors early
- ✅ Verify actual deployed artifacts, not just code

## Environment Setup

### Local Development

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **The `.env.development` file has defaults:**
   ```bash
   VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   ```

3. **Override in `.env.local` if needed:**
   ```bash
   # For local API development
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

4. **Validate before building:**
   ```bash
   npm run validate:api-config
   npm run build:finanzas
   ```

### CI/CD (GitHub Actions)

1. **Set repository variable `DEV_API_URL`:**
   - Go to: Repository → Settings → Secrets and variables → Actions → Variables
   - Add: `DEV_API_URL` = `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`

2. **The workflow uses this variable:**
   ```yaml
   env:
     VITE_API_BASE_URL: ${{ vars.DEV_API_URL }}
   ```

3. **Validation runs automatically** before and after deployment

### Production

1. **Use environment-specific values:**
   - Dev: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
   - Prod: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod`

2. **Set via deployment environment:**
   ```bash
   VITE_API_BASE_URL=https://... BUILD_TARGET=finanzas npm run build
   ```

## Troubleshooting

### Error: "VITE_API_BASE_URL is not set for Finanzas build"

**Cause:** The environment variable is missing.

**Fix:**
```bash
# Set the variable
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# Or add to .env.local
echo "VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev" >> .env.local

# Then rebuild
npm run build:finanzas
```

### Error: "DNS resolution failed"

**Cause:** The API hostname cannot be resolved.

**Check:**
```bash
# Test DNS resolution
host m3g6am67aj.execute-api.us-east-2.amazonaws.com

# Or use dig
dig m3g6am67aj.execute-api.us-east-2.amazonaws.com
```

**Fix:**
- Check network connectivity
- Verify API ID is correct
- Check AWS region is correct

### Error: "API /health preflight failed"

**Cause:** The API endpoint is not responding.

**Check:**
```bash
# Test API directly
curl -i https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# Check API Gateway deployment status
aws apigateway get-deployments --rest-api-id m3g6am67aj --region us-east-2
```

**Fix:**
- Deploy API Gateway
- Check API stage name is correct
- Verify AWS credentials have access

### Error: "API URL not found in bundle"

**Cause:** The build process did not inject `VITE_API_BASE_URL`.

**Check:**
```bash
# Verify environment variable is set during build
echo $VITE_API_BASE_URL

# Check if it's in the bundle
grep -r "m3g6am67aj" dist-finanzas/
```

**Fix:**
- Ensure `VITE_API_BASE_URL` is exported before build
- Check `vite.config.ts` is injecting the value
- Rebuild with correct environment variable

### Browser Error: "Failed to fetch"

**Cause:** Frontend cannot connect to API.

**Check:**
1. Open DevTools → Network tab
2. Find failed API request
3. Copy request URL
4. Test in new tab or with curl

**Common causes:**
- CORS not configured on API Gateway
- API Gateway not deployed
- Wrong API URL in bundle
- Network/firewall blocking request

**Fix:**
```bash
# Verify API is accessible
curl -i https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# Check CORS headers
curl -i -X OPTIONS \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# Should see Access-Control-Allow-Origin header
```

## Best Practices

### 1. Always Validate Before Building

```bash
# Run validation first
npm run validate:api-config

# Then build
npm run build:finanzas
```

### 2. Use Environment-Specific Values

```bash
# Development
export VITE_API_BASE_URL=https://...amazonaws.com/dev

# Production
export VITE_API_BASE_URL=https://...amazonaws.com/prod
```

### 3. Verify After Deployment

```bash
# Run post-deployment checks
bash scripts/post-deploy-verify.sh
```

### 4. Document Environment Variables

Always document in `.env.example`:
```bash
# ⚠️ REQUIRED: Finanzas API Base URL
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
```

### 5. Use CI/CD Validation Gates

Never skip validation in CI/CD:
```yaml
- name: Validate API Configuration
  run: npm run validate:api-config
  # This step MUST pass before deployment
```

## Smoke Testing

For end-to-end validation with authentication:

```bash
# Set credentials
export USERNAME="christian.valencia@ikusi.com"
export PASSWORD="Velatia@2025"

# Run smoke tests
npm run smoke:api
```

This validates:
- ✅ Cognito authentication
- ✅ Public endpoints
- ✅ Protected endpoints
- ✅ Lambda → DynamoDB wiring
- ✅ Data persistence

## Checklist for New Deployments

Before deploying to a new environment:

- [ ] Set `VITE_API_BASE_URL` (or `DEV_API_URL` repo variable)
- [ ] Run `npm run validate:api-config` locally
- [ ] Verify API Gateway is deployed and `/health` returns 200
- [ ] Check CORS configuration on API Gateway
- [ ] Build with `npm run build:finanzas`
- [ ] Deploy to S3 + CloudFront
- [ ] Run `bash scripts/post-deploy-verify.sh`
- [ ] Test in browser - no "Failed to fetch" errors
- [ ] Run `npm run smoke:api` for E2E validation

## Summary

This validation infrastructure ensures:

1. **Build-time validation** prevents builds without API configuration
2. **Pre-deployment validation** verifies API is accessible before deploying UI
3. **Post-deployment validation** confirms deployed UI can reach API
4. **Release gates** block broken deployments from reaching production
5. **Clear error messages** guide developers to fix issues quickly

**Result:** No more "Failed to fetch" errors in production due to missing or incorrect API configuration.
