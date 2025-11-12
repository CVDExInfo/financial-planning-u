function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/" || uri === "") {
    request.uri = "/index.html";
  }
  else if (uri !== "" && !uri.match(/\.\w+$/) &&
           !uri.startsWith("/assets/") &&
           !uri.startsWith("/docs/") &&
           !uri.startsWith("/auth/")) {
    request.uri = "/index.html";
  }

  return request;
}
