/**
 * HTTP response helpers with CORS headers
 * All Lambda responses (success & error) must include CORS headers
 */

// Get CORS origin from environment or use default
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://d7t9x3j66yd8k.cloudfront.net";

/**
 * Standard CORS headers for all responses
 */
export const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization,Content-Type,X-Amz-Date,X-Amz-Security-Token,X-Requested-With,authorization,content-type,x-amz-date,x-amz-security-token,x-requested-with",
  "Access-Control-Max-Age": "86400",
};

/**
 * Success response with CORS headers
 */
export function ok<T>(data: T, statusCode = 200) {
  return {
    statusCode,
    headers: cors,
    body: JSON.stringify(data),
  };
}

/**
 * Empty success response for CORS preflight handling
 */
export function noContent(statusCode = 204) {
  return {
    statusCode,
    headers: cors,
    body: "",
  };
}

/**
 * Error response with CORS headers
 * Accepts either a string message or an object with error details
 */
export function bad(message: string | Record<string, unknown>, statusCode = 400) {
  return {
    statusCode,
    headers: cors,
    body: typeof message === "string"
      ? JSON.stringify({ error: message })
      : JSON.stringify(message),
  };
}

/**
 * Not found response with CORS headers
 */
export function notFound(message = "Resource not found") {
  return bad(message, 404);
}

/**
 * Server error response with CORS headers
 */
export function serverError(message = "Internal server error") {
  return bad(message, 500);
}

/**
 * Not implemented response with CORS headers
 */
export function notImplemented(message = "Not implemented") {
  return bad(message, 501);
}

/**
 * Unauthorized response with CORS headers
 */
export function unauthorized(message = "Unauthorized") {
  return bad(message, 401);
}

/**
 * Convert auth errors thrown by ensure* helpers into proper HTTP responses
 */
export function fromAuthError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    "body" in error
  ) {
    const statusCode = Number((error as { statusCode: number }).statusCode) || 403;
    const message = String((error as { body: string }).body || "Access denied");
    return bad(message, statusCode);
  }
  return null;
}
