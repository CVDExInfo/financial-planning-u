function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // IMPORTANT: With Origin Path=/finanzas, CloudFront passes the FULL request path to the function
  // Request /finanzas/ comes to function as /finanzas/
  // Request /finanzas/assets/index.js comes as /finanzas/assets/index.js

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
      // This is a SPA route like /finanzas/catalog/rubros
      request.uri = "/finanzas/index.html";
      return request;
    }
  }

  return request;
}
