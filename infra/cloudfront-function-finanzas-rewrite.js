function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // NOTE: Origin Path for the Finanzas origin is empty.
  // CloudFront passes the full request path as `request.uri`, e.g.:
  // - /finanzas/
  // - /finanzas/assets/index.js
  // - /finanzas/projects/123/handoff

  // Rewrite /finanzas/ to /finanzas/index.html for SPA root
  if (uri === "/finanzas/" || uri === "/finanzas") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // For SPA deep links WITHOUT file extensions, serve index.html
  // But SKIP /finanzas/assets/, /finanzas/docs/, /finanzas/auth/
  if (uri.startsWith("/finanzas/") && !uri.match(/\.\w+$/)) {
    if (!uri.startsWith("/finanzas/assets/") &&
        !uri.startsWith("/finanzas/docs/") &&
        !uri.startsWith("/finanzas/auth/")) {
      // This is a SPA route like /finanzas/projects/123/handoff
      request.uri = "/finanzas/index.html";
      return request;
    }
  }

  return request;
}
