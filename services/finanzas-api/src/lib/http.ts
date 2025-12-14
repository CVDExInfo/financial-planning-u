/**
 * HTTP response helpers with CORS headers
 * All Lambda responses (success & error) must include CORS headers
 */

/**
 * Standard CORS headers for all responses
 * Using wildcard origin (*) for maximum compatibility with any frontend domain
 * Note: We don't use AllowCredentials since authentication is via JWT in Authorization header
 */
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Requested-With,X-Idempotency-Key,X-Amz-Date,X-Amz-Security-Token,X-Api-Key",
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
