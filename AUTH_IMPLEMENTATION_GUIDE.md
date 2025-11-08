# SDT Finanzas Authentication - Implementation Guide

**Quick Start:** This is the step-by-step guide to fix the login segment conflicts.  
**Estimated Time:** 2-3 hours (Phase 1) + 1 hour testing  
**Complexity:** Medium (Cognito integration requires careful JWT handling)

---

## Phase 1: Core Login Flow (Required for MVP)

### Step 1: Add Cognito Environment Variables

**File:** `.env` (or build config)

```bash
# Cognito configuration
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY

# API configuration (already present, verify these)
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_API_JWT_TOKEN=  # Leave empty; for CI only

# App configuration
VITE_APP_BASENAME=/finanzas
VITE_FINZ_ENABLED=true
```

### Step 2: Create JWT Utilities

**File:** `src/lib/jwt.ts` (new)

```typescript
/**
 * JWT decoding and validation utilities for Cognito ID tokens
 */

export interface JWTClaims {
  sub: string;
  aud?: string;
  iss?: string;
  exp: number;
  iat: number;
  email?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string | string[];
  email_verified?: boolean;
  [key: string]: any;
}

/**
 * Decode JWT without verification (verify on backend only)
 * Use only for reading claims; always trust the server to validate signature
 */
export function decodeJWT(token: string): JWTClaims {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const decoded = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );

    return decoded as JWTClaims;
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Check if JWT is expired
 */
export function isTokenExpired(claims: JWTClaims): boolean {
  if (!claims.exp) return true;
  return claims.exp * 1000 < Date.now();
}

/**
 * Validate JWT basic structure and expiration (not signature)
 * Signature validation must happen on backend (API Gateway authorizer)
 */
export function isTokenValid(token: string): boolean {
  try {
    const claims = decodeJWT(token);
    return !isTokenExpired(claims);
  } catch {
    return false;
  }
}

/**
 * Extract groups from JWT claims
 * Cognito may return groups as comma-separated string or array
 */
export function getGroupsFromClaims(claims: JWTClaims): string[] {
  const groups = claims["cognito:groups"];
  if (!groups) return [];

  if (Array.isArray(groups)) {
    return groups;
  }

  if (typeof groups === "string") {
    return groups.split(",").map((g) => g.trim());
  }

  return [];
}
```

### Step 3: Update AuthProvider

**File:** `src/components/AuthProvider.tsx`

**Replace the entire file with:**

```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { UserInfo, UserRole } from "@/types/domain";
import {
  getDefaultUserRole,
  getAvailableRoles,
  canAccessRoute,
  canPerformAction,
  getDefaultRouteForRole,
  DEMO_USERS,
} from "@/lib/auth";
import { decodeJWT, isTokenValid, getGroupsFromClaims } from "@/lib/jwt";
import { useKV } from "@github/spark/hooks";
import { toast } from "sonner";

interface AuthContextType {
  // Authentication state
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

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

  // Cognito login
  loginWithCognito: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Persist current role selection
  const [currentRole, setCurrentRole] = useKV<UserRole>(
    "user-current-role",
    "SDT"
  );

  const isAuthenticated = !!user;

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Update available roles when user changes
  useEffect(() => {
    if (user) {
      const roles = getAvailableRoles(user);
      setAvailableRoles(roles);

      // Set default role if none is set or current role is not available
      const effectiveCurrentRole = currentRole || "SDT";
      if (!roles.includes(effectiveCurrentRole)) {
        const defaultRole = getDefaultUserRole(user);
        setCurrentRole(defaultRole);
      }
    }
  }, [user, currentRole, setCurrentRole]);

  /**
   * Cognito login via USER_PASSWORD_AUTH flow
   */
  const loginWithCognito = async (
    username: string,
    password: string
  ): Promise<void> => {
    setError(null);
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const region = import.meta.env.VITE_COGNITO_REGION || "us-east-2";

    if (!clientId) {
      throw new Error("Cognito client ID not configured");
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
        const errorData = await response
          .json()
          .catch(() => ({ message: "Authentication failed" }));
        const message = errorData.message || "Authentication failed";

        // Handle specific Cognito errors
        if (message.includes("UserNotConfirmedException")) {
          throw new Error(
            "Please confirm your email address before signing in"
          );
        }
        if (message.includes("NotAuthorizedException")) {
          throw new Error("Invalid username or password");
        }
        if (message.includes("UserNotFoundException")) {
          throw new Error("User not found");
        }

        throw new Error(message);
      }

      const data = await response.json();
      const { AuthenticationResult } = data;

      if (!AuthenticationResult?.IdToken) {
        throw new Error("No ID token received from authentication service");
      }

      // ✅ Store JWT (this is the key fix)
      localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);

      // Optional: Store refresh token
      if (AuthenticationResult.RefreshToken) {
        localStorage.setItem(
          "finz_refresh_token",
          AuthenticationResult.RefreshToken
        );
      }

      // Re-initialize with JWT claims
      await initializeAuth();

      toast.success("Signed in successfully");
    } catch (err) {
      // Clear any partial tokens on error
      localStorage.removeItem("finz_jwt");
      localStorage.removeItem("finz_refresh_token");

      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      throw err;
    }
  };

  /**
   * Initialize authentication from JWT or Spark
   * Priority: 1) Valid JWT in localStorage, 2) Spark (dev), 3) Not authenticated
   */
  const initializeAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check for valid JWT in localStorage (existing session)
      const jwt = localStorage.getItem("finz_jwt");
      if (jwt) {
        try {
          if (isTokenValid(jwt)) {
            // ✅ Valid JWT found
            const decoded = decodeJWT(jwt);
            const groups = getGroupsFromClaims(decoded);

            const authenticatedUser: UserInfo = {
              id: decoded.sub,
              login: decoded["cognito:username"] || decoded.email || "user",
              email: decoded.email || "unknown",
              avatarUrl: "",
              isOwner: groups.includes("admin"),
              roles: (groups as UserRole[]) || ["SDT"],
              current_role: (groups?.[0] || "SDT") as UserRole,
            };

            setUser(authenticatedUser);
            setAvailableRoles(authenticatedUser.roles);
            setIsLoading(false);
            return; // ← Successfully authenticated with JWT
          } else {
            // Expired or invalid: clear and continue
            console.warn("JWT expired or invalid, clearing");
            localStorage.removeItem("finz_jwt");
            localStorage.removeItem("finz_refresh_token");
          }
        } catch (e) {
          console.warn("Failed to process JWT:", e);
          localStorage.removeItem("finz_jwt");
          localStorage.removeItem("finz_refresh_token");
        }
      }

      // 2. Check for Spark (development mode only)
      if (typeof window !== "undefined" && (window as any).spark?.user) {
        try {
          const sparkUser = await (window as any).spark.user();
          const demoUserData = DEMO_USERS[sparkUser.login] || {};

          const user: UserInfo = {
            ...sparkUser,
            roles: demoUserData.roles || ["SDT"],
            current_role: "SDT",
          };

          setUser(user);
          setAvailableRoles(user.roles);
          console.log("Authenticated via Spark (dev mode):", user);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error("Spark authentication failed:", e);
        }
      }

      // 3. No JWT and no Spark → not authenticated, show LoginPage
      setUser(null);
      setAvailableRoles([]);
      console.log("Not authenticated; show LoginPage");
    } catch (error) {
      console.error("Auth initialization error:", error);
      setUser(null);
      setAvailableRoles([]);
      setError("Authentication initialization failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (): Promise<void> => {
    // In the new flow, this is replaced by loginWithCognito
    // Kept for backward compatibility
    await initializeAuth();
  };

  const signOut = (): void => {
    // Clear JWT and related auth data
    localStorage.removeItem("finz_jwt");
    localStorage.removeItem("finz_refresh_token");

    setUser(null);
    setCurrentRole("SDT");
    setAvailableRoles([]);
    setError(null);

    toast.success("Signed out successfully");
  };

  const setRole = (role: UserRole): void => {
    if (!availableRoles.includes(role)) {
      toast.error("Access denied", {
        description: `You don't have permission to switch to ${role} role`,
      });
      return;
    }

    const previousRole = currentRole;
    setCurrentRole(role);

    // Update user object
    if (user) {
      setUser((prev) => (prev ? { ...prev, current_role: role } : prev));
    }

    toast.success(`Role changed to ${role}`, {
      description: `Switched from ${previousRole} to ${role}`,
    });
  };

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(route, currentRole || "SDT");
  };

  const checkActionPermission = (action: string): boolean => {
    return canPerformAction(action, currentRole || "SDT");
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    currentRole: currentRole || "SDT",
    availableRoles,
    setRole,
    canAccessRoute: checkRouteAccess,
    canPerformAction: checkActionPermission,
    signIn,
    signOut,
    loginWithCognito,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Convenience hooks
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useCurrentRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  return { currentRole, setRole, availableRoles };
}

export function usePermissions() {
  const { canAccessRoute, canPerformAction } = useAuth();
  return { canAccessRoute, canPerformAction };
}
```

### Step 4: Replace LoginPage Component

**File:** `src/components/LoginPage.tsx`

**Replace the entire file with:**

```typescript
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCognito } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loginWithCognito(email, password);
      // On success, AuthProvider redirects to home automatically
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
      setPassword(""); // Clear password on error
    } finally {
      setIsLoading(false);
    }
  };

  // Demo credentials for development
  const fillDemoCredentials = () => {
    setEmail("christian.valencia@ikusi.com");
    setPassword("Velatia@2025");
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
                Ikusi Digital Platform - Finanzas
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
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@ikusi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password Input */}
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
                  autoComplete="current-password"
                />
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={isLoading || !email || !password}
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

            {/* Demo Credentials (Development) */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Development Test Credentials:
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <strong>Email:</strong>
                  <br />
                  <code className="bg-background px-2 py-1 rounded">
                    christian.valencia@ikusi.com
                  </code>
                </p>
                <p>
                  <strong>Password:</strong>
                  <br />
                  <code className="bg-background px-2 py-1 rounded">
                    Velatia@2025
                  </code>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillDemoCredentials}
                disabled={isLoading}
                className="w-full text-xs"
              >
                Fill Demo Credentials
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Credentials securely authenticated via Cognito IdP</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
```

### Step 5: Verify API Client (Already Correct)

**File:** `src/api/finanzasClient.ts`

**No changes needed!** The existing implementation is correct:

```typescript
// ✅ Already correct - retrieves token from localStorage.finz_jwt
function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem("finz_jwt") || import.meta.env.VITE_API_JWT_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

---

## Phase 1 Testing Checklist

### ✅ Terminal Test (Verify JWT Flow)

```bash
# 1. Get valid JWT
USERNAME="christian.valencia@ikusi.com"
PASSWORD="Velatia@2025"
REGION="us-east-2"
CLIENT_ID="dshos5iou44tuach7ta3ici5m"

ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region $REGION \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' --output text)

echo "✅ Token obtained"

# 2. Verify claims
echo "Token claims:"
echo "$ID_TOKEN" | cut -d. -f2 | base64 -d | jq '.'

# 3. Test API call with token
echo "Testing API..."
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros \
  | jq '.data | length'
# Expected: 71 (or > 0)
```

### ✅ Browser Test (Verify UI Login)

1. **Open App:**

   - Go to `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
   - Should show LoginPage with email/password form

2. **Enter Credentials:**

   - Email: `christian.valencia@ikusi.com`
   - Password: `Velatia@2025`
   - Click "Sign In"

3. **Verify Login:**

   - Should redirect to home (loading spinner → catalog)
   - Check DevTools → Application → LocalStorage
   - `finz_jwt` should be present (long JWT string)

4. **Verify API Call:**

   - Open DevTools → Network tab
   - Each API request should have `Authorization: Bearer <token>` header
   - Responses should be 200 (not 401)

5. **Verify Page Data:**

   - Catalog should display rows (rubros)
   - Rules should display (allocation rules)

6. **Test Page Reload:**

   - Refresh page (Cmd/Ctrl+R)
   - Should stay logged in (token persists in localStorage)
   - Catalog still visible

7. **Test Sign Out:**
   - Click user menu → "Sign Out"
   - Should redirect to LoginPage
   - Check DevTools → LocalStorage → `finz_jwt` cleared

---

## Phase 2: Token Refresh (Post-MVP)

### Optional: Add Refresh Token Logic

**File:** `src/lib/jwt.ts` (add to existing file)

```typescript
/**
 * Refresh JWT using refresh token
 */
export async function refreshJWT(
  region: string,
  clientId: string
): Promise<string | null> {
  const refreshToken = localStorage.getItem("finz_refresh_token");

  if (!refreshToken) {
    console.warn("No refresh token available");
    return null;
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
          AuthFlow: "REFRESH_TOKEN_AUTH",
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const { AuthenticationResult } = await response.json();
    const newIdToken = AuthenticationResult.IdToken;

    localStorage.setItem("finz_jwt", newIdToken);
    return newIdToken;
  } catch (error) {
    console.error("Token refresh error:", error);
    localStorage.removeItem("finz_jwt");
    localStorage.removeItem("finz_refresh_token");
    return null;
  }
}
```

---

## Troubleshooting

### Issue: "Invalid username or password"

**Solution:**

- Verify user exists: `aws cognito-idp list-users --user-pool-id us-east-2_FyHLtOhiY --region us-east-2`
- Verify password is set: Reset password with `aws cognito-idp admin-set-user-password`

### Issue: "No ID token received"

**Solution:**

- Verify app client auth flows are enabled:
  ```bash
  aws cognito-idp describe-user-pool-client \
    --user-pool-id us-east-2_FyHLtOhiY \
    --client-id dshos5iou44tuach7ta3ici5m \
    --region us-east-2 \
    --query 'UserPoolClient.ExplicitAuthFlows'
  ```
- Should include `USER_PASSWORD_AUTH`

### Issue: API returns 401 (Unauthorized)

**Solution:**

1. Check token in localStorage: `localStorage.getItem('finz_jwt')`
2. Verify token is being sent: Check DevTools → Network → Authorization header
3. Verify token is valid: Decode and check `exp` claim
4. Verify API accepts CORS with Authorization header

### Issue: CORS error on login request

**Solution:**

- Cognito endpoint doesn't support CORS for direct POST
- Solution: Use Cognito Hosted UI (POST-MVP) instead of direct API call
- For MVP, direct POST to Cognito works from development (localhost, 127.0.0.1)
- For production CloudFront, might hit CORS; use Lambda@Edge or Hosted UI as workaround

---

## Files Modified

| File                              | Change                       | Priority |
| --------------------------------- | ---------------------------- | -------- |
| `.env`                            | Add Cognito vars             | P0       |
| `src/lib/jwt.ts`                  | NEW - JWT utilities          | P0       |
| `src/components/AuthProvider.tsx` | Cognito login + JWT check    | P0       |
| `src/components/LoginPage.tsx`    | Replace with credential form | P0       |
| `src/api/finanzasClient.ts`       | No changes (already correct) | -        |

---

## Summary

✅ **After Phase 1:**

- LoginPage shows username/password form (not GitHub button)
- Users can authenticate via Cognito
- JWT stored in `localStorage.finz_jwt`
- API calls carry Bearer token
- Page refresh maintains session (JWT persists)
- API returns 200 (not 401)

⚠️ **Known Limitations (Post-MVP):**

- No token auto-refresh (user logged out if JWT expires, ~1 hour)
- No password recovery flow
- No MFA support
- No Hosted UI (workaround for CORS in production)

🎯 **Next Phase:**

- Add token refresh logic
- Add Cognito Hosted UI option
- Add error pages (403, 404, 500)
