# CloudFront Validation Guide

## Overview

This document describes the validation strategy for the dual-SPA deployment architecture where:
- **PMO Portal** is served at the root `/` with assets under `/assets/*`
- **Finanzas Portal** is served at `/finanzas/` with assets under `/finanzas/assets/*`

Both portals are served through a single CloudFront distribution with multiple origins and cache behaviors.

## Architecture Constraints

### CloudFront Distribution (Read-Only in this Lane)
- **Distribution ID**: Managed via repository variables (`CLOUDFRONT_DIST_ID`)
- **Origins**: 
  - PMO S3 bucket (root content)
  - Finanzas S3 bucket (finanzas content)
- **Cache Behaviors**:
  - Default behavior: Routes to PMO origin
  - `/finanzas/*` behavior: Routes to Finanzas origin with CloudFront function for SPA routing

⚠️ **These CloudFront settings are NOT modified by the deployment workflow** - they are pre-configured infrastructure.

### S3 Buckets (Read-Only Structure)
- **PMO Bucket**: Content uploaded to root of bucket
- **Finanzas Bucket**: Content uploaded to `/finanzas/` prefix within bucket

⚠️ **Bucket names and structure are NOT modified** - only the workflow uploads content to existing buckets.

## Build Configuration

### Vite Configuration (`vite.config.ts`)
The build system uses the `BUILD_TARGET` environment variable to determine the base path:

```typescript
const buildTarget = process.env.BUILD_TARGET || "finanzas";
const isPmo = buildTarget === "pmo";

const publicBase = process.env.VITE_PUBLIC_BASE || (isPmo ? "/" : "/finanzas/");

export default defineConfig(() => {
  return {
    base: publicBase,
    build: {
      outDir: isPmo ? "dist-pmo" : "dist-finanzas",
    },
    // ... other config
  };
});
```

**Key Points**:
- `BUILD_TARGET=pmo` → builds to `dist-pmo/` with `base: "/"`
- `BUILD_TARGET=finanzas` → builds to `dist-finanzas/` with `base: "/finanzas/"`
- The `base` setting controls how Vite generates asset paths in the HTML

### Build Commands
```bash
# PMO build
BUILD_TARGET=pmo npm run build  # → dist-pmo/ with /assets/* paths

# Finanzas build  
BUILD_TARGET=finanzas npm run build  # → dist-finanzas/ with /finanzas/assets/* paths
```

## CI/CD Validation Guards

The deployment workflow (`.github/workflows/deploy-ui.yml`) includes automated guards to prevent misconfigurations:

### 1. PMO Artifact Guard
**Location**: After PMO build step

```yaml
- name: Guard - PMO build artifacts
  run: |
    set -euo pipefail
    if grep -R -nE 'src="/finanzas/assets/|href="/finanzas/assets/' dist-pmo/index.html; then
      echo "❌ dist-pmo/index.html points to /finanzas/assets/* (PMO must use /assets/*)";
      exit 1;
    fi
    echo "✅ PMO build artifacts look good"
```

**Purpose**: Ensures PMO build doesn't accidentally use Finanzas asset paths.

**What it checks**:
- Scans `dist-pmo/index.html` for any references to `/finanzas/assets/`
- Fails the build if found, preventing deployment of misconfigured PMO

### 2. Finanzas Artifact Guard
**Location**: After Finanzas build step

```yaml
- name: Guard - Finanzas build artifacts
  run: |
    set -euo pipefail
    if grep -R -nE 'src="/assets/|href="/assets/' dist-finanzas/index.html; then
      echo "❌ dist-finanzas/index.html points to /assets/* (missing base '/finanzas/')";
      exit 1;
    fi
    if grep -R -i 'github\.dev\|codespaces' dist-finanzas/ 2>/dev/null; then
      echo "❌ Build contains github.dev/codespaces references"; exit 1;
    fi
    echo "✅ Finanzas build artifacts look good"
```

**Purpose**: Ensures Finanzas build has correct base path and no dev references.

**What it checks**:
- Scans `dist-finanzas/index.html` for root `/assets/` paths (should be `/finanzas/assets/`)
- Checks for development environment references (github.dev, codespaces)
- Fails the build if issues found

## Manual Validation

### Inspecting Deployed HTML

You can verify correct deployment using curl:

```bash
# PMO at root
curl -sS https://d7t9x3j66yd8k.cloudfront.net/ | head -40

# Expected output should include:
# - <title>...PMO...</title>
# - <script src="/assets/index-xxx.js">

# Finanzas at /finanzas/
curl -sS https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -40

# Expected output should include:
# - <title>...Finanzas...</title>  (if differentiated)
# - <script src="/finanzas/assets/index-xxx.js">
```

### Checking Asset Loading

In browser DevTools Network tab:
- PMO assets should load from paths like: `https://domain.cloudfront.net/assets/index-xxx.js`
- Finanzas assets should load from: `https://domain.cloudfront.net/finanzas/assets/index-xxx.js`

### Verifying CloudFront Behavior

The workflow includes a guard to verify the `/finanzas/*` cache behavior exists:

```yaml
- name: Guard - Verify CloudFront /finanzas/* Behavior (CRITICAL)
  run: |
    set -euo pipefail
    BEHAVIOR_COUNT=$(aws cloudfront get-distribution-config \
      --id "${CLOUDFRONT_DIST_ID}" \
      --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`] | length(@)' \
      --output text)
    if [ "$BEHAVIOR_COUNT" != "1" ]; then
      echo "❌ CRITICAL: /finanzas/* behavior missing"; exit 1;
    fi
    echo "✅ /finanzas/* behavior configured"
```

This is a **read-only check** - it verifies the expected CloudFront configuration exists but does not modify it.

## Troubleshooting

### PMO Shows White Screen

**Check 1: Asset Paths**
```bash
curl -sS https://domain.cloudfront.net/ | grep -E 'src=|href='
# Should show /assets/* NOT /finanzas/assets/*
```

**Check 2: Browser Console**
Open DevTools console at `/` and look for:
- 404 errors loading assets
- JavaScript errors indicating missing modules
- Router configuration issues

**Check 3: Build Artifacts**
Locally verify the build:
```bash
BUILD_TARGET=pmo npm run build
cat dist-pmo/index.html
# Should reference /assets/* paths
```

### Finanzas Shows PMO Content

**Check 1: CloudFront Behavior**
Verify `/finanzas/*` behavior routes to correct origin:
```bash
aws cloudfront get-distribution-config --id YOUR_ID \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`]'
```

**Check 2: S3 Upload Path**
Verify Finanzas content is uploaded to the correct S3 prefix:
```bash
aws s3 ls s3://YOUR_FINANZAS_BUCKET/finanzas/
# Should show index.html and assets/
```

### Assets Return 403/404

**Check 1: S3 Bucket Policy**
Ensure CloudFront has read access to both buckets via Origin Access Identity (OAI) or Origin Access Control (OAC).

**Check 2: Cache Invalidation**
After deployment, caches are invalidated:
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_ID \
  --paths '/*' '/finanzas/*' '/finanzas/index.html'
```

The workflow does this automatically, but you can manually trigger if needed.

## GREEN Criteria

✅ **PMO at `/` works**:
- No white screen
- Assets load from `/assets/*`
- Console free of fatal errors

✅ **Finanzas at `/finanzas/` works**:
- Loads correctly
- Deep links function (via CloudFront function)
- Assets load from `/finanzas/assets/*`
- Console free of fatal errors

✅ **CI Guards Pass**:
- PMO guard prevents `/finanzas/assets/*` in PMO build
- Finanzas guard prevents `/assets/*` in Finanzas build
- CloudFront behavior verification passes

✅ **No Infrastructure Changes**:
- CloudFront distribution config unchanged
- S3 bucket structure unchanged
- Only workflow and build guards modified

## References

- **vite.config.ts**: Build configuration with conditional base paths
- **.github/workflows/deploy-ui.yml**: Deployment workflow with artifact guards
- **CLOUDFRONT_FIX_SUMMARY.md**: Historical context on CloudFront setup
- **src/App.tsx**: React Router basename configuration
