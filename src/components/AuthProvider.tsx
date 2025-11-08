import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Spark global type (development mode)
interface SparkAPI {
  user: () => Promise<any>;
}
declare global {
  interface Window {
    spark?: SparkAPI;
  }
}
import { UserInfo, UserRole } from "@/types/domain";
import {
  getDefaultUserRole,
  getAvailableRoles,
  canAccessRoute,
  canPerformAction,
  DEMO_USERS,
} from "@/lib/auth";
import {
  decodeJWT,
  isTokenValid,
  getGroupsFromClaims,
  mapCognitoGroupsToRoles,
} from "@/lib/jwt";
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

      // ✅ Store JWT (unified + legacy for backward compatibility)
      localStorage.setItem("cv.jwt", AuthenticationResult.IdToken);
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

      // Explicit redirect safeguard for Finanzas-only build target
      if (import.meta.env.VITE_FINZ_ENABLED === "true") {
        try {
          window.location.replace("/finanzas/");
        } catch (e) {
          console.warn("Redirect failed", e);
        }
      }
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
      const jwt =
        localStorage.getItem("cv.jwt") ||
        localStorage.getItem("finz_jwt") ||
        localStorage.getItem("spark_jwt");
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
              login: decoded["cognito:username"] || decoded.email || "user",
              email: decoded.email || "unknown",
              avatarUrl: "",
              isOwner: groups.includes("admin"),
              roles: mappedRoles.length > 0 ? mappedRoles : ["SDMT"],
              current_role: defaultRole,
            };

            setUser(authenticatedUser);
            setAvailableRoles(authenticatedUser.roles);
            setIsLoading(false);
            return; // ← Successfully authenticated with JWT
          } else {
            // Expired or invalid: clear and continue
            console.warn("[Auth] JWT expired or invalid, clearing");
            localStorage.removeItem("finz_jwt");
            localStorage.removeItem("finz_refresh_token");
          }
        } catch (e) {
          console.warn("[Auth] Failed to process JWT:", e);
          localStorage.removeItem("finz_jwt");
          localStorage.removeItem("finz_refresh_token");
        }
      }

      // 2. Check for Spark (development mode only)
      if (typeof window !== "undefined" && window.spark?.user) {
        try {
          const sparkUser = await window.spark.user();
          const demoUserData = DEMO_USERS[sparkUser.login] || {};

          const user: UserInfo = {
            ...sparkUser,
            roles: demoUserData.roles || ["SDMT"],
            current_role: "SDMT",
          };

          setUser(user);
          setAvailableRoles(user.roles);
          console.log("[Auth] Authenticated via Spark (dev mode):", user);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error("[Auth] Spark authentication failed:", e);
        }
      }

      // 3. No JWT and no Spark → not authenticated, show LoginPage
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

    setUser(null);
    setCurrentRole("PMO");
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Convenience hooks for common use cases
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
