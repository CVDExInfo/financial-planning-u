# Finanzas Authentication Testing Guide

This guide provides step-by-step instructions for testing the complete Cognito authentication flow for the Finanzas module.

## Pre-requisites

Before testing, ensure:

1. **Cognito Configuration**
   - User Pool ID: `us-east-2_FyHLtOhiY`
   - App Client ID: `dshos5iou44tuach7ta3ici5m`
   - Domain: `us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com`
   - Callback URLs configured:
     - Production: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
     - Local: `http://localhost:5173/finanzas/auth/callback.html`

2. **Test User Account**
   - Email: `christian.valencia@ikusi.com`
   - Password: `Velatia@2025`
   - Groups: Should include both SDT (Finanzas) and PMO groups

3. **Environment Setup**
   ```bash
   # Ensure .env.production has correct values
   VITE_COGNITO_REGION=us-east-2
   VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
   VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
   VITE_COGNITO_DOMAIN=us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com
   VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
   VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   VITE_FINZ_ENABLED=true
   ```

## Local Development Testing

### Test 1: Direct Login (USER_PASSWORD_AUTH)

**Objective**: Verify username/password login works and stores tokens correctly.

**Steps**:
1. Build and run the Finanzas app locally:
   ```bash
   npm install
   BUILD_TARGET=finanzas npm run dev
   ```

2. Open browser to `http://localhost:5173/finanzas/`

3. You should see the login page (not authenticated)

4. Enter test credentials:
   - Email: `christian.valencia@ikusi.com`
   - Password: `Velatia@2025`

5. Click "Sign In"

**Expected Results**:
- ✅ Success toast message: "Signed in successfully"
- ✅ Redirect to `/finanzas/` (Finanzas home page showing catalog and rules links)
- ✅ Browser localStorage contains:
  - `cv.jwt` - ID token (starts with "eyJ...")
  - `finz_jwt` - Same token (backward compatibility)
  - `finz_refresh_token` - Refresh token
- ✅ Decode JWT payload (use jwt.io or DevTools console):
  ```javascript
  JSON.parse(atob(localStorage.getItem('cv.jwt').split('.')[1]))
  ```
  Should show:
  - `cognito:groups` array containing SDT, PM, or other groups
  - `email`: christian.valencia@ikusi.com
  - `exp`: expiration timestamp (future date)

**Troubleshooting**:
- If login fails with "Invalid credentials": Verify test user exists in Cognito
- If redirect doesn't work: Check browser console for errors
- If token not stored: Check localStorage in DevTools Application tab

### Test 2: Hosted UI Login (OAuth 2.0)

**Objective**: Verify Cognito Hosted UI login redirects correctly.

**Steps**:
1. Clear localStorage to start fresh:
   ```javascript
   localStorage.clear()
   ```

2. Refresh page - should show login form again

3. Click "Sign in with Cognito Hosted UI" button

4. Should redirect to Cognito login page:
   `https://us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com/login?...`

5. **Note**: In local dev, callback URL might not match. For full testing, use deployed version.

6. Enter credentials on Cognito page and sign in

**Expected Results**:
- ✅ Redirect to callback URL: `http://localhost:5173/finanzas/auth/callback.html`
- ✅ Callback page shows "Signing you in..." then "Redirecting..."
- ✅ Final redirect to `/finanzas/`
- ✅ Token stored in localStorage (cv.jwt, finz_jwt)

**Note**: Hosted UI testing works best in production with proper callback URLs configured.

### Test 3: Session Persistence

**Objective**: Verify user remains logged in across page refreshes and deep links.

**Steps**:
1. Complete Test 1 (direct login) successfully

2. Verify you're logged in (seeing catalog/rules page)

3. Refresh the page (F5 or Ctrl+R)

**Expected Results**:
- ✅ No redirect to login page
- ✅ User remains authenticated
- ✅ Page loads immediately without login prompt

4. Navigate directly to a deep link:
   ```
   http://localhost:5173/finanzas/catalog/rubros
   ```

**Expected Results**:
- ✅ Page loads showing rubros catalog
- ✅ No login prompt
- ✅ Data fetches successfully from API

5. Close browser tab completely

6. Reopen browser and navigate to `http://localhost:5173/finanzas/`

**Expected Results**:
- ✅ Still logged in (token persisted)
- ✅ Session continues until token expires

### Test 4: API Authorization

**Objective**: Verify API requests include Bearer token and authenticate correctly.

**Steps**:
1. Log in successfully (Test 1)

2. Navigate to `/finanzas/catalog/rubros`

3. Open DevTools → Network tab

4. Look for API request to `/catalog/rubros`

**Expected Results**:
- ✅ Request Headers include:
  ```
  Authorization: Bearer eyJraWQ...
  ```
- ✅ Response status: `200 OK`
- ✅ Response body contains rubros data (JSON array)

5. Clear localStorage:
   ```javascript
   localStorage.clear()
   ```

6. Try to access `/finanzas/catalog/rubros` again

**Expected Results**:
- ✅ Redirect to login page (no token available)
- ✅ Cannot access protected route without authentication

### Test 5: Role-Based Redirects

**Objective**: Verify users are redirected based on their Cognito groups.

**Setup**: This test requires users with different group memberships.

**Scenario A: Finanzas-only user (SDT/FIN/AUD groups)**:
1. Login with user who has only SDT, FIN, or AUD groups
2. Expected: Redirect to `/finanzas/`

**Scenario B: PMO-only user**:
1. Login with user who has only PM or PMO groups
2. Expected: Redirect to `/` (PMO home)

**Scenario C: Dual-role user (both Finanzas and PMO groups)**:
1. Login with test user (has both SDT and PM groups)
2. First login: Should redirect to `/finanzas/` (default preference)
3. Check localStorage:
   ```javascript
   localStorage.getItem('cv.module')  // Should be 'finanzas'
   ```

4. Change preference:
   ```javascript
   localStorage.setItem('cv.module', 'pmo')
   ```

5. Log out and log in again

6. Expected: Should redirect to `/` (PMO) based on preference

### Test 6: Logout Flow

**Objective**: Verify logout clears tokens and redirects properly.

**Steps**:
1. Log in successfully

2. Find and click logout button (typically in navigation/profile menu)
   - If no UI button exists, test via console:
   ```javascript
   // Trigger signOut from AuthProvider
   // This requires access to the auth context
   ```

3. Or manually test logout:
   ```javascript
   localStorage.removeItem('cv.jwt')
   localStorage.removeItem('finz_jwt')
   localStorage.removeItem('finz_refresh_token')
   window.location.href = '/finanzas/'
   ```

**Expected Results**:
- ✅ Success toast: "Signed out successfully"
- ✅ All auth tokens cleared from localStorage
- ✅ Redirect to login page
- ✅ Cannot access protected routes

4. Try to navigate to `/finanzas/catalog/rubros`

**Expected Results**:
- ✅ Redirect to login page
- ✅ Cannot see catalog data

## Production (CloudFront) Testing

After deploying to CloudFront, repeat all tests above with production URLs:

### Pre-deployment Checklist

1. **Build Finanzas bundle**:
   ```bash
   BUILD_TARGET=finanzas npm run build
   ```

2. **Verify build output**:
   - Check `dist/index.html` has `/finanzas/` prefix in asset URLs
   - Verify `dist/auth/callback.html` exists
   - Confirm assets in `dist/assets/` directory

3. **Upload to S3**:
   ```bash
   aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete
   ```

4. **Invalidate CloudFront cache**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPQU7PVDLQXUA \
     --paths '/finanzas/*'
   ```

### Production Test 1: Direct Login

1. Navigate to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

2. Should see login page

3. Enter test credentials and sign in

**Expected Results**:
- ✅ Successful login
- ✅ Redirect to `/finanzas/`
- ✅ Tokens stored correctly
- ✅ No CORS errors in console

### Production Test 2: Hosted UI

1. Clear localStorage

2. Navigate to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

3. Click "Sign in with Cognito Hosted UI"

4. Should redirect to:
   `https://us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com/login?...`

5. Complete login on Cognito page

**Expected Results**:
- ✅ Redirect to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
- ✅ Callback processes token from URL hash
- ✅ Final redirect to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- ✅ User authenticated successfully

### Production Test 3: Deep Links & SPA Routing

1. Log in successfully

2. Navigate directly to (by typing URL or bookmarking):
   ```
   https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
   ```

**Expected Results**:
- ✅ Page loads directly (no 404 or CloudFront error)
- ✅ SPA routing works correctly
- ✅ Catalog data displays

3. Test other routes:
   ```
   https://d7t9x3j66yd8k.cloudfront.net/finanzas/rules
   https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
   ```

**Expected Results**:
- ✅ All routes accessible
- ✅ No 404 errors
- ✅ CloudFront custom error responses working (403/404 → index.html)

### Production Test 4: API Calls

1. Log in and navigate to `/finanzas/catalog/rubros`

2. Open DevTools → Network tab

3. Observe API calls

**Expected Results**:
- ✅ Request to: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros`
- ✅ Authorization header present: `Bearer eyJ...`
- ✅ Response status: `200 OK`
- ✅ Response body: Array of ~71 rubros (based on QA data)

4. Check `/allocation-rules` endpoint

**Expected Results**:
- ✅ Request successful
- ✅ Response: ~2 rules

### Production Test 5: Cross-Browser Testing

Test authentication flow on different browsers:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

Verify for each:
- ✅ Login works
- ✅ Tokens stored in localStorage
- ✅ Session persists
- ✅ Logout works

### Production Test 6: Multi-Module Integration

If PMO module is also deployed:

1. Log in via Finanzas: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

2. Navigate to PMO: `https://d7t9x3j66yd8k.cloudfront.net/`

**Expected Results**:
- ✅ No need to log in again (shared token)
- ✅ Same cv.jwt works for both modules
- ✅ User can access both Finanzas and PMO features

3. Vice versa: Log in via PMO, then access Finanzas

**Expected Results**:
- ✅ Seamless access to both modules
- ✅ Single sign-on working

## Token Validation Testing

### Manual Token Inspection

After logging in, inspect the JWT token:

1. Get token from localStorage:
   ```javascript
   const token = localStorage.getItem('cv.jwt')
   console.log(token)
   ```

2. Decode at https://jwt.io:
   - Paste token in "Encoded" field
   - Inspect "Payload" section

**Verify Claims**:
- ✅ `aud`: Should match App Client ID (`dshos5iou44tuach7ta3ici5m`)
- ✅ `iss`: Should be `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY`
- ✅ `exp`: Expiration timestamp (should be in future)
- ✅ `email`: Test user email
- ✅ `cognito:groups`: Array of groups (e.g., ["SDT", "PM", "admin"])

### Token Expiration Testing

**Objective**: Verify app handles expired tokens correctly.

**Manual Expiration**:
1. Log in successfully

2. Modify token expiration in localStorage (set to past time):
   ```javascript
   // Get current token
   let token = localStorage.getItem('cv.jwt')
   let [header, payload, signature] = token.split('.')
   
   // Decode payload
   let decodedPayload = JSON.parse(atob(payload))
   
   // Set expiration to past (1 hour ago)
   decodedPayload.exp = Math.floor(Date.now() / 1000) - 3600
   
   // Re-encode (note: signature will be invalid, but that's okay for client-side testing)
   let newPayload = btoa(JSON.stringify(decodedPayload))
   let newToken = [header, newPayload, signature].join('.')
   
   // Store expired token
   localStorage.setItem('cv.jwt', newToken)
   localStorage.setItem('finz_jwt', newToken)
   ```

3. Refresh page

**Expected Results**:
- ✅ Token detected as expired
- ✅ Token cleared from localStorage
- ✅ Redirect to login page
- ✅ Console warning: "[Auth] JWT expired or invalid, clearing"

## Performance Testing

### Load Time

1. Clear browser cache

2. Navigate to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

3. Measure page load time (DevTools → Network → Load time)

**Expected**:
- ✅ Initial load: < 3 seconds (depends on network)
- ✅ Login page renders quickly
- ✅ No unnecessary API calls before login

### Token Refresh (Future Enhancement)

If token refresh is implemented:

1. Log in and get a token

2. Wait for token to be near expiration

3. Make an API call

**Expected**:
- ✅ System detects near-expiration
- ✅ Automatically refreshes token using refresh token
- ✅ API call succeeds with new token
- ✅ No interruption to user experience

## Security Testing

### Token Storage Security

1. Inspect localStorage after login:
   ```javascript
   Object.keys(localStorage).filter(k => k.includes('jwt') || k.includes('token'))
   ```

**Expected**:
- ✅ Only storing necessary tokens (cv.jwt, finz_jwt, finz_refresh_token)
- ✅ No plain-text passwords
- ✅ No AWS credentials

### XSS Prevention

1. Try injecting script in login form:
   ```
   Email: <script>alert('XSS')</script>
   ```

**Expected**:
- ✅ Input sanitized
- ✅ No script execution
- ✅ Login fails with appropriate error

### HTTPS Enforcement

1. Try accessing via HTTP:
   ```
   http://d7t9x3j66yd8k.cloudfront.net/finanzas/
   ```

**Expected**:
- ✅ Redirect to HTTPS
- ✅ No mixed content warnings
- ✅ All resources loaded over HTTPS

## Automated Testing (Future)

For CI/CD integration, consider:

1. **Unit Tests**:
   - Test JWT decode/validation functions
   - Test group-to-role mapping
   - Test redirect logic

2. **Integration Tests**:
   - Mock Cognito API responses
   - Test AuthProvider state management
   - Test API client token attachment

3. **E2E Tests** (Playwright/Cypress):
   - Automate login flow
   - Test navigation with authentication
   - Test logout flow

Example test structure:
```typescript
describe('Finanzas Authentication', () => {
  test('should login with valid credentials', async () => {
    // Navigate to login
    // Enter credentials
    // Submit form
    // Assert redirect to /finanzas/
    // Assert token in localStorage
  })
  
  test('should persist session across refresh', async () => {
    // Login
    // Refresh page
    // Assert still authenticated
  })
})
```

## Troubleshooting Common Issues

### Issue: "No id_token present" in callback

**Cause**: Callback URL mismatch or wrong response_type

**Fix**:
1. Verify Cognito App Client settings:
   - Callback URLs include exact URL (with /finanzas/auth/callback.html)
   - Response type is "token" (implicit) or "code" (authorization code)

2. Check browser console for actual redirect URL

3. Verify no typos in domain name (us-east-2-**fyhltohiy** with hyphen)

### Issue: 401 Unauthorized on API calls

**Cause**: Token not attached, expired, or authorizer misconfigured

**Fix**:
1. Check Network tab for Authorization header
2. Verify token not expired: decode and check `exp` claim
3. Test token manually with curl:
   ```bash
   TOKEN=$(cat <<< 'paste-token-here')
   curl -H "Authorization: Bearer $TOKEN" \
     https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health
   ```

### Issue: Redirect loop after login

**Cause**: Redirect logic bug or missing group mapping

**Fix**:
1. Check browser console for redirect messages
2. Verify user has correct groups in Cognito
3. Check cv.module preference in localStorage
4. Clear localStorage and try again

### Issue: CORS errors in production

**Cause**: API Gateway CORS not configured for CloudFront origin

**Fix**:
1. Verify API Gateway CORS settings allow CloudFront domain
2. Check preflight OPTIONS requests succeed
3. Ensure API responses include CORS headers:
   ```
   Access-Control-Allow-Origin: https://d7t9x3j66yd8k.cloudfront.net
   Access-Control-Allow-Headers: Authorization, Content-Type
   ```

## Test Results Template

Use this template to document test results:

```
## Test Execution Results

**Date**: YYYY-MM-DD
**Tester**: Name
**Environment**: Local / Production
**Browser**: Chrome 120 / Firefox 121 / etc.

### Test 1: Direct Login
- ✅ / ❌ Login successful
- ✅ / ❌ Tokens stored correctly
- ✅ / ❌ Redirect to /finanzas/
- Notes: 

### Test 2: Hosted UI
- ✅ / ❌ Redirect to Cognito
- ✅ / ❌ Callback processed
- ✅ / ❌ Final redirect successful
- Notes:

### Test 3: Session Persistence
- ✅ / ❌ Refresh persists session
- ✅ / ❌ Deep links work
- Notes:

### Test 4: API Authorization
- ✅ / ❌ Bearer token attached
- ✅ / ❌ 200 OK responses
- ✅ / ❌ 401 when not authenticated
- Notes:

### Test 5: Role-Based Redirects
- ✅ / ❌ Finanzas users → /finanzas/
- ✅ / ❌ PMO users → /
- ✅ / ❌ Dual-role preference works
- Notes:

### Test 6: Logout
- ✅ / ❌ Tokens cleared
- ✅ / ❌ Redirect to login
- ✅ / ❌ Cannot access protected routes
- Notes:

### Issues Found
1. [Description of issue]
   - Severity: High / Medium / Low
   - Steps to reproduce:
   - Expected:
   - Actual:

### Overall Assessment
- ✅ All tests passed / ❌ Some tests failed
- Recommendation: Ready for production / Needs fixes
```

---

**Last Updated**: November 2025
**Owner**: Ikusi Digital Platform Team
