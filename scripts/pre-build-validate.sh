#!/usr/bin/env bash
#
# pre-build-validate.sh
# ====================
# Pre-build validation script that runs before Vite build
#
# This script ensures critical configuration is present before building.
# It's designed to be lightweight and fast, with optional full validation.
#
# Usage:
#   npm run validate:pre-build
#   BUILD_TARGET=finanzas npm run validate:pre-build
#

set -euo pipefail

# Get build target
BUILD_TARGET="${BUILD_TARGET:-finanzas}"

echo ""
echo "🔍 Pre-Build Validation (BUILD_TARGET=$BUILD_TARGET)"
echo "════════════════════════════════════════════════════════"
echo ""

# For PMO builds, we don't require VITE_API_BASE_URL
if [ "$BUILD_TARGET" = "pmo" ]; then
  echo "ℹ️  PMO build detected - skipping Finanzas-specific checks"
  exit 0
fi

# For Finanzas builds, VITE_API_BASE_URL is REQUIRED
if [ "$BUILD_TARGET" = "finanzas" ]; then
  echo "📍 Validating Finanzas build configuration..."
  echo ""
  
  # Check if VITE_API_BASE_URL is set
  if [ -z "${VITE_API_BASE_URL:-}" ]; then
    echo "❌ CRITICAL: VITE_API_BASE_URL is not set"
    echo ""
    echo "This environment variable is REQUIRED for Finanzas builds."
    echo "Without it, the frontend will not be able to connect to the API."
    echo ""
    echo "🔧 To fix this:"
    echo "  1. Set VITE_API_BASE_URL in your environment:"
    echo "     export VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"
    echo ""
    echo "  2. Or create a .env.local file with:"
    echo "     VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"
    echo ""
    echo "  3. For CI/CD: Set as GitHub repository variable or secret"
    echo ""
    exit 1
  fi
  
  # Normalize and validate the URL
  VITE_API_BASE_URL="$(echo "$VITE_API_BASE_URL" | sed 's/[[:space:]]*$//' | sed 's:/*$::')"

  if [ -z "$VITE_API_BASE_URL" ]; then
    echo "❌ CRITICAL: VITE_API_BASE_URL is empty (after trimming whitespace)"
    exit 1
  fi

  # Basic URL format validation
  if ! echo "$VITE_API_BASE_URL" | grep -qE '^https?://[a-zA-Z0-9]'; then
    echo "❌ CRITICAL: VITE_API_BASE_URL has invalid format"
    echo "   Got: '$VITE_API_BASE_URL'"
    echo "   Expected: https://... or http://..."
    exit 1
  fi

  # Ensure API base URL points to expected API/stage unless explicitly overridden
  EXPECTED_API_BASE_URL="${EXPECTED_API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"
  if [ -n "$EXPECTED_API_BASE_URL" ] && [ "$VITE_API_BASE_URL" != "$EXPECTED_API_BASE_URL" ]; then
    echo "❌ CRITICAL: VITE_API_BASE_URL does not match expected target"
    echo "   Expected: $EXPECTED_API_BASE_URL"
    echo "   Got:      $VITE_API_BASE_URL"
    echo ""
    echo "Set EXPECTED_API_BASE_URL to override this check if a different stage is required."
    exit 1
  fi

  echo "✅ VITE_API_BASE_URL is set: $VITE_API_BASE_URL"
  echo "   (expected target: $EXPECTED_API_BASE_URL)"
  echo ""

  # Ensure Cognito and CloudFront configuration are present
  if [ -z "${VITE_COGNITO_DOMAIN:-}" ]; then
    echo "❌ CRITICAL: VITE_COGNITO_DOMAIN is not set"
    echo "   Expected: us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com"
    exit 1
  fi

  if [ -z "${VITE_CLOUDFRONT_URL:-}" ]; then
    echo "❌ CRITICAL: VITE_CLOUDFRONT_URL is not set"
    echo "   Expected: https://d7t9x3j66yd8k.cloudfront.net"
    exit 1
  fi

  echo "✅ VITE_COGNITO_DOMAIN: $VITE_COGNITO_DOMAIN"
  echo "✅ VITE_CLOUDFRONT_URL: $VITE_CLOUDFRONT_URL"
  echo ""
  
  # Validate OAuth configuration in src/config/aws.ts
  echo "🔐 Validating OAuth configuration..."
  
  # Check that responseType is set to "token" (implicit flow)
  if grep -q 'responseType: "token"' src/config/aws.ts; then
    echo "✅ OAuth responseType is correctly set to 'token' (implicit flow)"
  else
    echo "❌ CRITICAL: OAuth responseType must be 'token' for implicit flow"
    echo ""
    echo "Current configuration in src/config/aws.ts does not contain:"
    echo "  responseType: \"token\""
    echo ""
    echo "This is required for the Cognito Hosted UI implicit grant flow."
    echo "Please update src/config/aws.ts to use:"
    echo "  oauth: {"
    echo "    responseType: \"token\","
    echo "    scope: [\"openid\", \"email\", \"profile\", \"aws.cognito.signin.user.admin\"],"
    echo "    ..."
    echo "  }"
    echo ""
    echo "DO NOT use 'token id_token' - this is not a valid AWS Cognito response_type."
    echo ""
    exit 1
  fi
  
  # Check that scope includes "openid" (required for id_token)
  if grep -q '"openid"' src/config/aws.ts; then
    echo "✅ OAuth scope includes 'openid' (required for id_token)"
  else
    echo "⚠️  WARNING: OAuth scope should include 'openid' for id_token to be issued"
  fi
  
  echo ""
  
  # Optional: Run full validation if VALIDATE_API_CONNECTIVITY is set
  if [ "${VALIDATE_API_CONNECTIVITY:-false}" = "true" ]; then
    echo "🌐 Running full API connectivity validation..."
    echo ""
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/validate-api-config.sh" ]; then
      bash "$SCRIPT_DIR/validate-api-config.sh"
    else
      echo "⚠️  validate-api-config.sh not found, skipping connectivity check"
    fi
  else
    echo "ℹ️  Skipping connectivity check (set VALIDATE_API_CONNECTIVITY=true to enable)"
  fi
  
  echo ""
  echo "✅ Pre-build validation passed"
fi

exit 0
