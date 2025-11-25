/**
 * CloudFront Function for Finanzas SPA routing
 *
 * Behavior summary:
 * - /finanzas          → 301 redirect to /finanzas/ (preserves querystring)
 * - /finanzas/         → serve /finanzas/index.html (SPA entry)
 * - /finanzas/* (no ext) → rewrite to /finanzas/index.html for client-side routing
 * - /finanzas/auth/callback.html is NEVER rewritten (served as static asset)
 * - All other /finanzas/* asset requests pass through untouched
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Do not rewrite the Cognito callback page (serve the static HTML as-is)
  if (
    uri === "/finanzas/auth/callback.html" ||
    uri.startsWith("/finanzas/auth/callback.html")
  ) {
    return request;
  }

  // Redirect /finanzas to /finanzas/ (preserve querystring if present)
  if (uri === "/finanzas") {
    var query = request.querystring;
    var queryParts = [];

    for (var key in query) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        var queryValue = query[key];
        if (queryValue && queryValue.value !== undefined) {
          queryParts.push(key + "=" + queryValue.value);
        }
      }
    }

    var queryString = queryParts.length > 0 ? "?" + queryParts.join("&") : "";

    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "/finanzas/" + queryString },
      },
    };
  }

  // SPA root
  if (uri === "/finanzas/") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // For any /finanzas/* path without extension, serve the SPA
  if (uri.startsWith("/finanzas/") && !uri.match(/\.\w+$/)) {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // All other paths (assets, etc.) just pass through to S3
  return request;
}
