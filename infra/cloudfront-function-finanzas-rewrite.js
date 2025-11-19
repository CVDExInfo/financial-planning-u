function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // SPA root
  if (uri === "/finanzas/" || uri === "/finanzas") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // Never rewrite the Cognito callback
  if (uri === "/finanzas/auth/callback.html") {
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
