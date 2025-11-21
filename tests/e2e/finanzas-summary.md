# Finanzas UI E2E (CloudFront) – Summary

## Configuration
- Base UI: `${FINZ_UI_BASE_URL:-https://d7t9x3j66yd8k.cloudfront.net/finanzas/}`
- API base expected: `https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev`
- Credentials read from env: `FINZ_TEST_USERNAME`, `FINZ_TEST_PASSWORD`

## Results (2025-11-14 container run)
- ❌ **Login** – Form submission with tester creds never left the login screen. No error toast rendered; heading `Finanzas · Gestión Presupuesto (R1)` never appeared within 30s.
- ❌ **Projects list / drill-down** – Blocked by login failure; navigation could not proceed to `/projects`.
- ❌ **Uploads (S3 PUT)** – Blocked by login failure; upload controls never reached.

## Observations
- The CloudFront certificate is not trusted in the container; Playwright is configured with `ignoreHTTPSErrors: true` to proceed.
- The login form renders two primary buttons (password login and Cognito Hosted UI). The password login click succeeds, but no state change occurs and no error message appears.
- Because authentication never completes, no API calls to the expected dev gateway were captured during these runs.

## Next Steps
- Confirm whether the CloudFront environment requires the Cognito Hosted UI flow instead of direct password login; update tests accordingly if so.
- Investigate why the password login path returns no error and no redirect (check network tab for 4xx/5xx responses and CORS).
- Once login succeeds, extend the tests to validate `/projects` fetches, rubro endpoints, and presigned S3 uploads.
