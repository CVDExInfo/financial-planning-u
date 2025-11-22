# Finanzas Cognito Hosted UI Integration

This document describes the Cognito Hosted UI integration for the Finanzas module, including configuration, authentication flows, and troubleshooting.

## Overview

The Finanzas module supports two authentication methods:
1. **Direct Login** (USER_PASSWORD_AUTH): Username/password form in the app
2. **Hosted UI Login** (OAuth 2.0): Redirect to Cognito's hosted login page

Both methods authenticate against the same Cognito User Pool and share the same session tokens.

## Cognito Configuration

### User Pool Details
- **Region**: us-east-2
- **User Pool ID**: us-east-2_FyHLtOhiY
- **App Client ID**: dshos5iou44tuach7ta3ici5m
- **Domain Prefix**: us-east-2fyhltohiy (NOTE: NO hyphen after "us-east-2")

### Important Domain Note
The Cognito domain prefix is a **free-form string** chosen during domain configuration. For this User Pool, it happens to be `us-east-2fyhltohiy` (without a hyphen between the region and the rest of the prefix).

**Correct Domain**: `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`
**Incorrect Domain**: `us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com` (DO NOT USE)

The domain prefix must exactly match what is configured in the AWS Cognito console. Always verify the domain in the console rather than guessing the format.

### OAuth Settings
- **Allowed OAuth Flows**: 
  - ✅ Implicit grant (currently active)
  - ✅ Authorization code grant (configured but not yet implemented)
- **Allowed OAuth Scopes**: openid, email, profile
- **Callback URLs**:
  - Production: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
  - Development: `http://localhost:5173/finanzas/auth/callback.html`
- **Sign-out URLs**:
  - Production: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - Development: `http://localhost:5173/finanzas/`

### Authentication Flows Enabled
- ✅ ALLOW_USER_PASSWORD_AUTH (for direct login)
- ✅ ALLOW_REFRESH_TOKEN_AUTH (for token refresh)
- ✅ ALLOW_USER_SRP_AUTH (optional, not currently used)

## Current Implementation Status

### Active Flow: Implicit Grant (Validated)
The application currently uses **implicit grant flow** (`response_type=token`) for Hosted UI login:
- Cognito returns both `id_token` and `access_token` in the URL hash when `scope` includes `openid`.
- Handled by `public/finanzas/auth/callback.html`, which requires `id_token` and stores the same keys as direct login.
- Simple to operate (no backend token exchange required), and aligned with existing deployment configuration.

### Planned: Authorization Code Grant (Future)
The Cognito app client also supports **authorization code grant**, but this is intentionally deferred:
- **TODO**: Implement token exchange endpoint (backend or PKCE client).
- **TODO**: Update `loginWithHostedUI()` to use `response_type=code` and adjust callback.html accordingly.
- **NOTE**: Cognito does **not** accept `response_type="token id_token"`; using it prevents `id_token` from being returned.

## Authentication Flows

### 1. Direct Login Flow (USER_PASSWORD_AUTH)

```
User enters credentials in Login form
         ↓
loginWithCognito(email, password) called
         ↓
Direct API call to Cognito IdP:
  POST https://cognito-idp.us-east-2.amazonaws.com/
  X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth
  Body: { ClientId, AuthFlow, AuthParameters }
         ↓
Cognito validates credentials
         ↓
Returns AuthenticationResult with IdToken, AccessToken, RefreshToken
         ↓
Tokens stored in localStorage:
  - cv.jwt (primary)
  - finz_jwt (legacy)
  - cognitoIdToken, idToken (fallback keys)
  - finz_refresh_token
         ↓
AuthProvider initializes with decoded token
         ↓
User redirected based on Cognito groups
```

### 2. Hosted UI Login Flow (Implicit Grant)

```
User clicks "Sign in with Cognito Hosted UI"
         ↓
loginWithHostedUI() called from src/config/aws.ts
         ↓
Redirect to:
  https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?
    client_id=dshos5iou44tuach7ta3ici5m&
    response_type=token&
    scope=openid+email+profile&
    redirect_uri=https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
         ↓
User authenticates on Cognito Hosted UI
         ↓
Cognito redirects back to callback URL with tokens in hash when scope contains `openid`:
  /finanzas/auth/callback.html#id_token=...&access_token=...
         ↓
callback.html script:
  - Extracts tokens from URL hash (requires `id_token`, logs hash if missing)
  - Validates token format (lightweight decode)
  - Stores tokens in localStorage (same keys as direct login)
  - Determines redirect based on Cognito groups
         ↓
Redirect to appropriate module:
  - SDT/FIN/AUD → /finanzas/
  - PMO → /
  - Dual-role → preference-based (default: /finanzas/)
```

### 3. Logout Flow

**Client-Side Logout** (via `signOut()` in AuthProvider):
```typescript
// Clear all tokens
localStorage.removeItem("cv.jwt");
localStorage.removeItem("finz_jwt");
localStorage.removeItem("finz_refresh_token");
localStorage.removeItem("cv.module");

// Reset auth state
setUser(null);
setCurrentRole("PMO");

// Redirect to login
window.location.href = "/finanzas/";
```

**Hosted UI Logout** (optional, via `logoutWithHostedUI()`):
```typescript
// Clear local tokens
localStorage.removeItem("cv.jwt");
localStorage.removeItem("finz_jwt");
localStorage.removeItem("finz_refresh_token");
localStorage.removeItem("cv.module");

// Redirect to Cognito logout endpoint
window.location.href = 
  `https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/logout?` +
  `client_id=dshos5iou44tuach7ta3ici5m&` +
  `logout_uri=https://d7t9x3j66yd8k.cloudfront.net/finanzas/`;
```

The Hosted UI logout also clears the Cognito session server-side, so the user will need to re-enter credentials even in other applications using the same User Pool.

## Token Management

### Token Storage Keys
- **cv.jwt**: Primary unified token (used across PMO and Finanzas)
- **finz_jwt**: Legacy Finanzas-specific token (backward compatibility)
- **cognitoIdToken, idToken**: Additional fallback keys for older API clients
- **finz_refresh_token**: Refresh token for automatic renewal

### Token Lifecycle
1. **Acquisition**: After successful authentication (direct or Hosted UI)
2. **Storage**: Multiple keys in localStorage for compatibility
3. **Validation**: On app load via `initializeAuth()` in AuthProvider
4. **Usage**: Attached to API calls as `Authorization: Bearer <token>`
5. **Refresh**: When expired (if refresh token available)
6. **Cleanup**: On logout or failed refresh

### Token Validation
- **Client-side**: Format validation and expiry check only
- **Server-side**: Full signature validation by API Gateway authorizer
- **Never trust client-side validation alone**

## Implementation Files

### Configuration
- **src/config/aws.ts**: Cognito configuration and helper functions
  - `loginWithHostedUI()`: Initiates Hosted UI login
  - `logoutWithHostedUI()`: Logs out via Hosted UI
- **.env files**: Environment-specific configuration
  - `.env.development`: Local development settings
  - `.env.production`: Production settings

### Authentication Components
- **src/components/AuthProvider.tsx**: Single source of truth for auth state
- **src/hooks/useAuth.ts**: Primary hook for accessing auth context
- **src/hooks/useRole.ts**: Thin wrapper for role-specific operations
- **src/components/Login.tsx**: Login UI with both auth methods
- **src/components/LoginPage.tsx**: Alternative login page layout

### Callback Handler
- **public/finanzas/auth/callback.html**: Processes OAuth callback
  - Extracts tokens from URL hash (implicit flow)
  - Validates token format
  - Stores tokens in localStorage
  - Redirects based on user groups

## Testing

### Manual Testing Checklist

#### Prerequisites
- [ ] User exists in Cognito User Pool (us-east-2_FyHLtOhiY)
- [ ] User is CONFIRMED status
- [ ] User has appropriate groups (SDT, FIN, AUD, PMO, etc.)

#### Test Scenarios

1. **Direct Login**
   - [ ] Navigate to /finanzas/
   - [ ] Enter valid credentials
   - [ ] Verify successful login and redirect
   - [ ] Check tokens in localStorage (cv.jwt, finz_jwt)

2. **Hosted UI Login**
   - [ ] Navigate to /finanzas/
   - [ ] Click "Sign in with Cognito Hosted UI"
   - [ ] Verify redirect to correct domain (us-east-2fyhltohiy)
   - [ ] Complete login on Hosted UI
   - [ ] Verify redirect back to callback.html
   - [ ] Verify final redirect to appropriate module
   - [ ] Check tokens in localStorage

3. **Token Persistence**
   - [ ] Login successfully
   - [ ] Refresh page
   - [ ] Verify still logged in (no re-login required)
   - [ ] Verify tokens still in localStorage

4. **Logout**
   - [ ] Login successfully
   - [ ] Click logout
   - [ ] Verify tokens cleared from localStorage
   - [ ] Verify redirect to login page
   - [ ] Verify cannot access protected routes

5. **Role-Based Routing**
   - [ ] Login with SDT-only user → /finanzas/
   - [ ] Login with PMO-only user → /
   - [ ] Login with dual-role user → /finanzas/ (default)

### Automated Testing

#### Runtime Configuration Check
A runtime configuration checker is available (currently commented out):
- **src/__tests__/cognitoIntegration.test.ts**
- Export: `COGNITO_INTEGRATION_CHECKLIST`
- Function: `verifyCognitoIntegrationAtRuntime()`

To use in browser console:
```javascript
import { verifyCognitoIntegrationAtRuntime } from '@/tests/cognitoIntegration.test';
verifyCognitoIntegrationAtRuntime();
```

## Troubleshooting

### Issue: Redirect fails after Hosted UI login
**Symptoms**: Error in callback.html, or redirect to wrong location

**Fixes**:
1. Verify domain is correct (NO hyphen): `us-east-2fyhltohiy`
2. Check callback URL in Cognito matches exactly (including /finanzas/auth/callback.html)
3. Clear browser cache and cookies
4. Check browser console for errors
5. Verify tokens in URL hash after callback

### Issue: "Token exchange not yet implemented" error
**Symptoms**: Error message appears after Hosted UI login

**Cause**: Authorization code received but app expects implicit flow

**Fixes**:
1. Verify `response_type=token` in `src/config/aws.ts`
2. Check `aws.oauth.responseType` is "token" not "code"
3. Clear browser cache
4. If problem persists, check Cognito app client OAuth settings

### Issue: Domain not found or SSL error
**Symptoms**: ERR_NAME_NOT_RESOLVED, SSL certificate error

**Cause**: Incorrect domain prefix (typo or extra hyphen)

**Fixes**:
1. Verify domain in .env files matches console exactly
2. Check for common typos:
   - ❌ `us-east-2-fyhltohiy` (extra hyphen)
   - ✅ `us-east-2fyhltohiy` (correct)
3. Test domain directly in browser:
   ```
   https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/.well-known/openid-configuration
   ```
4. If this returns 404, domain is wrong

### Issue: Invalid client ID
**Symptoms**: "Invalid client" error from Cognito

**Fixes**:
1. Verify client ID is correct: `dshos5iou44tuach7ta3ici5m`
2. Check client ID in .env files
3. Verify client exists in Cognito console
4. Check client is enabled

### Issue: Redirect URI mismatch
**Symptoms**: "redirect_uri_mismatch" error from Cognito

**Fixes**:
1. Verify callback URL matches Cognito configuration exactly
2. Check for case sensitivity
3. Check for trailing slash differences
4. Common issues:
   - Missing `/finanzas/auth/callback.html` path
   - Wrong protocol (http vs https)
   - Wrong domain

### Issue: Tokens not stored
**Symptoms**: Login succeeds but app doesn't recognize user

**Fixes**:
1. Check browser localStorage for tokens
2. Verify callback.html is executing (add console.log)
3. Check for JavaScript errors in console
4. Verify Content Security Policy allows callback script
5. Check browser privacy settings (localStorage may be blocked)

## Security Considerations

### Token Security
- ✅ Tokens stored in localStorage (acceptable for SPA)
- ✅ No tokens in URL (except temporary hash in callback)
- ✅ HTTPS enforced in production
- ⚠️ Consider httpOnly cookies for higher security (requires backend)

### CORS Configuration
- API Gateway must allow requests from CloudFront origin
- Cognito callback URLs must be explicitly configured
- No wildcard origins in production

### Content Security Policy
- Allow inline scripts for callback.html
- Restrict script sources to trusted domains
- Block mixed content (HTTP resources on HTTPS page)

### Token Validation
- **Client-side**: Format and expiry only (not cryptographic validation)
- **Server-side**: Full JWT signature validation by API Gateway authorizer
- Never trust client-side validation alone

## Future Enhancements

### Short-term
- [ ] Implement automatic token refresh before expiration
- [ ] Add session timeout warnings
- [ ] Improve error messages for common issues

### Long-term
- [ ] Migrate to Authorization Code with PKCE flow
  - Implement token exchange (backend or client-side PKCE)
  - Update `loginWithHostedUI()` to use `response_type=code`
  - Update `callback.html` to handle code exchange
- [ ] Consider httpOnly cookies for token storage
- [ ] Add MFA support
- [ ] Implement "Remember Me" functionality
- [ ] Add account recovery flows (password reset, etc.)

## References

### AWS Documentation
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [OAuth 2.0 Grants](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html)
- [Hosted UI](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)

### Internal Documentation
- AUTHENTICATION_FLOW.md - Complete authentication flow diagrams
- AUTHENTICATION_TESTING.md - Comprehensive testing guide
- FINANZAS_AUTH_IMPLEMENTATION_SUMMARY.md - Implementation details
- FINANZAS_AUTH_FIX_SUMMARY.md - Bug fixes and improvements

## Support

For issues or questions:
1. Review this document thoroughly
2. Check browser console for errors
3. Verify configuration in AWS Cognito console
4. Test with CLI commands (see AUTHENTICATION_TESTING.md)
5. Contact the platform team

---

**Last Updated**: November 22, 2024
**Version**: 1.0
**Status**: Active (Implicit Grant Flow)
