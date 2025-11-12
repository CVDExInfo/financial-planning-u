#!/bin/bash
#
# This script assumes an IAM role and waits for the CloudFront distribution to be deployed.
#

set -e

DISTRIBUTION_ID="EPQU7PVDLQXUA"
ROLE_ARN="arn:aws:iam::703671891952:role/ProjectplaceLambdaRole"
SESSION_NAME="DeploymentWaitSession"

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

echo "✅ Role assumed successfully. Waiting for distribution ${DISTRIBUTION_ID} to deploy..."

# Loop until the distribution is deployed
while true; do
  STATUS=$(aws cloudfront get-distribution --id "${DISTRIBUTION_ID}" --query "Distribution.Status" --output text)
  echo "Current status: ${STATUS}"
  if [ "${STATUS}" == "Deployed" ]; then
    echo "✅ Distribution deployed successfully."
    break
  fi
  echo "Waiting for 30 seconds before checking again..."
  sleep 30
done

echo "🚀 Validating URL..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://d7t9x3j66yd8k.cloudfront.net/finanzas/)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ URL returned HTTP 200. Final validation successful."
else
  echo "❌ URL returned HTTP ${HTTP_CODE}. Further investigation may be needed."
  # Also check the headers for more clues
  curl -s -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
fi
