import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import awsConfig, { loginWithHostedUI, logoutWithHostedUI } from "@/config/aws";
import {
  canAccessRoute,
  canPerformAction,
  getRoleForPath,
  getDefaultUserRole,
  getRoutesForRole,
  getRolePermissionKeys,
} from "@/lib/auth";
import {
  decodeJwt,
  extractGroupsFromClaims,
  isTokenValid,
  mapGroupsToRoles,
  type JWTClaims,
} from "@/lib/jwt";
import { UserInfo, UserRole } from "@/types/domain";
import { queryClient } from "@/lib/queryClient";

export type AuthSession = {
  idToken: string | null;
  accessToken: string | null;
  user: UserInfo | null;
  groups: string[];
  avpDecisions: string[];
  availableRoles: UserRole[];
  currentRole: UserRole;
};

type AuthContextType = {
  user: UserInfo | null;
  groups: string[];
  roles: UserRole[];
  idToken: string | null;
  accessToken: string | null;
  avpDecisions: string[];
  session: AuthSession;
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

// Canonical JWT sources (kept in sync with src/config/api.ts#getAuthToken)
// Access token (finz_access_token) is preferred for Authorization headers and
// will be discovered by the API client alongside these ID token keys.
const TOKEN_KEYS = ["cv.jwt", "finz_jwt", "idToken", "cognitoIdToken"];
const DEFAULT_ROLE = getDefaultUserRole(null);
const ACTIVE_ROLE_KEY = "finz_active_role";

const EMPTY_SESSION: AuthSession = {
  idToken: null,
  accessToken: null,
  user: null,
  groups: [],
  avpDecisions: [],
  availableRoles: [],
  currentRole: DEFAULT_ROLE,
};

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

function buildSessionFromTokens(
  storedIdToken: string | null,
  storedAccessToken: string | null
): AuthSession | null {
  if (!storedIdToken || !isTokenValid(storedIdToken)) {
    return null;
  }

  let claims: JWTClaims;
  try {
    claims = decodeJwt(storedIdToken);
  } catch (error) {
    console.error("[AuthProvider] Failed to decode JWT", error);
    return null;
  }

  const cognitoGroups = extractGroupsFromClaims(claims);
  const decisions = Array.isArray(claims?.["avp:decisions"])
    ? (claims["avp:decisions"] as string[])
    : [];

  const email =
    claims?.email ??
    claims?.["cognito:username"] ??
    claims?.username ??
    null;

  const login =
    claims?.preferred_username ??
    email ??
    claims?.["cognito:username"] ??
    claims?.username ??
    null;

  const mappedRoles = mapGroupsToRoles(cognitoGroups).filter(
    (role): role is UserRole =>
      ["PM", "PMO", "SDMT", "VENDOR", "EXEC_RO"].includes(role)
  );
  const fallbackRole = mappedRoles[0] ?? getDefaultUserRole({
    email,
    login,
    isOwner: cognitoGroups.includes("admin"),
  });
  const effectiveRoles = mappedRoles.length ? mappedRoles : [fallbackRole];
  const defaultRole = effectiveRoles[0] ?? DEFAULT_ROLE;

  const user: UserInfo = {
    id: claims?.sub ?? null,
    login,
    email,
    avatarUrl: claims?.picture ?? null,
    isOwner: cognitoGroups.includes("admin"),
    roles: effectiveRoles,
    current_role: defaultRole,
    name: claims?.name ?? null,
  };

  return {
    idToken: storedIdToken,
    accessToken: storedAccessToken,
    user,
    groups: cognitoGroups,
    avpDecisions: decisions,
    availableRoles: effectiveRoles,
    currentRole: defaultRole,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [avpDecisions, setAvpDecisions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>(DEFAULT_ROLE);
  const [error, setError] = useState<string | null>(null);
  const [routeConfigMissing, setRouteConfigMissing] = useState(false);
  const [groupClaims, setGroupClaims] = useState<string[]>([]);
  const isLoggingOutRef = useRef(false);
  const location = useLocation();

  const roles = useMemo(
    () => mapGroupsToRoles(groups).filter((r): r is UserRole => !!r),
    [groups]
  );

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[AuthProvider] Derived roles", {
        groups,
        roles,
        availableRoles,
        currentRole,
      });
    }
  }, [availableRoles, currentRole, groups, roles]);

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
    const effectiveRole = currentRole || DEFAULT_ROLE;
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

  useEffect(() => {
    const suggestedRole = getRoleForPath(
      location.pathname,
      availableRoles.length ? availableRoles : roles,
      currentRole || DEFAULT_ROLE,
    );

    if (suggestedRole !== currentRole && (availableRoles.length === 0 || availableRoles.includes(suggestedRole))) {
      setCurrentRole(suggestedRole);
      try {
        localStorage.setItem(ACTIVE_ROLE_KEY, suggestedRole);
      } catch {
        /* ignore storage errors */
      }
      if (user) {
        setUser((prev) =>
          prev ? { ...prev, current_role: suggestedRole } : prev,
        );
      }
    }
  }, [availableRoles, currentRole, location.pathname, roles, user]);

  async function initializeAuth() {
    setIsLoading(true);
    setError(null);

    try {
      const storedIdToken = readTokenFromStorage(TOKEN_KEYS);
      const storedAccessToken = localStorage.getItem("finz_access_token") || null;

      const sessionFromTokens = buildSessionFromTokens(
        storedIdToken,
        storedAccessToken
      );

      if (sessionFromTokens) {
        setIdToken(sessionFromTokens.idToken);
        setAccessToken(sessionFromTokens.accessToken);
        setGroups(sessionFromTokens.groups);
        setGroupClaims(sessionFromTokens.groups);
        setAvpDecisions(sessionFromTokens.avpDecisions);
        const availableSessionRoles = sessionFromTokens.availableRoles;
        setAvailableRoles(availableSessionRoles);

        const storedRole = localStorage.getItem(ACTIVE_ROLE_KEY) as
          | UserRole
          | null;
        const suggestedRole = getRoleForPath(
          location.pathname,
          availableSessionRoles,
          sessionFromTokens.currentRole,
        );
        const effectiveRole =
          (storedRole && availableSessionRoles.includes(storedRole)
            ? storedRole
            : suggestedRole) || sessionFromTokens.currentRole;

        setCurrentRole(effectiveRole);
        try {
          localStorage.setItem(ACTIVE_ROLE_KEY, effectiveRole);
        } catch {
          /* ignore storage errors */
        }

        setUser({ ...sessionFromTokens.user, current_role: effectiveRole });
        return;
      }

      clearLocalTokens();
      setIdToken(null);
      setAccessToken(null);
      setGroups([]);
      setAvpDecisions([]);
      setAvailableRoles([]);
      setCurrentRole(DEFAULT_ROLE);
      setUser(null);
    } catch (authError) {
      console.error("[AuthProvider] Failed to initialize auth", authError);
      clearLocalTokens();
      setIdToken(null);
      setAccessToken(null);
      setGroups([]);
      setAvpDecisions([]);
      setAvailableRoles([]);
      setCurrentRole(DEFAULT_ROLE);
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

    let decoded: JWTClaims | null = null;
    try {
      decoded = decodeJwt(AuthenticationResult.IdToken);
    } catch (decodeError) {
      console.error("[AuthProvider] Failed to decode login response", decodeError);
    }

    const cognitoGroups = decoded ? extractGroupsFromClaims(decoded) : [];

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
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    clearLocalTokens();
    queryClient.clear();
    setUser(null);
    setGroups([]);
    setIdToken(null);
    setAccessToken(null);
    setAvpDecisions([]);
    setAvailableRoles([]);
    setCurrentRole(DEFAULT_ROLE);
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
      localStorage.setItem(ACTIVE_ROLE_KEY, role);
    } catch {
      /* ignore storage errors */
    }

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
    return canAccessRoute(route, currentRole || DEFAULT_ROLE);
  };

  const checkActionPermission = (action: string): boolean => {
    return canPerformAction(action, currentRole || DEFAULT_ROLE);
  };

  const signIn = async () => {
    loginWithHostedUI();
  };

  const signOut = () => {
    logout();
  };

  const session = useMemo(
    () => ({
      ...EMPTY_SESSION,
      idToken,
      accessToken,
      user,
      groups,
      avpDecisions,
      availableRoles,
      currentRole: currentRole || DEFAULT_ROLE,
    }),
    [
      idToken,
      accessToken,
      user,
      groups,
      avpDecisions,
      availableRoles,
      currentRole,
    ]
  );

  const value: AuthContextType = {
    user,
    groups,
    roles,
    idToken,
    accessToken,
    avpDecisions,
    session,
    isAuthenticated,
    isLoading,
    error,
    currentRole: currentRole || DEFAULT_ROLE,
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
