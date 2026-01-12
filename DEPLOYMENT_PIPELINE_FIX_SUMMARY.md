# Deployment Pipeline Fix - Index.html and CDN Cache Issue

## Executive Summary

This document summarizes the fix implemented to resolve the issue where the Finanzas UI was not reflecting the latest code changes after deployment. The root cause was that the SPA shell (`index.html`) was either stale or cached, causing browsers to load old bundle names even though new assets were uploaded to S3.

## Problem Statement

### Symptoms
- UI on `https://d7t9x3j66yd8k.cloudfront.net/finanzas` did not reflect latest code changes
- New assets were present in S3 (`finanzas/assets/index-*.js`)
- `index.html` appeared stale or was being served from CloudFront cache
- Users saw old UI even after successful deployments

### Root Causes
1. **No Cache Headers**: Files uploaded without proper cache-control headers
2. **Race Condition**: `index.html` uploaded simultaneously with assets
3. **No Verification**: No checks to ensure `index.html` references exist in S3
4. **Incomplete Invalidation**: CloudFront invalidation didn't wait for completion
5. **No CDN Verification**: No checks that CloudFront serves updated `index.html`

## Solution Overview

### Atomic Deployment Strategy

The fix implements a 4-step atomic deployment process:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Upload Hashed Assets                                │
│ - Path: /finanzas/assets/*                                   │
│ - Cache-Control: public, max-age=31536000, immutable        │
│ - Why first: Ensures assets are available before index.html │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Upload Static Files                                 │
│ - Paths: /finanzas/auth/*, favicon, etc.                    │
│ - Cache-Control: public, max-age=3600                       │
│ - Why second: Non-critical files, moderate cache OK         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Upload index.html LAST                              │
│ - Path: /finanzas/index.html                                │
│ - Cache-Control: no-cache, must-revalidate                  │
│ - Why last: Ensures it only references uploaded assets      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Cleanup Stale Files                                 │
│ - Action: aws s3 sync --delete                              │
│ - Why last: Prevents accidental deletion of new uploads     │
│ - Transparency: Dry-run output shows what will be deleted   │
└─────────────────────────────────────────────────────────────┘
```

### Verification Steps

After upload, the deployment includes comprehensive verification:

```
┌─────────────────────────────────────────────────────────────┐
│ Smoke Test: Verify index.html References                    │
│ 1. Download index.html from S3                              │
│ 2. Extract all JS/CSS asset references                      │
│ 3. Verify each asset exists in S3                           │
│ 4. FAIL if any asset is missing                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CloudFront Invalidation                                      │
│ 1. Invalidate /finanzas/index.html, /finanzas/assets/*, /*  │
│ 2. Wait up to 5 minutes for completion                      │
│ 3. Poll every 10 seconds for status updates                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CloudFront Verification                                      │
│ 1. Fetch index.html from CloudFront                         │
│ 2. Fetch index.html from S3                                 │
│ 3. Compare asset references                                 │
│ 4. FAIL if they differ (CDN cache not updated)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Cache Headers Verification (post-deploy script)             │
│ 1. Check index.html has no-cache header                     │
│ 2. Check hashed assets have long-term cache                 │
│ 3. Warn if headers don't match expected values              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Files Modified

#### 1. `.github/workflows/deploy-ui.yml`

**Changed: Upload Strategy (Lines 439-503)**
```yaml
# Old (single sync with --delete)
aws s3 sync dist-finanzas/ "s3://${BUCKET}/finanzas/" --delete

# New (4-step atomic process)
# Step 1: Assets with immutable cache
aws s3 sync dist-finanzas/assets/ "s3://${BUCKET}/finanzas/assets/" \
  --cache-control 'public, max-age=31536000, immutable'

# Step 2: Static files
aws s3 sync dist-finanzas/ "s3://${BUCKET}/finanzas/" \
  --exclude 'index.html' --exclude 'assets/*' \
  --cache-control 'public, max-age=3600'

# Step 3: index.html LAST
aws s3 cp dist-finanzas/index.html "s3://${BUCKET}/finanzas/index.html" \
  --cache-control 'no-cache, must-revalidate'

# Step 4: Cleanup (with dry-run transparency)
aws s3 sync dist-finanzas/ "s3://${BUCKET}/finanzas/" --delete
```

**Added: Smoke Test Step (Lines 505-557)**
```bash
# Download index.html from S3
aws s3 cp "s3://${BUCKET}/finanzas/index.html" /tmp/s3-index.html

# Extract asset references
grep -oP '(?<=(src|href)=")[^"]*\.(js|css)[^"]*(?=")' /tmp/s3-index.html > /tmp/assets.txt

# Verify each asset exists in S3
for ASSET in $(cat /tmp/assets.txt); do
  aws s3api head-object --bucket "${BUCKET}" --key "finanzas/${ASSET}" || exit 1
done
```

**Changed: CloudFront Invalidation (Lines 615-660)**
```bash
# Old (fire and forget)
aws cloudfront create-invalidation --paths '/*'

# New (wait for completion)
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --paths '/finanzas/index.html' '/finanzas/assets/*' '/*' \
  --query 'Invalidation.Id' --output text)

# Wait up to 5 minutes
for i in {1..30}; do
  STATUS=$(aws cloudfront get-invalidation --id "$INVALIDATION_ID" --query 'Invalidation.Status')
  if [ "$STATUS" = "Completed" ]; then break; fi
  sleep 10
done
```

**Added: CloudFront Verification (Lines 675-729)**
```bash
# Fetch from CloudFront
curl -sS "https://${DOMAIN}/finanzas/" -o /tmp/cf-index.html

# Fetch from S3
aws s3 cp "s3://${BUCKET}/finanzas/index.html" /tmp/s3-index.html

# Compare asset references
diff <(grep -oP 'index-.*\.js' /tmp/cf-index.html) \
     <(grep -oP 'index-.*\.js' /tmp/s3-index.html) || exit 1
```

#### 2. `scripts/post-deploy-verify.sh`

**Added: Cache Headers Verification Section**
```bash
# Check index.html cache headers
curl -I "https://${DOMAIN}/finanzas/" | grep -i 'cache-control' | grep -q 'no-cache'

# Check hashed asset cache headers
curl -I "https://${DOMAIN}/finanzas/assets/index-*.js" | grep -i 'cache-control' | grep -q 'max-age=31536000'
```

### Cache Strategy

| File Type | Cache-Control Header | Rationale |
|-----------|---------------------|-----------|
| `index.html` | `no-cache, must-revalidate` | Always fetch fresh shell, never cache |
| Hashed assets (`*.js`, `*.css`) | `public, max-age=31536000, immutable` | Cache for 1 year, hash changes on content change |
| Static files (auth, favicon) | `public, max-age=3600` | Cache for 1 hour, can be refreshed |

### Verification Matrix

| Verification | When | What | Action on Failure |
|--------------|------|------|-------------------|
| Asset References | After S3 upload | All assets in index.html exist in S3 | FAIL deployment |
| S3 Manifest | After S3 upload | Local build matches S3 | FAIL deployment |
| CloudFront Invalidation | After invalidation | Status is "Completed" | WARN, continue |
| CloudFront Consistency | After invalidation | CF index.html matches S3 | FAIL deployment |
| Cache Headers | Post-deploy script | Headers match expected values | WARN only |

## Benefits

### 1. **No More Stale UI**
- `index.html` never cached (no-cache header)
- Users always get latest shell
- Eliminates the reported issue

### 2. **Optimal Performance**
- Hashed assets cached for 1 year
- Reduces bandwidth and improves load times
- Only shell needs to be re-fetched

### 3. **Atomic Deployment**
- Assets uploaded before `index.html`
- Shell only references uploaded assets
- No race conditions

### 4. **Early Failure Detection**
- Smoke test catches broken deployments
- Fails before CloudFront invalidation
- Prevents users from seeing errors

### 5. **CDN Consistency**
- Verification ensures CloudFront serves fresh content
- Detects invalidation issues
- Provides manual remediation steps

### 6. **Better Debugging**
- Detailed logs at each step
- Dry-run output for deletions
- Evidence pack in deployment summary

## Testing Strategy

### Automated Tests (in workflow)

1. **Build Artifact Validation**
   - Verify `index.html` contains `/finanzas/assets/` references
   - Verify no root `/assets/` paths
   - Verify auth callback exists

2. **Upload Verification**
   - Compare local manifest to S3 manifest
   - Verify all files uploaded

3. **Smoke Test**
   - Verify `index.html` references exist in S3
   - Fail if any asset missing

4. **CloudFront Verification**
   - Compare CF and S3 `index.html`
   - Verify asset references match

5. **Post-Deploy Validation**
   - Run comprehensive verification script
   - Check cache headers
   - Verify API connectivity
   - Test deep routes

### Manual Tests (recommended after merge)

1. **Deployment Smoke Test**
   - Trigger workflow manually
   - Verify all steps pass
   - Check deployment summary

2. **UI Validation**
   - Open `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
   - Hard refresh (Ctrl+Shift+R)
   - Verify latest changes visible

3. **Cache Header Validation**
   ```bash
   # Check index.html
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/ | grep cache-control
   # Expected: cache-control: no-cache, must-revalidate
   
   # Check hashed asset
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/assets/index-*.js | grep cache-control
   # Expected: cache-control: public, max-age=31536000, immutable
   ```

4. **CDN Consistency**
   ```bash
   # Fetch from CloudFront
   curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/ > /tmp/cf.html
   
   # Fetch from S3
   aws s3 cp s3://ukusi-ui-finanzas-prod/finanzas/index.html /tmp/s3.html
   
   # Compare asset hashes
   diff <(grep -o 'index-.*\.js' /tmp/cf.html) <(grep -o 'index-.*\.js' /tmp/s3.html)
   # Expected: no differences
   ```

## Rollback Plan

If the new deployment strategy causes issues:

### Option 1: Quick Fix (Revert to Previous Strategy)
```bash
# Revert the workflow file
git revert <commit-sha>
git push origin main
```

### Option 2: Manual Deployment
```bash
# Build locally
npm run build:finanzas

# Upload all files with --delete
aws s3 sync dist-finanzas/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*'
```

### Option 3: Emergency Cache Clear
```bash
# If just cache issues, invalidate aggressively
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/*'

# Wait for completion
aws cloudfront wait invalidation-completed \
  --distribution-id EPQU7PVDLQXUA \
  --id <invalidation-id>
```

## Future Enhancements (Optional)

### 1. Playwright Post-Deploy Validation
```typescript
// Test that UI actually loads and functions
test('finanzas UI loads after deployment', async ({ page }) => {
  await page.goto('https://d7t9x3j66yd8k.cloudfront.net/finanzas/');
  await expect(page.locator('[data-testid="kpi-bar"]')).toBeVisible();
});
```

### 2. S3 Object Metadata Validation
```bash
# Verify cache headers are set in S3
aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key finanzas/index.html \
  --query 'CacheControl'
```

### 3. Automated Rollback
```yaml
- name: Rollback on failure
  if: failure()
  run: |
    # Revert to previous successful deployment
    aws s3 sync s3://backup-bucket/finanzas/ s3://ukusi-ui-finanzas-prod/finanzas/
```

### 4. Deployment Notifications
```yaml
- name: Notify on success
  if: success()
  uses: slack/action@v1
  with:
    message: "Finanzas UI deployed successfully ✅"
```

## Security Considerations

### Changes Made
- ✅ No changes to authentication/authorization logic
- ✅ No changes to API endpoints or data access
- ✅ No secrets exposed in logs
- ✅ No changes to IAM roles or permissions

### Security Benefits
- ✅ Better audit trail (detailed logs)
- ✅ Verification steps prevent broken deployments
- ✅ Dry-run output improves transparency
- ✅ No new attack surface introduced

## Monitoring & Alerts

### Key Metrics to Watch

1. **Deployment Success Rate**
   - Monitor workflow completion rate
   - Alert if failures increase

2. **CloudFront Invalidation Time**
   - Track how long invalidations take
   - Alert if exceeds 5 minutes consistently

3. **Smoke Test Failures**
   - Track asset reference mismatches
   - Indicates build or upload issues

4. **Cache Hit Rate**
   - Monitor CloudFront cache hit rate
   - Should be high for assets, low for index.html

### Recommended Alerts

```yaml
# Example CloudWatch alarm
DeploymentFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: "Alert when deployment fails"
    MetricName: WorkflowFailed
    Threshold: 1
    ComparisonOperator: GreaterThanThreshold
```

## References

### Related Documents
- [CLOUDFRONT_FIX_SUMMARY.md](./CLOUDFRONT_FIX_SUMMARY.md) - Previous CloudFront fixes
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - General deployment guide
- [FINANZAS_UI_DIAGNOSTIC_CHANGELOG.md](./FINANZAS_UI_DIAGNOSTIC_CHANGELOG.md) - UI diagnostics

### AWS Documentation
- [S3 Cache-Control](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html#object-metadata)
- [CloudFront Invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
- [CloudFront Cache Behaviors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesCacheBehavior)

### Issue Tracking
- Original issue: "UI not reflecting latest code after deployment"
- Root cause: Stale index.html in CloudFront cache
- Solution: Atomic deployment with proper cache headers and verification

## Conclusion

This fix implements a comprehensive solution to ensure that Finanzas UI deployments are:
- **Atomic**: Assets uploaded before index.html
- **Verified**: Multiple verification steps catch issues early
- **Cached Correctly**: Proper cache headers for performance and freshness
- **Transparent**: Detailed logs and dry-run output
- **Safe**: No accidental deletions, fail-fast on errors

The implementation follows best practices for SPA deployments to CDNs and ensures users always see the latest UI after deployment.

---

**Last Updated**: 2026-01-12  
**Author**: GitHub Copilot  
**Status**: Ready for Deployment  
**Next Steps**: Merge PR and monitor next deployment
