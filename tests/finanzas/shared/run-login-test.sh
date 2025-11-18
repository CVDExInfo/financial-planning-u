#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

if [[ -n "${FINZ_API_BASE:-}" ]]; then
  guard_dev_api_target
fi

# Cognito login smoke test
# This script validates that the tester credentials work with Cognito.
# If login fails, this script will exit with non-zero status and fail the workflow.

: "${COGNITO_TESTER_USERNAME:?COGNITO_TESTER_USERNAME not set}"
: "${COGNITO_TESTER_PASSWORD:?COGNITO_TESTER_PASSWORD not set}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID not set}"
: "${COGNITO_WEB_CLIENT:?COGNITO_WEB_CLIENT not set}"

echo "=== Cognito login smoke test ==="
echo "Testing authentication with user: ${COGNITO_TESTER_USERNAME}"

# Ensure AWS CLI is available
if ! command -v aws >/dev/null 2>&1; then
  echo "❌ AWS CLI is not installed or not in PATH"
  exit 1
fi

# Attempt Cognito authentication
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$COGNITO_WEB_CLIENT" \
  --auth-parameters USERNAME="$COGNITO_TESTER_USERNAME",PASSWORD="$COGNITO_TESTER_PASSWORD" \
  --region "${AWS_REGION:-us-east-2}" \
  > /tmp/finz_login_response.json

echo "✅ Login successful - response written to /tmp/finz_login_response.json"
echo "IdToken present: $(jq -r 'if .AuthenticationResult.IdToken then "yes" else "no" end' /tmp/finz_login_response.json 2>/dev/null || echo "unknown")"
