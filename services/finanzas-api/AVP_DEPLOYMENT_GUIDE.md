# AVP Deployment Guide

## Overview

This guide explains how to deploy and configure Amazon Verified Permissions (AVP) for the Finanzas SD API.

## Problem Statement

The AVP policy store configuration exists in `avp-policy-store.yaml` but **does not deploy itself** automatically. It's a CloudFormation template that must be explicitly deployed to create the AVP resources in AWS.

## Solution Architecture

```
┌─────────────────────────────────────────┐
│  1. Deploy AVP (deploy-avp.yml)         │
│     - Creates Policy Store               │
│     - Loads Schema                       │
│     - Creates Policies & Templates       │
│     - Outputs POLICY_STORE_ID            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. Configure GitHub Variables          │
│     POLICY_STORE_ID=<store-id>          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  3. Deploy API (deploy-api.yml)         │
│     - Verifies AVP Policy Store exists  │
│     - Passes POLICY_STORE_ID to Lambdas │
│     - Grants IAM permissions            │
└─────────────────────────────────────────┘
```

## Step-by-Step Deployment

### Step 1: Deploy AVP Policy Store

The AVP policy store must be deployed once per environment (dev/stg/prod).

**Via GitHub Actions:**

1. Go to the repository's **Actions** tab
2. Select **"Deploy AVP (Finanzas)"** workflow
3. Click **"Run workflow"**
4. Select the **stage** (dev, stg, or prod)
5. Click **"Run workflow"**

**Via AWS CLI:**

```bash
cd services/finanzas-api

# Deploy for dev environment
aws cloudformation deploy \
  --template-file avp-policy-store.yaml \
  --stack-name finanzas-avp-dev \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    PolicyStoreName=FinanzasPolicyStore-dev \
    ValidationMode=STRICT \
  --region us-east-2

# Get the Policy Store ID
POLICY_STORE_ID=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyStoreId`].OutputValue' \
  --output text \
  --region us-east-2)

echo "Policy Store ID: $POLICY_STORE_ID"
```

### Step 2: Configure Repository Variables

After the AVP deployment completes, add the Policy Store ID to your GitHub repository variables:

1. Go to **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Click **"New repository variable"**
3. Name: `POLICY_STORE_ID` (or `POLICY_STORE_ID_DEV` for environment-specific)
4. Value: The Policy Store ID from the deployment output
5. Click **"Add variable"**

Alternatively, for environment-specific configurations:
- `POLICY_STORE_ID_DEV` for development
- `POLICY_STORE_ID_STG` for staging
- `POLICY_STORE_ID_PROD` for production

### Step 3: Deploy the API

Once the AVP policy store is deployed and configured, deploy the API as usual. The deployment workflow will:

1. **Verify** the policy store exists
2. **Pass** the Policy Store ID to Lambda functions as an environment variable
3. **Grant** IAM permissions for Lambda functions to call AVP APIs

**Via GitHub Actions:**

The regular API deployment workflow (`deploy-api.yml`) will automatically pick up the `POLICY_STORE_ID` variable and use it.

**Via AWS CLI:**

```bash
cd services/finanzas-api

sam build

sam deploy \
  --stack-name finanzas-sd-api-dev \
  --parameter-overrides \
    CognitoUserPoolArn=<cognito-pool-arn> \
    CognitoUserPoolId=<cognito-pool-id> \
    CognitoUserPoolClientId=<cognito-client-id> \
    StageName=dev \
    PolicyStoreId="$POLICY_STORE_ID" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3
```

## Verification

### Verify AVP Policy Store

```bash
# List policy stores
aws verifiedpermissions list-policy-stores \
  --region us-east-2 \
  --query 'policyStores[*].[policyStoreId,arn,validationSettings.mode]' \
  --output table

# Get schema
aws verifiedpermissions get-schema \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --query 'schema' \
  --output text

# List policies
aws verifiedpermissions list-policies \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --max-results 10 \
  --query 'policies[*].[policyId,policyType,definition]' \
  --output table

# List policy templates
aws verifiedpermissions list-policy-templates \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --query 'policyTemplates[*].[policyTemplateId,description]' \
  --output table
```

### Verify Lambda Configuration

```bash
# Check that Lambda has POLICY_STORE_ID environment variable
aws lambda get-function-configuration \
  --function-name <function-name> \
  --query 'Environment.Variables.POLICY_STORE_ID' \
  --output text

# Check Lambda execution role has AVP permissions
aws lambda get-function \
  --function-name <function-name> \
  --query 'Configuration.Role' \
  --output text | xargs -I {} aws iam get-role-policy \
  --role-name $(basename {}) \
  --policy-name <policy-name>
```

### Verify Lambda Logs

Check CloudWatch Logs for AVP authorization calls:

```bash
aws logs tail /aws/lambda/<function-name> --follow
```

Look for log entries containing:
- `[AVP]` - Authorization checks
- `IsAuthorizedWithToken` - AVP API calls
- `ALLOW` or `DENY` - Authorization decisions

## Troubleshooting

### Issue: "POLICY_STORE_ID not found"

**Cause:** The AVP policy store has not been deployed, or the GitHub variable is not set.

**Solution:**
1. Deploy AVP using the `deploy-avp.yml` workflow
2. Add `POLICY_STORE_ID` to GitHub repository variables

### Issue: "403 Forbidden" errors in Lambda

**Cause:** One of the following:
- Policy Store ID is incorrect
- User doesn't have required Cognito groups
- Policy template not instantiated for the project
- Lambda lacks IAM permissions for AVP

**Solution:**
1. Verify `POLICY_STORE_ID` is correct
2. Check user's Cognito groups
3. Ensure policy templates are instantiated for the project
4. Verify Lambda execution role has `verifiedpermissions:IsAuthorizedWithToken` permission

### Issue: "Policy store not found" during API deployment

**Cause:** The AVP policy store doesn't exist in AWS.

**Solution:**
1. Run the `Deploy AVP` workflow first
2. Verify the Policy Store ID is correct
3. Ensure you're deploying to the correct AWS region

## Workflow Files

- **`.github/workflows/deploy-avp.yml`**: Deploys the AVP policy store
- **`.github/workflows/deploy-api.yml`**: Deploys the API with AVP integration
- **`services/finanzas-api/avp-policy-store.yaml`**: CloudFormation template for AVP resources
- **`services/finanzas-api/template.yaml`**: SAM template with AVP configuration

## Lambda Functions with AVP

The following Lambda functions have AVP permissions:

- **ProjectsFn**: Create and list projects
- **AllocationsFn**: Bulk allocations
- **AdjustmentsFn**: Create and list adjustments
- **CloseMonthFn**: Close monthly periods

Other functions can be updated to use AVP by:
1. Adding the AVP inline policy to the function's `Policies` array
2. Calling AVP authorization functions in the handler code

## IAM Permissions

Lambda functions need the following IAM permission to call AVP:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AVPIsAuthorizedWithToken",
      "Effect": "Allow",
      "Action": [
        "verifiedpermissions:IsAuthorizedWithToken"
      ],
      "Resource": "arn:aws:verifiedpermissions:*:*:policy-store/*"
    }
  ]
}
```

This permission is automatically added to supported Lambda functions via the SAM template.

## Optional Configuration

If you don't want to use AVP (for testing or development):

1. Don't set `POLICY_STORE_ID` in GitHub variables
2. Deploy the API without the `PolicyStoreId` parameter
3. Lambda functions will skip AVP authorization (if implemented with skip logic)

## References

- [AVP README](./avp/README.md)
- [Amazon Verified Permissions Documentation](https://docs.aws.amazon.com/verifiedpermissions/)
- [Cedar Policy Language](https://docs.cedarpolicy.com/)
