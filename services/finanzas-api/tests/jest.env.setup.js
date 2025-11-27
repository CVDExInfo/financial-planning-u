// Jest-only environment setup for Finanzas API unit tests.
// These defaults ensure auth.ts can be imported without requiring real Cognito env vars.
// Production and local runtime behaviour remains unchanged; real env vars must be provided there.

if (!process.env.COGNITO_USER_POOL_ID) {
  process.env.COGNITO_USER_POOL_ID = "us-east-2_FyHLtOhiY";
}

if (!process.env.COGNITO_CLIENT_ID) {
  process.env.COGNITO_CLIENT_ID = "test-client-id-for-jest";
}

if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = "us-east-2";
}
