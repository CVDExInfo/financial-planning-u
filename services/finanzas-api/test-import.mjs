// Test 1: With COGNITO_CLIENT_ID in test mode
console.log("\n=== Test 1: With COGNITO_CLIENT_ID in test mode ===");
process.env.NODE_ENV = "test";
process.env.COGNITO_CLIENT_ID = "test-client-123";
process.env.COGNITO_USER_POOL_ID = "us-east-2_TestPool";
process.env.AWS_REGION = "us-east-2";

import('./src/lib/auth.js').then(() => {
  console.log("✓ Successfully imported auth.ts with client ID");
}).catch(err => {
  console.error("✗ Failed:", err.message);
});
