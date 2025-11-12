// CloudFront Function: Finanzas Path Rewrite
// Purpose: Normalize /finanzas → /finanzas/ and handle SPA routing
// Attach to: Viewer Request event on /finanzas/* behavior

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // 1. Rewrite /finanzas → /finanzas/ (add trailing slash)
  if (uri === "/finanzas") {
    var response = {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "/finanzas/" },
      },
    };
    return response;
  }

  // 2. Serve index.html for /finanzas/ (root of SPA)
  if (uri === "/finanzas/") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // 3. For /finanzas/* paths that don't have a file extension,
  //    rewrite to /finanzas/index.html (SPA routing)
  if (uri.startsWith("/finanzas/") && !uri.match(/\.\w+$/)) {
    // Only rewrite if it's not an asset (no file extension)
    // This allows /finanzas/catalog/rubros → /finanzas/index.html
    // But preserves /finanzas/assets/file.js
    if (
      !uri.startsWith("/finanzas/assets/") &&
      !uri.startsWith("/finanzas/docs/") &&
      !uri.startsWith("/finanzas/auth/")
    ) {
      request.uri = "/finanzas/index.html";
    }
  }

  return request;
}
