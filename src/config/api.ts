/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

import { logoutWithHostedUI } from "./aws";
import { AuthError, ServerError, ValidationError } from "@/lib/errors";
import { API_BASE, HAS_API_BASE } from "./env";

const envSource =
  (typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined) || (process.env as Record<string, string | undefined>);

// API Base URL - use environment variable in production
export const API_BASE_URL = API_BASE;

// API Endpoints
export const API_ENDPOINTS = {
  forecast: "/plan/forecast",
  // Projects
  projects: "/projects",
  projectById: (id: string) => `/projects/${id}`,

  // Rubros (Chart of Accounts)
  rubros: "/rubros",
  rubroById: (id: string) => `/rubros/${id}`,

  // Allocations
  allocations: "/allocations",
  allocationsByProject: (projectId: string) =>
    `/allocations?project_id=${projectId}`,

  // Baseline
  baseline: "/baseline",
  baselineById: (id: string) => `/baseline/${id}`,

  // Billing
  billing: "/billing",
  billingByProject: (projectId: string) => `/billing?project_id=${projectId}`,

  // Handoff
  handoff: "/handoff",

  // Providers
  providers: "/providers",
  providerById: (id: string) => `/providers/${id}`,
} as const;

// Helper function to build full URL
export function buildApiUrl(endpoint: string): string {
  if (!HAS_API_BASE) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }
  return `${API_BASE_URL}${endpoint}`;
}

// Helper function to get auth token from localStorage
export function getAuthToken(): string | null {
  try {
    // Canonical JWT lookup order for Finanzas (access token preferred):
    // 1) finz_access_token (Cognito access token written by auth callback/login)
    // 2) cv.jwt / finz_jwt (ID token written by auth callback/login)
    // 3) idToken / cognitoIdToken (legacy Cognito keys)
    // 4) build-time token (used by CI/E2E only)
    const preferredKeys = [
      "finz_access_token",
      "cv.jwt",
      "finz_jwt",
      "idToken",
      "cognitoIdToken",
    ];

    const storageSources = [localStorage, sessionStorage];
    for (const store of storageSources) {
      for (const key of preferredKeys) {
        const value = store.getItem(key);
        if (value && value.trim().length > 0) return value;
      }
    }

    if (envSource?.VITE_API_JWT_TOKEN) {
      return envSource.VITE_API_JWT_TOKEN;
    }

    // Fallback to old "auth" key structure for backward compatibility
    const authData = localStorage.getItem("auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed?.idToken) return parsed.idToken;
    }
  } catch (error) {
    console.error("Failed to get auth token:", error);
  }

  return null;
}

export function buildAuthHeader(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function handleAuthErrorStatus(status: number): never | void {
  if (status === 401) {
    logoutWithHostedUI();
    throw new AuthError("AUTH_REQUIRED", "Your session expired. Please sign in again.", 401);
  }

  if (status === 403) {
    throw new AuthError("FORBIDDEN", "You don’t have permission to perform this action.", 403);
  }
}

// Helper function to build request headers
export function buildHeaders(
  includeAuth: boolean = true,
  customHeaders: HeadersInit = {}
): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (includeAuth) {
    const token = getAuthToken();

    if (!token) {
      if (envSource?.VITE_SKIP_AUTH === "true") {
        return headers;
      }

      console.warn("[Finanzas] Missing auth token; skipping API call until user signs in.");
      throw new AuthError("AUTH_REQUIRED", "Authentication required to call Finanzas API", 401);
    }

    Object.assign(headers, { Authorization: `Bearer ${token}` });
  }

  return headers;
}

// Helper function to handle API errors
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = `API Error: ${response.status} ${response.statusText}`;

  try {
    const errorData = await response.json();
    if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    // Could not parse error response as JSON
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthError(
      response.status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
      errorMessage,
      response.status,
    );
  }

  if (response.status >= 500) {
    throw new ServerError("SERVER_ERROR", errorMessage, response.status);
  }

  throw new ValidationError("VALIDATION_ERROR", errorMessage, response.status);
}
