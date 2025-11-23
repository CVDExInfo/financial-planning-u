import React, { createContext, useEffect, useMemo, useState } from "react";

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

  const roles = useMemo(
    () => mapCognitoGroupsToRoles(groups) as UserRole[],
    [groups]
  );

  const isAuthenticated = !!user && !!idToken;

  useEffect(() => {
    const initialize = () => {
      setIsLoading(true);

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
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
