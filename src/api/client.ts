/**
 * Core HTTP client for Finanzas API
 * Provides a single safeFetch helper with optional mock support.
 */

import { API_BASE, HAS_API_BASE } from "@/config/env";

const BASE_URL = API_BASE;
const STATIC_TEST_TOKEN = import.meta.env.VITE_API_JWT_TOKEN || "";
const USE_MOCKS =
  (import.meta.env.VITE_USE_MOCKS || "false").toLowerCase() === "true";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type SafeFetchOptions<T> = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  mockResponse?: () => Promise<T> | T;
  allowMock?: boolean;
};

const isFormDataBody = (value: unknown): value is FormData =>
  typeof FormData !== "undefined" && value instanceof FormData;

function getAuthHeader(): Record<string, string> {
  // Priority: 1) Unified cv.jwt, 2) Legacy finz_jwt, 3) Static test token
  const token =
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
    STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function allowMock(): boolean {
  return USE_MOCKS;
}

function buildUrl(path: string): string {
  if (!HAS_API_BASE) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }
  if (!path.startsWith("/")) {
    return `${BASE_URL}/${path}`;
  }
  return `${BASE_URL}${path}`;
}

export async function safeFetch<T = unknown>(
  path: string,
  options: SafeFetchOptions<T> = {}
): Promise<T> {
  const url = buildUrl(path);
  const method = options.method || "GET";
  const formDataBody = isFormDataBody(options.body);
  const headers: Record<string, string> = {
    ...(formDataBody ? {} : { "Content-Type": "application/json" }),
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      credentials: "omit",
      mode: "cors",
      body: options.body
        ? formDataBody
          ? (options.body as FormData)
          : JSON.stringify(options.body)
        : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${
          errorText || "No response body"
        }`
      );
    }

    // Many endpoints return JSON but guard against no-content responses
    const contentType = response.headers.get("content-type") || "";
    if (!contentType || !contentType.includes("application/json")) {
      // Attempt to parse text for debugging, but don't blow up on empty 204s
      const text = await response.text().catch(() => "");
      if (!text) {
        return undefined as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch (_error) {
        throw new Error(
          `Unexpected response type (${
            contentType || "unknown"
          }). First bytes: ${text.slice(0, 120)}`
        );
      }
    }

    return (await response.json()) as T;
  } catch (error) {
    if (options.allowMock && allowMock() && options.mockResponse) {
      console.warn("safeFetch falling back to mock for", path, error);
      return await options.mockResponse();
    }

    throw error instanceof Error
      ? error
      : new Error("Unknown network error while calling API");
  }
}
