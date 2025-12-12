#!/bin/bash
#
# Setup Cognito test users for behavioral testing
#
# This script creates test users for each role needed for behavioral API tests.
# It requires AWS credentials with permissions to manage Cognito users.
#
# Usage:
#   ./scripts/cognito/setup-test-users.sh
#
# Environment variables:
#   COGNITO_USER_POOL_ID - Cognito User Pool ID (default: us-east-2_FyHLtOhiY)
#   AWS_REGION - AWS region (default: us-east-2)
#   OIDC_AWS_ROLE_ARN - Optional: AWS role to assume via OIDC

set -euo pipefail

# Configuration
COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-us-east-2_FyHLtOhiY}"
AWS_REGION="${AWS_REGION:-us-east-2}"
TEMP_PASSWORD="TempPassword123!"
PERMANENT_PASSWORD="SecureTestPass2025!"

echo "═══════════════════════════════════════════════════"
echo "  Cognito Test User Setup"
echo "═══════════════════════════════════════════════════"
echo ""
echo "User Pool ID: ${COGNITO_USER_POOL_ID}"
echo "Region: ${AWS_REGION}"
echo ""

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS credentials not configured"
  echo ""
  echo "Options:"
  echo "1. Run 'aws configure' to set up credentials"
  echo "2. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars"
  echo "3. Use AWS SSO: aws sso login --profile <profile>"
  echo ""
  exit 1
fi

echo "✓ AWS credentials configured"
aws sts get-caller-identity
echo ""

# Function to create a user
create_user() {
  local email="$1"
  local role_name="$2"
  local groups="$3"
  
  echo "───────────────────────────────────────────────────"
  echo "Creating user: ${email} (${role_name})"
  echo "───────────────────────────────────────────────────"
  
  # Check if user already exists
  if aws cognito-idp admin-get-user \
    --user-pool-id "${COGNITO_USER_POOL_ID}" \
    --username "${email}" \
    --region "${AWS_REGION}" &>/dev/null; then
    echo "⚠️  User ${email} already exists"
    
    # Ask if we should update the password
    read -p "Update password? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "Updating password..."
      aws cognito-idp admin-set-user-password \
        --user-pool-id "${COGNITO_USER_POOL_ID}" \
        --username "${email}" \
        --password "${PERMANENT_PASSWORD}" \
        --permanent \
        --region "${AWS_REGION}"
      echo "✓ Password updated"
    fi
  else
    # Create the user
    echo "Creating user..."
    aws cognito-idp admin-create-user \
      --user-pool-id "${COGNITO_USER_POOL_ID}" \
      --username "${email}" \
      --user-attributes Name=email,Value="${email}" Name=email_verified,Value=true \
      --temporary-password "${TEMP_PASSWORD}" \
      --region "${AWS_REGION}"
    
    echo "Setting permanent password..."
    aws cognito-idp admin-set-user-password \
      --user-pool-id "${COGNITO_USER_POOL_ID}" \
      --username "${email}" \
      --password "${PERMANENT_PASSWORD}" \
      --permanent \
      --region "${AWS_REGION}"
    
    echo "✓ User created"
  fi
  
  # Assign groups (if specified)
  if [ -n "${groups}" ]; then
    echo "Assigning to groups: ${groups}"
    IFS=',' read -ra GROUP_ARRAY <<< "$groups"
    for group in "${GROUP_ARRAY[@]}"; do
      # Create group if it doesn't exist
      if ! aws cognito-idp get-group \
        --user-pool-id "${COGNITO_USER_POOL_ID}" \
        --group-name "${group}" \
        --region "${AWS_REGION}" &>/dev/null; then
        echo "  Creating group: ${group}"
        aws cognito-idp create-group \
          --user-pool-id "${COGNITO_USER_POOL_ID}" \
          --group-name "${group}" \
          --description "Test group for ${role_name} role" \
          --region "${AWS_REGION}" || echo "  ⚠️  Group creation failed (may already exist)"
      fi
      
      # Add user to group
      echo "  Adding to group: ${group}"
      aws cognito-idp admin-add-user-to-group \
        --user-pool-id "${COGNITO_USER_POOL_ID}" \
        --username "${email}" \
        --group-name "${group}" \
        --region "${AWS_REGION}" || echo "  ⚠️  May already be in group"
    done
    echo "✓ Groups assigned"
  else
    echo "⚠️  No groups assigned (NO_GROUP user)"
  fi
  
  # Verify group membership
  echo "Verifying group membership..."
  aws cognito-idp admin-list-groups-for-user \
    --user-pool-id "${COGNITO_USER_POOL_ID}" \
    --username "${email}" \
    --region "${AWS_REGION}" \
    --query 'Groups[].GroupName' \
    --output text || echo "  (no groups)"
  
  echo "✓ ${role_name} user setup complete"
  echo ""
}

# Create users for each role
echo "Creating test users..."
echo ""

# PMO user
create_user "e2e-pmo-test@ikusi.com" "PMO" "PMO"

# SDMT user (SDT group maps to SDMT role)
create_user "e2e-sdmt-test@ikusi.com" "SDMT" "SDT"

# EXEC_RO user
create_user "e2e-exec-test@ikusi.com" "EXEC_RO" "EXEC_RO"

# NO_GROUP user (already exists according to user, but create if needed)
echo "───────────────────────────────────────────────────"
echo "Checking NO_GROUP user"
echo "───────────────────────────────────────────────────"

NO_GROUP_EMAIL="e2e-nogroup-test@ikusi.com"

if aws cognito-idp admin-get-user \
  --user-pool-id "${COGNITO_USER_POOL_ID}" \
  --username "${NO_GROUP_EMAIL}" \
  --region "${AWS_REGION}" &>/dev/null; then
  echo "✓ NO_GROUP user ${NO_GROUP_EMAIL} exists"
  
  # Verify it has no groups
  GROUPS=$(aws cognito-idp admin-list-groups-for-user \
    --user-pool-id "${COGNITO_USER_POOL_ID}" \
    --username "${NO_GROUP_EMAIL}" \
    --region "${AWS_REGION}" \
    --query 'Groups[].GroupName' \
    --output text)
  
  if [ -z "${GROUPS}" ]; then
    echo "✓ NO_GROUP user has zero group memberships (correct)"
  else
    echo "⚠️  WARNING: NO_GROUP user has groups: ${GROUPS}"
    echo "   This user should have NO group memberships for security testing"
    echo "   Remove groups manually or delete and recreate user"
  fi
else
  echo "NO_GROUP user does not exist, creating..."
  create_user "${NO_GROUP_EMAIL}" "NO_GROUP" ""
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Test User Setup Complete"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Created users with credentials:"
echo ""
echo "export E2E_PMO_EMAIL='e2e-pmo-test@ikusi.com'"
echo "export E2E_PMO_PASSWORD='${PERMANENT_PASSWORD}'"
echo ""
echo "export E2E_SDMT_EMAIL='e2e-sdmt-test@ikusi.com'"
echo "export E2E_SDMT_PASSWORD='${PERMANENT_PASSWORD}'"
echo ""
echo "export E2E_EXEC_EMAIL='e2e-exec-test@ikusi.com'"
echo "export E2E_EXEC_PASSWORD='${PERMANENT_PASSWORD}'"
echo ""
echo "export E2E_NO_GROUP_EMAIL='e2e-nogroup-test@ikusi.com'"
echo "export E2E_NO_GROUP_PASSWORD='${PERMANENT_PASSWORD}'"
echo ""
echo "Add these to your .env.local or GitHub Actions secrets"
echo ""
echo "To test authentication:"
echo "  ./scripts/cognito/get-jwt.sh"
echo ""
