#!/bin/bash

# This script fixes the CloudFront distribution by removing the Origin Path
# from the finanzas-ui-s3 origin.

set -e

DISTRIBUTION_ID="EPQU7PVDLQXUA"
ROLE_ARN="arn:aws:iam::703671891952:role/ProjectplaceLambdaRole"
SESSION_NAME="CFDistributionFixSession"

echo "Assuming role: ${ROLE_ARN}..."

# Assume the role and get temporary credentials
ASSUMED_ROLE_CREDS=$(aws sts assume-role \
  --role-arn "${ROLE_ARN}" \
  --role-session-name "${SESSION_NAME}" \
  --query "Credentials" --output "json")

if [ -z "$ASSUMED_ROLE_CREDS" ]; then
  echo "❌ Failed to assume role. Aborting."
  exit 1
fi

# Export the temporary credentials for this script's environment
export AWS_ACCESS_KEY_ID=$(echo "${ASSUMED_ROLE_CREDS}" | jq -r '.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "${ASSUMED_ROLE_CREDS}" | jq -r '.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "${ASSUMED_ROLE_CREDS}" | jq -r '.SessionToken')

echo "✅ Role assumed successfully."

# Get the current distribution config and ETag
echo "Getting current distribution configuration..."
DIST_JSON=$(aws cloudfront get-distribution --id "${DISTRIBUTION_ID}" --output json)

# Extract ETag and Config
ETAG=$(echo "$DIST_JSON" | jq -r '.ETag')
CONFIG=$(echo "$DIST_JSON" | jq '.DistributionConfig')

echo "Current ETag: ${ETAG}"

# Verify config was extracted
if [ -z "$CONFIG" ] || [ "$CONFIG" = "null" ]; then
  echo "❌ Failed to extract distribution config"
  exit 1
fi

# Update the Origin Path to empty string
echo "Removing Origin Path from finanzas-ui-s3 origin..."
UPDATED_CONFIG=$(echo "$CONFIG" | jq '.Origins.Items |= map(if .Id == "finanzas-ui-s3" then .OriginPath = "" else . end)')

# Save the updated config to a file
echo "$UPDATED_CONFIG" > /tmp/updated-dist-config.json

# Update the distribution
echo "Updating CloudFront distribution..."
aws cloudfront update-distribution \
  --id "${DISTRIBUTION_ID}" \
  --distribution-config file:///tmp/updated-dist-config.json \
  --if-match "$ETAG" > /dev/null

echo "✅ CloudFront distribution updated successfully - Origin Path removed."

# Wait for deployment
echo "Waiting for distribution to deploy..."
aws cloudfront wait distribution-deployed --id "${DISTRIBUTION_ID}"

echo "✅ Distribution deployed successfully."

# Create full invalidation
echo "Creating CloudFront invalidation..."
INVALIDATION=$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths '/*' '/finanzas/*' '/finanzas/index.html')

INVALIDATION_ID=$(echo "$INVALIDATION" | jq -r '.Invalidation.Id')
echo "Invalidation ID: ${INVALIDATION_ID}"

# Wait for invalidation to complete
echo "Waiting for invalidation to complete..."
aws cloudfront wait invalidation-completed --distribution-id "${DISTRIBUTION_ID}" --id "${INVALIDATION_ID}"

echo "✅ Invalidation completed."

# Final validation
echo "Testing URL..."
sleep 30  # Give CloudFront a moment to serve the new content
RESPONSE=$(curl -s https://d7t9x3j66yd8k.cloudfront.net/finanzas/)

if echo "$RESPONSE" | grep -q "Financial Planning & Management"; then
  echo "✅ Finanzas application is now being served correctly!"
  echo "$RESPONSE" | head -20
else
  echo "⚠️  URL returned unexpected content. First 20 lines:"
  echo "$RESPONSE" | head -20
fi
