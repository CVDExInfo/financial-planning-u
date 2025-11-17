/**
 * Core HTTP client for Finanzas API
 * CORS-friendly GET requests with proper error handling
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const STATIC_TEST_TOKEN = import.meta.env.VITE_API_JWT_TOKEN || "";

function getAuthHeader(): Record<string, string> {
  // Priority: 1) Unified cv.jwt, 2) Legacy finz_jwt, 3) Static test token
  const token =
    localStorage.getItem("cv.jwt") ||
    localStorage.getItem("finz_jwt") ||
    STATIC_TEST_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Execute a GET request to the Finanzas API
 * Throws on non-OK responses
 */
export async function httpGet<T = unknown>(path: string): Promise<T> {
  if (!BASE) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  const url = `${BASE}${path}`;
  console.log(`[httpGet] ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    credentials: "omit",
    mode: "cors",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}: ${errorText || "No response body"}`
    );
  }

  return res.json();
}

/**
 * Execute a POST request to the Finanzas API
 * Throws on non-OK responses
 */
export async function httpPost<T = unknown>(
  path: string,
  body: unknown
): Promise<T> {
  if (!BASE) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  const url = `${BASE}${path}`;
  console.log(`[httpPost] ${url}`, body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    credentials: "omit",
    mode: "cors",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}: ${errorText || "No response body"}`
    );
  }

  return res.json();
}
