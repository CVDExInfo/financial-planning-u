# Finanzas Authentication Flow Documentation

This document describes the complete authentication flow for the Finanzas module, including Cognito integration, token management, and role-based access control.

## Overview

The Finanzas application uses **AWS Cognito** for authentication with support for:
- Direct username/password login (USER_PASSWORD_AUTH flow)
- Cognito Hosted UI (OAuth 2.0 implicit flow)
- Role-based access control using Cognito groups
- Token persistence across sessions
- Multi-role user support with preference memory

## Architecture

### Components

1. **AuthProvider** (`src/components/AuthProvider.tsx`)
   - Central authentication state management
   - JWT token validation and storage
   - User session initialization
   - Role management and permission checking

2. **LoginPage** (`src/components/LoginPage.tsx`)
   - User-facing login interface
   - Support for both direct and Hosted UI login
   - Demo credentials for development

3. **AWS Config** (`src/config/aws.ts`)
   - Centralized Cognito configuration
   - OAuth settings and redirect URLs
   - Helper functions for Hosted UI flows

4. **JWT Utilities** (`src/lib/jwt.ts`)
   - Token decoding and validation
   - Group-to-role mapping
   - Token refresh logic

5. **Callback Handler** (`public/auth/callback.html`)
   - Processes OAuth redirect after Hosted UI login
   - Implements role-based redirect logic
   - Stores tokens in localStorage

## Authentication Flows

### Flow 1: Direct Login (USER_PASSWORD_AUTH)

```
User enters credentials → LoginPage
  ↓
loginWithCognito() called → AuthProvider
  ↓
POST to Cognito IdP API
  ↓
Receive IdToken + RefreshToken
  ↓
Store tokens: cv.jwt, finz_jwt, finz_refresh_token
  ↓
initializeAuth() extracts user info from JWT
  ↓
Map Cognito groups to application roles
  ↓
Role-based redirect:
  - SDT/FIN/AUD groups → /finanzas/
  - PMO groups only → /
  - Both → preference or /finanzas/ (default)
```

### Flow 2: Hosted UI Login (OAuth 2.0)

```
User clicks "Sign in with Hosted UI" → LoginPage
  ↓
loginWithHostedUI() redirects to Cognito Hosted UI
  ↓
User authenticates on Cognito page
  ↓
Cognito redirects to callback URL with token in hash
  ↓
callback.html parses #id_token from URL
  ↓
Store tokens: cv.jwt, finz_jwt
  ↓
Decode JWT to get cognito:groups
  ↓
Role-based redirect (same logic as Flow 1)
```

### Flow 3: Session Restoration

```
User returns to app / Page refresh
  ↓
App loads → AuthProvider.initializeAuth()
  ↓
Check localStorage for cv.jwt or finz_jwt
  ↓
If found and valid (not expired):
  - Decode JWT
  - Extract groups and map to roles
  - Set user as authenticated
  - Continue to requested page
  ↓
If not found or expired:
  - Show LoginPage
```

## Configuration

### Environment Variables

Required environment variables (set in `.env.production`):

```bash
# Cognito Configuration
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_DOMAIN=us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com

# CloudFront & API
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# Build Configuration
VITE_FINZ_ENABLED=true  # For Finanzas-only build
```

### Cognito App Client Settings

The Cognito App Client must be configured with:

**OAuth Settings:**
- Allowed OAuth Flows: Implicit grant
- Allowed OAuth Scopes: email, openid, profile
- Callback URLs: 
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
  - `http://localhost:5173/finanzas/auth/callback.html` (for local dev)
- Sign out URLs:
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

**Authentication Flows:**
- USER_PASSWORD_AUTH: Enabled (for direct login)
- ALLOW_REFRESH_TOKEN_AUTH: Enabled (for token refresh)

## Token Management

### Storage Keys

The application uses multiple localStorage keys for backward compatibility:

- **`cv.jwt`**: Unified JWT token (primary)
- **`finz_jwt`**: Legacy Finanzas token (secondary)
- **`finz_refresh_token`**: Refresh token for session extension
- **`cv.module`**: User's last selected module preference (pmo/finanzas)

### Token Lifecycle

1. **Storage**: After successful authentication, tokens are stored in localStorage
2. **Validation**: On app load, tokens are validated (format, expiration)
3. **Usage**: Bearer token attached to all API requests via `Authorization` header
4. **Refresh**: When token expires, attempt refresh using refresh token
5. **Cleanup**: On logout or failed refresh, all tokens are cleared

### API Authorization

The Finanzas API client (`src/api/finanzasClient.ts`) automatically:
- Retrieves token from localStorage (cv.jwt → finz_jwt → env fallback)
- Attaches as `Authorization: Bearer <token>` header
- Handles 401 responses (token expired or invalid)

```typescript
function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
    STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

## Role-Based Access Control

### Cognito Groups to Application Roles

The application maps Cognito groups to internal roles:

| Cognito Group | Application Role | Access |
|---------------|------------------|--------|
| SDT, FIN, AUD | SDMT | Finanzas module (catalog, rules) |
| PM, PMO | PMO | PMO estimator, SDMT features |
| admin | PMO + EXEC_RO | Full access to all modules |
| VENDOR | VENDOR | Limited SDMT access |

**Mapping Logic** (`src/lib/jwt.ts`):

```typescript
export function mapCognitoGroupsToRoles(cognitoGroups: string[]): string[] {
  const roles: Set<string> = new Set();
  
  for (const group of cognitoGroups) {
    const g = group.toLowerCase();
    
    // SDMT access for Finanzas groups
    if (g.includes("sdt") || g.includes("fin") || g.includes("aud")) {
      roles.add("SDMT");
    }
    
    // PMO access
    if (g.includes("pm") || g === "admin" || g.includes("pmo")) {
      roles.add("PMO");
    }
    
    // VENDOR access
    if (g.includes("vendor") || g.includes("acta-ui")) {
      roles.add("VENDOR");
    }
    
    // EXEC_RO for admins
    if (g === "admin") {
      roles.add("EXEC_RO");
    }
  }
  
  return Array.from(roles);
}
```

### Multi-Role Users

Users in multiple Cognito groups get multiple roles. The redirect logic handles this:

1. **Finanzas-only users** (SDT/FIN/AUD): Always redirect to `/finanzas/`
2. **PMO-only users**: Always redirect to `/` (PMO home)
3. **Dual-role users** (both groups):
   - Check `cv.module` preference in localStorage
   - If preference is "pmo", redirect to `/`
   - If preference is "finanzas" or no preference, redirect to `/finanzas/`
   - Default bias: `/finanzas/`

Users can manually switch between modules using the role switcher in the navigation.

## Router Configuration

### Basename for Finanzas Build

The Finanzas app is served under the `/finanzas/` subdirectory:

**Vite Config** (`vite.config.ts`):
```typescript
export default defineConfig(() => ({
  base: isPmo ? "/" : "/finanzas/",
  define: {
    "import.meta.env.VITE_APP_BASENAME": JSON.stringify(
      isPmo ? "/" : "/finanzas"
    ),
  },
}));
```

**App Router** (`src/App.tsx`):
```typescript
const basename = import.meta.env.VITE_APP_BASENAME || "/finanzas";

return (
  <BrowserRouter basename={basename}>
    {/* Routes */}
  </BrowserRouter>
);
```

### Route Structure

All Finanzas routes are defined **without** the `/finanzas` prefix, as the basename handles it:

```typescript
<Route path="/" element={<FinanzasHome />} />           // → /finanzas/
<Route path="/catalog/rubros" element={<RubrosCatalog />} />  // → /finanzas/catalog/rubros
<Route path="/rules" element={<AllocationRulesPreview />} />  // → /finanzas/rules
```

Use React Router's `<Link>` component for navigation to ensure basename is respected:
```typescript
<Link to="/catalog/rubros">Rubros</Link>  // Resolves to /finanzas/catalog/rubros
```

## Logout Flow

### Client-Side Logout

```typescript
signOut(): void {
  // Clear all tokens
  localStorage.removeItem("cv.jwt");
  localStorage.removeItem("finz_jwt");
  localStorage.removeItem("finz_refresh_token");
  localStorage.removeItem("cv.module");
  
  // Reset state
  setUser(null);
  setCurrentRole("PMO");
  setAvailableRoles([]);
  
  // Redirect to login
  if (VITE_FINZ_ENABLED === "true") {
    window.location.href = "/finanzas/";
  }
}
```

### Hosted UI Logout (Optional)

For full Cognito logout (ends Hosted UI session):

```typescript
import { logoutWithHostedUI } from "@/config/aws";

logoutWithHostedUI();
// Redirects to: https://{domain}/logout?client_id={id}&logout_uri={uri}
```

## Testing Checklist

### Local Development Tests

1. **Direct Login**
   - Enter valid credentials
   - Verify redirect to `/finanzas/`
   - Check tokens in localStorage (cv.jwt, finz_jwt)
   - Verify groups in JWT payload

2. **Hosted UI Login**
   - Click "Sign in with Hosted UI"
   - Complete login on Cognito page
   - Verify redirect to callback.html
   - Verify callback redirects to `/finanzas/`
   - Check tokens stored

3. **Session Persistence**
   - Log in successfully
   - Refresh page → should remain logged in
   - Navigate directly to `/finanzas/catalog/rubros` → should work
   - Close tab, reopen → should remain logged in (until token expires)

4. **API Authorization**
   - Log in and visit catalog page
   - Open DevTools Network tab
   - Verify API requests have `Authorization: Bearer ...` header
   - Verify responses are 200 OK with data
   - Log out, try to access API → should see 401

5. **Logout**
   - Click logout (if UI exists)
   - Verify tokens cleared from localStorage
   - Verify redirected to login page
   - Attempt to access protected route → should show login

6. **Multi-Role Behavior**
   - Log in with test user (has both SDT and PMO groups)
   - Should redirect to `/finanzas/` by default
   - Use role switcher to change to PMO
   - Verify `cv.module` updated in localStorage
   - Log out and log in again → should remember preference

### Production Tests

After deploying to CloudFront:

1. Verify Cognito callback URL matches: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
2. Test Hosted UI flow end-to-end
3. Verify deep links work (e.g., bookmark `/finanzas/catalog/rubros`)
4. Test on different browsers (Chrome, Firefox, Safari)
5. Verify no CORS errors in API calls

## Security Considerations

### Client-Side Security

1. **JWT Validation**: Only basic validation (format, expiration) happens client-side. **Signature validation MUST happen on the server** (API Gateway Cognito authorizer).

2. **No Secrets**: The client ID is public and safe to expose. Never embed user credentials or AWS secret keys in frontend code.

3. **Token Storage**: Tokens are stored in localStorage. For higher security needs, consider:
   - Using httpOnly cookies (requires backend changes)
   - Implementing token encryption
   - Shorter token expiration times

4. **HTTPS Only**: Always use HTTPS in production to protect tokens in transit.

### Backend Authorization

The API Gateway must have a Cognito authorizer configured:
- Validates JWT signature against Cognito public keys
- Checks token expiration
- Extracts `cognito:groups` for fine-grained authorization
- Returns 401 for invalid/expired tokens

## Troubleshooting

### Common Issues

**Issue**: "No id_token present" after Hosted UI redirect
- **Cause**: Callback URL mismatch or wrong response_type
- **Fix**: Verify Cognito App Client callback URLs match exactly, including `/finanzas/auth/callback.html`

**Issue**: 401 Unauthorized on API calls despite being logged in
- **Cause**: Token not attached, expired, or backend authorizer misconfigured
- **Fix**: Check DevTools Network tab for Authorization header, verify token not expired

**Issue**: Redirects to wrong module after login
- **Cause**: Group mapping incorrect or preference not set
- **Fix**: Verify Cognito groups match expected values (SDT, FIN, AUD, PMO), check `cv.module` in localStorage

**Issue**: Login works locally but not in production
- **Cause**: Environment variable mismatch or CORS configuration
- **Fix**: Verify VITE_* variables are set correctly for production build, check API Gateway CORS settings

**Issue**: "Unexpected token '<'" or "Expected JSON, got HTML" error
- **Cause**: API base URL is incorrect or pointing to a login page/CloudFront distribution instead of API Gateway
- **Fix**: Verify `VITE_API_BASE_URL` points to the correct API Gateway URL (not CloudFront), ensure the API endpoint is accessible without authentication for public routes or with proper Bearer token for protected routes

**Issue**: User not confirmed / Password reset required
- **Cause**: Cognito user account in wrong state
- **Fix**: Confirm user email via Cognito console or re-invite user; for password reset, use Cognito "Forgot Password" flow

### Debug Mode

To enable detailed auth logging:

```typescript
// In AuthProvider.tsx or LoginPage.tsx
console.log("[Auth] JWT claims:", decodeJWT(token));
console.log("[Auth] Groups:", getGroupsFromClaims(claims));
console.log("[Auth] Mapped roles:", mapCognitoGroupsToRoles(groups));
```

## Maintenance

### Updating Cognito Configuration

To change Cognito settings (e.g., different User Pool):

1. Update `.env.production`:
   ```bash
   VITE_COGNITO_USER_POOL_ID=new-pool-id
   VITE_COGNITO_CLIENT_ID=new-client-id
   VITE_COGNITO_DOMAIN=new-domain
   ```

2. Update callback URLs in new Cognito App Client

3. Rebuild and redeploy:
   ```bash
   npm run build:finanzas
   ```

### Adding New Roles

To add a new Cognito group → role mapping:

1. Update `mapCognitoGroupsToRoles()` in `src/lib/jwt.ts`
2. Update role permissions in `src/lib/auth.ts` (ROLE_PERMISSIONS)
3. Update UserRole type in `src/types/domain.ts` if needed

## References

- [AWS Cognito User Pools Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [OAuth 2.0 Implicit Grant Flow](https://oauth.net/2/grant-types/implicit/)
- [JWT.io](https://jwt.io) - JWT decoder and debugger
- Acta-UI reference implementation (shared Cognito setup)

---

**Last Updated**: November 2025  
**Maintainers**: Ikusi Digital Platform Team
