// Real CloudFront Function (viewer-request, cloudfront-js-2.0), attached
// only to the default (S3) cache behavior on distribution E3V59CPAVEU5Y9
// (dgzxyhsayte98.cloudfront.net). Replaces the old distribution-level
// CustomErrorResponses (403/404 -> /index.html, 200) mechanism, which
// applied regardless of which origin produced the error and was silently
// masking real backend 403/404 responses as the frontend's HTML shell on
// every request, not just cached ones - see CLAUDE.md §27 for the full
// real investigation and root cause.
//
// Real backend API paths (POST /construction-files, etc.) never reach this
// function at all - they match their own 19 dedicated cache behaviors
// (targeting ff-backend-nlb) first, so their real 403/404 responses flow
// straight back to the client untouched.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Real static assets (a file extension on the last path segment) pass
  // through unchanged - real S3 lookup, real 403/404 if genuinely missing.
  if (/\.[^/]+$/.test(uri)) {
    return request;
  }

  // Everything else reaching this function is a client-side SPA route
  // (e.g. /permissions, /networking) under the default (S3) behavior -
  // rewrite to the real index.html so react-router can take over.
  request.uri = "/index.html";
  return request;
}
