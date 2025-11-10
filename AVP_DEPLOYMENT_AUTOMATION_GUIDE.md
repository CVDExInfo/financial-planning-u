# AVP Deployment Automation - Implementation Guide

## Overview

The AVP (Amazon Verified Permissions) deployment workflow has been **hardened and enhanced** to provide 100% reliable, self-verifying deployments. This eliminates manual CLI steps, provides comprehensive validation, and ensures every deployment creates a complete, verified Policy Store ready for API integration.

## Recent Enhancements (2025-11)

The workflow now includes:

1. ✅ **Preflight Variable Checks** - Validates required Cognito variables before starting
2. ✅ **AWS Region Flexibility** - Supports `vars.AWS_REGION` instead of hardcoding
3. ✅ **Schema Verification** - Confirms schema is successfully attached after upload
4. ✅ **Identity Source Validation** - Fixed query logic and added count verification
5. ✅ **Policy/Template Count Checks** - Validates expected counts (≥7 policies, 3 templates)
6. ✅ **Fail-Fast Error Handling** - Workflow fails immediately if critical components are missing
7. ✅ **Workflow Call Support** - Can be invoked programmatically by other workflows

## What's Automated

The `Deploy AVP (Finanzas)` workflow now automatically:

1. ✅ **Creates the Policy Store** via CloudFormation stack
2. ✅ **Uploads the Cedar Schema** from `services/finanzas-api/avp/schema.cedar`
3. ✅ **Binds the Cognito Identity Source** to enable JWT-based authorization
4. ✅ **Verifies the complete setup** with comprehensive checks
5. ✅ **Provides deployment summary** with status indicators and next steps

## Prerequisites

### Required GitHub Repository Variables

Before running the workflow, ensure these variables are configured in your GitHub repository:

**Settings → Secrets and variables → Actions → Variables**

| Variable | Example | Description |
|----------|---------|-------------|
| `COGNITO_USER_POOL_ARN` | `arn:aws:cognito-idp:us-east-2:123456789012:userpool/us-east-2_ABC123` | ARN of your Cognito User Pool |
| `COGNITO_WEB_CLIENT` | `1234567890abcdefghijk` | Client ID of your Cognito Web Client |
| `AWS_REGION` | `us-east-2` | AWS region (optional, defaults to us-east-2) |

### Required IAM Permissions

The OIDC role (`OIDC_AWS_ROLE_ARN` secret) must have these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "verifiedpermissions:CreatePolicyStore",
        "verifiedpermissions:GetPolicyStore",
        "verifiedpermissions:PutSchema",
        "verifiedpermissions:GetSchema",
        "verifiedpermissions:CreateIdentitySource",
        "verifiedpermissions:ListIdentitySources",
        "verifiedpermissions:ListPolicies",
        "verifiedpermissions:ListPolicyTemplates",
        "verifiedpermissions:CreatePolicy",
        "verifiedpermissions:CreatePolicyTemplate",
        "cloudformation:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## How to Run the Workflow

### Via GitHub Actions UI

1. Go to **Actions** tab in the repository
2. Select **Deploy AVP (Finanzas)** workflow
3. Click **Run workflow**
4. Choose the stage: `dev`, `stg`, or `prod`
5. Click **Run workflow** button

### Via GitHub CLI

```bash
gh workflow run deploy-avp.yml -f stage=dev
```

## Workflow Steps Explained

### 0. Preflight - Verify Required Variables ⚡ NEW
- **Checks**: `COGNITO_USER_POOL_ARN` and `COGNITO_WEB_CLIENT` are set
- **Fails fast**: If variables are missing, workflow stops with clear instructions
- **Purpose**: Prevents wasted time deploying only to fail at identity source binding

### 1. Deploy AVP Policy Store
- Creates CloudFormation stack `finanzas-avp-{stage}`
- Deploys Policy Store with Cedar 4.5 validation
- Creates static policies and policy templates

### 2. Get Policy Store ID
- Retrieves the Policy Store ID from stack outputs
- Exports to `GITHUB_OUTPUT` and `GITHUB_ENV` for subsequent steps

### 3. Upload AVP Schema ⚡ ENHANCED
- Uploads Cedar schema from `services/finanzas-api/avp/schema.cedar`
- Defines entity types, actions, and context structure
- **Now verifies**: Schema is actually attached by calling `get-schema`
- **Fails**: If schema upload doesn't result in retrievable schema

### 4. Bind Cognito Identity Source ⚡ ENHANCED
- Creates identity source linking Cognito User Pool to AVP
- Sets principal entity type to `Finanzas::User`
- **Idempotent**: Uses fixed jq query to check if source exists before creating
- **Validates**: Confirms identity source count is > 0 after creation

### 5. Verify Policy Store ⚡ ENHANCED
- Validates schema attachment
- Confirms identity source binding
- **Now checks**: Policy count is ≥7 (expected static policies)
- **Now checks**: Template count is 3 (expected policy templates)
- Fails if any component is missing

### 6. Summary ⚡ ENHANCED
- Displays comprehensive deployment status with validation indicators
- **Tracks errors**: Sets `HAS_ERRORS` flag if schema or identity source missing
- **Fails workflow**: If critical components (schema, identity source) are not present
- Provides verification commands
- Shows next steps for API deployment

## Expected Output

After successful deployment, you'll see:

```
🔐 AVP Policy Store Deployed Successfully

Deployment Status
─────────────────
✅ Policy Store Created
✅ Cedar Schema attached
✅ Cognito identity source bound (1 source(s))
✅ 7 policies (expected ≥7)
✅ 3 templates (expected 3)

Policy Store ID: ps-1234567890abcdef
```

If any component fails validation, you'll see:

```
❌ Deployment failed: Critical AVP components are missing
Please review the errors above and re-run the workflow
```

## Programmatic Workflow Invocation ⚡ NEW

The workflow now supports `workflow_call`, allowing it to be invoked by other workflows:

```yaml
jobs:
  deploy-avp:
    uses: ./.github/workflows/deploy-avp.yml
    with:
      stage: dev
    secrets: inherit
  
  deploy-api:
    needs: deploy-avp
    uses: ./.github/workflows/deploy-api.yml
    secrets: inherit
```

This enables automated pipeline chaining where API deployment only runs after successful AVP deployment.

## Next Steps After Deployment

### 1. Update GitHub Variables

Add the Policy Store ID to repository variables:

```bash
# In GitHub UI: Settings → Secrets and variables → Actions → Variables
POLICY_STORE_ID=ps-1234567890abcdef
```

Or via GitHub CLI:

```bash
gh variable set POLICY_STORE_ID --body "ps-1234567890abcdef"
```

### 2. Deploy the API

Run the `Deploy Finanzas API` workflow:

```bash
gh workflow run deploy-api.yml
```

The API will automatically use the `POLICY_STORE_ID` variable for AVP integration.

### 3. Test Authorization

Test the API with a Cognito JWT token:

```bash
# Get JWT token
JWT_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $COGNITO_WEB_CLIENT \
  --auth-parameters USERNAME=$USERNAME,PASSWORD=$PASSWORD \
  --query 'AuthenticationResult.IdToken' --output text)

# Test protected endpoint
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://API_URL/allocation-rules
```

## Verification Commands

After deployment, verify the Policy Store:

```bash
# Get policy store details
aws verifiedpermissions get-policy-store \
  --policy-store-id ps-1234567890abcdef \
  --region us-east-2

# Get schema
aws verifiedpermissions get-schema \
  --policy-store-id ps-1234567890abcdef \
  --region us-east-2

# List identity sources
aws verifiedpermissions list-identity-sources \
  --policy-store-id ps-1234567890abcdef \
  --region us-east-2

# List policies
aws verifiedpermissions list-policies \
  --policy-store-id ps-1234567890abcdef \
  --region us-east-2
```

## Troubleshooting

### Schema Upload Fails

**Error**: `ValidationException: Invalid schema`

**Solution**: Check `services/finanzas-api/avp/schema.cedar` syntax:
- Ensure namespace is `Finanzas`
- Verify entity types match policy definitions
- Check action definitions have proper `appliesTo` clauses

### Identity Source Creation Fails

**Error**: `AccessDeniedException: User is not authorized to perform: verifiedpermissions:CreateIdentitySource`

**Solution**: Update IAM role with required permissions (see Prerequisites section)

**Error**: `InvalidParameterException: Invalid Cognito User Pool ARN`

**Solution**: Verify `COGNITO_USER_POOL_ARN` variable is set correctly in repository variables

### Verification Fails

**Error**: `❌ Schema not found` or `❌ No identity sources found`

**Cause**: Upload or creation step failed silently

**Solution**: 
1. Check workflow logs for specific error messages in upload/creation steps
2. The workflow now fails fast at the Summary step with clear error messages
3. Review the preflight check to ensure variables are set correctly
4. Manually upload schema if needed: `aws verifiedpermissions put-schema --policy-store-id ps-xxx --definition file://avp/schema.cedar`
5. Manually create identity source if needed (see workflow step for command)

### Policy/Template Count Mismatch ⚡ NEW

**Warning**: `⚠️ Expected at least 7 policies, found 5`

**Cause**: CloudFormation stack may not have created all static policies

**Solution**:
1. Check CloudFormation stack events in AWS Console
2. Verify `avp-policy-store.yaml` defines all expected policies
3. Re-deploy the workflow to sync policies
4. Expected counts:
   - **Policies**: ≥7 (Health, CatalogRules, PayrollIngest, ViewPrefactura, SendPrefactura, ApprovePrefactura, SuspendedUserDeny)
   - **Templates**: 3 (ProjectMemberAccess, FinanceWriteAccess, CloseMonthAccess)

### Missing Required Variables ⚡ NEW

**Error**: `❌ COGNITO_USER_POOL_ARN is not set`

**Cause**: Repository variables not configured

**Solution**:
1. Go to repository Settings → Secrets and variables → Actions → Variables
2. Add the missing variable with correct value
3. Re-run the workflow

## Idempotency

The workflow is designed to be safe to re-run:

- **Policy Store**: CloudFormation handles updates/no-ops
- **Schema**: `put-schema` overwrites existing schema
- **Identity Source**: Checks if source exists before creating
- **Policies**: CloudFormation manages as resources

You can safely re-run the workflow without causing duplicates or errors.

## Advanced Configuration

### Custom Validation Mode

Edit `services/finanzas-api/avp-policy-store.yaml`:

```yaml
Parameters:
  ValidationMode:
    Type: String
    Default: STRICT  # Change to OFF for development
```

### Custom Principal Entity Type

Edit workflow step "Bind Cognito Identity Source":

```yaml
--principal-entity-type "Finanzas::User"  # Must match schema namespace
```

### Multiple Cognito Clients

To support multiple client IDs:

```yaml
--configuration "cognitoUserPoolConfiguration={userPoolArn=$ARN,clientIds=[$CLIENT1,$CLIENT2]}"
```

## References

- [Cedar Policy Language](https://docs.cedarpolicy.com/)
- [Amazon Verified Permissions](https://docs.aws.amazon.com/verifiedpermissions/)
- [GitHub Actions Workflows](https://docs.github.com/en/actions/using-workflows)
- Repository: `services/finanzas-api/avp/README.md`
- Schema: `services/finanzas-api/avp/schema.cedar`
- Policies: `services/finanzas-api/avp/policies.cedar`

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review this guide
3. Verify prerequisites are met
4. Check CloudWatch logs for Lambda AVP calls
5. Open an issue in the repository
