import React, { createContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import awsConfig, { loginWithHostedUI, logoutWithHostedUI } from "@/config/aws";
import {
  canAccessRoute,
  canPerformAction,
  getDefaultUserRole,
  getRoutesForRole,
  getRolePermissionKeys,
} from "@/lib/auth";
import {
  decodeJWT,
  getGroupsFromClaims,
  isTokenValid,
  mapCognitoGroupsToRoles,
} from "@/lib/jwt";
import { UserInfo, UserRole } from "@/types/domain";

type AuthContextType = {
  user: UserInfo | null;
  groups: string[];
  roles: UserRole[];
  idToken: string | null;
  accessToken: string | null;
  avpDecisions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  currentRole: UserRole;
  availableRoles: UserRole[];
  setRole: (role: UserRole) => void;
  routeConfigMissing: boolean;

  canAccessRoute: (route: string) => boolean;
  canPerformAction: (action: string) => boolean;

  signIn: () => Promise<void>;
  signOut: () => void;
  loginWithCognito: (username: string, password: string) => Promise<void>;
  login: () => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEYS = ["cv.jwt", "finz_jwt", "idToken", "cognitoIdToken"];

function readTokenFromStorage(keys: string[]): string | null {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function clearLocalTokens() {
  [
    "cv.jwt",
    "finz_jwt",
    "idToken",
    "cognitoIdToken",
    "finz_access_token",
    "finz_refresh_token",
    "cv.module",
  ].forEach((key) => localStorage.removeItem(key));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [avpDecisions, setAvpDecisions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>(getDefaultUserRole());
  const [error, setError] = useState<string | null>(null);
  const [routeConfigMissing, setRouteConfigMissing] = useState(false);
  const [groupClaims, setGroupClaims] = useState<string[]>([]);

  const roles = useMemo(
    () => mapCognitoGroupsToRoles(groups).filter((r): r is UserRole => !!r),
    [groups]
  );

  const isAuthenticated = !!user && !!idToken;

  useEffect(() => {
    void initializeAuth();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && TOKEN_KEYS.includes(event.key)) {
        void initializeAuth();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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

  async function initializeAuth() {
    setIsLoading(true);
    setError(null);

    try {
      const storedIdToken = readTokenFromStorage(TOKEN_KEYS);
      const storedAccessToken = localStorage.getItem("finz_access_token") || null;

      if (storedIdToken && isTokenValid(storedIdToken)) {
        const claims = decodeJWT(storedIdToken);
        const cognitoGroups = getGroupsFromClaims(claims);
        const decisions = Array.isArray(claims["avp:decisions"])
          ? (claims["avp:decisions"] as string[])
          : [];

        const mappedRoles = mapCognitoGroupsToRoles(cognitoGroups).filter(
          (role): role is UserRole => ["PMO", "SDMT", "VENDOR", "EXEC_RO"].includes(role)
        );
        const effectiveRoles = mappedRoles.length ? mappedRoles : [getDefaultUserRole()];
        const defaultRole = effectiveRoles[0];

        setIdToken(storedIdToken);
        setAccessToken(storedAccessToken);
        setGroups(cognitoGroups);
        setGroupClaims(cognitoGroups);
        setAvpDecisions(decisions);
        setAvailableRoles(effectiveRoles);
        setCurrentRole(defaultRole);
        setUser({
          id: claims.sub || "unknown",
          login:
            claims.email ||
            claims["cognito:username"] ||
            claims["preferred_username"] ||
            "user",
          email: claims.email || "unknown",
          avatarUrl: "",
          isOwner: cognitoGroups.includes("admin"),
          roles: effectiveRoles,
          current_role: defaultRole,
        });
        return;
      }

      clearLocalTokens();
      setIdToken(null);
      setAccessToken(null);
      setGroups([]);
      setAvpDecisions([]);
      setAvailableRoles([]);
      setUser(null);
    } catch (authError) {
      console.error("[AuthProvider] Failed to initialize auth", authError);
      clearLocalTokens();
      setIdToken(null);
      setAccessToken(null);
      setGroups([]);
      setAvpDecisions([]);
      setAvailableRoles([]);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithCognito(username: string, password: string): Promise<void> {
    setError(null);

    const clientId =
      import.meta.env.VITE_COGNITO_CLIENT_ID || awsConfig.aws_user_pools_web_client_id;
    const region = import.meta.env.VITE_COGNITO_REGION || awsConfig.aws_cognito_region;

    if (!clientId) {
      throw new Error("Cognito client ID not configured");
    }

    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
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
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Authentication failed" }));
      const message = errorData.message || "Authentication failed";

      if (message.includes("UserNotConfirmedException")) {
        throw new Error("Please confirm your email address before signing in");
      }
      if (message.includes("NotAuthorizedException")) {
        throw new Error("Invalid username or password");
      }
      if (message.includes("UserNotFoundException")) {
        throw new Error("User not found");
      }
      throw new Error(message);
    }

    const { AuthenticationResult } = await response.json();
    if (!AuthenticationResult?.IdToken) {
      throw new Error("Invalid authentication response");
    }

    localStorage.setItem("cv.jwt", AuthenticationResult.IdToken);
    localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);
    localStorage.setItem("idToken", AuthenticationResult.IdToken);
    localStorage.setItem("cognitoIdToken", AuthenticationResult.IdToken);

    if (AuthenticationResult.AccessToken) {
      localStorage.setItem("finz_access_token", AuthenticationResult.AccessToken);
    }

    if (AuthenticationResult.RefreshToken) {
      localStorage.setItem("finz_refresh_token", AuthenticationResult.RefreshToken);
    }

    await initializeAuth();
    toast.success("Signed in successfully");

    const decoded = decodeJWT(AuthenticationResult.IdToken);
    const cognitoGroups = getGroupsFromClaims(decoded);

    const canSDT = cognitoGroups.some((g) =>
      ["SDT", "FIN", "AUD", "sdmt", "fin", "aud"].includes(g.toUpperCase())
    );
    const canPMO = cognitoGroups.some((g) =>
      ["PM", "PMO", "EXEC_RO", "VENDOR", "admin", "pmo"].includes(g.toUpperCase())
    );

    const pref = localStorage.getItem("cv.module");
    let targetPath = "/";

    if (canSDT && !canPMO) {
      targetPath = "/finanzas/";
    } else if (canPMO && !canSDT) {
      targetPath = "/";
    } else if (canSDT && canPMO) {
      if (pref === "pmo" && canPMO) {
        targetPath = "/";
      } else if (pref === "finanzas" && canSDT) {
        targetPath = "/finanzas/";
      } else {
        targetPath = "/finanzas/";
      }
    }

    if (import.meta.env.VITE_FINZ_ENABLED === "true") {
      targetPath = "/finanzas/";
    }

    setTimeout(() => {
      window.location.replace(targetPath);
    }, 100);
  }

  const login = () => {
    loginWithHostedUI();
  };

  function logout() {
    clearLocalTokens();
    setUser(null);
    setGroups([]);
    setIdToken(null);
    setAccessToken(null);
    setAvpDecisions([]);
    setAvailableRoles([]);
    setCurrentRole(getDefaultUserRole());
    setGroupClaims([]);
    setError(null);

    toast.success("Signed out successfully");

    if (import.meta.env.VITE_FINZ_ENABLED === "true") {
      setTimeout(() => {
        window.location.href = "/finanzas/";
      }, 500);
    }

    logoutWithHostedUI();
  }

  const setRole = (role: UserRole): void => {
    if (!availableRoles.includes(role)) {
      toast.error("Access denied", {
        description: `You don't have permission to switch to ${role} role`,
      });
      return;
    }

    const previousRole = currentRole;
    setCurrentRole(role);

    try {
      if (role === "PMO") localStorage.setItem("cv.module", "pmo");
      else localStorage.setItem("cv.module", "finanzas");
    } catch {
      /* ignore storage errors */
    }

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

  const signIn = async () => {
    loginWithHostedUI();
  };

  const signOut = () => {
    logout();
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
