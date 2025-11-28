/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

import { logoutWithHostedUI } from "./aws";
import { API_BASE, HAS_API_BASE } from "./env";

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
    // Priority order:
    // 1) Current access/id tokens written by the auth callback
    // 2) Unified Finanzas tokens kept for backward compatibility
    // 3) Legacy Cognito keys (idToken/cognitoIdToken) across local & session storage
    // 4) Static build-time token (used in CI/E2E)
    // 5) Legacy serialized auth object
    const storageSources = [localStorage, sessionStorage];
    for (const store of storageSources) {
      const token =
        store.getItem("finz_access_token") ||
        store.getItem("cv.jwt") ||
        store.getItem("finz_jwt") ||
        store.getItem("idToken") ||
        store.getItem("cognitoIdToken") ||
        "";
      if (token) return token;
    }

    if (import.meta.env.VITE_API_JWT_TOKEN) {
      return import.meta.env.VITE_API_JWT_TOKEN;
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
    throw new Error("Your session expired. Please sign in again.");
  }

  if (status === 403) {
    throw new Error("You don’t have permission to perform this action.");
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
    Object.assign(headers, buildAuthHeader());
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

  throw new Error(errorMessage);
}
