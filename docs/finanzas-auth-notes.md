# Finanzas Authentication Architecture

## Overview

This document describes the authentication and authorization architecture for the Finanzas module, providing a clear understanding of how auth state is managed and accessed throughout the application.

## Core Principles

1. **Single Source of Truth**: All authentication and authorization state lives in `AuthProvider`
2. **Hook-Based Access**: Components access auth state through well-defined hooks
3. **JWT-Based Auth**: Authentication uses AWS Cognito JWT tokens
4. **Role-Based Access Control (RBAC)**: User permissions are determined by their role(s)

## Architecture Components

### 1. AuthProvider (`src/components/AuthProvider.tsx`)

The `AuthProvider` is the **single source of truth** for all authentication and authorization state.

**Responsibilities:**
- Manages user authentication state (logged in/out)
- Stores and validates JWT tokens
- Provides role management (current role, available roles, role switching)
- Handles login/logout operations
- Persists auth state to localStorage
- Provides permission checking functions

**Key Functions:**
- `loginWithCognito(username, password)` - Email/password authentication
- `signOut()` - Logout and clear tokens
- `setRole(role)` - Switch user's active role
- `canAccessRoute(route)` - Check if current role can access a route
- `canPerformAction(action)` - Check if current role can perform an action

**State Provided:**
```typescript
{
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentRole: UserRole;
  availableRoles: UserRole[];
  setRole: (role: UserRole) => void;
  canAccessRoute: (route: string) => boolean;
  canPerformAction: (action: string) => boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  loginWithCognito: (username: string, password: string) => Promise<void>;
}
```

### 2. useAuth Hook (`src/hooks/useAuth.ts`)

The primary hook for accessing authentication state and functions.

**Usage:**
```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, currentRole, signOut } = useAuth();
  // ...
}
```

**Convenience Exports:**
- `useCurrentUser()` - Returns just the user object
- `useCurrentRole()` - Returns role management functions
- `usePermissions()` - Returns permission checking functions

### 3. useRole Hook (`src/hooks/useRole.ts`)

A specialized hook for role-specific functionality. **This hook derives all state from `useAuth()`** - it does not maintain separate state.

**Usage:**
```typescript
import { useRole } from '@/hooks/useRole';

function MyComponent() {
  const { currentRole, setRole, hasRole, availableRoles } = useRole();
  
  if (hasRole('SDMT')) {
    // Show SDMT-specific UI
  }
}
```

**Important:** `useRole()` is a convenience wrapper around `useAuth()` - it calls `useAuth()` internally and returns role-specific properties.

### 4. usePermissions Hook (`src/hooks/usePermissions.ts`)

Provides granular permission checking functions.

**Usage:**
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { canCreate, canUpdate, canDelete, isReadOnly } = usePermissions();
  
  return (
    <>
      {canCreate() && <CreateButton />}
      {canUpdate() && <EditButton />}
      {canDelete() && <DeleteButton />}
    </>
  );
}
```

## Authentication Flow

### 1. Application Bootstrap

```
App Start
  ↓
AuthProvider Mounts
  ↓
initializeAuth() runs
  ↓
Check for valid JWT in localStorage
  ↓
  ├── Valid JWT found → Decode token, set user, extract roles
  │                    → Show authenticated app
  │
  └── No valid JWT → Set isAuthenticated = false
                   → Show Login component
```

### 2. Login Flow (Email/Password)

```
User enters credentials
  ↓
Submit form → loginWithCognito(email, password)
  ↓
Call Cognito USER_PASSWORD_AUTH API
  ↓
Receive JWT tokens
  ↓
Store tokens in localStorage:
  - cv.jwt
  - finz_jwt
  - cognitoIdToken
  - idToken (legacy)
  ↓
Decode JWT to extract user info and groups
  ↓
Map Cognito groups to application roles
  ↓
Set user and auth state
  ↓
Redirect based on role(s):
  - SDT/FIN/AUD → /finanzas/
  - PMO/EXEC_RO → /
  - Dual role → Use preference or default to /finanzas/
```

### 3. Login Flow (Hosted UI)

```
User clicks "Sign in with Cognito Hosted UI"
  ↓
loginWithHostedUI() from config/aws.ts
  ↓
Redirect to Cognito hosted UI
  ↓
User authenticates with Cognito
  ↓
Cognito redirects to callback URL with token in hash
  ↓
Callback page (callback.html) extracts token
  ↓
Stores token in localStorage
  ↓
Redirects to application
  ↓
AuthProvider detects token
  ↓
Initializes user session
```

## Access Control

### Route-Level Access Control

Use `AccessControl` component to protect entire routes:

```typescript
import { AccessControl } from '@/components/AccessControl';

<AccessControl requiredRoles={['SDMT', 'PMO']}>
  <YourProtectedComponent />
</AccessControl>
```

### Component-Level Access Control

Use `Protected` component for conditional rendering:

```typescript
import { Protected } from '@/components/Protected';

<Protected roles={['PMO']}>
  <AdminOnlyFeature />
</Protected>

<Protected action="delete">
  <DeleteButton />
</Protected>
```

### Programmatic Access Control

Use hooks for programmatic checks:

```typescript
const { canAccessRoute, canPerformAction } = useAuth();

if (canAccessRoute('/admin')) {
  // Navigate to admin
}

if (canPerformAction('approve')) {
  // Show approve button
}
```

## Role Management

### Available Roles

- `PMO` - Project Management Office users
- `SDMT` - Service Delivery Management Team (Finanzas users)
- `EXEC_RO` - Executive Read-Only access
- `VENDOR` - External vendor access

### Role Hierarchy

Roles have different permission levels:
1. `VENDOR` - Lowest (level 1)
2. `SDMT` - Standard (level 2)
3. `PMO` - Management (level 3)
4. `EXEC_RO` - Executive (level 4)

### Role Switching

Users with multiple roles can switch between them:

```typescript
const { currentRole, availableRoles, setRole } = useRole();

// Check available roles
console.log(availableRoles); // ['PMO', 'SDMT']

// Switch to SDMT role
setRole('SDMT');

// Preference is persisted to localStorage for future logins
```

## Token Management

### Token Storage

Tokens are stored in multiple localStorage keys for compatibility:
- `cv.jwt` - Unified token key (primary)
- `finz_jwt` - Finanzas-specific key
- `cognitoIdToken` - Cognito ID token
- `idToken` - Legacy key

### Token Validation

On every app load, `AuthProvider`:
1. Checks for tokens in localStorage
2. Validates token expiration
3. Decodes token to extract user info
4. If expired/invalid, clears tokens and shows login

### Token Refresh

Token refresh is handled by the refresh token stored separately:
- `finz_refresh_token` - Cognito refresh token

## Best Practices

### DO ✅

1. **Always use hooks to access auth state**
   ```typescript
   const { user, currentRole } = useAuth();
   ```

2. **Use AccessControl for route protection**
   ```typescript
   <AccessControl requiredRoles={['SDMT']}>
     <FinanzasRoute />
   </AccessControl>
   ```

3. **Check permissions before rendering UI**
   ```typescript
   const { canDelete } = usePermissions();
   {canDelete() && <DeleteButton />}
   ```

4. **Handle loading states**
   ```typescript
   const { isLoading, isAuthenticated } = useAuth();
   if (isLoading) return <LoadingSpinner />;
   if (!isAuthenticated) return <Login />;
   ```

### DON'T ❌

1. **Don't access AuthContext directly**
   ```typescript
   // ❌ Bad
   const context = useContext(AuthContext);
   
   // ✅ Good
   const auth = useAuth();
   ```

2. **Don't maintain separate auth state**
   ```typescript
   // ❌ Bad - Duplicate state
   const [user, setUser] = useState(null);
   
   // ✅ Good - Use AuthProvider's state
   const { user } = useAuth();
   ```

3. **Don't store tokens in component state**
   ```typescript
   // ❌ Bad
   const [token, setToken] = useState(localStorage.getItem('token'));
   
   // ✅ Good - Let AuthProvider manage tokens
   const { isAuthenticated } = useAuth();
   ```

4. **Don't use RoleProvider**
   ```typescript
   // ❌ Deprecated - RoleProvider is deprecated
   <RoleProvider>
     <App />
   </RoleProvider>
   
   // ✅ Good - Use AuthProvider
   <AuthProvider>
     <App />
   </AuthProvider>
   ```

## Deprecated Components

### RoleProvider (`src/components/RoleProvider.tsx`)

**Status:** ⚠️ DEPRECATED

This component is deprecated and should not be used. Role management is now handled entirely by `AuthProvider`. The component remains in the codebase for reference only and will be removed in a future update.

If you encounter code using `RoleProvider`, refactor it to use `AuthProvider` instead.

## Login Components

### Login.tsx vs LoginPage.tsx

Both components provide login functionality with subtle differences:

- **Login.tsx** - More feature-rich, includes:
  - Environment-based password login toggle
  - Auto-redirect to Hosted UI in production
  - Development demo credentials

- **LoginPage.tsx** - Simpler, always shows:
  - Email/password form
  - Hosted UI button
  - Development credentials

Both components:
- Import `useAuth` from `@/hooks/useAuth` ✅
- Use controlled inputs (value + onChange) ✅
- Call `loginWithCognito()` for email/password auth ✅
- Support Hosted UI login via `loginWithHostedUI()` ✅

## Troubleshooting

### Common Issues

**Issue: "useAuth must be used within an AuthProvider"**
- **Cause:** Component using `useAuth()` is not wrapped in `<AuthProvider>`
- **Fix:** Ensure App.tsx has `<AuthProvider>` wrapping your app routes

**Issue: User logged in but shows login page**
- **Cause:** JWT token expired or invalid
- **Fix:** Clear localStorage and login again

**Issue: Role changes not persisting**
- **Cause:** localStorage not available (incognito mode)
- **Fix:** Check browser console for storage errors

**Issue: Infinite redirect loop**
- **Cause:** Protected route redirecting to itself
- **Fix:** Ensure login page route is not protected

## Security Considerations

1. **Token Storage:** Tokens are stored in localStorage, which is vulnerable to XSS. Ensure:
   - All user input is sanitized
   - CSP headers are configured
   - No inline scripts

2. **Token Validation:** Always validate tokens server-side

3. **HTTPS Only:** All auth flows must use HTTPS in production

4. **Token Rotation:** Implement refresh token rotation for long-lived sessions

## Summary

The Finanzas auth architecture follows these key principles:

1. **AuthProvider** is the single source of truth for auth state
2. **useAuth** hook provides access to auth state and functions  
3. **useRole** hook derives role state from useAuth (no separate context)
4. **usePermissions** hook provides granular permission checks
5. **AccessControl** and **Protected** components handle UI-level access control
6. **JWT tokens** are stored in localStorage and validated on every app load
7. **Role-based access** determines what users can see and do

This architecture ensures consistency, maintainability, and a clear separation of concerns between authentication, authorization, and business logic.
