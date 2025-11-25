# Finanzas Authentication Deployment Checklist

This document provides a step-by-step checklist for deploying the updated Cognito Hosted UI authentication to production.
**Note:** Finanzas treats the API **dev** stage as production until a dedicated prod stage is introduced.

## Pre-Deployment Verification

### 1. AWS Cognito Console Verification

Log into AWS Console → Cognito → User Pool `us-east-2_FyHLtOhiY` → App client `Ikusi-acta-ui-web`

- [ ] **OAuth 2.0 Grant Types:**
  - [ ] ✅ Authorization code grant is ENABLED
  - [ ] ✅ Implicit grant is ENABLED (this is critical!)

- [ ] **Allowed callback URLs:**
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/index.html` (temporary for legacy bookmarks)
  - Source file: `public/auth/callback.html` (canonical, deploys to `/finanzas/auth/callback.html`). If `public/finanzas/auth/callback.html` exists, it must be identical or a redirect stub only.

- [ ] **Allowed sign-out URLs:**
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

- [ ] **OpenID Connect scopes:**
  - [ ] `openid`
  - [ ] `email`
  - [ ] `profile`
  - [ ] `aws.cognito.signin.user.admin`

### 2. Environment Variables Check

Verify these are set in GitHub Actions (Settings → Secrets and variables → Actions → Variables):

- [ ] `VITE_API_BASE_URL` = `https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev` (dev stage is the effective prod stage for Finanzas)
- [ ] `VITE_COGNITO_USER_POOL_ID` = `us-east-2_FyHLtOhiY`
- [ ] `VITE_COGNITO_CLIENT_ID` = `dshos5iou44tuach7ta3ici5m`
- [ ] `VITE_COGNITO_REGION` = `us-east-2`
- [ ] `VITE_COGNITO_DOMAIN` = `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`
- [ ] `VITE_CLOUDFRONT_URL` = `https://d7t9x3j66yd8k.cloudfront.net`

### 3. CloudFront routing guardrails

- [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas` issues a **301 redirect** to `/finanzas/` (querystring preserved)
- [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html` serves the static HTML file (no SPA rewrite)
- [ ] Deep links without extensions (e.g., `/finanzas/sdmt/cost/catalog`) load via SPA rewrite to `index.html`

### 4. Local Build Test

```bash
# Set environment variables
export VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
export VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com
export VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
export VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
export VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net

# Run lint
npm run lint

# Build
npm run build:finanzas

# Verify callback.html was copied (canonical source lives at public/auth/callback.html → dist-finanzas/auth/callback.html)
ls -la dist-finanzas/auth/callback.html

# Run Finanzas QA guardrail checks
npm run qa:finanzas:auth
```

- [ ] Lint passes with no new errors
- [ ] Build completes successfully
- [ ] `callback.html` exists in `dist-finanzas/auth/`
- [ ] `npm run qa:finanzas:auth` passes locally (see `docs/FINANZAS_QA_GUARDRAILS.md` for invariant list)

### Smoke test (post-deploy)

- [ ] Login with a Finanzas role lands on `/sdmt/cost/catalog`
- [ ] Login with a Vendor role shows only Catalog, Reconciliation, Rubros
- [ ] Deep link `/finanzas/catalog/rubros` loads correctly
- [ ] Logout returns to `/finanzas/` login page

## Deployment Steps

### 5. Merge and Deploy

- [ ] Merge PR to main branch
- [ ] Wait for GitHub Actions deployment workflow to complete
- [ ] Verify CloudFront invalidation was triggered for `/finanzas/*`
- [ ] Wait 2-3 minutes for CloudFront cache to clear

### 6. Production Validation

Open incognito/private browser window and test the full flow:

#### Step 1: Navigate to Login
- [ ] Go to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] Should see login page with "Sign in with Cognito Hosted UI" button

#### Step 2: Click Hosted UI Button
- [ ] Click "Sign in with Cognito Hosted UI"
- [ ] Browser should redirect to Cognito Hosted UI
- [ ] URL should be: `https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?...`

#### Step 3: Authenticate
- [ ] Enter test credentials:
  - Email: `christian.valencia@ikusi.com`
  - Password: (use actual test password, not hardcoded here)
- [ ] Click "Sign in"

#### Step 4: Verify Callback
Watch the URL bar carefully during this step:

- [ ] Browser redirects to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html#id_token=...&access_token=...`
- [ ] Should see "Signing you in…" message briefly
- [ ] **Should NOT see:**
  - ❌ "No id_token present" error
  - ❌ "unauthorized_client" error
  - ❌ "invalid_request" error
  - ❌ Infinite redirect loop
  - ❌ Stuck on callback page

#### Step 5: Verify Redirect to Dashboard
- [ ] Browser automatically redirects to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] Dashboard loads and displays
- [ ] User name appears in navigation (top right)

#### Step 6: Verify Token Storage
Open Browser DevTools (F12):

- [ ] Go to Application → Local Storage → `https://d7t9x3j66yd8k.cloudfront.net`
- [ ] Verify these keys exist:
  - [ ] `cv.jwt` (contains JWT token)
  - [ ] `finz_jwt` (contains JWT token)
  - [ ] `idToken` (contains JWT token)
  - [ ] `cognitoIdToken` (contains JWT token)
  - [ ] `finz_access_token` (contains access token)

#### Step 7: Verify Console Logs
In Browser DevTools Console:

- [ ] Look for `[Callback]` prefixed log messages
- [ ] Should see successful flow:
  ```
  [Callback] Starting authentication callback processing
  [Callback] href: https://...
  [Callback] hash: #id_token=...&access_token=...
  [Callback] Token presence check:
  [Callback]   id_token: true
  [Callback]   access_token: true
  [Callback] ✅ id_token successfully extracted from hash
  [Callback] User: christian.valencia@ikusi.com
  [Callback] ✅ Stored both id_token and access_token
  [Callback] User groups: [...]
  [Callback] Final redirect target: /finanzas/
  [Callback] Executing redirect to: /finanzas/
  ```

#### Step 8: Verify Session Persistence
- [ ] Refresh the page (F5)
- [ ] Dashboard should reload WITHOUT redirecting to login
- [ ] User should remain authenticated

#### Step 9: Verify Sign Out
- [ ] Click user menu → "Sign out"
- [ ] Should redirect to login page
- [ ] Tokens should be cleared from localStorage

## Troubleshooting

### If You See "unauthorized_client" Error:

1. **Check:** Cognito app client has "Implicit grant" enabled
2. **Check:** `response_type` in `src/config/aws.ts` is `"token"`
3. **Check:** CloudFront cache was invalidated after deployment

### If You See "No id_token present" Error:

1. **Check:** All OpenID Connect scopes are enabled (especially `openid`)
2. **Check:** Redirect URIs in Cognito match exactly (including trailing slash)
3. **Check:** `VITE_COGNITO_DOMAIN` environment variable is correct (no typo)

### If Stuck in Infinite Loop:

1. **Check:** CloudFront Function is NOT rewriting `/finanzas/auth/callback.html` to `/finanzas/index.html`
2. **Check:** `callback.html` exists in S3 at correct path
3. **Check:** Browser can load `callback.html` directly (view source should show HTML file, not React app)

### If Tokens Are Not Stored:

1. **Check:** Browser console for localStorage errors
2. **Check:** Browser is not in private mode with localStorage disabled
3. **Check:** `callback.html` script executed successfully (check console logs)

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor CloudWatch Logs for authentication errors
- [ ] Check for any support tickets related to login issues
- [ ] Verify multiple test users can authenticate successfully

### Week 1
- [ ] Confirm no spike in authentication errors
- [ ] Verify session persistence is working across browser refreshes
- [ ] Confirm no infinite loop issues reported

## Rollback Plan

If critical issues are discovered:

1. **Immediate:** Revert the merge commit in main branch
2. **Redeploy:** Trigger manual GitHub Actions workflow run
3. **Notify:** Alert users of temporary authentication issues
4. **Investigate:** Review CloudWatch logs and browser console errors
5. **Fix:** Address root cause before re-attempting deployment

## Contact Information

**For deployment issues:**
- GitHub Issues: https://github.com/CVDExInfo/financial-planning-u/issues
- Development Team: (add contact info)

**AWS Resources:**
- Cognito User Pool: `us-east-2_FyHLtOhiY`
- CloudFront Distribution: `EPQU7PVDLQXUA`
- S3 Bucket: (bucket name here)
- API Gateway: `pyorjw6lbe`

---

**Last Updated:** November 22, 2025  
**Related PR:** #[PR_NUMBER]  
**Related Docs:** 
- [FINANZAS_CONFIGURATION.md](docs/FINANZAS_CONFIGURATION.md)
- [AUTHENTICATION_FLOW.md](AUTHENTICATION_FLOW.md)
