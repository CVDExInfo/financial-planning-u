# Unified CloudFront & AVP Integration Deployment Guide

## Overview

This runbook provides step-by-step instructions for executing the complete CloudFront distribution update and AVP (Amazon Verified Permissions) policy store integration for the Finanzas SD module. This deployment consolidates both the frontend UI routing and backend API routing behind the existing CloudFront distribution, while enabling fine-grained authorization through AVP.

## Branch Setup

**Branch Name:** `infra/cloudfront-avp-sync`

This branch consolidates the CloudFront distribution update and the AVP policy store integration for the Finanzas SD module.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              CloudFront Distribution (EPQU7PVDLQXUA)        │
│  Domain: d7t9x3j66yd8k.cloudfront.net                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /finanzas/*          → S3 Origin (UI Assets)                │
│  /finanzas/api/*      → API Gateway Origin (Backend API)     │
│                         + Path Rewrite Function              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌──────────────────────────┐
                  │  API Gateway (HTTP API)  │
                  │  ID: m3g6am67aj          │
                  │  Stage: dev              │
                  ├──────────────────────────┤
                  │  Cognito JWT Authorizer  │
                  │  + AVP Authorization     │
                  └──────────────────────────┘
                              │
                              ▼
                  ┌──────────────────────────┐
                  │  Amazon Verified         │
                  │  Permissions (AVP)       │
                  │  Policy Store            │
                  ├──────────────────────────┤
                  │  - Cedar Policies        │
                  │  - Policy Templates      │
                  │  - Cognito Identity Src  │
                  └──────────────────────────┘
```

## Prerequisites

### Required GitHub Repository Variables

Ensure the following variables are configured in **Settings → Secrets and variables → Actions → Variables**:

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `AWS_REGION` | AWS region for all resources | `us-east-2` |
| `CLOUDFRONT_DIST_ID` | CloudFront distribution ID | `EPQU7PVDLQXUA` |
| `DISTRIBUTION_DOMAIN_NAME` | CloudFront domain | `d7t9x3j66yd8k.cloudfront.net` |
| `DEV_API_URL` | API Gateway endpoint URL | `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` |
| `FINZ_API_STACK` | CloudFormation stack name (fallback) | `finanzas-sd-api-dev` |
| `FINZ_API_STAGE` | API Gateway stage (fallback) | `dev` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `us-east-2_xxxxxxxxx` |
| `COGNITO_USER_POOL_ARN` | Cognito User Pool ARN | `arn:aws:cognito-idp:us-east-2:...` |
| `COGNITO_WEB_CLIENT` | Cognito App Client ID | `xxxxxxxxxxxxxxxxxxxxx` |

### Required GitHub Secrets

| Secret Name | Description |
|------------|-------------|
| `OIDC_AWS_ROLE_ARN` | IAM role ARN for OIDC authentication |
| `USERNAME` | Test user for smoke tests |
| `PASSWORD` | Test user password for smoke tests |

### AWS Permissions Required

The OIDC role must have permissions for:
- CloudFront (read/write distributions, functions)
- CloudFormation (deploy stacks, describe stacks)
- API Gateway (describe APIs, routes, authorizers)
- Verified Permissions (create/manage policy stores, policies, identity sources)
- Lambda (function management)
- DynamoDB (table access for seeding)
- Cognito (user authentication for testing)

## Deployment Procedure

### Phase 1: CloudFront Distribution Update

This phase configures the CloudFront distribution to proxy the Finanzas API through the existing distribution.

#### 1.1 Run the CloudFront Update Workflow

**Via GitHub Actions UI:**

1. Navigate to **Actions** tab in the repository
2. Select **"update-cloudfront"** workflow from the left sidebar
3. Click **"Run workflow"** button (top right)
4. Select environment: **`dev`**
5. Click **"Run workflow"** to execute

**Via GitHub CLI:**

```bash
gh workflow run update-cloudfront.yml -f environment=dev
```

#### 1.2 What the Workflow Does

The workflow performs the following automated steps:

1. **Resolve API ID and Stage**
   - Checks `DEV_API_URL` repository variable and parses API ID and stage
   - Falls back to CloudFormation outputs if `DEV_API_URL` is not set
   - Ensures the workflow always uses the current Finanzas API ID and stage

2. **Deploy CloudFront Function (Path Rewrite)**
   - Creates or updates the function: `finanzas-sd-dev-api-path-rewrite`
   - Function strips `/finanzas/api` prefix from incoming URIs
   - Example: `GET /finanzas/api/projects` → origin receives `/projects`
   - Function is published and its ARN is captured

3. **Merge API Origin**
   - Fetches current distribution config with ETag for concurrency control
   - Adds API Gateway origin if not present: `ApiGwOrigin`
   - Domain: `<API_ID>.execute-api.<region>.amazonaws.com`
   - Origin Path: `/<stage>` (e.g., `/dev`)
   - Configured for HTTPS only

4. **Add Cache Behavior for API Paths**
   - Inserts cache behavior for path pattern: `/finanzas/api/*`
   - Routes matching requests to `ApiGwOrigin`
   - Redirects HTTP to HTTPS
   - Allows all standard HTTP methods (GET, POST, PUT, DELETE, etc.)
   - Uses managed `CachingDisabled` policy (no caching for dynamic API)
   - Attaches CloudFront Function for path rewriting on viewer requests
   - Uses managed origin request policy to forward all headers including `Authorization`

5. **Ensure SPA Fallback Errors**
   - Adds custom error responses for HTTP 403 and 404
   - Maps to `/finanzas/index.html` with 200 OK response
   - Handles deep linking for SPA routes

6. **Update CloudFront Distribution**
   - Updates distribution via AWS CLI using captured ETag
   - Finanzas UI (`/finanzas/*`) and API (`/finanzas/api/*`) behaviors are configured

#### 1.3 Verify CloudFront Changes

After the workflow completes (typically 10-15 minutes for propagation):

**Check Distribution Configuration:**

```bash
# Verify origins
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.DistributionConfig.Origins.Items[].[Id,DomainName,OriginPath]' \
  --output table

# Verify cache behaviors
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.DistributionConfig.CacheBehaviors.Items[].PathPattern' \
  --output table
```

**Expected Output:**
- An origin with ID `ApiGwOrigin` pointing to `m3g6am67aj.execute-api.us-east-2.amazonaws.com` with OriginPath `/dev`
- A cache behavior for path pattern `finanzas/api/*`

**Smoke Test - Public Health Endpoint:**

```bash
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health
```

**Expected Response:**
```json
{
  "ok": true,
  "stage": "dev",
  "time": "2025-01-01T12:00:00.000Z"
}
```

**Smoke Test - Protected Endpoint (requires JWT):**

```bash
# First, obtain a JWT token
JWT_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <COGNITO_WEB_CLIENT> \
  --auth-parameters USERNAME=<username>,PASSWORD=<password> \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test authenticated endpoint
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:**
- HTTP 200 with project list data, or HTTP 403 if AVP is not yet configured (next phase)

---

### Phase 2: AVP Policy Store Deployment

This phase deploys the Amazon Verified Permissions policy store with all necessary Cedar policies and templates.

#### 2.1 Run the AVP Deployment Workflow

**Via GitHub Actions UI:**

1. Navigate to **Actions** tab
2. Select **"Deploy AVP (Finanzas)"** workflow
3. Click **"Run workflow"**
4. Select stage: **`dev`**
5. Click **"Run workflow"**

**Via GitHub CLI:**

```bash
gh workflow run deploy-avp.yml -f stage=dev
```

#### 2.2 What the Workflow Does

1. **Deploy CloudFormation Stack**
   - Stack name: `finanzas-avp-dev`
   - Template: `services/finanzas-api/avp-policy-store.yaml`
   - Creates AVP policy store with strict validation mode
   - Deploys static Cedar policies and policy templates

2. **Retrieve Policy Store ID**
   - Extracts `PolicyStoreId` from CloudFormation outputs
   - Displays in workflow summary

3. **Verify Policy Store**
   - Confirms policy store creation
   - Lists policies and policy templates
   - Verifies schema (if present)

#### 2.3 Capture Policy Store ID

From the workflow summary output, note the **Policy Store ID**. It will look like:

```
Policy Store ID: PSEXAMPLEabcdef123456
```

#### 2.4 Update Repository Variables

**Via GitHub UI:**

1. Go to **Settings → Secrets and variables → Actions → Variables**
2. Click **"New repository variable"**
3. Enter:
   - **Name:** `POLICY_STORE_ID`
   - **Value:** `<Policy Store ID from workflow output>`
4. Click **"Add variable"**

**Via GitHub CLI:**

```bash
gh variable set POLICY_STORE_ID --body "<Policy Store ID>"
```

**Note:** For environment-specific configurations, you can alternatively use:
- `POLICY_STORE_ID_DEV` for development
- `POLICY_STORE_ID_STG` for staging  
- `POLICY_STORE_ID_PROD` for production

Ensure the `deploy-api` workflow references the correct variable name.

---

### Phase 3: Cognito Identity Source Binding

⚠️ **Important Manual Step** ⚠️

The AVP policy store must be associated with the Cognito User Pool to enable token-based authorization. This step is **not automated** and must be performed manually.

#### 3.1 Create Identity Source

Run the following AWS CLI command to bind the policy store to Cognito:

```bash
# Set variables
POLICY_STORE_ID="<Policy Store ID from Phase 2>"
COGNITO_USER_POOL_ARN="arn:aws:cognito-idp:us-east-2:<account-id>:userpool/<pool-id>"
COGNITO_APP_CLIENT_ID="<App Client ID>"

# Create identity source
aws verifiedpermissions create-identity-source \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --configuration "CognitoUserPoolConfiguration={UserPoolArn=$COGNITO_USER_POOL_ARN,ClientIds=[$COGNITO_APP_CLIENT_ID]}" \
  --principal-entity-type USER
```

**Expected Output:**
```json
{
  "createdDate": "2025-01-01T12:00:00.000000+00:00",
  "identitySourceId": "ISEXAMPLExyz789",
  "lastUpdatedDate": "2025-01-01T12:00:00.000000+00:00",
  "policyStoreId": "PSEXAMPLEabcdef123456"
}
```

#### 3.2 Verify Identity Source

```bash
aws verifiedpermissions list-identity-sources \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID"
```

**Expected Output:**
- At least one identity source with `principalEntityType: USER`
- Configuration pointing to your Cognito User Pool

#### 3.3 Why This Step Is Critical

Without the identity source binding:
- `IsAuthorizedWithToken` API calls will fail
- JWT tokens won't be mapped to AVP entities
- All authorization decisions will deny (even with valid policies)
- Protected endpoints will return 403 Forbidden

With the identity source configured:
- Cognito user identities from JWTs are recognized by AVP
- User group claims (e.g., `SDT`, `FIN`, `AUD`) are available in authorization context
- Cedar policies can evaluate based on `context.jwt_groups`

---

### Phase 4: API Redeployment with AVP Integration

This phase redeploys the Finanzas API to enable AVP authorization checks.

#### 4.1 Run the API Deployment Workflow

**Via GitHub Actions UI:**

1. Navigate to **Actions** tab
2. Select **"Deploy Finanzas API (dev)"** workflow
3. Click **"Run workflow"**
4. Click **"Run workflow"** to execute (no inputs required for dev)

**Via GitHub CLI:**

```bash
gh workflow run deploy-api.yml
```

#### 4.2 What the Workflow Does

1. **Preflight Environment Check**
   - Verifies all required environment variables are set
   - Confirms AWS credentials are valid

2. **Verify AVP Policy Store** (Guard Step)
   - Checks if `POLICY_STORE_ID` variable is set
   - Confirms policy store exists in AWS
   - Verifies schema is present
   - Outputs: `✅ AVP Policy Store verified` or fails if not found

3. **Build and Deploy API**
   - Installs dependencies and builds Lambda functions
   - Deploys SAM template with AVP configuration
   - Passes `POLICY_STORE_ID` to Lambda environment variables
   - Attaches IAM permissions for `verifiedpermissions:IsAuthorizedWithToken`

4. **Guard Checks**
   - Verifies canonical API ID matches expected value
   - Confirms mandatory routes exist (health, catalog, projects)
   - Validates Cognito JWT authorizer is present

5. **Smoke Tests**
   - Tests public endpoints (health, catalog)
   - Tests protected endpoints with JWT authentication
   - Verifies AVP authorization decisions

6. **Seed DynamoDB Tables**
   - Seeds rubros (budget line items)
   - Seeds taxonomía (budget categories)

#### 4.3 Verify AVP Integration

**Check Lambda Environment Variables:**

```bash
# Get Lambda function name
FUNCTION_NAME=$(aws cloudformation list-stack-resources \
  --stack-name finanzas-sd-api-dev \
  --query "StackResourceSummaries[?LogicalResourceId=='ProjectsFn'].PhysicalResourceId" \
  --output text)

# Check environment variables
aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --query 'Environment.Variables.POLICY_STORE_ID' \
  --output text
```

**Expected Output:** The Policy Store ID from Phase 2

**Check IAM Permissions:**

```bash
# Get Lambda role
ROLE_NAME=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --query 'Configuration.Role' \
  --output text | awk -F'/' '{print $2}')

# List attached policies
aws iam list-attached-role-policies \
  --role-name "$ROLE_NAME"
```

**Expected:** A policy granting `verifiedpermissions:IsAuthorizedWithToken` on the policy store ARN

**Check CloudWatch Logs for AVP Calls:**

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/"$FUNCTION_NAME" --follow --since 5m
```

**Look for log lines like:**
```
[AVP] Authorization decision: ALLOW (policies: ['ProjectMemberAccess-abc123'])
```
or
```
[AVP] Authorization decision: DENY (no matching policies)
```

---

## Complete Verification & Smoke Tests

### 1. CloudFront UI Access

```bash
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

**Expected:** HTTP/2 200 - SPA loads successfully

### 2. CloudFront API Health Check

```bash
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health | jq .
```

**Expected:**
```json
{
  "ok": true,
  "stage": "dev",
  "time": "2025-01-01T12:00:00.000Z"
}
```

### 3. Public Catalog Endpoint (No Auth)

```bash
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/catalog/rubros | jq '.data | length'
```

**Expected:** Number of rubros (e.g., `50`)

### 4. Protected Endpoint with JWT (AVP Authorization)

```bash
# Generate JWT
JWT_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <COGNITO_WEB_CLIENT> \
  --auth-parameters USERNAME=<username>,PASSWORD=<password> \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test protected endpoint
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .
```

**Expected:**
- HTTP 200 with project list if user has `SDT`, `FIN`, or authorized group
- HTTP 403 if user lacks required permissions (AVP deny decision)

### 5. Create Project (Fine-Grained Authorization)

```bash
curl -X POST https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Cliente Alpha",
    "nombre": "Proyecto Test",
    "fecha_inicio": "2025-01-01",
    "fecha_fin": "2025-09-30",
    "moneda": "COP"
  }' | jq .
```

**Expected:**
- HTTP 201 with project data if user has `SDT` group and AVP allows
- HTTP 403 if user lacks required group membership
- Lambda logs show `[AVP] Authorization decision: ALLOW/DENY`

### 6. CORS Preflight Test

```bash
curl -X OPTIONS https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  -v
```

**Expected:** HTTP 200 with CORS headers:
- `Access-Control-Allow-Origin: https://d7t9x3j66yd8k.cloudfront.net`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: Authorization,Content-Type`

---

## Troubleshooting

### Issue: CloudFront Update Fails

**Symptoms:**
- Workflow fails at "Update distribution" step
- Error: `PreconditionFailed` or `ETag mismatch`

**Resolution:**
1. Check if another update is in progress (CloudFront only allows one update at a time)
2. Wait for current update to complete (check distribution status)
3. Retry the workflow

```bash
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.Status' --output text
# Wait for "Deployed" status
```

### Issue: AVP Policy Store Not Found

**Symptoms:**
- API deployment fails at "Verify AVP Policy Store" step
- Error: `❌ AVP Policy Store not found`

**Resolution:**
1. Verify `POLICY_STORE_ID` repository variable is set correctly
2. Confirm policy store exists in AWS:

```bash
aws verifiedpermissions get-policy-store \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID"
```

3. If store doesn't exist, re-run Phase 2 (AVP deployment)

### Issue: Protected Endpoints Return 403 After AVP Integration

**Symptoms:**
- All authenticated API calls return 403 Forbidden
- Lambda logs show `[AVP] Authorization decision: DENY`

**Possible Causes & Resolutions:**

**A. Identity Source Not Configured**

Check if identity source exists:

```bash
aws verifiedpermissions list-identity-sources \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID"
```

If empty, complete Phase 3 (Cognito binding).

**B. User Missing Required Groups**

Check user's Cognito groups:

```bash
aws cognito-idp admin-list-groups-for-user \
  --region us-east-2 \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --username <username>
```

Ensure user has appropriate groups (`SDT`, `FIN`, `AUD`, etc.).

**C. JWT Token Invalid**

Verify JWT token is valid and not expired:

```bash
# Decode JWT (use jwt.io or similar tool)
echo "$JWT_TOKEN" | jq -R 'split(".") | .[1] | @base64d | fromjson'
```

Check:
- `exp` (expiration) is in the future
- `aud` (audience) matches `COGNITO_WEB_CLIENT`
- `cognito:groups` claim contains expected groups

**D. Policy Mismatch**

Review AVP policies:

```bash
aws verifiedpermissions list-policies \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID"
```

Ensure policies exist for the action being performed.

### Issue: Path Rewrite Not Working

**Symptoms:**
- API calls return 404 or wrong responses
- CloudFront logs show incorrect paths

**Resolution:**

1. Check if CloudFront Function is deployed:

```bash
aws cloudfront describe-function \
  --name finanzas-sd-dev-api-path-rewrite
```

2. Verify function is associated with cache behavior:

```bash
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.DistributionConfig.CacheBehaviors.Items[?PathPattern==`finanzas/api/*`].FunctionAssociations'
```

3. Test function logic manually (if needed, update and re-run Phase 1)

### Issue: CORS Errors in Browser

**Symptoms:**
- Browser console shows CORS policy errors
- API calls work in curl but fail in browser

**Resolution:**

1. Verify API CORS configuration matches CloudFront domain:

```bash
# Check SAM template parameter
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Parameters[?ParameterKey==`AllowedCorsOrigin`].ParameterValue' \
  --output text
```

2. Should be: `https://d7t9x3j66yd8k.cloudfront.net`

3. If incorrect, update and redeploy:

```bash
cd services/finanzas-api
sam build
sam deploy --parameter-overrides AllowedCorsOrigin=https://d7t9x3j66yd8k.cloudfront.net
```

### Issue: AVP Calls Timing Out

**Symptoms:**
- API responses slow or timeout
- Lambda logs show AVP latency warnings

**Resolution:**

1. Check AVP service health in region
2. Verify Lambda has network access (VPC configuration if applicable)
3. Review Lambda timeout settings (should be at least 30 seconds)
4. Consider caching authorization decisions (application-level)

---

## Rollback Procedures

### Rollback Phase 4 (API with AVP)

If AVP integration causes issues, deploy API without AVP:

```bash
# Remove POLICY_STORE_ID variable
gh variable delete POLICY_STORE_ID

# Redeploy API
gh workflow run deploy-api.yml
```

API will deploy without AVP checks, falling back to Cognito JWT-only authorization.

### Rollback Phase 3 (Cognito Identity Source)

```bash
# List identity sources
IDENTITY_SOURCE_ID=$(aws verifiedpermissions list-identity-sources \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --query 'identitySources[0].identitySourceId' \
  --output text)

# Delete identity source
aws verifiedpermissions delete-identity-source \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --identity-source-id "$IDENTITY_SOURCE_ID"
```

### Rollback Phase 2 (AVP Policy Store)

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name finanzas-avp-dev \
  --region us-east-2

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name finanzas-avp-dev \
  --region us-east-2
```

### Rollback Phase 1 (CloudFront)

To remove API proxy from CloudFront:

1. Manually edit distribution via AWS Console
2. Remove cache behavior for `finanzas/api/*`
3. Optionally remove `ApiGwOrigin` origin
4. Save and wait for deployment

**Or use CLI:**

```bash
# Backup current config
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA > dist-backup.json

# Manually edit JSON to remove API behavior and origin
# Then update:
aws cloudfront update-distribution --id EPQU7PVDLQXUA \
  --if-match <etag> \
  --distribution-config file://modified-config.json
```

---

## Evidence Collection

When executing this deployment, collect the following evidence for documentation:

### Phase 1 Evidence

```bash
# Distribution summary
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.{Status:Status,Origins:DistributionConfig.Origins.Items[].Id,Behaviors:DistributionConfig.CacheBehaviors.Items[].PathPattern}' \
  --output json > phase1-cloudfront-config.json

# Function details
aws cloudfront describe-function \
  --name finanzas-sd-dev-api-path-rewrite \
  --query 'FunctionSummary' --output json > phase1-function.json
```

### Phase 2 Evidence

```bash
# Policy store details
aws verifiedpermissions get-policy-store \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --output json > phase2-policy-store.json

# Policies list
aws verifiedpermissions list-policies \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --output json > phase2-policies.json
```

### Phase 3 Evidence

```bash
# Identity sources
aws verifiedpermissions list-identity-sources \
  --region us-east-2 \
  --policy-store-id "$POLICY_STORE_ID" \
  --output json > phase3-identity-sources.json
```

### Phase 4 Evidence

```bash
# Stack outputs
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs' \
  --output json > phase4-api-outputs.json

# Lambda environment
aws lambda get-function-configuration \
  --function-name <function-name> \
  --query 'Environment.Variables' \
  --output json > phase4-lambda-env.json
```

---

## Related Documentation

- [CloudFront CDN Proxy Runbook](./cdn-proxy.md) - Detailed CloudFront configuration
- [AVP Deployment Guide](../../services/finanzas-api/AVP_DEPLOYMENT_GUIDE.md) - AVP standalone deployment
- [API Deployment Guide](../deploy.md) - Overall deployment guide
- [Authentication Flow](../../AUTHENTICATION_FLOW.md) - Cognito and AVP auth details
- [API Contracts](../api-contracts.md) - API endpoint specifications

## References

- **CloudFront Distribution ID:** `EPQU7PVDLQXUA`
- **CloudFront Domain:** `d7t9x3j66yd8k.cloudfront.net`
- **API Gateway ID:** `m3g6am67aj`
- **API Stage:** `dev`
- **Region:** `us-east-2`
- **API Stack Name:** `finanzas-sd-api-dev`
- **AVP Stack Name:** `finanzas-avp-dev`

---

## Workflow Reference

| Workflow | File | Purpose |
|----------|------|---------|
| Update CloudFront | `.github/workflows/update-cloudfront.yml` | Configure CDN proxy for API |
| Deploy AVP | `.github/workflows/deploy-avp.yml` | Deploy policy store |
| Deploy API | `.github/workflows/deploy-api.yml` | Deploy API with AVP integration |

---

## Summary

This runbook provides a complete, step-by-step guide for:

1. ✅ Configuring CloudFront to proxy Finanzas API traffic
2. ✅ Deploying AVP policy store with Cedar policies
3. ✅ Binding AVP to Cognito for token-based authorization
4. ✅ Redeploying API with AVP integration enabled
5. ✅ Verifying end-to-end functionality
6. ✅ Troubleshooting common issues
7. ✅ Rolling back if needed

After completing all phases, the Finanzas SD module will have:
- Unified CloudFront distribution serving both UI and API
- Fine-grained authorization via AVP with Cedar policies
- Secure JWT-based authentication via Cognito
- CORS properly configured for browser-based access
- Path rewriting for clean API URLs

**Estimated Total Time:** 45-60 minutes (including CloudFront propagation delays)
