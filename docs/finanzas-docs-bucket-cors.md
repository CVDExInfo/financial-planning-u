# Finanzas SD docs bucket CORS configuration

The Finanzas SD document uploads rely on a pre-created S3 bucket provided via the `DocsBucketName` parameter (default: `ukusi-ui-finanzas-prod`). The application stack **must not** create or rename this bucket. To avoid browser CORS errors when uploading invoices or supporting documents with a presigned URL, apply the following CORS rules to that bucket.

## Recommended CORS rules

```xml
<CORSConfiguration>
  <CORSRule>
    <!-- Finanzas SD CloudFront origin -->
    <AllowedOrigin>https://d7t9x3j66yd8k.cloudfront.net</AllowedOrigin>

    <!-- If you have another domain serving Finanzas, add it here as well.
         Example:
         <AllowedOrigin>https://k.cloudfront.net</AllowedOrigin>
    -->

    <!-- Methods needed by the app -->
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>

    <!-- Allow our browser-side headers -->
    <AllowedHeader>*</AllowedHeader>

    <!-- Optional, but useful for debugging -->
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <ExposeHeader>x-amz-id-2</ExposeHeader>

    <!-- Cache the preflight response -->
    <MaxAgeSeconds>300</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

## Notes

- **Apply to the bucket referenced by `DocsBucketName` / `DOCS_BUCKET`**. The default value is `ukusi-ui-finanzas-prod`.
- **Origins:** must match the Finanzas SD UI origin (currently `https://d7t9x3j66yd8k.cloudfront.net`). If you front the UI with another domain, add an additional `<AllowedOrigin>` entry.
- **Methods:**
  - `PUT` for uploads using presigned URLs.
  - `GET`/`HEAD` for fetching or previewing stored documents.
- **Headers:** `AllowedHeader *` lets the browser send `Content-Type` and any `X-Amz-*` headers required by S3.
- **ExposeHeader:** Optional but useful when debugging uploads (ETag, request IDs).
- **No template changes:** keep `services/finanzas-api/template.yaml` unchanged; the bucket is managed externally and provided via parameters/environment variables.

## Health check

To validate the docs pipeline end-to-end without a browser (no CORS in Node), run the health-check script from the API package:

```bash
cd services/finanzas-api
FINZ_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev \
FINZ_API_TOKEN=<cognito-id-token> \
PROJECT_ID=<project-id> \
node scripts/check-docs-upload.mjs
```

The script calls `/uploads/docs`, then performs the PUT to the returned presigned S3 URL and reports success or a detailed error.
