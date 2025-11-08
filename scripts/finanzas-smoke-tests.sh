#!/bin/bash
#
# Finanzas UI Deployment Smoke Tests
# Run this after deployment to verify Finanzas SPA is correctly served from CloudFront
# and API Gateway is accessible.
#
# Usage: bash scripts/finanzas-smoke-tests.sh [cognito-username] [cognito-password]
#

set -euo pipefail

# Source of Truth - HARD VALUES
CF_DIST="EPQU7PVDLQXUA"
CF_DOMAIN="d7t9x3j66yd8k.cloudfront.net"
CF_URL="https://${CF_DOMAIN}"
FINANZAS_URL="${CF_URL}/finanzas"
API_BASE="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
COGNITO_CLIENT_ID="dshos5iou44tuach7ta3ici5m"
AWS_REGION="us-east-2"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  exit 1
}

warn() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

info() {
  echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

# Parse CLI arguments
USERNAME="${1:-}"
PASSWORD="${2:-}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Finanzas UI Deployment Smoke Tests                     ║"
echo "║      (CloudFront + S3 + API Gateway Verification)             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ========== SECTION 1: CloudFront Configuration ==========
echo "📍 Section 1: CloudFront Configuration Verification"
echo "─────────────────────────────────────────────────────"

info "Verifying CloudFront distribution $CF_DIST has /finanzas/* behavior..."
BEHAVIOR_COUNT=$(aws cloudfront get-distribution-config \
  --id "$CF_DIST" \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`] | length(@)' \
  --output text 2>/dev/null || echo "0")

if [ "$BEHAVIOR_COUNT" = "1" ]; then
  pass "CloudFront /finanzas/* behavior exists"
  
  # Check target origin
  TARGET_ORIGIN=$(aws cloudfront get-distribution-config \
    --id "$CF_DIST" \
    --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`][0].TargetOriginId' \
    --output text)
  
  if [ "$TARGET_ORIGIN" = "finanzas-ui-s3" ]; then
    pass "Target origin is finanzas-ui-s3"
  else
    warn "Target origin is $TARGET_ORIGIN (expected finanzas-ui-s3)"
  fi
  
  # Check SmoothStreaming
  SMOOTH_STREAMING=$(aws cloudfront get-distribution-config \
    --id "$CF_DIST" \
    --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/finanzas/*`][0].SmoothStreaming' \
    --output text)
  
  if [ "$SMOOTH_STREAMING" = "false" ]; then
    pass "SmoothStreaming is disabled"
  else
    warn "SmoothStreaming is $SMOOTH_STREAMING (expected false)"
  fi
else
  fail "CloudFront /finanzas/* behavior NOT found (count: $BEHAVIOR_COUNT)"
fi

echo ""

# ========== SECTION 2: S3 Bucket Verification ==========
echo "📍 Section 2: S3 Bucket Verification"
echo "────────────────────────────────────"

info "Checking S3 bucket ukusi-ui-finanzas-prod..."
if aws s3api head-bucket --bucket ukusi-ui-finanzas-prod 2>/dev/null; then
  pass "S3 bucket exists"
else
  fail "S3 bucket not found"
fi

info "Verifying index.html exists in /finanzas/ prefix..."
if aws s3api head-object \
  --bucket ukusi-ui-finanzas-prod \
  --key finanzas/index.html \
  --output json 2>/dev/null | jq -e '.ContentLength' >/dev/null; then
  
  SIZE=$(aws s3api head-object \
    --bucket ukusi-ui-finanzas-prod \
    --key finanzas/index.html \
    --query 'ContentLength' --output text)
  pass "index.html exists (size: $SIZE bytes)"
else
  fail "index.html not found in s3://ukusi-ui-finanzas-prod/finanzas/"
fi

info "Verifying asset files exist..."
ASSET_COUNT=$(aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/assets/ --recursive | wc -l)
if [ "$ASSET_COUNT" -gt 0 ]; then
  pass "Asset files exist ($ASSET_COUNT files)"
else
  warn "No asset files found in /finanzas/assets/"
fi

echo ""

# ========== SECTION 3: UI Accessibility ==========
echo "📍 Section 3: UI Accessibility"
echo "───────────────────────────────"

info "Testing HTTP connectivity to $FINANZAS_URL"
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FINANZAS_URL/" || echo "000")

if [ "$STATUS" = "200" ]; then
  pass "UI accessible (HTTP $STATUS)"
else
  fail "UI not accessible (HTTP $STATUS)"
fi

echo ""

# ========== SECTION 4: Asset Path Verification ==========
echo "📍 Section 4: Asset Path Verification"
echo "─────────────────────────────────────"

info "Fetching HTML and checking asset paths..."
HTML=$(curl -sS "$FINANZAS_URL/" 2>/dev/null || echo "")

if [ -z "$HTML" ]; then
  fail "Could not fetch HTML"
fi

# Check for /finanzas/assets paths
if echo "$HTML" | grep -q '/finanzas/assets/'; then
  ASSET_REFS=$(echo "$HTML" | grep -o '/finanzas/assets/[^"]*' | head -3)
  pass "Asset paths use /finanzas/assets/ prefix"
  info "Sample asset references:"
  echo "$ASSET_REFS" | sed 's/^/  - /'
else
  fail "HTML does not reference /finanzas/assets/"
fi

# Check for incorrect /assets paths
if echo "$HTML" | grep -E 'src="/assets/|href="/assets/' >/dev/null; then
  fail "HTML contains incorrect /assets/ paths (should be /finanzas/assets/)"
fi

echo ""

# ========== SECTION 5: Leakage Detection ==========
echo "📍 Section 5: Leakage Detection (github.dev/codespaces)"
echo "──────────────────────────────────────────────────────"

info "Scanning HTML for github.dev references..."
if echo "$HTML" | grep -iq 'github\.dev'; then
  fail "HTML contains github.dev reference"
else
  pass "No github.dev references found"
fi

info "Scanning HTML for codespaces references..."
if echo "$HTML" | grep -iq 'codespaces'; then
  fail "HTML contains codespaces reference"
else
  pass "No codespaces references found"
fi

echo ""

# ========== SECTION 6: API Connectivity ==========
echo "📍 Section 6: API Connectivity"
echo "──────────────────────────────"

info "Testing API Gateway health endpoint (public)..."
API_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$API_BASE/health" || echo "000")

if [ "$API_STATUS" = "200" ]; then
  pass "API health endpoint accessible (HTTP $API_STATUS)"
  
  HEALTH_RESP=$(curl -sS "$API_BASE/health" 2>/dev/null || echo "{}")
  STAGE=$(echo "$HEALTH_RESP" | jq -r '.stage // "unknown"' 2>/dev/null || echo "unknown")
  info "API Stage: $STAGE"
else
  warn "API health endpoint not accessible (HTTP $API_STATUS)"
fi

echo ""

# ========== SECTION 7: Protected Endpoints (Optional) ==========
if [ -n "$USERNAME" ] && [ -n "$PASSWORD" ]; then
  echo "📍 Section 7: Protected Endpoints (Cognito Auth)"
  echo "──────────────────────────────────────────────"
  
  info "Obtaining Cognito ID token..."
  ID_TOKEN=$(aws cognito-idp initiate-auth \
    --region "$AWS_REGION" \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$COGNITO_CLIENT_ID" \
    --auth-parameters USERNAME="$USERNAME" PASSWORD="$PASSWORD" \
    --query 'AuthenticationResult.IdToken' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$ID_TOKEN" ]; then
    warn "Could not obtain ID token (check credentials)"
  else
    pass "ID token obtained"
    
    # Verify token contains correct aud
    TOKEN_AUD=$(echo "$ID_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.aud' 2>/dev/null || echo "unknown")
    if [ "$TOKEN_AUD" = "$COGNITO_CLIENT_ID" ]; then
      pass "Token aud matches Cognito client ID"
    else
      warn "Token aud mismatch (got: $TOKEN_AUD)"
    fi
    
    echo ""
    
    # Test protected endpoint /catalog/rubros
    info "Testing protected endpoint: GET /catalog/rubros"
    RUBROS_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $ID_TOKEN" \
      "$API_BASE/catalog/rubros" || echo "000")
    
    if [ "$RUBROS_STATUS" = "200" ]; then
      RUBROS_COUNT=$(curl -sS \
        -H "Authorization: Bearer $ID_TOKEN" \
        "$API_BASE/catalog/rubros" 2>/dev/null | jq '.data | length' 2>/dev/null || echo "?")
      pass "Protected endpoint /catalog/rubros accessible (HTTP $RUBROS_STATUS, items: $RUBROS_COUNT)"
    else
      warn "Protected endpoint /catalog/rubros returned HTTP $RUBROS_STATUS"
    fi
    
    # Test protected endpoint /allocation-rules
    info "Testing protected endpoint: GET /allocation-rules"
    RULES_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $ID_TOKEN" \
      "$API_BASE/allocation-rules" || echo "000")
    
    if [ "$RULES_STATUS" = "200" ]; then
      RULES_COUNT=$(curl -sS \
        -H "Authorization: Bearer $ID_TOKEN" \
        "$API_BASE/allocation-rules" 2>/dev/null | jq '.data | length' 2>/dev/null || echo "?")
      pass "Protected endpoint /allocation-rules accessible (HTTP $RULES_STATUS, items: $RULES_COUNT)"
    else
      warn "Protected endpoint /allocation-rules returned HTTP $RULES_STATUS"
    fi
  fi
  
  echo ""
else
  info "Skipping protected endpoint tests (provide USERNAME and PASSWORD to enable)"
  echo "Usage: bash $0 <cognito-username> <cognito-password>"
  echo ""
fi

# ========== FINAL SUMMARY ==========
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SMOKE TESTS COMPLETE                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "  - CloudFront Distribution: $CF_DIST"
echo "  - CloudFront Domain: $CF_DOMAIN"
echo "  - Finanzas URL: $FINANZAS_URL"
echo "  - API Base: $API_BASE"
echo "  - Region: $AWS_REGION"
echo ""
echo "🎯 Next Steps:"
echo "  1. Open $FINANZAS_URL in browser"
echo "  2. Log in with Cognito credentials"
echo "  3. Navigate to Rubros catalog"
echo "  4. Verify API calls work correctly"
echo "  5. Check CloudFront cache metrics in AWS Console"
echo ""
