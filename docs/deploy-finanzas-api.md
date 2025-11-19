# Finanzas API Deployment Notes

## CORS Policy – Finanzas SD

The Finanzas SD UI is served from `https://d7t9x3j66yd8k.cloudfront.net`, and every Finanzas HTTP API endpoint must answer browser preflight requests with matching headers. The SAM template now configures the HttpApi with:

- **Allowed origins:** `https://d7t9x3j66yd8k.cloudfront.net`
- **Allowed methods:** `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Allowed headers:** `Authorization, Content-Type, X-Amz-Date, X-Amz-Security-Token, X-Requested-With`
- **MaxAge:** `86400` seconds (24 hours)

Custom Lambda responses reuse the helper in `services/finanzas-api/src/lib/http.ts`, ensuring `Access-Control-Allow-Origin` mirrors the CloudFront domain and the `Authorization` header stays whitelisted during preflights. When extending the API, keep these lists synchronized and rerun the documented curl-based preflight to confirm `Access-Control-Allow-*` headers match expectations.
