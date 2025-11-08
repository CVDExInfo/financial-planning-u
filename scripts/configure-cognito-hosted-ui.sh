#!/bin/bash
# scripts/configure-cognito-hosted-ui.sh
# Configure Cognito App Client for Hosted UI login flow
#
# PREREQUISITES:
# 1. AWS CLI installed and configured with credentials
# 2. Appropriate IAM permissions: cognito-idp:UpdateUserPoolClient
#
# USAGE:
#   bash scripts/configure-cognito-hosted-ui.sh
#
# OR manually in AWS Console: See MANUAL_STEPS.md

set -e

# Configuration
USER_POOL_ID="us-east-2_FyHLtOhiY"
CLIENT_ID="dshos5iou44tuach7ta3ici5m"
REGION="us-east-2"
CALLBACK_URL="https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html"
FINANZAS_URL="https://d7t9x3j66yd8k.cloudfront.net/finanzas/"
PMO_URL="https://d7t9x3j66yd8k.cloudfront.net/"

echo "🔧 Configuring Cognito App Client for Hosted UI..."
echo ""
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID:   $CLIENT_ID"
echo "Region:      $REGION"
echo ""

# Step 1: Describe current client
echo "📋 Current client configuration:"
aws cognito-idp describe-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --region "$REGION" \
  --query 'UserPoolClient.[ClientName,AllowedOAuthFlows,AllowedOAuthScopes,CallbackURLs]' \
  --output table 2>/dev/null || echo "⚠️  Unable to fetch current config (check AWS credentials)"

echo ""
echo "🔄 Updating client configuration..."

# Step 2: Update App Client with Hosted UI settings
# This enables implicit flow and sets callback URLs
aws cognito-idp update-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --region "$REGION" \
  --explicit-auth-flows \
    ALLOW_USER_PASSWORD_AUTH \
    ALLOW_REFRESH_TOKEN_AUTH \
    ALLOW_IMPLICIT_OAUTH_AUTH_FLOW \
  --allowed-o-auth-flows \
    implicit \
    code \
  --allowed-o-auth-scopes \
    openid \
    email \
    profile \
  --callback-urls \
    "$CALLBACK_URL" \
    "$FINANZAS_URL" \
    "$PMO_URL" \
  --allowed-o-auth-flows-user-pool-client \
  2>/dev/null && {
    echo "✅ App Client updated successfully"
  } || {
    echo "⚠️  Update via AWS CLI failed (credentials or permissions issue)"
    echo "    → Please complete MANUAL STEPS below"
  }

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📝 MANUAL STEPS (if CLI failed):"
echo ""
echo "1. Go to AWS Cognito Console:"
echo "   https://console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-2_FyHLtOhiY/clients?region=us-east-2"
echo ""
echo "2. Click on client: dshos5iou44tuach7ta3ici5m"
echo ""
echo "3. Under 'Authentication flows configuration':"
echo "   ✅ User password-based authentication (ALLOW_USER_PASSWORD_AUTH)"
echo "   ✅ Allow refresh token based authentication (ALLOW_REFRESH_TOKEN_AUTH)"
echo "   ✅ Allow implicit OAuth authFlow (ALLOW_IMPLICIT_OAUTH_AUTH_FLOW)"
echo ""
echo "4. Under 'Hosted UI settings' → 'Allowed callback URLs':"
echo "   Add all three:"
echo "   - $CALLBACK_URL"
echo "   - $FINANZAS_URL"
echo "   - $PMO_URL"
echo ""
echo "5. Under 'OAuth 2.0 settings' → 'Allowed OAuth Flows':"
echo "   ✅ Implicit code"
echo "   ✅ Authorization code"
echo ""
echo "6. Under 'OAuth 2.0 settings' → 'Allowed OAuth Scopes':"
echo "   ✅ openid"
echo "   ✅ email"
echo "   ✅ profile"
echo ""
echo "7. Click 'Save changes' at bottom"
echo ""
echo "8. Wait 1-2 minutes for changes to propagate"
echo ""
echo "9. Test the Hosted UI login URL:"
echo "   https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html"
echo ""
