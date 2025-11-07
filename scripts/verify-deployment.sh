#!/bin/bash
# Deployment Verification Script for Dual-SPA (PMO + Finanzas)
# Usage: ./scripts/verify-deployment.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "============================================"
echo "🔍 Deployment Verification - PMO + Finanzas"
echo "============================================"
echo ""

# Check if AWS CLI is available
if ! command -v aws &>/dev/null; then
  echo "❌ AWS CLI not found. Please install it first."
  exit 1
fi

# Try to get AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  echo "⚠️  AWS credentials not configured. Some checks will be skipped."
  SKIP_AWS=true
else
  SKIP_AWS=false
fi

# Configuration
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-EPQU7PVDLQXUA}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-ukusi-ui-finanzas-prod}"
CLOUDFRONT_DOMAIN="d7t9x3j66yd8k.cloudfront.net"

echo "Configuration:"
echo "  CloudFront Distribution: $CLOUDFRONT_DIST_ID"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "  S3 Bucket: $S3_BUCKET_NAME"
echo ""

# ===== CloudFront Behaviors =====
if [ "$SKIP_AWS" != "true" ]; then
  echo "1️⃣  Checking CloudFront Behaviors..."
  echo ""
  
  BEHAVIORS=$(aws cloudfront get-distribution-config --id "$CLOUDFRONT_DIST_ID" 2>/dev/null || echo "{}")
  
  if [ "$BEHAVIORS" != "{}" ]; then
    echo "✅ CloudFront distribution accessible"
    
    # Check for /finanzas/* behavior
    if echo "$BEHAVIORS" | jq -e '.DistributionConfig.DistributionConfig.CacheBehaviors[]? | select(.PathPattern == "/finanzas/*")' &>/dev/null 2>&1; then
      echo "✅ /finanzas/* behavior found"
    else
      echo "⚠️  /finanzas/* behavior NOT found - this may be the issue!"
      echo "   Requests to /finanzas/* may be served by default behavior"
    fi
  else
    echo "❌ Could not retrieve CloudFront config"
  fi
  echo ""
fi

# ===== S3 Content Verification =====
if [ "$SKIP_AWS" != "true" ]; then
  echo "2️⃣  Checking S3 Bucket Content..."
  echo ""
  
  if aws s3 ls "s3://$S3_BUCKET_NAME/" &>/dev/null 2>&1; then
    echo "✅ S3 bucket accessible: s3://$S3_BUCKET_NAME/"
    
    # Check for root index.html (PMO)
    if aws s3api head-object --bucket "$S3_BUCKET_NAME" --key "index.html" &>/dev/null 2>&1; then
      echo "✅ PMO Portal: index.html found at root"
    else
      echo "❌ PMO Portal: index.html NOT found at root"
    fi
    
    # Check for finanzas/index.html
    if aws s3api head-object --bucket "$S3_BUCKET_NAME" --key "finanzas/index.html" &>/dev/null 2>&1; then
      MODIFIED=$(aws s3api head-object --bucket "$S3_BUCKET_NAME" --key "finanzas/index.html" --query 'LastModified' --output text)
      echo "✅ Finanzas Portal: index.html found"
      echo "   Last modified: $MODIFIED"
    else
      echo "❌ Finanzas Portal: index.html NOT found at finanzas/"
      echo "   Checking if finanzas/ directory exists..."
      if aws s3 ls "s3://$S3_BUCKET_NAME/finanzas/" --recursive | head -5 &>/dev/null 2>&1; then
        echo "   Files exist in finanzas/ directory"
        echo "   First few files:"
        aws s3 ls "s3://$S3_BUCKET_NAME/finanzas/" --recursive | head -10
      else
        echo "   ❌ finanzas/ directory is EMPTY or does not exist"
      fi
    fi
  else
    echo "❌ Could not access S3 bucket: s3://$S3_BUCKET_NAME/"
  fi
  echo ""
fi

# ===== Web Accessibility =====
echo "3️⃣  Testing Web Accessibility..."
echo ""

# Test PMO root
PMO_URL="https://$CLOUDFRONT_DOMAIN/"
echo "Testing PMO Portal: $PMO_URL"
PMO_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$PMO_URL" 2>/dev/null || echo "ERROR")
if [ "$PMO_STATUS" = "200" ]; then
  echo "✅ PMO Portal: HTTP 200"
else
  echo "❌ PMO Portal: HTTP $PMO_STATUS"
fi

# Test Finanzas
FINANZAS_URL="https://$CLOUDFRONT_DOMAIN/finanzas/"
echo "Testing Finanzas Portal: $FINANZAS_URL"
FINANZAS_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FINANZAS_URL" 2>/dev/null || echo "ERROR")
if [ "$FINANZAS_STATUS" = "200" ]; then
  echo "✅ Finanzas Portal: HTTP 200"
else
  echo "❌ Finanzas Portal: HTTP $FINANZAS_STATUS"
fi

# Test Finanzas subdirectory
FINANZAS_CATALOG_URL="https://$CLOUDFRONT_DOMAIN/finanzas/catalog/rubros"
echo "Testing Finanzas Catalog: $FINANZAS_CATALOG_URL"
FINANZAS_CATALOG_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FINANZAS_CATALOG_URL" 2>/dev/null || echo "ERROR")
if [ "$FINANZAS_CATALOG_STATUS" = "200" ]; then
  echo "✅ Finanzas Catalog: HTTP 200"
else
  echo "❌ Finanzas Catalog: HTTP $FINANZAS_CATALOG_STATUS"
fi

echo ""
echo "============================================"
echo "Summary"
echo "============================================"
echo ""
if [ "$FINANZAS_STATUS" = "200" ]; then
  echo "✅ Deployment appears correct!"
else
  echo "⚠️  Issues detected. Please review checklist in DEPLOYMENT_DIAGNOSTICS.md"
fi
echo ""
