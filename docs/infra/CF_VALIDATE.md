# CloudFront Validation Guide

## Overview

This document describes the validation strategy for the dual-SPA deployment architecture where:
- **PMO Portal** is deployed from the `acta-ui` repository to `acta-ui-frontend-prod` bucket and served at the root `/` with assets under `/assets/*`
- **Finanzas Portal** is deployed from the `financial-planning-u` repository to `ukusi-ui-finanzas-prod` bucket and served at `/finanzas/` with assets under `/finanzas/assets/*`

Both portals are served through a single CloudFront distribution with multiple origins and cache behaviors.

## Repository Ownership

⚠️ **CRITICAL: Deployment Separation**

- **acta-ui repository**: 
  - Owns and deploys PMO Portal exclusively
  - Deploys to `acta-ui-frontend-prod` S3 bucket (root `/`)
  - Has its own build and deployment pipeline
  
- **financial-planning-u repository** (this repo):
  - Owns and deploys Finanzas Portal exclusively
  - Deploys to `ukusi-ui-finanzas-prod` S3 bucket (`/finanzas/` prefix)
  - **Does NOT build or deploy PMO Portal**
  - **Does NOT touch `acta-ui-frontend-prod` bucket**

This separation ensures:
- No risk of one repo overwriting the other's deployments
- Clear ownership boundaries
- Independent deployment pipelines
- PMO and Finanzas can be updated independently

## Architecture Constraints

### CloudFront Distribution (Read-Only in this Lane)
- **Distribution ID**: Managed via repository variables (`CLOUDFRONT_DIST_ID`)
- **Origins**: 
  - PMO S3 bucket (`acta-ui-frontend-prod`) - managed by acta-ui repo
  - Finanzas S3 bucket (`ukusi-ui-finanzas-prod`) - managed by this repo
- **Cache Behaviors**:
  - Default behavior: Routes to PMO origin
  - `/finanzas/*` behavior: Routes to Finanzas origin with CloudFront function for SPA routing

⚠️ **These CloudFront settings are NOT modified by the deployment workflow** - they are pre-configured infrastructure.

### S3 Buckets (Read-Only Structure)
- **PMO Bucket** (`acta-ui-frontend-prod`): Content uploaded to root of bucket by acta-ui repo
- **Finanzas Bucket** (`ukusi-ui-finanzas-prod`): Content uploaded to `/finanzas/` prefix within bucket by this repo

⚠️ **Bucket names and structure are NOT modified** - only the workflow uploads content to the Finanzas bucket.

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
- `BUILD_TARGET=pmo` → builds to `dist-pmo/` with `base: "/"` (not used by this repo anymore)
- `BUILD_TARGET=finanzas` → builds to `dist-finanzas/` with `base: "/finanzas/"`
- The `base` setting controls how Vite generates asset paths in the HTML

### Build Commands
```bash
# PMO build (not used in this repo - acta-ui repo handles PMO)
BUILD_TARGET=pmo npm run build  # → dist-pmo/ with /assets/* paths

# Finanzas build (this repo only builds Finanzas)
BUILD_TARGET=finanzas npm run build  # → dist-finanzas/ with /finanzas/assets/* paths
```

## CI/CD Validation Guards

The deployment workflow (`.github/workflows/deploy-ui.yml`) includes automated guards to prevent misconfigurations:

### 1. Finanzas Artifact Guard
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

**Note**: PMO artifact guard has been removed from this repo as PMO is built by acta-ui repo.

## Manual Validation

### Inspecting Deployed HTML

You can verify correct deployment using curl:

```bash
# PMO at root (deployed by acta-ui repo)
curl -sS https://d7t9x3j66yd8k.cloudfront.net/ | head -40

# Expected output should include:
# - <title>...PMO...</title>
# - <script src="/assets/index-xxx.js">

# Finanzas at /finanzas/ (deployed by this repo)
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

**Check 1: Repository Ownership**
Ensure PMO is being deployed by the correct repository (acta-ui), not this one.

**Check 2: Asset Paths**
```bash
curl -sS https://domain.cloudfront.net/ | grep -E 'src=|href='
# Should show /assets/* NOT /finanzas/assets/*
```

**Check 3: Browser Console**
Open DevTools console at `/` and look for:
- 404 errors loading assets
- JavaScript errors indicating missing modules
- Router configuration issues

**Check 4: S3 Bucket**
Verify PMO bucket has the correct content:
```bash
aws s3 ls s3://acta-ui-frontend-prod/
# Should show index.html and assets/ from acta-ui repo
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

✅ **PMO at `/` works** (deployed by acta-ui repo):
- No white screen
- Assets load from `/assets/*`
- Console free of fatal errors
- Deployed independently from this repo

✅ **Finanzas at `/finanzas/` works** (deployed by this repo):
- Loads correctly
- Deep links function (via CloudFront function)
- Assets load from `/finanzas/assets/*`
- Console free of fatal errors

✅ **CI Guards Pass**:
- Finanzas guard prevents `/assets/*` in Finanzas build
- CloudFront behavior verification passes

✅ **No Infrastructure Changes**:
- CloudFront distribution config unchanged
- S3 bucket structure unchanged
- Only Finanzas workflow and build guards are active in this repo

✅ **Clear Separation**:
- This repo only deploys to `ukusi-ui-finanzas-prod`
- This repo does NOT touch `acta-ui-frontend-prod`
- PMO and Finanzas deployments are independent

## References

- **vite.config.ts**: Build configuration with conditional base paths
- **.github/workflows/deploy-ui.yml**: Deployment workflow with artifact guards
- **CLOUDFRONT_FIX_SUMMARY.md**: Historical context on CloudFront setup
- **src/App.tsx**: React Router basename configuration
