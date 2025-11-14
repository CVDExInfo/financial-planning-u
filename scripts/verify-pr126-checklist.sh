#!/usr/bin/env bash
#
# Pre-Merge Verification Script for PR #126
# Verifies critical CloudFront and deployment configuration before merge
#
# Usage: ./scripts/verify-pr126-checklist.sh [--stage dev|prod]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE="${1:-dev}"
if [ "$STAGE" = "--stage" ] && [ -n "${2:-}" ]; then
  STAGE="$2"
fi

echo ""
echo "============================================"
echo "🔍 PR #126 Pre-Merge Verification Checklist"
echo "============================================"
echo ""
echo "Stage: $STAGE"
echo ""

# Check AWS CLI
if ! command -v aws &>/dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
  exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  echo -e "${YELLOW}⚠️  AWS credentials not configured. AWS checks will be skipped.${NC}"
  SKIP_AWS=true
else
  SKIP_AWS=false
  echo -e "${GREEN}✅ AWS credentials configured${NC}"
fi

# Read configuration from workflow or defaults
AWS_REGION="${AWS_REGION:-us-east-2}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-EPQU7PVDLQXUA}"
FINANZAS_BUCKET_NAME="${FINANZAS_BUCKET_NAME:-ukusi-ui-finanzas-prod}"

if [ "$STAGE" = "prod" ]; then
  FINZ_API_ID="${FINZ_API_ID_PROD:-m3g6am67aj}"
  FINZ_API_STAGE="${FINZ_API_STAGE_PROD:-prod}"
else
  FINZ_API_ID="${FINZ_API_ID_DEV:-m3g6am67aj}"
  FINZ_API_STAGE="${FINZ_API_STAGE_DEV:-dev}"
fi

echo ""
echo "Configuration:"
echo "  AWS Region: $AWS_REGION"
echo "  CloudFront Distribution: $CLOUDFRONT_DIST_ID"
echo "  Finanzas Bucket: $FINANZAS_BUCKET_NAME"
echo "  API ID: $FINZ_API_ID"
echo "  API Stage: $FINZ_API_STAGE"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# ============================================
# 1. Repository Variables Check
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Checking Repository Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_var() {
  local var_name="$1"
  local var_value="${!var_name:-}"
  
  if [ -n "$var_value" ]; then
    echo -e "${GREEN}✅${NC} $var_name = $var_value"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $var_name is NOT set"
    ((CHECKS_FAILED++))
    return 1
  fi
}

echo "Required repository variables:"
check_var "FINANZAS_BUCKET_NAME"
check_var "CLOUDFRONT_DIST_ID"
check_var "AWS_REGION"

if [ "$STAGE" = "prod" ]; then
  check_var "FINZ_API_ID_PROD" || check_var "FINZ_API_ID"
  check_var "FINZ_API_STAGE_PROD"
else
  check_var "FINZ_API_ID_DEV" || check_var "FINZ_API_ID"
  check_var "FINZ_API_STAGE_DEV"
fi

echo ""
echo -e "${BLUE}ℹ️  Note: PMO vars (PMO_BUCKET_NAME, etc.) are no longer required in this repo${NC}"
echo ""

if [ "$SKIP_AWS" = "true" ]; then
  echo -e "${YELLOW}⚠️  AWS checks skipped (no credentials)${NC}"
  echo ""
  exit 0
fi

# ============================================
# 2. CloudFront Origin Path Verification
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Verifying Finanzas Origin Path (CRITICAL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DIST_CONFIG=$(aws cloudfront get-distribution-config --id "$CLOUDFRONT_DIST_ID" 2>/dev/null || echo '{}')

if [ "$DIST_CONFIG" = "{}" ]; then
  echo -e "${RED}❌ Could not retrieve CloudFront distribution config${NC}"
  ((CHECKS_FAILED++))
else
  # Find Finanzas origin
  FINANZAS_ORIGIN_PATH=$(echo "$DIST_CONFIG" | jq -r '.DistributionConfig.Origins.Items[] | select(.DomainName | contains("finanzas")) | .OriginPath // ""' | head -1)
  
  if [ -z "$FINANZAS_ORIGIN_PATH" ]; then
    echo -e "${GREEN}✅ Finanzas origin OriginPath is EMPTY (correct for /finanzas/* routing)${NC}"
    echo "   This ensures CloudFront forwards full paths to S3 correctly"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}❌ CRITICAL: Finanzas origin has OriginPath = '$FINANZAS_ORIGIN_PATH'${NC}"
    echo "   Expected: empty string"
    echo "   Issue: This will cause CloudFront to look for files at wrong S3 paths"
    echo "   Fix: Remove OriginPath from Finanzas origin in CloudFront console"
    ((CHECKS_FAILED++))
  fi
fi

echo ""

# ============================================
# 3. CloudFront Behaviors Check
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Verifying CloudFront Behaviors"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_behavior() {
  local pattern="$1"
  local behavior_count=$(echo "$DIST_CONFIG" | jq "[.DistributionConfig.CacheBehaviors.Items[]? | select(.PathPattern == \"$pattern\")] | length" 2>/dev/null || echo "0")
  
  if [ "$behavior_count" = "1" ]; then
    echo -e "${GREEN}✅${NC} Behavior exists: $pattern"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Behavior MISSING: $pattern"
    ((CHECKS_FAILED++))
    return 1
  fi
}

echo "Required behaviors:"
check_behavior "/finanzas"
check_behavior "/finanzas/"
check_behavior "/finanzas/*"

echo ""

# ============================================
# 4. CloudFront Function Association Check
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Verifying CloudFront Function Association (CRITICAL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# List all CloudFront functions
FUNCTIONS=$(aws cloudfront list-functions --stage LIVE 2>/dev/null || echo '{"FunctionList": {"Items": []}}')
FINANZAS_FUNCTION=$(echo "$FUNCTIONS" | jq -r '.FunctionList.Items[] | select(.Name | contains("finanzas") or contains("path-rewrite")) | .Name' | head -1)

if [ -z "$FINANZAS_FUNCTION" ]; then
  echo -e "${RED}❌ No Finanzas CloudFront Function found (expected: finanzas-path-rewrite)${NC}"
  echo "   Without this function, deep links like /finanzas/catalog/rubros will 404"
  ((CHECKS_FAILED++))
else
  echo -e "${GREEN}✅ Found CloudFront Function: $FINANZAS_FUNCTION${NC}"
  ((CHECKS_PASSED++))
  
  # Check function associations on behaviors
  echo ""
  echo "Checking function associations on behaviors:"
  
  for pattern in "/finanzas" "/finanzas/" "/finanzas/*"; do
    ASSOC=$(echo "$DIST_CONFIG" | jq -r ".DistributionConfig.CacheBehaviors.Items[]? | select(.PathPattern == \"$pattern\") | .FunctionAssociations.Items[]? | select(.EventType == \"viewer-request\") | .FunctionARN" 2>/dev/null || echo "")
    
    if [ -n "$ASSOC" ] && echo "$ASSOC" | grep -qi "finanzas\|path-rewrite"; then
      echo -e "${GREEN}  ✅${NC} $pattern → Function attached at viewer-request"
      ((CHECKS_PASSED++))
    else
      echo -e "${RED}  ❌${NC} $pattern → NO function attached or wrong function"
      echo "     Expected: $FINANZAS_FUNCTION at viewer-request"
      echo "     This will break SPA deep links!"
      ((CHECKS_FAILED++))
    fi
  done
fi

echo ""

# ============================================
# 5. S3 Bucket Structure Check
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Verifying S3 Bucket Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if aws s3api head-bucket --bucket "$FINANZAS_BUCKET_NAME" &>/dev/null; then
  echo -e "${GREEN}✅${NC} Bucket exists: s3://$FINANZAS_BUCKET_NAME/"
  ((CHECKS_PASSED++))
  
  # Check if files are at /finanzas/ prefix (correct for workflow)
  if aws s3api head-object --bucket "$FINANZAS_BUCKET_NAME" --key "finanzas/index.html" &>/dev/null; then
    MODIFIED=$(aws s3api head-object --bucket "$FINANZAS_BUCKET_NAME" --key "finanzas/index.html" --query 'LastModified' --output text)
    echo -e "${GREEN}✅${NC} Finanzas files at s3://$FINANZAS_BUCKET_NAME/finanzas/"
    echo "   Last modified: $MODIFIED"
    ((CHECKS_PASSED++))
  else
    echo -e "${YELLOW}⚠️${NC}  No index.html at s3://$FINANZAS_BUCKET_NAME/finanzas/"
    echo "   This may be expected before first deployment"
    ((CHECKS_WARNING++))
  fi
else
  echo -e "${RED}❌${NC} Bucket NOT accessible: s3://$FINANZAS_BUCKET_NAME/"
  ((CHECKS_FAILED++))
fi

echo ""

# ============================================
# 6. API Endpoint Check
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Verifying API Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_BASE_URL="https://${FINZ_API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${FINZ_API_STAGE}"
echo "Testing: $API_BASE_URL/health"

HEALTH_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$API_BASE_URL/health" 2>/dev/null || echo "ERROR")

if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅${NC} API /health returns 200"
  echo "   API is deployed and accessible"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}❌${NC} API /health returns $HEALTH_STATUS"
  echo "   The API may not be deployed correctly"
  ((CHECKS_FAILED++))
fi

echo ""

# ============================================
# 7. Build Artifacts Guard
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  Checking Build Artifacts (Local)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if dist-finanzas exists
if [ -d "dist-finanzas" ]; then
  echo "Found dist-finanzas/ directory"
  
  # Check for aws-exports.js (should NOT be in Finanzas)
  if find dist-finanzas -name "aws-exports.js" -o -name "aws-exports.ts" | grep -q .; then
    echo -e "${RED}❌${NC} CRITICAL: aws-exports.js found in Finanzas build!"
    echo "   This is a PMO/Amplify concern and should not be in Finanzas"
    ((CHECKS_FAILED++))
  else
    echo -e "${GREEN}✅${NC} No aws-exports.js in Finanzas build"
    ((CHECKS_PASSED++))
  fi
  
  # Check for correct base path in HTML
  if [ -f "dist-finanzas/index.html" ]; then
    if grep -q '"/finanzas/assets/' dist-finanzas/index.html; then
      echo -e "${GREEN}✅${NC} dist-finanzas/index.html uses /finanzas/assets/ paths"
      ((CHECKS_PASSED++))
    else
      echo -e "${YELLOW}⚠️${NC}  dist-finanzas/index.html may not have correct asset paths"
      echo "   Expected: /finanzas/assets/*"
      ((CHECKS_WARNING++))
    fi
  fi
else
  echo -e "${YELLOW}⚠️${NC}  dist-finanzas/ not found (build not run locally yet)"
  ((CHECKS_WARNING++))
fi

echo ""

# ============================================
# Summary
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Checks passed: $CHECKS_PASSED${NC}"
if [ $CHECKS_WARNING -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warnings: $CHECKS_WARNING${NC}"
fi
if [ $CHECKS_FAILED -gt 0 ]; then
  echo -e "${RED}❌ Checks failed: $CHECKS_FAILED${NC}"
fi
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All critical checks passed! PR #126 is ready to merge.${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Please review the issues above before merging.${NC}"
  echo ""
  echo "Key actions:"
  echo "  1. Ensure CloudFront function is attached to all /finanzas behaviors"
  echo "  2. Verify OriginPath is empty for Finanzas S3 origin"
  echo "  3. Check repository variables are set correctly"
  echo ""
  exit 1
fi
