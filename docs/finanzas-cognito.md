# Finanzas Cognito Hosted UI Integration

This document describes the AWS Cognito integration for the Finanzas (SDT) module, including required configuration, OAuth flow, and operational considerations.

## Overview

The Finanzas module uses **AWS Cognito Managed Login (Hosted UI)** for authentication. This provides:
- Secure, AWS-managed authentication pages
- Support for username/password and federated identity providers
- OAuth 2.0 Authorization Code Grant flow (recommended)
- Session management and token refresh

## Cognito Configuration

### User Pool Details
- **User Pool ID**: `us-east-2_FyHLtOhiY`
- **Region**: `us-east-2`
- **Plan**: Essentials
- **Managed Login Status**: Available

### App Client Configuration
- **App Client Name**: `Ikusi-acta-ui-web`
- **Client ID**: `dshos5iou44tuach7ta3ici5m`
- **Client Type**: Public (SPA)
- **Cognito Domain**: `us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com`

> **Note**: The domain format uses a hyphen after the region: `us-east-2-fyhltohiy` (not `us-east-2fyhltohiy`)

## OAuth Flow Configuration

### Grant Types
The app client MUST have the following OAuth grant type enabled:
- ✅ **Authorization code grant** (recommended for security)

Optional (for backward compatibility):
- ⚠️ **Implicit grant** (legacy - less secure, but simpler for SPAs without backend)

### Required Scopes
The following scopes are required and configured in `src/config/aws.ts`:
- `openid` - Core OIDC scope
- `email` - User email address
- `profile` - User profile information (name, etc.)

### Callback URLs (Allowed)
The following callback URLs MUST be configured in the Cognito app client:
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

> **Critical**: The callback URL in the code MUST exactly match one of the URLs in the "Allowed callback URLs" list.

### Sign-Out URLs (Allowed)
The following sign-out URLs MUST be configured in the Cognito app client:
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- `https://d7t9x3j66yd8k.cloudfront.net/finanzas/login`

> **Critical**: The logout_uri in the code MUST exactly match one of the URLs in the "Allowed sign-out URLs" list.

## Implementation Details

### Configuration File: `src/config/aws.ts`

The main configuration is in `src/config/aws.ts`, which reads from environment variables:

```typescript
// Required environment variables
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_DOMAIN=us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
```

### Login Flow

#### 1. User Initiates Login
When the user clicks "Sign in with Cognito Hosted UI":

```typescript
import { loginWithHostedUI } from '@/config/aws';

// Redirects to Cognito Hosted UI
loginWithHostedUI();
```

#### 2. Hosted UI URL
The function constructs the following URL:

```
https://{COGNITO_DOMAIN}/oauth2/authorize?
  client_id={CLIENT_ID}
  &response_type=code
  &scope=openid email profile
  &redirect_uri={CALLBACK_URL}
```

Example:
```
https://us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com/oauth2/authorize?
  client_id=dshos5iou44tuach7ta3ici5m
  &response_type=code
  &scope=openid%20email%20profile
  &redirect_uri=https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
```

#### 3. User Authenticates
- User enters credentials on Cognito-hosted login page
- Cognito validates credentials
- If successful, redirects to callback URL with authorization code

#### 4. Callback Processing
The callback is handled by `public/finanzas/auth/callback.html`:

**Authorization Code Grant** (recommended):
- Code arrives in query string: `?code=abc123...`
- TODO: Exchange code for tokens (requires backend endpoint or PKCE)

**Implicit Grant** (current implementation):
- Tokens arrive in URL fragment: `#id_token=xyz...&access_token=...`
- JavaScript extracts and stores tokens
- User is redirected to appropriate module based on Cognito groups

### Logout Flow

#### 1. User Initiates Logout
When the user logs out:

```typescript
import { logoutWithHostedUI } from '@/config/aws';

// Clears tokens and redirects to Cognito logout
logoutWithHostedUI();
```

#### 2. Token Cleanup
The function first clears all local storage tokens:
- `cv.jwt`
- `finz_jwt`
- `finz_refresh_token`
- `cv.module`
- `idToken`
- `cognitoIdToken`

#### 3. Cognito Logout URL
Then redirects to:

```
https://{COGNITO_DOMAIN}/logout?
  client_id={CLIENT_ID}
  &logout_uri={SIGN_OUT_URL}
```

Example:
```
https://us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com/logout?
  client_id=dshos5iou44tuach7ta3ici5m
  &logout_uri=https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

#### 4. Post-Logout Redirect
Cognito invalidates the session and redirects to the `logout_uri`.

## Troubleshooting

### Common Issues

#### 1. "Login pages unavailable" Error
**Cause**: Managed login is not properly configured or branding/domain issues.

**Solution**: Fix in AWS Console (not in code):
1. Go to Cognito → User Pool → App integration
2. Verify Cognito domain is configured
3. Check Hosted UI customization/branding
4. Ensure Managed login status shows "Available"

#### 2. Redirect URI Mismatch
**Error**: `redirect_uri_mismatch` or `invalid_request`

**Solution**: 
1. Check that callback URL in code exactly matches Cognito configuration
2. URLs are case-sensitive and must include protocol (https://)
3. No trailing slash differences

#### 3. Invalid Client Error
**Cause**: Client ID mismatch or app client misconfigured.

**Solution**:
1. Verify `VITE_COGNITO_CLIENT_ID` matches app client ID in Cognito
2. Ensure app client has correct grant types enabled
3. Check that client is not disabled

#### 4. Token Not Found After Callback
**Cause**: Response type mismatch or callback handler error.

**Solution**:
1. If using `response_type=code`, implement token exchange
2. If using `response_type=token`, check URL fragment for tokens
3. Verify app client has matching grant type enabled

## Development vs Production

### Development Environment
Set in `.env.development`:
```bash
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_DOMAIN=us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
```

### Production Environment
Set in `.env.production` or via CI/CD:
- Same values as development (using same Cognito user pool)
- Ensure CloudFront URL matches production distribution

### Local Development
For local testing with localhost:
1. Add `http://localhost:5173/finanzas/auth/callback.html` to Allowed callback URLs
2. Add `http://localhost:5173/finanzas/` to Allowed sign-out URLs
3. Set `VITE_CLOUDFRONT_URL=http://localhost:5173` in `.env.local`

## Security Considerations

### Authorization Code Grant vs Implicit Grant

**Authorization Code Grant** (recommended):
- ✅ More secure - tokens never exposed in browser URL
- ✅ Supports refresh tokens
- ✅ Industry best practice for SPAs (with PKCE)
- ⚠️ Requires additional implementation (token exchange)

**Implicit Grant** (legacy):
- ✅ Simpler implementation for SPAs
- ⚠️ Tokens exposed in URL fragment (visible in browser history)
- ⚠️ No refresh tokens
- ⚠️ Deprecated by OAuth 2.1 specification

### Current Implementation Status
- **Configured**: Authorization Code Grant (`response_type=code`)
- **Active**: Implicit Grant fallback in callback.html
- **TODO**: Implement token exchange for Authorization Code Grant

### Token Storage
Tokens are currently stored in localStorage:
- `cv.jwt` - Primary unified token
- `finz_jwt` - Finanzas-specific token (legacy)
- `finz_refresh_token` - Refresh token (when available)

**Security Note**: localStorage is vulnerable to XSS attacks. Consider:
- Using httpOnly cookies for production
- Implementing Content Security Policy (CSP)
- Regular security audits

## Cognito Groups and Authorization

The application uses Cognito groups for role-based access control:

### Finanzas (SDT) Access
Users with these groups can access Finanzas:
- `SDT` - Service Delivery Team
- `FIN` - Finance Team
- `AUD` - Audit Team

### PMO Access
Users with these groups can access PMO:
- `PMO` - Project Management Office
- `EXEC_RO` - Executive Read-Only
- `VENDOR` - External Vendors

### Dual-Role Users
Users in both Finanzas and PMO groups:
- Module preference stored in `localStorage.getItem('cv.module')`
- Default preference: Finanzas
- Users can switch modules after login

## Operator Checklist

When deploying or maintaining the Finanzas application, ensure:

### Cognito User Pool
- [ ] User pool `us-east-2_FyHLtOhiY` exists and is active
- [ ] Managed login status shows "Available"
- [ ] Domain `us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com` is configured

### App Client Configuration
- [ ] App client `Ikusi-acta-ui-web` exists
- [ ] Client ID matches `VITE_COGNITO_CLIENT_ID` in environment
- [ ] "Authorization code grant" is enabled
- [ ] Required scopes are configured: openid, email, profile

### Callback URLs
- [ ] All deployment URLs are in "Allowed callback URLs"
- [ ] Format: `https://{DOMAIN}/finanzas/auth/callback.html`
- [ ] Include localhost for local development if needed

### Sign-Out URLs
- [ ] All deployment URLs are in "Allowed sign-out URLs"
- [ ] Format: `https://{DOMAIN}/finanzas/`
- [ ] Include localhost for local development if needed

### Environment Variables
- [ ] All required variables are set in deployment environment
- [ ] CloudFront URL matches actual distribution
- [ ] No typos in Cognito domain (especially the hyphen)

### Testing
- [ ] Test login flow from login page
- [ ] Verify callback processes tokens correctly
- [ ] Test logout clears tokens and redirects properly
- [ ] Verify role-based routing works (Finanzas vs PMO)

## References

- [AWS Cognito Authorization Endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [AWS Cognito Logout Endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html)
- [OAuth 2.0 Authorization Code Grant](https://oauth.net/2/grant-types/authorization-code/)
- [OAuth 2.0 PKCE Extension](https://oauth.net/2/pkce/)

## Support

For issues or questions:
1. Check this documentation first
2. Verify Cognito configuration in AWS Console
3. Check browser console for error messages
4. Review application logs for authentication errors
5. Contact the DevOps or Security team for Cognito access

---

**Last Updated**: 2025-11-22  
**Maintained By**: Platform Team  
**Cognito User Pool**: us-east-2_FyHLtOhiY  
**App Client**: Ikusi-acta-ui-web (dshos5iou44tuach7ta3ici5m)
