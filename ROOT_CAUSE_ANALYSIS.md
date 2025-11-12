# 🔍 ROOT CAUSE ANALYSIS & CORRECTIVE ACTION PLAN

## Problem Statement

- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` serves the **PMO application** instead of Finanzas
- Expected: Finanzas SPA with title "Finanzas SDT" and assets at `/finanzas/assets/*`
- Actual: PMO SPA with title "Ikusi · PMO Platform" and assets at `/assets/`

## Root Cause (CRITICAL)

### 1. Wrong S3 Bucket Configuration for PMO Upload

The deployment workflow uploads **PMO to the Finanzas S3 bucket** instead of the PMO-specific bucket.

**Current (WRONG):**

```yaml
S3_BUCKET_NAME: ukusi-ui-finanzas-prod  # Used for BOTH PMO and Finanzas
- Upload PMO  → s3://ukusi-ui-finanzas-prod/         ❌ WRONG
- Upload Finanzas → s3://ukusi-ui-finanzas-prod/finanzas/  ✓ CORRECT
```

**Should be:**

```yaml
PMO_BUCKET:     acta-ui-frontend-prod         ✓ Correct for PMO
FINANZAS_BUCKET: ukusi-ui-finanzas-prod       ✓ Correct for Finanzas
- Upload PMO     → s3://acta-ui-frontend-prod/       ✓ CORRECT
- Upload Finanzas → s3://ukusi-ui-finanzas-prod/finanzas/ ✓ CORRECT
```

### 2. CloudFront Origins Mismatch

The CloudFront distribution is correctly configured with TWO separate origins:

- **Default (\*)** behavior → Origin: `acta-ui-frontend-prod` (PMO)
- **/finanzas/\* ** behavior → Origin: `ukusi-ui-finanzas-prod` (Finanzas)

But because PMO is being uploaded to the **Finanzas bucket**, the Default behavior is serving Finanzas bucket content (which happens to be the PMO app that was uploaded there).

## Evidence of Misconfiguration

1. **HTML Title Check:**

   ```bash
   curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -5
   # Expected: "Finanzas SDT" or similar
   # Actual:   "Ikusi · PMO Platform" ❌
   ```

2. **Asset Path Check:**

   ```bash
   curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep -o 'src="/assets/'
   # Expected: (no match; should be /finanzas/assets/)
   # Actual: src="/assets/ ❌
   ```

3. **S3 Bucket Content:**
   - `s3://ukusi-ui-finanzas-prod/` contains PMO app (index.html with PMO title)
   - `s3://ukusi-ui-finanzas-prod/finanzas/` contains Finanzas app (correct)

## Corrective Actions (REQUIRED)

### Step 1: Fix the Deployment Workflow

Update `.github/workflows/deploy-ui.yml` to use separate S3 buckets:

```yaml
env:
  # Add separate bucket variables
  PMO_BUCKET_NAME: acta-ui-frontend-prod
  FINANZAS_BUCKET_NAME: ukusi-ui-finanzas-prod

# In "Upload PMO Portal" step:
- name: "Upload PMO Portal to S3 (root /)"
  run: |
    aws s3 sync dist-pmo/ "s3://${PMO_BUCKET_NAME}/" ...

# In "Upload Finanzas Portal" step:
- name: "Upload Finanzas Portal to S3 (/finanzas prefix)"
  run: |
    aws s3 sync dist-finanzas/ "s3://${FINANZAS_BUCKET_NAME}/finanzas/" ...
```

### Step 2: Clean Up S3 Buckets

```bash
# Remove PMO app from Finanzas bucket (keep only /finanzas/ prefix)
aws s3 rm s3://ukusi-ui-finanzas-prod/ --recursive --exclude "finanzas/*"

# Verify only /finanzas/ content remains
aws s3 ls s3://ukusi-ui-finanzas-prod/ --recursive
# Should show ONLY: finanzas/index.html, finanzas/assets/...
```

### Step 3: Ensure PMO Bucket Has PMO App

```bash
# Verify PMO bucket has root-level content
aws s3 ls s3://acta-ui-frontend-prod/ --recursive
# Should show: index.html, assets/..., etc at root level
```

### Step 4: Clear CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/*' '/finanzas/*' '/finanzas/index.html'
```

### Step 5: Validate

```bash
# Test PMO root
curl -s https://d7t9x3j66yd8k.cloudfront.net/ | head -5
# Expected: "Ikusi · PMO Platform"

# Test Finanzas
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | head -5
# Expected: "Finanzas SDT" (or appropriate Finanzas title)

# Verify assets paths
curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep 'src="/finanzas/assets/'
# Expected: Match found (assets correctly prefixed)
```

## Why Previous Actions Didn't Work

1. **CloudFront Function:** Correctly rewrites paths, but can't fix bucket content being wrong
2. **Origin Path Setting:** Setting `OriginPath=/finanzas` tells CF to look for `/finanzas` prefix in the bucket, but that bucket had PMO at root
3. **Cache Invalidation:** Just cleared cache; didn't fix the underlying data

## Next Steps

1. ✅ Update `.github/workflows/deploy-ui.yml` with correct bucket assignments
2. ✅ Clean up S3 buckets
3. ✅ Run workflow or manual deploy
4. ✅ Validate with curl tests
5. ✅ Test login flow
6. ✅ Create Evidence Pack with screenshots and curl output
