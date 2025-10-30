# Deployment Summary - Fix CI + Finalize Option A (/finanzas)

## What Changed

This PR implements a secure, resilient CI/CD deployment workflow for the Financial Planning UI under CloudFront path `/finanzas/*`.

### Key Components

1. **Local OIDC Composite Action** (`.github/actions/oidc-configure-aws/`)
   - Custom GitHub Action for AWS authentication
   - Uses GitHub OIDC tokens instead of static credentials
   - No dependency on external Marketplace actions
   - Fully transparent and auditable

2. **Dual Authentication Path**
   - **Primary (Default):** OIDC authentication
     - No long-lived credentials
     - Temporary credentials (1-hour)
     - Better security posture
   - **Fallback (Opt-in):** Static credentials
     - Only used if OIDC fails **AND** `FALLBACK_STATIC_KEYS='true'`
     - Gated by repository variable (OFF by default)
     - Temporary workaround during OIDC setup

3. **Auto S3 Bucket Creation**
   - Workflow creates bucket if missing
   - Security-first configuration:
     - Public access blocked
     - Versioning enabled (rollback capability)
     - Encryption enabled (AES256)
   - Manual creation script: `scripts/create-s3-bucket.sh`

4. **Enhanced Documentation**
   - `docs/deploy.md`: Complete deployment guide
   - `docs/ops/readme.md`: Operations reference
   - `.github/actions/oidc-configure-aws/README.md`: Action docs
   - `PR_MERGE_CHECKLIST.md`: Pre-merge verification

## How to Use

### Normal Deployment (Automatic)

The workflow runs automatically on every push to `main`:

```bash
git push origin main
```

Monitor at: https://github.com/valencia94/financial-planning-u/actions

### Manual Deployment

Trigger via GitHub Actions UI:
1. Go to Actions → "Deploy Financial UI"
2. Click "Run workflow"
3. Select branch (default: main)
4. Click "Run workflow"

### Verify Deployment

After workflow completes:
1. Check workflow logs for: "✅ Using OIDC authentication (preferred)"
2. Visit: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
3. Test deep links: https://d7t9x3j66yd8k.cloudfront.net/finanzas/pmo/prefactura/estimator
4. Verify browser refresh works on nested routes

## How to Toggle the Fallback

### Enable Static Key Fallback

**When to use:** OIDC setup incomplete or temporarily unavailable

**Steps:**
1. Go to repository Settings → Secrets and Variables → Actions → Variables
2. Add variable: `FALLBACK_STATIC_KEYS` = `true`
3. Ensure secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
4. Re-run workflow

**Via GitHub CLI:**
```bash
gh variable set FALLBACK_STATIC_KEYS --body "true"
```

**Workflow will use:**
- OIDC first (always attempts)
- If OIDC fails, falls back to static keys
- Logs show: "⚠️ Using static credentials (fallback)"

### Disable Static Key Fallback (Recommended)

**When to use:** Once OIDC is working

**Steps:**
1. Go to repository Settings → Secrets and Variables → Actions → Variables
2. Delete variable `FALLBACK_STATIC_KEYS` (or set to `'false'`)
3. Workflow will use OIDC only
4. If OIDC fails, workflow fails (safer default)

**Via GitHub CLI:**
```bash
gh variable delete FALLBACK_STATIC_KEYS
```

## How to Re-run the Workflow

### From GitHub UI

1. Go to: https://github.com/valencia94/financial-planning-u/actions
2. Click "Deploy Financial UI" workflow
3. Click "Run workflow" button
4. Select branch (default: main)
5. Click green "Run workflow" button

### From GitHub CLI

```bash
# Run on main branch
gh workflow run deploy.yml

# Run on specific branch
gh workflow run deploy.yml --ref feature-branch

# Run on specific commit
gh workflow run deploy.yml --ref abc1234
```

### After Failed Run

1. Fix the issue (see troubleshooting below)
2. Click "Re-run all jobs" or "Re-run failed jobs"
3. Monitor logs for errors

## Rollback Procedures

### Option 1: Quick Rollback (5-10 minutes)

Use S3 versioning to restore previous version:

```bash
# List versions
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html

# Restore specific version (replace VERSION_ID)
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source "ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID" \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths "/finanzas/*"
```

**Note:** This only restores the HTML entry point. If assets (JS/CSS) have changed significantly, use Option 2 for a complete rollback of all files.

### Option 2: GitHub Actions Rollback (10-20 minutes)

1. Go to Actions → Deploy Financial UI
2. Click "Run workflow"
3. Select previous working commit from history
4. Click "Run workflow"
5. Wait for deployment

### Option 3: Revert PR (5-10 minutes + CI time)

```bash
git revert <merge-commit-sha>
git push origin main
# Automatic re-deploy triggers
```

## Troubleshooting

### OIDC Authentication Fails

**Error:** "Failed to assume role with web identity"

**Check:**
1. OIDC provider exists:
   ```bash
   aws iam list-open-id-connect-providers | grep token.actions.githubusercontent.com
   ```

2. Role trust policy is correct:
   ```bash
   aws iam get-role --role-name github-actions-finanzas-prod
   ```

3. Role has required permissions (S3, CloudFront)

**Temporary Fix:**
- Enable static key fallback: `FALLBACK_STATIC_KEYS=true`
- Deploy once
- Fix OIDC setup
- Disable fallback

### Deployment Fails - S3 Access

**Error:** S3 access denied or bucket not found

**Solutions:**
1. Verify bucket exists: `aws s3 ls s3://ukusi-ui-finanzas-prod/`
2. Check IAM permissions for S3
3. Bucket will be auto-created if missing (first run)

### Deployment Fails - CloudFront

**Error:** CloudFront invalidation fails

**Solutions:**
1. Verify distribution exists:
   ```bash
   aws cloudfront get-distribution --id EPQU7PVDLQXUA
   ```
2. Check IAM permissions for CloudFront
3. Verify distribution ID is correct: `EPQU7PVDLQXUA`

### Assets Not Loading (404s)

**Problem:** Assets return 404 or paths are wrong

**Solutions:**
1. Verify base path in `vite.config.ts`: `base: '/finanzas/'`
2. Verify router basename in `src/App.tsx`: `basename="/finanzas"`
3. Check CloudFront behavior path pattern: `/finanzas/*`
4. Clear CloudFront cache:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPQU7PVDLQXUA \
     --paths "/finanzas/*"
   ```

### Deep Links Return 404

**Problem:** Refreshing on `/finanzas/pmo/...` returns 404

**Solutions:**
1. Verify CloudFront custom error responses are configured:
   - Error 403 → Response `/finanzas/index.html` (200)
   - Error 404 → Response `/finanzas/index.html` (200)
2. Check in CloudFront Console → Error Pages
3. Response page path must be `/finanzas/index.html` (not just `index.html`)

## Console-Side Steps (One-Time Setup)

These must be configured in AWS Console before first deployment:

### 1. OIDC Provider (One-Time)

If not already created:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. IAM Role (One-Time)

Create role with trust policy for GitHub Actions:
- See `docs/ops/readme.md` for complete trust policy
- Attach policies for S3 and CloudFront access

### 3. CloudFront Configuration (Verify)

**Verify these settings (do not modify other behaviors):**

✅ **Behavior for `/finanzas/*`:**
- Path pattern: `/finanzas/*`
- Origin: S3 bucket `ukusi-ui-finanzas-prod`
- Origin Access Control: Configured
- Viewer protocol: Redirect HTTP to HTTPS
- Allowed methods: GET, HEAD, OPTIONS
- Cache policy: Long TTL for assets

✅ **Custom Error Responses:**
- Error 403 → Response Code 200, Response Page `/finanzas/index.html`
- Error 404 → Response Code 200, Response Page `/finanzas/index.html`

✅ **Origin Access Control (OAC):**
- S3 bucket policy allows CloudFront OAC
- See `docs/ops/readme.md` for bucket policy

### 4. GitHub Secrets & Variables

**Secrets** (Settings → Secrets and Variables → Actions → Secrets):
- `OIDC_AWS_ROLE_ARN`: arn:aws:iam::703671891952:role/github-actions-finanzas-prod
- `AWS_ACCESS_KEY_ID`: (optional, fallback only)
- `AWS_SECRET_ACCESS_KEY`: (optional, fallback only)

**Variables** (Settings → Secrets and Variables → Actions → Variables):
- `AWS_REGION`: us-east-2
- `S3_BUCKET_NAME`: ukusi-ui-finanzas-prod
- `CLOUDFRONT_DIST_ID`: EPQU7PVDLQXUA
- `DISTRIBUTION_DOMAIN_NAME`: d7t9x3j66yd8k.cloudfront.net
- `VITE_API_BASE_URL`: (your API URL)
- `VITE_ACTA_API_ID`: (your API ID)
- `FALLBACK_STATIC_KEYS`: NOT SET (or 'false')

## Post-Deployment Checklist

After first successful deployment:

- [ ] Verify OIDC was used (check workflow logs)
- [ ] Access https://d7t9x3j66yd8k.cloudfront.net/finanzas/
- [ ] Test deep link navigation
- [ ] Test browser refresh on nested routes
- [ ] Verify assets load (no 404s in DevTools)
- [ ] Check CloudFront behavior configuration
- [ ] Verify custom error responses work
- [ ] Document team on new deployment process
- [ ] Share rollback procedures with team

## Support & References

- **Repository:** https://github.com/valencia94/financial-planning-u
- **Deployment Guide:** `docs/deploy.md`
- **Operations Guide:** `docs/ops/readme.md`
- **OIDC Action Docs:** `.github/actions/oidc-configure-aws/README.md`
- **Actions:** https://github.com/valencia94/financial-planning-u/actions

## Key Contacts

- **Repository Owner:** valencia94
- **AWS Account:** 703671891952
- **Region:** us-east-2
- **CloudFront:** EPQU7PVDLQXUA
- **Domain:** d7t9x3j66yd8k.cloudfront.net

---

**Questions?** Review documentation in `docs/` directory or open an issue.
