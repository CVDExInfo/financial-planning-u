#!/usr/bin/env bash
# Validate Finanzas API production deployment
# This script checks that the prod stage is properly deployed to API Gateway
set -euo pipefail

REGION=${AWS_REGION:-us-east-2}
EXPECTED_API_ID=${EXPECTED_API_ID:-pyorjw6lbe}
PROD_STACK=${PROD_STACK:-finanzas-sd-api-prod}
PROD_STAGE=${PROD_STAGE:-prod}

echo "=== Finanzas API Production Deployment Validation ==="
echo ""
echo "Region: $REGION"
echo "Expected API ID: $EXPECTED_API_ID"
echo "Stack: $PROD_STACK"
echo "Stage: $PROD_STAGE"
echo ""

# Check if the stack exists
echo "✓ Checking CloudFormation stack..."
if aws cloudformation describe-stacks --stack-name "$PROD_STACK" --region "$REGION" &>/dev/null; then
  echo "  ✅ Stack '$PROD_STACK' exists"
  
  # Get stack outputs
  API_ID=$(aws cloudformation describe-stacks --stack-name "$PROD_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='FinzApiId'].OutputValue" --output text --region "$REGION")
  API_URL=$(aws cloudformation describe-stacks --stack-name "$PROD_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='FinzApiUrl'].OutputValue" --output text --region "$REGION")
  
  echo "  API ID: $API_ID"
  echo "  API URL: $API_URL"
  
  # Verify API ID matches expected
  if [ "$API_ID" = "$EXPECTED_API_ID" ]; then
    echo "  ✅ API ID matches expected value"
  else
    echo "  ❌ API ID mismatch! Expected: $EXPECTED_API_ID, Got: $API_ID"
    exit 1
  fi
else
  echo "  ❌ Stack '$PROD_STACK' does not exist"
  echo ""
  echo "To deploy the stack, run:"
  echo "  cd services/finanzas-api"
  echo "  sam build"
  echo "  sam deploy --stack-name $PROD_STACK --parameter-overrides StageName=$PROD_STAGE"
  exit 1
fi

# Check if prod stage exists on the API
echo ""
echo "✓ Checking API Gateway stage..."
STAGES=$(aws apigatewayv2 get-stages --api-id "$API_ID" --region "$REGION" --query 'Items[].StageName' --output text)
if echo "$STAGES" | grep -qw "$PROD_STAGE"; then
  echo "  ✅ Stage '$PROD_STAGE' exists on API $API_ID"
  echo "  Available stages: $STAGES"
else
  echo "  ❌ Stage '$PROD_STAGE' not found on API $API_ID"
  echo "  Available stages: $STAGES"
  exit 1
fi

# Check mandatory routes
echo ""
echo "✓ Checking API routes..."
ROUTES=$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" --query 'Items[].RouteKey' --output text)
for ROUTE in "GET /health" "GET /catalog/rubros" "POST /projects" "GET /allocation-rules"; do
  if echo "$ROUTES" | grep -q "^${ROUTE}$"; then
    echo "  ✅ Route found: $ROUTE"
  else
    echo "  ❌ Route missing: $ROUTE"
    exit 1
  fi
done

# Check authorizer
echo ""
echo "✓ Checking API authorizers..."
AUTH_COUNT=$(aws apigatewayv2 get-authorizers --api-id "$API_ID" --region "$REGION" --query 'length(Items[?Name==`CognitoJwt`])' --output text)
if [ "$AUTH_COUNT" -ge "1" ]; then
  echo "  ✅ CognitoJwt authorizer present"
else
  echo "  ❌ CognitoJwt authorizer not found"
  exit 1
fi

# Test health endpoint
echo ""
echo "✓ Testing health endpoint..."
HEALTH_STATUS=$(curl -s -o /tmp/health.json -w '%{http_code}' "${API_URL}/health" || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "  ✅ Health endpoint returned 200"
  RESPONSE=$(cat /tmp/health.json)
  echo "  Response: $RESPONSE"
  
  # Check if response indicates correct stage
  if echo "$RESPONSE" | jq -e ".stage == \"$PROD_STAGE\"" &>/dev/null; then
    echo "  ✅ Health response indicates stage: $PROD_STAGE"
  else
    ACTUAL_STAGE=$(cat /tmp/health.json | jq -r '.stage // "unknown"')
    echo "  ⚠️  Stage in response: $ACTUAL_STAGE (expected: $PROD_STAGE)"
  fi
else
  echo "  ❌ Health endpoint returned $HEALTH_STATUS"
  cat /tmp/health.json
  exit 1
fi

# Test catalog endpoint (public, no auth required)
echo ""
echo "✓ Testing catalog endpoint..."
CATALOG_STATUS=$(curl -s -o /tmp/catalog.json -w '%{http_code}' "${API_URL}/catalog/rubros" || echo "000")
if [ "$CATALOG_STATUS" = "200" ] || [ "$CATALOG_STATUS" = "401" ]; then
  echo "  ✅ Catalog endpoint returned $CATALOG_STATUS (200=OK, 401=Requires auth)"
  if [ "$CATALOG_STATUS" = "200" ]; then
    TOTAL=$(cat /tmp/catalog.json | jq -r '.total // 0')
    echo "  Total rubros: $TOTAL"
  fi
else
  echo "  ❌ Catalog endpoint returned unexpected status: $CATALOG_STATUS"
  cat /tmp/catalog.json
  exit 1
fi

echo ""
echo "=== ✅ Production Deployment Validation Complete ==="
echo ""
echo "API URL: $API_URL"
echo "Stage: $PROD_STAGE"
echo ""
echo "To test protected endpoints, use:"
echo "  STAGE=$PROD_STAGE STACK_NAME=$PROD_STACK API_URL=$API_URL \\"
echo "    CLIENT_ID=\$COGNITO_WEB_CLIENT USERNAME=\$USERNAME PASSWORD=\$PASSWORD \\"
echo "    USER_POOL_ID=\$COGNITO_USER_POOL_ID \\"
echo "    bash scripts/test-protected-endpoints.sh"
