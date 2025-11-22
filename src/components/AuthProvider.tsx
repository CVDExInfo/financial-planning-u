/**
 * AuthProvider - Single Source of Truth for Authentication and Role Management
 * 
 * This component is the unified authentication and role management provider for the application.
 * It consolidates what was previously split between AuthProvider and RoleProvider (now deprecated).
 * 
 * As documented in:
 * - docs/finanzas-auth-notes.md
 * - FINANZAS_AUTH_REPAIR_SUMMARY.md
 * - PR #221 Finalization – Architecture Verification Report
 * 
 * RESPONSIBILITIES:
 * 1. Authentication State Management
 *    - Validates and stores JWT tokens from localStorage
 *    - Decodes JWT to extract user info and Cognito groups
 *    - Manages authentication lifecycle (init, login, logout, refresh)
 * 
 * 2. Role Management
 *    - Maps Cognito groups to application roles (SDMT, PMO, VENDOR, EXEC_RO)
 *    - Maintains current role selection with persistence
 *    - Enforces role availability based on user's Cognito groups
 * 
 * 3. Permission Checking
 *    - Route-level access control based on current role
 *    - Action-level permission checking
 * 
 * USAGE:
 *   Wrap your app or module with <AuthProvider>:
 *   
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * 
 *   Then use useAuth() hook in components:
 *   
 *   const { user, isAuthenticated, currentRole, loginWithCognito, signOut } = useAuth();
 * 
 * TOKEN STORAGE:
 *   - cv.jwt: Primary unified token key
 *   - finz_jwt: Legacy Finanzas token key (backward compatibility)
 *   - cognitoIdToken, idToken: Additional fallback keys for older API clients
 *   - finz_refresh_token: Refresh token for token renewal
 * 
 * @see useAuth Hook for accessing this context
 * @see useRole Hook for role-specific convenience methods
 */
import React, {
  createContext,
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
} from "@/lib/auth";
import {
  decodeJWT,
  isTokenValid,
  getGroupsFromClaims,
  mapCognitoGroupsToRoles,
} from "@/lib/jwt";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import awsConfig from "@/config/aws";

/**
 * AuthContext Type Definition
 * 
 * This interface defines the complete public API of AuthProvider.
 * All authentication and role management state and methods are exposed through this context.
 */
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

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Persist current role selection
  const [currentRole, setCurrentRole] = useLocalStorage<UserRole>(
    "user-current-role",
    "SDMT"
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
      const effectiveCurrentRole = currentRole || "SDMT";
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
    // Use environment variable if available, otherwise fall back to aws config
    const clientId =
      import.meta.env.VITE_COGNITO_CLIENT_ID ||
      awsConfig.aws_user_pools_web_client_id;
    const region =
      import.meta.env.VITE_COGNITO_REGION || awsConfig.aws_cognito_region;

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

      // ✅ Store JWT (unified + legacy for backward compatibility)
      localStorage.setItem("cv.jwt", AuthenticationResult.IdToken);
      localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);
      // Additional legacy keys used by older API helpers
      localStorage.setItem("idToken", AuthenticationResult.IdToken);
      localStorage.setItem("cognitoIdToken", AuthenticationResult.IdToken);

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

      // Role-based redirect logic (matches callback.html behavior)
      // Decode the token to get groups and determine redirect
      const decoded = decodeJWT(AuthenticationResult.IdToken);
      const groups = getGroupsFromClaims(decoded);

      const canSDT = groups.some((g) =>
        ["SDT", "FIN", "AUD", "sdmt", "fin", "aud"].includes(g.toUpperCase())
      );
      const canPMO = groups.some((g) =>
        ["PM", "PMO", "EXEC_RO", "VENDOR", "admin", "pmo"].includes(
          g.toUpperCase()
        )
      );

      // Preference resolution for dual-role users
      const pref = localStorage.getItem("cv.module");
      let targetPath = "/";

      if (canSDT && !canPMO) {
        targetPath = "/finanzas/";
      } else if (canPMO && !canSDT) {
        targetPath = "/";
      } else if (canSDT && canPMO) {
        // Both roles - use preference or default to Finanzas
        if (pref === "pmo" && canPMO) {
          targetPath = "/";
        } else if (pref === "finanzas" && canSDT) {
          targetPath = "/finanzas/";
        } else {
          // Default bias to Finanzas for dual-role users
          targetPath = "/finanzas/";
        }
      }

      // For Finanzas-only build, always redirect to /finanzas/ regardless
      if (import.meta.env.VITE_FINZ_ENABLED === "true") {
        targetPath = "/finanzas/";
      }

      // Perform redirect
      try {
        setTimeout(() => {
          window.location.replace(targetPath);
        }, 100);
      } catch (e) {
        console.warn("Redirect failed", e);
      }
    } catch (err) {
      // Clear any partial tokens on error
      localStorage.removeItem("cv.jwt");
      localStorage.removeItem("finz_jwt");
      localStorage.removeItem("finz_refresh_token");

      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      throw err;
    }
  };

  /**
   * Initialize authentication from JWT
   * Priority: 1) Valid JWT in localStorage, 2) Not authenticated
   */
  const initializeAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check for valid JWT in localStorage (existing session)
      const jwt =
        localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
      if (jwt) {
        try {
          if (isTokenValid(jwt)) {
            // ✅ Valid JWT found
            const decoded = decodeJWT(jwt);
            const groups = getGroupsFromClaims(decoded);
            const roles = mapCognitoGroupsToRoles(groups);
            const mappedRoles = roles.filter((r): r is UserRole =>
              ["PMO", "SDMT", "VENDOR", "EXEC_RO"].includes(r)
            );
            const defaultRole: UserRole = mappedRoles[0] || "SDMT";

            const authenticatedUser: UserInfo = {
              id: decoded.sub,
              login:
                decoded.email ||
                decoded["cognito:username"] ||
                decoded["preferred_username"] ||
                "user",
              email: decoded.email || "unknown",
              avatarUrl: "",
              isOwner: groups.includes("admin"),
              roles: mappedRoles.length > 0 ? mappedRoles : ["SDMT"],
              current_role: defaultRole,
            };

            // Ensure token is stored in both cv.jwt and finz_jwt for cross-module compatibility
            // If user logged into PMO first and navigates to Finanzas, this ensures the token is available
            const cvJwt = localStorage.getItem("cv.jwt");
            const finzJwt = localStorage.getItem("finz_jwt");
            if (cvJwt && !finzJwt) {
              localStorage.setItem("finz_jwt", cvJwt);
            } else if (finzJwt && !cvJwt) {
              localStorage.setItem("cv.jwt", finzJwt);
            }

            setUser(authenticatedUser);
            setAvailableRoles(authenticatedUser.roles);
            setIsLoading(false);
            return; // ← Successfully authenticated with JWT
          } else {
            // Expired or invalid: clear and continue
            console.warn("[Auth] JWT expired or invalid, clearing");
            localStorage.removeItem("cv.jwt");
            localStorage.removeItem("finz_jwt");
            localStorage.removeItem("finz_refresh_token");
          }
        } catch (e) {
          console.warn("[Auth] Failed to process JWT:", e);
          localStorage.removeItem("cv.jwt");
          localStorage.removeItem("finz_jwt");
          localStorage.removeItem("finz_refresh_token");
        }
      }

      // 2. No JWT → not authenticated, show LoginPage
      setUser(null);
      setAvailableRoles([]);
      console.log("[Auth] Not authenticated; show LoginPage");
    } catch (error) {
      console.error("[Auth] Initialization error:", error);
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
    localStorage.removeItem("cv.jwt");
    localStorage.removeItem("cv.module");

    setUser(null);
    setCurrentRole("PMO");
    setAvailableRoles([]);
    setError(null);

    toast.success("Signed out successfully");

    // For Finanzas-only build, redirect to login
    // For PMO build or dual-module, stay on current path (will show login if needed)
    if (import.meta.env.VITE_FINZ_ENABLED === "true") {
      // Redirect to Finanzas home (which will show login page due to no auth)
      setTimeout(() => {
        window.location.href = "/finanzas/";
      }, 500);
    }
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
    // Persist preference for dual-role routing (neutral callback)
    try {
      if (role === "PMO") localStorage.setItem("cv.module", "pmo");
      else localStorage.setItem("cv.module", "finanzas");
    } catch {
      // Preference storage is non-critical; ignore errors (e.g., private mode)
    }

    // Update user object
    if (user) {
      setUser((prev) => (prev ? { ...prev, current_role: role } : prev));
    }

    toast.success(`Role changed to ${role}`, {
      description: `Switched from ${previousRole} to ${role}`,
    });
  };

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(route, currentRole || "PMO");
  };

  const checkActionPermission = (action: string): boolean => {
    return canPerformAction(action, currentRole || "PMO");
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    currentRole: currentRole || "PMO",
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
