#!/usr/bin/env bash
# Example environment configuration for Finanzas CLI smoke tests.
# Copy this file to env.sh (ignored via .gitignore) and replace placeholder values
# with the actual endpoints, Cognito tester credentials, and configuration.

export FINZ_API_BASE="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod"
export FINZ_UI_BASE="https://d7t9x3j66yd8k.cloudfront.net/finanzas"

# Cognito tester account (matches COGNITO_TESTER_USERNAME / COGNITO_TESTER_PASSWORD in CI)
export FINZ_TEST_EMAIL="tester@example.com"
export FINZ_TEST_PASSWORD="replace-with-real-password"
export FINZ_COGNITO_REGION="us-east-2"
export FINZ_COGNITO_CLIENT_ID="dshos5iou44tuach7ta3ici5m"

# Optional: pre-generated ID token to skip AWS CLI auth (takes precedence if set)
# export FINZ_ID_TOKEN="eyJhbGci..."

# Helper: location where curl output will be persisted.
export FINZ_LOG_DIR="${FINZ_LOG_DIR:-/tmp}"
