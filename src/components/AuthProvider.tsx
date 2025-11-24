import React, { createContext, useEffect, useMemo, useState } from "react";

import { UserInfo, UserRole } from "@/types/domain";
import {
  getDefaultUserRole,
  getAvailableRoles,
  canAccessRoute,
  canPerformAction,
  getRoutesForRole,
  getRolePermissionKeys,
} from "@/lib/auth";
import { UserRole } from "@/types/domain";
import {
  decodeJWT,
  getGroupsFromClaims,
  isTokenValid,
  mapCognitoGroupsToRoles,
} from "@/lib/jwt";
import { loginWithHostedUI, logoutWithHostedUI } from "@/config/aws";

type AuthUser = {
  sub?: string;
  email?: string;
  name?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  groups: string[];
  roles: UserRole[];
  idToken: string | null;
  accessToken: string | null;
  avpDecisions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Role management
  currentRole: UserRole;
  availableRoles: UserRole[];
  setRole: (role: UserRole) => void;
  routeConfigMissing: boolean;

  // Permission checking
  canAccessRoute: (route: string) => boolean;
  canPerformAction: (action: string) => boolean;

  // Authentication actions
  signIn: () => Promise<void>;
  signOut: () => void;

  // Cognito login
  loginWithCognito: (username: string, password: string) => Promise<void>;
}
  login: () => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEYS = ["cv.jwt", "finz_jwt", "idToken", "cognitoIdToken"];

const readTokenFromStorage = (keys: string[]): string | null => {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [avpDecisions, setAvpDecisions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [routeConfigMissing, setRouteConfigMissing] = useState(false);
  const [groupClaims, setGroupClaims] = useState<string[]>([]);

  const roles = useMemo(
    () => mapCognitoGroupsToRoles(groups) as UserRole[],
    [groups]
  );

  const isAuthenticated = !!user && !!idToken;

  useEffect(() => {
    const initialize = () => {
      setIsLoading(true);

  useEffect(() => {
    const effectiveRole = currentRole || "PMO";
    const { routes, hasConfig } = getRoutesForRole(effectiveRole);

    if (!hasConfig) {
      setRouteConfigMissing(true);
      console.error("[Router] No route configuration found for role", {
        role: effectiveRole,
        user,
        availableRoles,
        groups: groupClaims,
        availableConfigs: getRolePermissionKeys(),
      });
    } else {
      setRouteConfigMissing(false);
      if (import.meta.env.DEV) {
        console.debug("[Router] Active role routes", {
          role: effectiveRole,
          routes,
        });
      }
    }
  }, [availableRoles, currentRole, groupClaims, user]);

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
      try {
        const storedIdToken = readTokenFromStorage(TOKEN_KEYS);
        const storedAccessToken =
          localStorage.getItem("finz_access_token") || null;

        if (storedIdToken && isTokenValid(storedIdToken)) {
          const claims = decodeJWT(storedIdToken);
          const cognitoGroups = getGroupsFromClaims(claims);
          const decisions = Array.isArray(claims["avp:decisions"])
            ? (claims["avp:decisions"] as string[])
            : [];

          setIdToken(storedIdToken);
          setAccessToken(storedAccessToken);
          setGroups(cognitoGroups);
          setAvpDecisions(decisions);
          setUser({
            sub: claims.sub,
            email: claims.email,
            name:
              claims.name ||
              claims["preferred_username"] ||
              claims["cognito:username"],
          });
          return;
        }

        // Invalid or missing token; clear everything to avoid loops
        clearLocalTokens();
        setIdToken(null);
        setAccessToken(null);
        setGroups([]);
        setAvpDecisions([]);
        setUser(null);
      } catch (error) {
        console.error("[AuthProvider] Failed to initialize auth", error);
        clearLocalTokens();
        setIdToken(null);
        setAccessToken(null);
        setGroups([]);
        setAvpDecisions([]);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Re-run initialization when localStorage changes in this tab
    const handleStorage = (event: StorageEvent) => {
      if (event.key && TOKEN_KEYS.includes(event.key)) {
        initialize();
      }
    };

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
      localStorage.removeItem("idToken");
      localStorage.removeItem("cognitoIdToken");
      localStorage.removeItem("finz_access_token");
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
        localStorage.getItem("cv.jwt") ||
        localStorage.getItem("finz_jwt") ||
        localStorage.getItem("idToken") ||
        localStorage.getItem("cognitoIdToken");
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
            setGroupClaims(groups);
            if (import.meta.env.DEV) {
              console.debug("[Auth] Effective role", {
                user: authenticatedUser,
                groups,
                mappedRoles,
                defaultRole,
              });
            }
            setIsLoading(false);
            return; // ← Successfully authenticated with JWT
          } else {
            // Expired or invalid: clear and continue
            console.warn("[Auth] JWT expired or invalid, clearing");
            localStorage.removeItem("cv.jwt");
            localStorage.removeItem("finz_jwt");
            localStorage.removeItem("idToken");
            localStorage.removeItem("cognitoIdToken");
            localStorage.removeItem("finz_access_token");
            localStorage.removeItem("finz_refresh_token");
          }
        } catch (e) {
          console.warn("[Auth] Failed to process JWT:", e);
          localStorage.removeItem("cv.jwt");
          localStorage.removeItem("finz_jwt");
          localStorage.removeItem("idToken");
          localStorage.removeItem("cognitoIdToken");
          localStorage.removeItem("finz_access_token");
          localStorage.removeItem("finz_refresh_token");
        }
      }

      // 2. No JWT → not authenticated, show LoginPage
      setUser(null);
      setAvailableRoles([]);
      setGroupClaims([]);
      console.log("[Auth] Not authenticated; show LoginPage");
    } catch (error) {
      console.error("[Auth] Initialization error:", error);
      setUser(null);
      setAvailableRoles([]);
      setError("Authentication initialization failed");
    } finally {
      setIsLoading(false);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = () => {
    loginWithHostedUI();
  };

  const clearLocalTokens = () => {
    [
      "cv.jwt",
      "finz_jwt",
      "idToken",
      "cognitoIdToken",
      "finz_access_token",
      "finz_refresh_token",
      "cv.module",
    ].forEach((key) => localStorage.removeItem(key));
  };

  const logout = () => {
    clearLocalTokens();
    setUser(null);
    setCurrentRole("PMO");
    setAvailableRoles([]);
    setError(null);
    setGroupClaims([]);

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
    setGroups([]);
    setIdToken(null);
    setAccessToken(null);
    setAvpDecisions([]);
    logoutWithHostedUI();
  };

  const value: AuthContextType = {
    user,
    groups,
    roles,
    idToken,
    accessToken,
    avpDecisions,
    isAuthenticated,
    isLoading,
    error,
    currentRole: currentRole || "PMO",
    availableRoles,
    setRole,
    routeConfigMissing,
    canAccessRoute: checkRouteAccess,
    canPerformAction: checkActionPermission,
    signIn,
    signOut,
    loginWithCognito,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
