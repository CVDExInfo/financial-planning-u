/**
 * Unified HTTP Client
 * Consolidates all HTTP communication into a single, consistent layer
 * Replaces fragmented patterns in api.ts and finanzasClient.ts
 */

import { logger } from "@/utils/logger";

export interface HttpRequestInit extends RequestInit {
  timeout?: number;
  retries?: number;
  validateStatus?: (status: number) => boolean;
}

export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseText: string,
    message?: string
  ) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
  }
}

export class HttpTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}

/**
 * Unified HTTP Client for all API communication
 * Features:
 * - Consistent error handling
 * - Automatic retries with exponential backoff
 * - Request timeout support
 * - Proper header management
 * - Logging at all levels
 * - Type-safe responses
 */
export class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultRetries: number = 3;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    logger.info("HttpClient initialized with base URL:", baseUrl);
  }

  /**
   * Perform HTTP GET request
   */
  async get<T = unknown>(
    endpoint: string,
    init?: HttpRequestInit
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...init, method: "GET" });
  }

  /**
   * Perform HTTP POST request
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    init?: HttpRequestInit
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, {
      ...init,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Perform HTTP PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    init?: HttpRequestInit
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, {
      ...init,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Perform HTTP PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    init?: HttpRequestInit
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, {
      ...init,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Perform HTTP DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    init?: HttpRequestInit
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...init, method: "DELETE" });
  }

  /**
   * Core request method with retry logic and error handling
   */
  private async request<T = unknown>(
    endpoint: string,
    init: HttpRequestInit = {}
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(endpoint);
    const timeout = init.timeout ?? this.defaultTimeout;
    const maxRetries = init.retries ?? this.defaultRetries;
    const validateStatus =
      init.validateStatus ??
      ((status: number) => status >= 200 && status < 300);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(
          `HttpClient: ${
            init.method || "GET"
          } ${endpoint} (attempt ${attempt}/${maxRetries})`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: this.buildHeaders(init.headers),
          });

          clearTimeout(timeoutId);

          const responseText = await response.text();
          let data: T;

          try {
            data = responseText ? JSON.parse(responseText) : ({} as T);
          } catch (e) {
            logger.warn("Failed to parse response as JSON:", responseText);
            data = responseText as unknown as T;
          }

          const isSuccess = validateStatus(response.status);

          if (!isSuccess) {
            logger.warn(
              `HttpClient: ${response.status} ${response.statusText} from ${endpoint}`
            );

            if (attempt === maxRetries) {
              throw new HttpError(
                response.status,
                response.statusText,
                responseText,
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            // Retry on server errors
            if (response.status >= 500) {
              const backoffMs = Math.min(
                1000 * Math.pow(2, attempt - 1),
                10000
              );
              logger.info(`Retrying after ${backoffMs}ms...`);
              await this.delay(backoffMs);
              continue;
            }

            // Don't retry on client errors (4xx)
            throw new HttpError(
              response.status,
              response.statusText,
              responseText,
              `HTTP ${response.status}: ${response.statusText}`
            );
          }

          logger.info(`HttpClient: ${response.status} ${endpoint} - Success`);

          return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            data,
            headers: this.parseHeaders(response.headers),
          };
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof DOMException && error.name === "AbortError") {
            throw new HttpTimeoutError(timeout);
          }

          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof HttpTimeoutError) {
          logger.error("Request timeout:", error.message);
          throw error;
        }

        if (error instanceof HttpError) {
          logger.error("HTTP error:", error.message);
          throw error;
        }

        logger.warn(
          `Request failed (attempt ${attempt}/${maxRetries}):`,
          lastError.message
        );

        if (attempt === maxRetries) {
          logger.error("Max retries exceeded for", endpoint);
          throw lastError;
        }

        // Exponential backoff before retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.delay(backoffMs);
      }
    }

    throw lastError || new Error("Unknown error occurred");
  }

  /**
   * Build full URL from base URL and endpoint
   */
  private buildUrl(endpoint: string): string {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;
    return url;
  }

  /**
   * Build request headers with proper Content-Type and Auth
   */
  private buildHeaders(customHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...customHeaders,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    try {
      // Try unified key first (used by AuthProvider)
      const token =
        localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
      if (token) return token;

      // Fallback to old "auth" key structure for backward compatibility
      const authData = localStorage.getItem("auth");
      if (!authData) return null;

      const parsed = JSON.parse(authData);
      return parsed.idToken || null;
    } catch (error) {
      logger.warn("Failed to get auth token:", error);
      return null;
    }
  }

  /**
   * Parse response headers into object
   */
  private parseHeaders(headersList: Headers): Record<string, string> {
    const headers: Record<string, string> = {};
    headersList.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const httpClient = new HttpClient(
  import.meta.env.VITE_API_BASE_URL ||
    "https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
);

export default httpClient;
