# Finanzas Hosted UI Callback Flow - Test Results

**Date:** November 8, 2025  
**Objective:** Verify neutral callback routing, unified token storage, and role-based module assignment

---

## Test Environment

| Component          | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **CloudFront URL** | `https://d7t9x3j66yd8k.cloudfront.net/`                      |
| **Finanzas SPA**   | `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`             |
| **Callback Page**  | `https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html`    |
| **Cognito Domain** | `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`        |
| **Client ID**      | `dshos5iou44tuach7ta3ici5m`                                  |
| **User Pool**      | `us-east-2_FyHLtOhiY`                                        |
| **API Endpoint**   | `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` |

---

## Hosted UI Login URLs

### Option A: Neutral Callback (Recommended – Groups-based Routing)

Routes SDT users → `/finanzas/`, PMO users → `/`, dual-role → preference or Finanzas default.

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login
  ?client_id=dshos5iou44tuach7ta3ici5m
  &response_type=token
  &scope=openid+email+profile
  &redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

**Single-line:**

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

### Option B: Direct Finanzas (Fast Path – for Finanzas-only users)

Routes all users directly to `/finanzas/` after login.

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Ffinanzas%2F
```

---

## Test Case 1: Known Working User (Christian Valencia)

**Credentials:**

- Email: `christian.valencia@ikusi.com`
- Password: `Velatia@2025`

**Terminal Test Results:**

```bash
✅ Step 1: Cognito InitiateAuth (USER_PASSWORD_AUTH)
  Result: IdToken obtained successfully

✅ Step 2: Decode JWT Claims
  Sub: amazon-cognito-generated-id
  Email: christian.valencia@ikusi.com
  Cognito Groups: ["PM", "SDT", "FIN", "AUD", "admin", "acta-ui-ikusi", "acta-ui-s3", "ikusi-acta-ui"]

✅ Step 3: Role Mapping
  Groups → Roles: [PMO, SDMT, EXEC_RO]
  User is: DUAL-ROLE (has both PMO and SDT capabilities)

✅ Step 4: API Access with Bearer Token
  /catalog/rubros → 71 items ✅
  /allocation-rules → 2 items ✅

✅ Step 5: Callback Routing Logic
  Has SDT groups: YES (SDT, FIN, AUD, admin)
  Has PMO groups: YES (PM, admin)
  Routing decision: DUAL-ROLE → defaults to /finanzas/
  cv.module preference: Can be set to 'pmo' or 'finanzas'
```

**Expected Flow:**

1. Click Option A (neutral callback) → Login form
2. Enter credentials → Cognito validates
3. Redirect to `/auth/callback.html#id_token=...`
4. Callback decodes groups: [PM, SDT, FIN, AUD, admin, ...]
5. Detects: both SDT and PMO groups
6. Defaults to `/finanzas/` (or reads `cv.module` preference)
7. Page auto-redirects to `/finanzas/`
8. Finanzas SPA loads, shows home page with [Rubros, Rules] navigation
9. localStorage contains:
   - `cv.jwt` = IdToken
   - `finz_jwt` = IdToken (legacy)
   - `cv.module` = 'finanzas' (if switching roles)

---

## Test Case 2: SDT-Only User (valencia42003@gmail.com)

**Status:** ⚠️ Credentials validation failed in terminal test  
**Reason:** `NotAuthorizedException: Incorrect username or password`

**Action Required:**

1. Verify credentials are correct in Cognito User Pool
2. Ensure user is confirmed (not in `FORCE_CHANGE_PASSWORD` state)
3. Re-provide correct password or create a test SDT-only user

**Once credentials are valid, expected flow:**

1. Click Option A (neutral callback) → Login form
2. Enter SDT-only credentials → Cognito validates
3. Redirect to `/auth/callback.html#id_token=...`
4. Callback decodes groups: [SDT, FIN, AUD] (no PM/PMO/admin)
5. Detects: SDT-only, no PMO
6. Routes to `/finanzas/`
7. Finanzas SPA loads, shows home page
8. localStorage:
   - `cv.jwt` = IdToken
   - `finz_jwt` = IdToken

---

## Implementation Details

### `public/auth/callback.html`

Neutral router that:

1. Extracts `id_token` from URL hash (`#id_token=...`)
2. Stores in localStorage:
   - `cv.jwt` (unified key)
   - `finz_jwt` (backward compatibility)
3. Decodes JWT payload (no signature check in callback)
4. Extracts `cognito:groups` array
5. Logic:
   ```
   if (canSDT && !canPMO) → redirect to /finanzas/
   if (canPMO && !canSDT) → redirect to /
   if (both) → check localStorage.cv.module preference
              if not set → default to /finanzas/
   ```

### `src/components/AuthProvider.tsx` (Updated)

Changes:

1. **Token precedence on init:** `cv.jwt` → `finz_jwt` → `spark_jwt`
2. **On Cognito login:**
   - Stores both `cv.jwt` and `finz_jwt`
   - If Finanzas mode: explicitly calls `window.location.replace("/finanzas/")`
3. **On role switch:**
   - Sets `cv.module` preference ('pmo' or 'finanzas')
   - Enables smart routing on next login
4. **On sign-out:**
   - Clears `cv.jwt`, `finz_jwt`, `spark_jwt`
   - Clears role preference

### `vite.config.ts` (Updated)

Defines at build time:

- `VITE_FINZ_ENABLED="true"` when `BUILD_TARGET=finanzas`
- Ensures app knows it's running in Finanzas-only mode

---

## Browser Testing Steps (Manual)

### Step 1: Open Cognito Login (Option A - Neutral Callback)

```
Copy this URL to browser (or use QR code):
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

**Expected:** Cognito login form (email + password)

### Step 2: Log In with Known Credentials

```
Email: christian.valencia@ikusi.com
Password: Velatia@2025
```

**Expected:** "Signing you in…" message (brief)

### Step 3: Verify Callback Routing

**Check URL:** Should briefly show:

```
https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html#id_token=eyJ...&access_token=eyJ...&expires_in=3600&...
```

Then auto-redirect to:

```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

### Step 4: Verify Finanzas Home

**Expected elements:**

- Page title: "Financial Planning & Management"
- Navigation: ["Rubros" link, "Rules" link]
- Welcome message or empty state

**Not expected:**

- "PMO Platform" header
- PMO project list
- Dashboard tabs

### Step 5: DevTools Verification

#### localStorage (Application tab):

```
cv.jwt        = eyJ... (IdToken, starts with header.payload.signature)
finz_jwt      = eyJ... (same)
cv.module     = 'finanzas' (if user switched roles before)
```

#### Network tab (filter `catalog` or `rubros`):

```
GET https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros
  Headers:
    Authorization: Bearer eyJ...
  Response:
    { data: [71 rubros], success: true, ... }
```

#### Console:

No auth errors. If Finanzas mode is correctly detected:

```
[Vite] import.meta.env.VITE_FINZ_ENABLED = "true"
```

### Step 6: Role Switching (if dual-role user)

**Not yet implemented in Finanzas UI** – would appear as a menu or modal.

Expected behavior (future):

1. User clicks "Switch to PMO"
2. `cv.module = 'pmo'` stored in localStorage
3. Page reloads → Callback logic honors preference
4. Lands at `/` (PMO) instead of `/finanzas/`

---

## Verification Checklist

### ✅ SDT-Only User (Once Credentials Confirmed)

- [ ] Login via Hosted UI callback
- [ ] Lands at `/finanzas/` (not PMO dashboard)
- [ ] Sees Finanzas navigation items
- [ ] Can load `/catalog/rubros` (71 items)
- [ ] Can load `/allocation-rules` (2 items)
- [ ] localStorage: `cv.jwt`, `finz_jwt` present
- [ ] Network: API calls include `Authorization: Bearer <token>`
- [ ] Sign out: tokens cleared from storage

### ✅ PMO-Only User (When Available)

- [ ] Login via Hosted UI callback
- [ ] Lands at `/` (PMO dashboard, not Finanzas)
- [ ] Sees PMO navigation and project list
- [ ] Can access PMO modules (if implemented)
- [ ] localStorage: `cv.jwt`, `finz_jwt` present
- [ ] Sign out: tokens cleared

### ✅ Dual-Role User (Christian)

- [ ] Login via Hosted UI callback
- [ ] Defaults to `/finanzas/`
- [ ] Can see both modules (once UI supports switching)
- [ ] Preference persists across sessions
- [ ] Role switch updates `cv.module`

### ✅ Internal App Login (LoginPage.tsx)

- [ ] User can log in via form (email + password)
- [ ] Token stored in `cv.jwt` (and `finz_jwt`)
- [ ] If Finanzas mode: redirected to `/finanzas/`
- [ ] Can access APIs with token

---

## Known Issues & Limitations

### 1. Credentials for valencia42003@gmail.com

**Status:** Not yet validated  
**Action:** Verify or provide correct SDT-only test user

### 2. PMO Module Not Deployed

**Status:** Only Finanzas (`/finanzas/`) SPA deployed  
**Impact:** PMO routing (/) will 404 if PMO SPA not on CloudFront root  
**Fix:** Deploy PMO build to CloudFront root or use separate domain

### 3. UI Role Switcher Not Yet Implemented

**Status:** Preference stored but no UI button  
**Roadmap:** Add role selector in Navigation (requires UI design)

### 4. Password Reset / MFA

**Status:** Not yet wired  
**Roadmap:** Future sprint after SDT login is stable

---

## Next Steps

1. **Confirm SDT user credentials** and re-test with `valencia42003@gmail.com`
2. **Deploy PMO SPA** to CloudFront root (if dual-module support needed)
3. **Add role switcher UI** for dual-role users
4. **Implement Hosted UI sign-out** button in Finanzas app
5. **Add password recovery link** (optional for MVP)
6. **Set up monitoring** (CloudWatch, error tracking)

---

## Rollback Plan

If issues arise:

1. Revert commit: `git revert <commit-hash>`
2. Rebuild without callback: `BUILD_TARGET=finanzas npm run build`
3. Deploy only `/finanzas/` SPA, remove `/auth/callback.html`
4. Fall back to direct internal login (LoginPage form)

---

**Status:** 🟡 Awaiting SDT user credential validation  
**Confidence:** High (Christian user verified ✅, logic sound ✅)  
**Timeline:** Ready for production once SDT test passes
