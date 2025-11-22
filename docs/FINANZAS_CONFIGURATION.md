# Finanzas Module Configuration Guide

This document provides comprehensive configuration instructions for the Finanzas (Service Delivery Management & Tracking) frontend module.

## Table of Contents

- [Overview](#overview)
- [Required Configuration](#required-configuration)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [CI/CD Configuration](#cicd-configuration)
- [Build System](#build-system)
- [Troubleshooting](#troubleshooting)

## Overview

The Finanzas frontend is a React + Vite application that requires specific configuration to connect to the backend API. The most critical configuration is **`VITE_API_BASE_URL`**, which specifies the API Gateway endpoint.

### Key Points

- ✅ `VITE_API_BASE_URL` is **REQUIRED** - build will fail without it
- ✅ Configuration is validated at both **build time** and **runtime**
- ✅ Clear error messages guide developers when configuration is missing
- ✅ Different environments use different API endpoints

## Required Configuration

### VITE_API_BASE_URL

**Purpose:** Specifies the base URL for all API calls from the Finanzas frontend.

**Format:** Full URL without trailing slash
```bash
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
```

**When it's checked:**
1. **Build time** - `vite.config.ts` throws error if missing for Finanzas builds
2. **Runtime** - `src/config/env.ts` logs clear error messages
3. **API calls** - `src/api/finanzasClient.ts` throws when attempting to call API

**Where to set it:**
- **Local dev:** `.env.development` (default) or `.env.local` (your override)
- **CI/CD:** Environment variable in GitHub Actions workflow
- **Manual build:** Export as shell environment variable before running build

## Environment Variables

### Complete List

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | ✅ Yes | None | API Gateway base URL |
| `VITE_COGNITO_REGION` | ✅ Yes | `us-east-2` | AWS region for Cognito |
| `VITE_COGNITO_USER_POOL_ID` | ✅ Yes | `us-east-2_FyHLtOhiY` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | ✅ Yes | `dshos5iou44tuach7ta3ici5m` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | ✅ Yes | See below | Cognito Hosted UI domain |
| `VITE_AWS_REGION` | No | `us-east-2` | AWS region for general services |
| `VITE_FINZ_ENABLED` | No | `true` | Enable Finanzas module |
| `VITE_ENVIRONMENT` | No | `development` | Environment name (dev/staging/prod) |
| `BUILD_TARGET` | No | `finanzas` | Build target (finanzas or pmo) |

### Cognito Domain Format

The Cognito domain is required for OAuth Hosted UI authentication:

```bash
VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com
```

**Important notes:**
- Must NOT include `https://` prefix
- Domain prefix (`us-east-2fyhltohiy`) must match your Cognito User Pool configuration
- For this production deployment: `us-east-2fyhltohiy` (no hyphen after region)

### Cognito OAuth Configuration

The Finanzas module uses AWS Cognito Hosted UI for authentication. The following settings must be configured in both your environment variables AND the AWS Cognito console:

#### Environment Variables

```bash
# Required for Cognito authentication
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com

# Required for OAuth redirects
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
```

#### AWS Cognito App Client Settings

In the AWS Cognito console, your app client (`Ikusi-acta-ui-web`) must have:

**OAuth 2.0 Grant Types:**
- ✅ Authorization code grant (enabled)
- ✅ Implicit grant (enabled) - **Required for token delivery in URL hash**

**Allowed callback URLs:**
```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
```

**Allowed sign-out URLs:**
```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
https://d7t9x3j66yd8k.cloudfront.net/finanzas/login
```

**OpenID Connect scopes:**
- ✅ openid (required for id_token)
- ✅ email
- ✅ profile
- ✅ aws.cognito.signin.user.admin

**Response type used by application:**
- `token id_token` (space-separated, URL-encoded as `token%20id_token`)
- This delivers both id_token and access_token in the URL hash fragment

#### Authentication Flow

1. User clicks "Sign in with Cognito Hosted UI" on login page
2. Browser redirects to Cognito Hosted UI at:
   ```
   https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/oauth2/authorize?
     client_id=dshos5iou44tuach7ta3ici5m&
     response_type=token%20id_token&
     scope=openid%20email%20profile%20aws.cognito.signin.user.admin&
     redirect_uri=https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
   ```
3. User authenticates with Cognito
4. Cognito redirects back to callback.html with tokens in URL hash:
   ```
   https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html#
     id_token=eyJraWQi...&
     access_token=eyJraWQi...&
     token_type=Bearer&
     expires_in=3600
   ```
5. `callback.html` extracts tokens, stores in localStorage, and redirects to `/finanzas/`
6. React app boots, reads tokens from localStorage, and shows authenticated UI

#### Troubleshooting OAuth Errors

If you see `unauthorized_client` or `invalid_request` errors:

1. **Verify Implicit Grant is enabled** in Cognito app client settings
2. **Check response_type** in `src/config/aws.ts` is `"token id_token"`
3. **Verify redirect URIs** in Cognito match exactly (including trailing slash)
4. **Verify scopes** include `openid` (required for id_token)
5. **Check CloudFront URL** environment variable is set correctly

For detailed authentication troubleshooting, see [AUTHENTICATION_FLOW.md](../AUTHENTICATION_FLOW.md).

## Local Development Setup

### Step-by-Step

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CVDExInfo/financial-planning-u.git
   cd financial-planning-u
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Configure environment (Option A - Use defaults):**
   
   The `.env.development` file provides safe defaults for local development:
   ```bash
   # No action needed - defaults are ready to use!
   npm run dev
   ```

4. **Configure environment (Option B - Custom config):**
   
   Create `.env.local` to override defaults:
   ```bash
   cp .env.example .env.local
   
   # Edit .env.local and set your values
   nano .env.local
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   ```
   http://localhost:5173/finanzas/
   ```

### Using Local API

If you're running the Finanzas API locally, create `.env.local`:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:3000/api
```

## CI/CD Configuration

### GitHub Actions

The deployment workflow (`.github/workflows/deploy-ui.yml`) handles configuration automatically:

**Key sections:**

```yaml
# 1. Variable is sourced from GitHub repository variables
env:
  DEV_API_URL: ${{ vars.DEV_API_URL }}

# 2. Computed and set before build
- name: Compute API base URL
  run: |
    # Uses DEV_API_URL if set, otherwise constructs from API ID
    BASE="${DEV_API_URL}"
    echo "VITE_API_BASE_URL=$BASE" >> "$GITHUB_ENV"

# 3. Used during build
- name: Build Finanzas SDT Portal
  env:
    VITE_API_BASE_URL: ${{ vars.DEV_API_URL }}
  run: |
    BUILD_TARGET=finanzas npm run build

# 4. Verified after build
- name: Verify API URL embedded in bundle
  run: |
    if ! grep -R "$VITE_API_BASE_URL" dist-finanzas; then
      echo "❌ VITE_API_BASE_URL not found in bundle"
      exit 1
    fi
```

### Setting GitHub Repository Variables

To configure for your deployment:

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Under **Variables** tab, set:
   - `DEV_API_URL`: Your dev API endpoint
   - `PROD_API_URL`: Your production API endpoint (if different)
   - `FINZ_API_ID`: API Gateway ID (e.g., `m3g6am67aj`)

## Build System

### Build Modes

The project supports dual-SPA builds:

```bash
# Build Finanzas (requires VITE_API_BASE_URL)
npm run build:finanzas

# Build PMO (VITE_API_BASE_URL optional)
npm run build:pmo

# Default build (alias for build:finanzas)
npm run build
```

### Build Target Selection

Controlled via `BUILD_TARGET` environment variable:

```bash
# Finanzas build (requires VITE_API_BASE_URL)
BUILD_TARGET=finanzas npm run build

# PMO build
BUILD_TARGET=pmo npm run build
```

### Build-time Validation

The build system (`vite.config.ts`) validates configuration:

```typescript
// Fail fast during build instead of shipping a broken bundle
if (!isPmo && !apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not set for Finanzas build.");
}
```

**Output directories:**
- Finanzas: `dist-finanzas/`
- PMO: `dist-pmo/`

## Troubleshooting

### Build Fails: "VITE_API_BASE_URL is not set"

**Error message:**
```
[Vite][Finanzas] ❌ VITE_API_BASE_URL is empty.
Error: VITE_API_BASE_URL is not set for Finanzas build.
```

**Cause:** Missing or empty `VITE_API_BASE_URL` environment variable.

**Fix:**
```bash
# Check current value
echo $VITE_API_BASE_URL

# Set and build
export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
npm run build:finanzas
```

### Runtime Error: Configuration Error Box

**Symptoms:** Large error message in browser console with configuration instructions.

**Cause:** Frontend bundle was built without `VITE_API_BASE_URL` injected.

**Fix:** 
1. Ensure `VITE_API_BASE_URL` is set at build time
2. Rebuild the application
3. Clear browser cache and refresh

### API Calls Return 404

**Symptoms:** All API calls fail with 404 Not Found.

**Possible causes:**
1. Wrong API endpoint URL
2. API not deployed
3. API stage mismatch

**Debugging:**
```bash
# 1. Check what URL is configured
# Look in browser DevTools console for: [env.ts] API_BASE configured

# 2. Test API directly
curl https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# 3. Expected response:
# {"ok":true,"stage":"dev","time":"..."}
```

### CORS Errors

**Symptoms:** Browser console shows CORS policy errors.

**Cause:** API Gateway CORS configuration doesn't allow your origin.

**Fix:**
1. Check API Gateway CORS settings
2. For local dev, ensure `http://localhost:5173` is in allowed origins
3. For production, ensure CloudFront domain is in allowed origins

### Token/Auth Issues

**Symptoms:** API returns 401 Unauthorized.

**Cause:** Missing or invalid authentication token.

**Fix:**
1. Open DevTools → Application → Local Storage
2. Check for `cv.jwt` or `finz_jwt` keys
3. If missing, log in again
4. If present but expired, clear storage and log in again

See [AUTHENTICATION_FLOW.md](../AUTHENTICATION_FLOW.md) for detailed authentication troubleshooting.

## Additional Resources

- [Main README](../README.md) - General project documentation
- [Authentication Flow](../AUTHENTICATION_FLOW.md) - Detailed auth documentation
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [API Contract](../openapi/finanzas.yaml) - OpenAPI specification
- [GitHub Actions Workflow](../.github/workflows/deploy-ui.yml) - CI/CD pipeline

## Support

For issues or questions:

1. Check this troubleshooting guide
2. Review [GitHub Issues](https://github.com/CVDExInfo/financial-planning-u/issues)
3. Contact the development team

---

**Last Updated:** November 2025  
**Maintainer:** PMO Platform Team
