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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
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
 * Error response with CORS headers
 */
export function bad(message: string, statusCode = 400) {
  return {
    statusCode,
    headers: cors,
    body: JSON.stringify({ error: message }),
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
