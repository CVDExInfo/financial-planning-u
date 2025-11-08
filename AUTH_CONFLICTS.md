# SDT (Finanzas) Authentication Conflict Analysis & Resolution

**Date:** November 8, 2025  
**Status:** Gap Analysis Complete | Recommended Fixes Provided  
**Author:** Auth Architecture Review

---

## Executive Summary

The current Finanzas UI implementation has **foundational auth conflicts** with the SDT requirements. The system is currently using a **GitHub Spark Runtime** auth model (demo-based, role-only), while **SDT requires Cognito IdP JWT validation for API security**.

**Critical Issues:**

1. ❌ No Cognito integration (no JWT issuance/validation in UI)
2. ❌ LoginPage hardcoded to GitHub auth (not Cognito)
3. ❌ No login credentials collection (username/password form)
4. ❌ `finz_jwt` token is **never populated** (API client searches localStorage but nothing sets it)
5. ⚠️ AuthProvider assumes demo user fallback (API will reject calls without valid JWT)
6. ❌ No Cognito Hosted UI integration or OAuth flow
7. ❌ No token expiration / refresh handling
8. ✅ Storage key `finz_jwt` is correct
9. ✅ Vite base `/finanzas/` is correct
10. ✅ Router basename `/finanzas` is correct
11. ✅ API client Bearer token injection is correct

---

## Current State vs. Required State

### 1. **Authentication Flow**

#### Current (❌ Broken)

```
Spark Runtime (GitHub)
  → sparkUser object
  → Demo roles (PMO, SDMT, etc.)
  → No JWT generated
  → API calls fail (no Authorization header with valid JWT)
```

#### Required (✅ SDT Standard)

```
User Form (username/password)
  → Cognito Hosted UI / Direct Cognito Auth
  → IdToken (JWT with aud=dshos5iou44tuach7ta3ici5m)
  → Store in localStorage.finz_jwt
  → Every API call carries: Authorization: Bearer <IdToken>
  → Lambda authorizer validates JWT (aud, iss, exp)
```

---

### 2. **LoginPage Component**

#### Current (❌ GitHub Auth Only)

```tsx
// src/components/LoginPage.tsx (lines 17-20)
const handleSignIn = async () => {
  setIsLoading(true);
  try {
    await signIn(); // Calls AuthProvider.signIn() which re-initializes spark
  } catch (error) {
    console.error("Sign in failed:", error);
  } finally {
    setIsLoading(false);
  }
};
```

**Issues:**

- No username/password form
- No Cognito auth call
- `signIn()` just calls `initializeAuth()` which looks for `window.spark.user()`
- In production (no Spark), falls back to demo user (API will fail)
- Label says "Sign in with GitHub" (false; actually demo mode)

#### Required (✅ Cognito IdP)

```tsx
// NEW LoginPage structure needed:
async function handleLogin(username: string, password: string) {
  const client_id = "dshos5iou44tuach7ta3ici5m";  // from Cognito
  const region = "us-east-2";

  const result = await window.fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", ... },
    body: JSON.stringify({
      ClientId: client_id,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: username, PASSWORD: password }
    })
  });

  const { AuthenticationResult } = await result.json();
  const idToken = AuthenticationResult.IdToken;  // JWT string

  localStorage.setItem('finz_jwt', idToken);

  // User info from ID token claims (or fetch separately)
  const user = decodeToken(idToken);  // { sub, aud, email, cognito:groups, ... }

  return { idToken, user };
}
```

---

### 3. **AuthProvider Initialization**

#### Current (❌ No Real Auth)

```tsx
// src/components/AuthProvider.tsx (lines 53-85)
const initializeAuth = async () => {
  setIsLoading(true);
  try {
    if (typeof window !== 'undefined' && (window as any).spark?.user) {
      const sparkUser = await (window as any).spark.user();
      // ✅ Spark found → great for dev
      const enhancedUser: UserInfo = { ...sparkUser, roles: [...] };
      setUser(enhancedUser);
    } else {
      // ❌ No Spark → fallback to hardcoded demo
      const demoUser: UserInfo = {
        id: 'demo-user',
        login: 'demo-user',
        email: 'demo@ikusi.com',
        roles: ['PMO', 'SDMT', 'VENDOR', 'EXEC_RO'],
        current_role: 'SDMT'
      };
      setUser(demoUser);  // ← This sets isAuthenticated=true but NO JWT!
    }
  } catch (error) {
    // ... fallback to fallback user ...
  }
};
```

**Issues:**

- `setUser()` is called **without checking for JWT in localStorage**
- In production (no Spark), app marks user as "authenticated" but never set `finz_jwt`
- API calls will fail (no Bearer token)

#### Required (✅ Check for Existing JWT)

```tsx
const initializeAuth = async () => {
  setIsLoading(true);
  try {
    // 1. Check for existing valid JWT (e.g., user returning to app)
    const existingJwt = localStorage.getItem('finz_jwt');
    if (existingJwt) {
      try {
        const decoded = decodeJWT(existingJwt);
        if (isTokenValid(decoded)) {  // Check exp, aud, iss
          setUser({
            id: decoded.sub,
            login: decoded['cognito:username'] || decoded.email,
            email: decoded.email,
            roles: (decoded['cognito:groups'] || '').split(','),
            current_role: 'SDT'  // or from decoded claims
          });
          setIsLoading(false);
          return;  // ← User is properly authenticated with JWT
        } else {
          localStorage.removeItem('finz_jwt');  // Expired
        }
      } catch {
        localStorage.removeItem('finz_jwt');  // Invalid
      }
    }

    // 2. If no valid JWT, check for Spark (dev only)
    if ((window as any).spark?.user) {
      const sparkUser = await (window as any).spark.user();
      setUser({ ...sparkUser, roles: [...] });
      // Still need to get JWT for API calls (or use test token)
    } else {
      // 3. No JWT, no Spark → redirect to login
      setUser(null);  // isAuthenticated = false → LoginPage shown
    }
  } finally {
    setIsLoading(false);
  }
};
```

---

### 4. **LoginPage Form**

#### Current (❌ No Credential Form)

```tsx
// Just a button that calls signIn()
// No username/password input
```

#### Required (✅ Cognito Credentials)

```tsx
// Pseudo-code for required LoginPage
export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCognito } = useAuth(); // NEW method on context

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await loginWithCognito(username, password);
      // On success, redirect happens in AuthProvider/useEffect
    } catch (err) {
      setError(err.message); // e.g., "Invalid username or password"
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
```

---

### 5. **API Client Token Injection**

#### Current (✅ Correct Intent, But Token Never Set)

```ts
// src/api/finanzasClient.ts (lines 37-41)
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("finz_jwt") || STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

**Good:**

- ✅ Checks `finz_jwt` key (correct key name)
- ✅ Falls back to `VITE_API_JWT_TOKEN` (for CI/testing)
- ✅ Bearer token format is correct

**Problem:**

- ❌ In production, `finz_jwt` is **never set** (no login path sets it)
- ❌ `STATIC_TEST_TOKEN` only helps in CI, not user auth

#### Verification (Still Good, But Needs Token Source)

```ts
// This part is fine; the issue is upstream (LoginPage must set finz_jwt)
function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem("finz_jwt") ||
    import.meta.env.VITE_API_JWT_TOKEN ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
  // If no token: returns {} → API will respond 401 (Unauthorized)
}
```

---

### 6. **Router & Vite Config**

#### Current (✅ Correct for SDT)

```ts
// vite.config.ts (lines 24-26, 44)
base: isPmo ? "/" : "/finanzas/",
define: {
  "import.meta.env.VITE_APP_BASENAME": JSON.stringify(isPmo ? "/" : "/finanzas"),
}

// App.tsx (lines 116-121)
const basename = import.meta.env.VITE_APP_BASENAME || "/finanzas/".replace(/\/$/, "");
return (
  <BrowserRouter basename={basename}>
    ...
  </BrowserRouter>
);
```

**Status:** ✅ **Already Correct**

- Base path: `/finanzas/` (for S3 + CloudFront)
- Router basename: `/finanzas` (for React Router)
- Both set properly

---

### 7. **Environment Variables**

#### Current (Partial)

```env
# Present:
VITE_APP_BASENAME=/finanzas
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

# Missing:
VITE_API_JWT_TOKEN=<test-jwt>        # For CI
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_DOMAIN=https://ikusi-auth.auth.us-east-2.amazonaws.com  # If using Hosted UI
```

#### Required (✅ Add These)

```bash
# Cognito credentials (needed in LoginPage)
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_HOSTED_UI_DOMAIN=ikusi-auth.auth.us-east-2.amazonaws.com  # Optional, if using hosted UI

# API token (for CI/test)
VITE_API_JWT_TOKEN=<valid-jwt-or-empty>
```

---

## Detailed Conflict Resolution

### Conflict #1: Login Flow (GitHub → Cognito)

**Symptom:**

- Current: LoginPage has "Sign in with GitHub" button
- Required: LoginPage needs username/password form for Cognito

**Resolution Steps:**

1. **Replace LoginPage with Cognito form:**

   - Remove "Sign in with GitHub" button
   - Add username (email) and password inputs
   - Call new `loginWithCognito(username, password)` method on AuthProvider

2. **Add `loginWithCognito` method to AuthProvider:**

   ```tsx
   const loginWithCognito = async (username: string, password: string) => {
     const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
     const region = import.meta.env.VITE_COGNITO_REGION;

     const result = await fetch(
       `https://cognito-idp.${region}.amazonaws.com/`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/x-amz-json-1.1",
           "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
         },
         body: JSON.stringify({
           ClientId: clientId,
           AuthFlow: "USER_PASSWORD_AUTH",
           AuthParameters: {
             USERNAME: username,
             PASSWORD: password,
           },
         }),
       }
     );

     if (!result.ok) {
       const err = await result.json();
       throw new Error(err.message || "Authentication failed");
     }

     const { AuthenticationResult } = await result.json();
     const idToken = AuthenticationResult.IdToken;

     localStorage.setItem("finz_jwt", idToken);

     // Re-initialize user from token claims
     await initializeAuth();
   };
   ```

3. **Update `initializeAuth` to check JWT first:**
   - Priority: 1) Valid JWT in localStorage, 2) Spark (dev), 3) Redirect to login

---

### Conflict #2: Token Storage (Never Set)

**Symptom:**

- `finanzasClient` checks `localStorage.finz_jwt`
- But nothing in the login flow sets it
- API calls fail with 401

**Resolution:**

- ✅ API client code is correct (already checks `finz_jwt`)
- ✅ Only needed fix: ensure `loginWithCognito` sets it (see Conflict #1)

---

### Conflict #3: User Info (Demo User vs. JWT Claims)

**Symptom:**

- Current: Demo user with hardcoded roles
- Required: User roles from Cognito JWT (`cognito:groups` claim)

**Resolution:**

```tsx
// In AuthProvider.initializeAuth() or after successful login:

function decodeJWT(token: string) {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64").toString());
}

// After setting finz_jwt in localStorage:
const decoded = decodeJWT(localStorage.getItem("finz_jwt")!);

const user: UserInfo = {
  id: decoded.sub,
  login: decoded["cognito:username"] || decoded.email,
  email: decoded.email,
  avatarUrl: "",
  isOwner: decoded["cognito:groups"]?.includes("admin"),
  roles: (decoded["cognito:groups"] || []) as UserRole[],
  current_role: (decoded["cognito:groups"]?.[0] || "SDT") as UserRole,
};

setUser(user);
```

---

### Conflict #4: CORS & Origin Check

**Symptom:**

- API Lambda expects `Authorization` header with valid JWT
- But UI may fail if CORS not set correctly

**Status:** ✅ **Verified in Deployment**

- API Gateway has CORS enabled for `https://d7t9x3j66yd8k.cloudfront.net`
- `Authorization` header allowed
- No fix needed (already in place)

---

### Conflict #5: Session Persistence (Page Refresh)

**Symptom:**

- User logs in (JWT set)
- Refreshes page
- Currently: AuthProvider checks Spark, finds nothing, falls back to demo user
- Issue: Loses JWT context even though token is still in localStorage

**Resolution:**

- Update `initializeAuth()` to check localStorage first
- If valid JWT present, decode and set user from claims
- Only fall back to Spark/demo if no valid JWT

---

## Implementation Checklist

### Phase 1: Core Auth Flow (Required)

- [ ] Add Cognito env vars to `.env` / build config
- [ ] Create `loginWithCognito(username, password)` in AuthProvider
- [ ] Update `LoginPage` to show username/password form
- [ ] Update `initializeAuth()` to check JWT first
- [ ] Add JWT decode utility (or use `jwt-decode` package)
- [ ] Test login → token set → page shows data

### Phase 2: Token Refresh (Recommended)

- [ ] Store `RefreshToken` in localStorage (from Cognito)
- [ ] Detect token expiration (check `exp` claim)
- [ ] Auto-refresh before API call if near expiration
- [ ] Handle 401 from API → refresh → retry

### Phase 3: Sign Out (Required)

- [ ] Clear `finz_jwt` and `refresh_token` from localStorage
- [ ] Redirect to login page
- [ ] Optionally: call Cognito sign-out endpoint

### Phase 4: Error Handling (Required)

- [ ] 401 from API → redirect to login
- [ ] Invalid credentials → show error on LoginPage
- [ ] Expired JWT → refresh or re-authenticate
- [ ] Network error during login → retry logic

---

## Mini Test Plan (Post-Fix)

### Terminal Test

```bash
export USERNAME="christian.valencia@ikusi.com"
export PASSWORD="Velatia@2025"
export REGION="us-east-2"
export CLIENT_ID="dshos5iou44tuach7ta3ici5m"

# 1. Get ID token (same as UI will get)
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region $REGION \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' --output text)

echo "✅ Token obtained"
echo "Token: ${ID_TOKEN:0:50}..."

# 2. Decode and verify claims
echo "$ID_TOKEN" | cut -d. -f2 | base64 -d | jq '.'
# Expected:
# - "aud": "dshos5iou44tuach7ta3ici5m"
# - "iss": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY"
# - "exp": <future-timestamp>
# - "email": "christian.valencia@ikusi.com"

# 3. Call API with token
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros | jq '.data | length'
# Expected: 71 (or > 0)
```

### UI Test (Manual)

```bash
# 1. Open browser to finanzas
open https://d7t9x3j66yd8k.cloudfront.net/finanzas/

# 2. Login page should show:
#    - Email input (not GitHub button)
#    - Password input
#    - Sign In button

# 3. Enter credentials:
#    - Email: christian.valencia@ikusi.com
#    - Password: Velatia@2025

# 4. After sign in:
#    - Should redirect to /finanzas/
#    - Catalog page should load (table with rubros)
#    - Check DevTools → Application → LocalStorage → finz_jwt present

# 5. Verify API calls:
#    - Open DevTools → Network
#    - Each API call should have: Authorization: Bearer <token>
#    - Status should be 200 (not 401)

# 6. Refresh page:
#    - Should stay logged in (token in localStorage)
#    - Catalog still visible
```

---

## Code Examples (Ready to Implement)

### Example 1: Updated AuthProvider Context Type

```tsx
interface AuthContextType {
  // Authentication state
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Role management
  currentRole: UserRole;
  availableRoles: UserRole[];
  setRole: (role: UserRole) => void;

  // Permission checking
  canAccessRoute: (route: string) => boolean;
  canPerformAction: (action: string) => boolean;

  // Authentication actions
  signIn: () => Promise<void>;
  signOut: () => void;

  // ← NEW: Cognito-specific login
  loginWithCognito: (username: string, password: string) => Promise<void>;
}
```

### Example 2: Cognito Login Method

```tsx
const loginWithCognito = async (
  username: string,
  password: string
): Promise<void> => {
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const region = import.meta.env.VITE_COGNITO_REGION || "us-east-2";

  if (!clientId) {
    throw new Error("VITE_COGNITO_CLIENT_ID not configured");
  }

  try {
    const response = await fetch(
      `https://cognito-idp.${region}.amazonaws.com/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({
          ClientId: clientId,
          AuthFlow: "USER_PASSWORD_AUTH",
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Authentication failed");
    }

    const { AuthenticationResult } = await response.json();

    if (!AuthenticationResult?.IdToken) {
      throw new Error("No ID token received");
    }

    // Store JWT
    localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);

    // Optional: store refresh token
    if (AuthenticationResult.RefreshToken) {
      localStorage.setItem(
        "finz_refresh_token",
        AuthenticationResult.RefreshToken
      );
    }

    // Re-initialize with JWT claims
    await initializeAuth();
  } catch (error) {
    localStorage.removeItem("finz_jwt");
    localStorage.removeItem("finz_refresh_token");
    throw error;
  }
};
```

### Example 3: Updated initializeAuth

```tsx
const initializeAuth = async () => {
  setIsLoading(true);

  try {
    // 1. Check for valid JWT in localStorage (existing session)
    const jwt = localStorage.getItem("finz_jwt");
    if (jwt) {
      try {
        const decoded = decodeJWT(jwt);

        // Verify token not expired
        if (decoded.exp * 1000 > Date.now()) {
          // ✅ Valid JWT found
          const user: UserInfo = {
            id: decoded.sub,
            login: decoded["cognito:username"] || decoded.email || "user",
            email: decoded.email,
            avatarUrl: "",
            isOwner: false,
            roles: (decoded["cognito:groups"] || []) as UserRole[],
            current_role: (decoded["cognito:groups"]?.[0] || "SDT") as UserRole,
          };

          setUser(user);
          setAvailableRoles(user.roles);
          setIsLoading(false);
          return;
        } else {
          // Expired: clear and continue
          localStorage.removeItem("finz_jwt");
        }
      } catch (e) {
        console.warn("Invalid JWT in localStorage:", e);
        localStorage.removeItem("finz_jwt");
      }
    }

    // 2. Check for Spark (dev/demo mode only)
    if (typeof window !== "undefined" && (window as any).spark?.user) {
      const sparkUser = await (window as any).spark.user();
      const demoUserData = DEMO_USERS[sparkUser.login] || {};

      const user: UserInfo = {
        ...sparkUser,
        roles: demoUserData.roles || ["SDT"],
        current_role: "SDT",
      };

      setUser(user);
      setAvailableRoles(user.roles);
      setIsLoading(false);
      return;
    }

    // 3. No JWT and no Spark → not authenticated, show LoginPage
    setUser(null);
    setAvailableRoles([]);
  } catch (error) {
    console.error("Auth initialization error:", error);
    setUser(null);
    setAvailableRoles([]);
  } finally {
    setIsLoading(false);
  }
};

function decodeJWT(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));

  return decoded;
}
```

### Example 4: Updated LoginPage (Cognito Form)

```tsx
import { useState, FormEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCognito } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loginWithCognito(username, password);
      // On success, AuthProvider redirects to home via useEffect
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
      setPassword(""); // Clear password on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="glass-card">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">
                  I
                </span>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl">
                Financial Planning & Management
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Ikusi Digital Platform
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@ikusi.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full h-11"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground">
              <p>
                <strong>Test Credentials:</strong>
              </p>
              <p className="mt-1">
                Email: <code>christian.valencia@ikusi.com</code>
              </p>
              <p>
                Password: <code>Velatia@2025</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "sonner": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Optional (for easier JWT handling):**

```json
{
  "dependencies": {
    "jwt-decode": "^4.0.0"
  }
}
```

If using jwt-decode:

```tsx
import { jwtDecode } from "jwt-decode";
const decoded = jwtDecode(token);
```

---

## Cognito Configuration Verification

### Required Cognito App Client Settings

Run this to verify (or fix):

```bash
APP_CLIENT_ID="dshos5iou44tuach7ta3ici5m"
USER_POOL_ID="us-east-2_FyHLtOhiY"
REGION="us-east-2"

# Check current settings
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $APP_CLIENT_ID \
  --region $REGION \
  --query '{
    AllowedOAuthFlows,
    AllowedOAuthScopes,
    CallbackURLs,
    LogoutURLs,
    ExplicitAuthFlows,
    AllowedOAuthFlowsUserPoolClient,
    AllowUserPasswordAuth
  }' --output table

# Expected output:
# AllowedOAuthFlows      | ALLOW_REFRESH_TOKEN_AUTH,ALLOW_USER_PASSWORD_AUTH
# ExplicitAuthFlows      | ADMIN_NO_SRP_AUTH,USER_PASSWORD_AUTH
# CallbackURLs           | https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# LogoutURLs             | https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

### If Settings Need Fixing:

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $APP_CLIENT_ID \
  --region $REGION \
  --explicit-auth-flows ADMIN_NO_SRP_AUTH USER_PASSWORD_AUTH \
  --allowed-oauth-flows ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
  --callback-urls "https://d7t9x3j66yd8k.cloudfront.net/finanzas/" \
  --logout-urls "https://d7t9x3j66yd8k.cloudfront.net/finanzas/" \
  --allow-user-password-auth
```

---

## Summary of Fixes (Priority Order)

| Priority | Issue                        | Fix                                                              | Status |
| -------- | ---------------------------- | ---------------------------------------------------------------- | ------ |
| P0       | No LoginPage form            | Replace with Cognito credentials form                            | TODO   |
| P0       | No `loginWithCognito` method | Add to AuthProvider                                              | TODO   |
| P0       | `finz_jwt` never set         | Login flow must call `localStorage.setItem('finz_jwt', idToken)` | TODO   |
| P1       | JWT not checked on reload    | Update `initializeAuth()` to check JWT first                     | TODO   |
| P1       | Demo user fallback           | Remove; redirect to login if no JWT                              | TODO   |
| P2       | Token refresh                | Add refresh logic (optional for MVP)                             | TODO   |
| P2       | Sign-out flow                | Clear JWT + redirect to login                                    | TODO   |
| P3       | Error handling               | Show login errors to user                                        | TODO   |

---

## Next Steps

1. **Review this document** with team (auth requirements, conflicts, examples)
2. **Update environment** with Cognito vars
3. **Implement Phase 1** (LoginPage + AuthProvider updates)
4. **Test with terminal** (verify JWT flow)
5. **Test in browser** (login → catalog loads)
6. **Implement Phase 2** (token refresh) if MVP+ timeline
7. **Document** in repo README

---

## References

- **Cognito Auth Flows:** https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html
- **JWT Claims:** https://docs.aws.amazon.com/cognito/latest/developerguide/user-pools-tokens-verifying-a-jwt.html
- **API Gateway JWT Authorizer:** https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-use-lambda-authorizer.html
- **SDT Finanzas Architecture:** See `docs/architecture/finanzas-architecture.md`
