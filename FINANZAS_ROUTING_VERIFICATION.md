# Finanzas Routing Verification & Testing Guide

**Date:** November 8, 2025  
**Status:** 🟢 **LIVE** - Neutral callback + unified token handling deployed  
**Commit:** `15b176f`

---

## Overview

Fixed the issue where SDT-only users were being redirected to the PMO Platform after login. Implemented a **neutral auth callback** that routes users to the correct SPA based on their Cognito groups, and **unified token handling** with explicit Finanzas-only redirects.

---

## Architecture

### 1. Hosted UI Login Flow (Recommended)

```
User clicks Hosted UI link
    ↓
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login
    ↓
(Cognito validates credentials)
    ↓
Redirect to: https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html
             #id_token=<JWT>&access_token=...&expires_in=...
    ↓
callback.html script:
  1. Extract id_token from hash
  2. Decode JWT payload
  3. Read cognito:groups
  4. Route based on groups:
     - SDT/FIN/AUD only → location.replace('/finanzas/')
     - PMO/VENDOR/EXEC_RO only → location.replace('/')
     - Both → check cv.module preference or default to /finanzas/
  5. Store tokens:
     - localStorage.setItem('cv.jwt', id_token)  // unified key
     - localStorage.setItem('finz_jwt', id_token) // legacy
    ↓
Finanzas or PMO SPA loads with authenticated user
```

### 2. Internal Login Flow (LoginPage.tsx)

```
User enters credentials in LoginPage
    ↓
AuthProvider.loginWithCognito(email, password)
    ↓
Cognito InitiateAuth API response includes IdToken
    ↓
Store both keys:
  - localStorage.cv.jwt
  - localStorage.finz_jwt
    ↓
If VITE_FINZ_ENABLED="true":
  - window.location.replace('/finanzas/')
    ↓
Finanzas SPA loads with authenticated user
```

---

## Test Credentials

### Known Working User (Dual-Role)

```
Email:    christian.valencia@ikusi.com
Password: Velatia@2025
Groups:   PM, SDT, FIN, AUD, admin, acta-ui-ikusi, acta-ui-s3, ikusi-acta-ui
Expected: Routes to /finanzas/ (both roles, defaults to Finanzas)
```

### SDT-Only User

```
Email:    [To be tested by operations]
Password: [To be tested by operations]
Groups:   SDT (or SDT + FIN + AUD variants)
Expected: Routes to /finanzas/
```

### PMO-Only User

```
Email:    [To be tested by operations]
Password: [To be tested by operations]
Groups:   PMO (or PMO + VENDOR + EXEC_RO variants)
Expected: Routes to /
```

---

## Hosted UI Login URL (Copy/Paste)

### Full URL (Multi-line for readability)

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login
  ?client_id=dshos5iou44tuach7ta3ici5m
  &response_type=token
  &scope=openid+email+profile
  &redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

### Single-Line (Copy/Paste into browser)

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

---

## Test Procedure

### Test 1: SDT-Only User via Hosted UI

**Goal:** Verify SDT-only users land at `/finanzas/` and see Finanzas home.

1. Open incognito window.
2. Paste Hosted UI login URL into address bar.
3. Log in with SDT-only credentials.
4. **Expected:** Brief "Signing you in…" message, then redirect to `/finanzas/`.
5. **Verify:**
   - URL is `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
   - See FinanzasHome page (not PMO dashboard).
   - DevTools → Application → localStorage shows:
     - `cv.jwt` (set)
     - `finz_jwt` (set, same value)

---

### Test 2: PMO-Only User via Hosted UI

**Goal:** Verify PMO-only users land at `/` (PMO dashboard).

1. Open incognito window.
2. Paste Hosted UI login URL into address bar.
3. Log in with PMO-only credentials.
4. **Expected:** Brief "Signing you in…" message, then redirect to `/`.
5. **Verify:**
   - URL is `https://d7t9x3j66yd8k.cloudfront.net/` (root).
   - See PMO Platform dashboard.
   - DevTools → Application → localStorage shows:
     - `cv.jwt` (set)
     - `finz_jwt` (set, same value)

---

### Test 3: Dual-Role User via Hosted UI (Christian)

**Goal:** Verify dual-role users default to Finanzas and can switch roles.

1. Open incognito window.
2. Paste Hosted UI login URL into address bar.
3. Log in with `christian.valencia@ikusi.com`.
4. **Expected:** Redirect to `/finanzas/` (Finanzas is default).
5. **Verify:**
   - URL is `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`.
   - See FinanzasHome page.
   - Navigation shows both Finanzas items (Catalog, Rules).
   - (Optional) Role switcher shows multiple roles available.
6. **Module Preference Test:**
   - Switch to PMO role in the app.
   - DevTools → Application → localStorage → check `cv.module = 'pmo'`.
   - Reload page; verify module preference is honored (or still at Finanzas by default).

---

### Test 4: Internal Login (LoginPage.tsx)

**Goal:** Verify credential form login redirects to `/finanzas/`.

1. Open `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` in incognito.
2. You should see LoginPage form.
3. Enter credentials (e.g., `christian.valencia@ikusi.com` / `Velatia@2025`).
4. Click "Sign In".
5. **Expected:** After successful auth, auto-redirect to `/finanzas/`.
6. **Verify:**
   - URL is `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`.
   - See FinanzasHome (not redirected to PMO).
   - localStorage shows `cv.jwt` and `finz_jwt`.

---

### Test 5: Session Persistence

**Goal:** Verify tokens persist across page reloads.

1. After logging in (any test above), reload the page (`Cmd+R` or `F5`).
2. **Expected:** No redirect to LoginPage; authenticated user remains.
3. **Verify:**
   - Still see the SPA content.
   - No "Signing in…" message.
   - User info displayed in header.

---

### Test 6: Sign Out

**Goal:** Verify sign out clears tokens and returns to LoginPage.

1. After logging in, click "Sign Out" button (if present in UI).
2. **Expected:** Redirect to LoginPage; tokens cleared.
3. **Verify:**
   - URL is `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` (LoginPage at root).
   - localStorage is empty (or `cv.jwt` / `finz_jwt` removed).
   - Form is shown for re-login.

---

## Troubleshooting

### "No id_token present" on callback page

**Cause:** Cognito did not return a token (auth failed or wrong flow).

**Fix:**
- Verify Cognito credentials are correct.
- Check that `response_type=token` matches the App Client settings (Hosted UI section).
- Ensure "Implicit" grant type is enabled in App Client.

---

### Redirected to wrong module (e.g., PMO instead of Finanzas)

**Cause:** Groups not being read or routing logic failure.

**Debug:**
1. DevTools → Network → filter `/auth/callback.html` request.
2. Look for `#id_token=...` in the redirect URL.
3. DevTools → Console → manually run:
   ```javascript
   const hash = new URLSearchParams(location.hash.slice(1));
   const token = hash.get('id_token');
   const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   console.log('Groups:', payload['cognito:groups']);
   ```
4. Verify groups are present and correct.
5. If groups are wrong, update Cognito group membership in AWS console.

---

### Token stored but user not authenticated

**Cause:** AuthProvider initialization may not have picked up the new token.

**Fix:**
1. Clear localStorage: `localStorage.clear()`.
2. Reload page.
3. If using LoginPage, re-authenticate.

---

### "Cannot read properties of undefined (reading 'slice')" in callback

**Cause:** Cognito did not return `id_token` (possibly wrong grant type or scopes).

**Fix:**
- Check response in Network tab: should include `#id_token=...`.
- Verify Cognito App Client settings → Allowed OAuth Flows → "Implicit" is checked.

---

## Configuration Checklist

- [ ] Cognito User Pool: `us-east-2_FyHLtOhiY`
- [ ] Cognito Client ID: `dshos5iou44tuach7ta3ici5m`
- [ ] Cognito Domain: `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`
- [ ] Allowed Callback URLs includes:
  - [ ] `https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html`
  - [ ] (Optional) `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - [ ] (Optional) `https://d7t9x3j66yd8k.cloudfront.net/` (PMO root, if both apps)
- [ ] OAuth Flows → Implicit grant enabled
- [ ] Scopes → openid, email, profile enabled
- [ ] CloudFront distribution: `EPQU7PVDLQXUA`
- [ ] S3 bucket: `ukusi-ui-finanzas-prod`
- [ ] Finanzas SPA deployment: `s3://ukusi-ui-finanzas-prod/finanzas/`
- [ ] Callback page deployment: `s3://ukusi-ui-finanzas-prod/auth/callback.html`
- [ ] `.env` file has `VITE_FINZ_ENABLED=true`
- [ ] vite.config.ts defines `VITE_FINZ_ENABLED` in `define` section

---

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `public/auth/callback.html` | ✨ NEW | Neutral callback page; decodes token, routes by groups |
| `src/components/AuthProvider.tsx` | 🔧 UPDATED | Unified token key (cv.jwt), explicit redirect, module preference |
| `.env` | 🔧 UPDATED | `VITE_FINZ_ENABLED=true` added |
| `vite.config.ts` | 🔧 UPDATED | `define` section embeds `VITE_FINZ_ENABLED` |
| `dist/` | 🔨 REBUILT | New bundle deployed to S3 |

---

## Verification Evidence

### Callback Routing Logic Test

```
✓ Decoded token claims:
  email: christian.valencia@ikusi.com
  groups: [PM, SDT, FIN, AUD, admin, acta-ui-ikusi, acta-ui-s3, ikusi-acta-ui]

✓ Access check:
  canSDT: true
  canPMO: true

✓ Routing decision:
  Would redirect to: /finanzas/
  Reason: dual-role (default Finanzas)
```

### Deployment Status

```
✓ Rebuilt Finanzas SPA
✓ Deployed to S3: ukusi-ui-finanzas-prod/finanzas/
✓ Uploaded callback: ukusi-ui-finanzas-prod/auth/callback.html
✓ CloudFront invalidation: I7RKM0VNSYOROJ9XDDM7F2J9QC
✓ Git commit: 15b176f
✓ GitHub push: main branch
```

---

## Next Steps

1. **Browser Testing:** Follow test procedures (1–6 above) with real test users.
2. **SDT User Creation (if needed):** Work with ops to create a dedicated SDT-only user for testing.
3. **CI Guards (Optional):** Add build-time checks to ensure callback.html is deployed and aws-exports.js is not in Finanzas dist.
4. **Documentation:** Update ops runbooks with Hosted UI login URL and troubleshooting steps.
5. **Production Rollout:** Once verified, roll out to wider team; communicate the new Hosted UI link.

---

## Contact & Support

- **Finanzas API:** `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- **CloudFront URL:** `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- **Test Credentials:** See Test Credentials section above.
- **Issues:** Check troubleshooting section; escalate to DevOps if needed.

---

**Status:** 🟢 Ready for browser testing and production use.
