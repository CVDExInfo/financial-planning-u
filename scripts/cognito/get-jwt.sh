#!/usr/bin/env bash
# Reusable JWT helper for Cognito authentication
# Prints JWT token to stdout, errors to stderr
# Exits non-zero on failure

set -euo pipefail

# Required environment variables
: "${AWS_REGION:?AWS_REGION is required}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_WEB_CLIENT:?COGNITO_WEB_CLIENT is required}"
: "${COGNITO_TESTER_USERNAME:?COGNITO_TESTER_USERNAME is required}"
: "${COGNITO_TESTER_PASSWORD:?COGNITO_TESTER_PASSWORD is required}"

# Check if AWS CLI is available
if ! command -v aws >/dev/null 2>&1; then
  echo "❌ AWS CLI is not installed or not in PATH" >&2
  exit 1
fi

# Authenticate with Cognito and get tokens
AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
  --region "$AWS_REGION" \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$COGNITO_WEB_CLIENT" \
  --auth-parameters "USERNAME=$COGNITO_TESTER_USERNAME,PASSWORD=$COGNITO_TESTER_PASSWORD" \
  --query 'AuthenticationResult' \
  --output json 2>&1) || {
    echo "❌ Failed to authenticate with Cognito" >&2
    echo "$AUTH_RESPONSE" >&2
    exit 1
  }

# Extract ID token (has aud claim for JWT authorizer validation)
# Note: API Gateway JWT authorizer requires aud claim in token; AccessToken lacks this
ID_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.IdToken' 2>/dev/null || echo "")

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" = "null" ]; then
  echo "❌ Failed to obtain ID token from authentication response" >&2
  exit 1
fi

# Print only the token to stdout (no debug info that would pollute the output)
printf '%s' "$ID_TOKEN"
