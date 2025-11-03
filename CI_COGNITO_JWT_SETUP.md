# CI/CD Runtime Cognito JWT Setup

This document describes the required GitHub repository settings (Variables and Secrets) for the Cognito JWT generation in CI/CD workflows.

## Overview

The CI/CD workflows now generate fresh Cognito JWT tokens at runtime, eliminating the need for static `DEV_JWT` secrets. This is accomplished through:

1. **Composite Action**: `.github/actions/cognito-generate-jwt/action.yml` - Generates Cognito access tokens
2. **Contract Tests Workflow**: `.github/workflows/api-contract-tests.yml` - Newman-based API testing with runtime JWT
3. **Deploy Workflow**: `.github/workflows/deploy-api.yml` - Enhanced with protected endpoint smoke tests

## Required Repository Variables

Configure these in **Settings → Secrets and variables → Actions → Variables**:

| Variable Name | Example Value | Description |
|---------------|---------------|-------------|
| `AWS_REGION` | `us-east-2` | AWS region for API and Cognito |
| `DEV_API_URL` | `https://{api-id}.execute-api.us-east-2.amazonaws.com/dev/finanzas` | Base URL for deployed API |
| `COGNITO_USER_POOL_ID` | `us-east-2_xxxxxxxxx` | Cognito User Pool ID |
| `COGNITO_WEB_CLIENT` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` | Cognito App Client ID (Web Client) |
| `COGNITO_USER_POOL_ARN` | `arn:aws:cognito-idp:us-east-2:{account}:userpool/us-east-2_xxxxxxxxx` | Cognito User Pool ARN |
| `FINZ_API_STACK` | `finanzas-sd-api-dev` | CloudFormation stack name (optional) |
| `FINZ_API_STAGE` | `dev` | API Gateway stage name (optional) |

## Required Repository Secrets

Configure these in **Settings → Secrets and variables → Actions → Secrets**:

| Secret Name | Description |
|-------------|-------------|
| `USERNAME` | Cognito user username for authentication |
| `PASSWORD` | Cognito user password for authentication |
| `OIDC_AWS_ROLE_ARN` | IAM role ARN for GitHub OIDC authentication (e.g., `arn:aws:iam::{account}:role/GitHubActionsRole`) |

## Cognito App Client Configuration

The Cognito App Client must be configured to support one of these authentication flows:

### Option 1: USER_PASSWORD_AUTH (Preferred)
- App client **without** a client secret
- **USER_PASSWORD_AUTH** flow enabled in app client settings
- No additional IAM permissions required

### Option 2: ADMIN_USER_PASSWORD_AUTH (Fallback)
- App client **with or without** a client secret
- **ADMIN_USER_PASSWORD_AUTH** flow enabled
- Requires IAM permissions: `cognito-idp:AdminInitiateAuth`

The action automatically tries `USER_PASSWORD_AUTH` first and falls back to `ADMIN_USER_PASSWORD_AUTH` if needed.

## Cognito User Setup

The user account referenced by `USERNAME` and `PASSWORD` must:

1. Exist in the specified User Pool
2. Be in CONFIRMED status (not FORCE_CHANGE_PASSWORD or pending verification)
3. Have a valid, non-expired password
4. Belong to appropriate groups (e.g., `SDT` group) for protected endpoints

## Preflight Checks

Both workflows include preflight validation that verifies all required Variables and Secrets are configured. If any are missing, the workflow fails immediately with a clear error message indicating which setting is missing.

## Workflows Using Runtime JWT

### 1. API Contract Tests (`api-contract-tests.yml`)

**Triggers:**
- Pull requests to `main`
- Daily at 3:00 AM UTC (cron)
- Manual workflow dispatch

**Steps:**
1. Preflight validation
2. Configure AWS credentials via OIDC
3. Generate Cognito JWT token
4. Install Newman
5. Build runtime Postman environment with current API URL and JWT
6. Execute Newman tests against deployed API
7. Generate test summary

### 2. API Deployment (`deploy-api.yml`)

**Triggers:**
- Push to `module/finanzas-api-mvp` branch
- Manual workflow dispatch

**Steps:**
1. Preflight validation (enhanced with JWT secret checks)
2. Configure AWS credentials via OIDC
3. Deploy API via AWS SAM
4. Run public smoke tests (`/health`)
5. Generate Cognito JWT token
6. Run protected smoke test (`POST /projects`) with JWT
7. Generate deployment summary

## Testing the Setup

### Verify Variables and Secrets

1. Check that all variables are set:
   ```bash
   # Navigate to: Settings → Secrets and variables → Actions → Variables
   # Verify all required variables are listed
   ```

2. Check that all secrets are set:
   ```bash
   # Navigate to: Settings → Secrets and variables → Actions → Secrets
   # Verify USERNAME, PASSWORD, and OIDC_AWS_ROLE_ARN are listed
   ```

### Run Contract Tests Manually

1. Go to **Actions** → **API Contract Tests (Newman)**
2. Click **Run workflow**
3. Watch for:
   - ✅ Preflight validation passes
   - ✅ OIDC authentication succeeds
   - ✅ JWT token generation succeeds
   - ✅ Newman tests execute

### Trigger a Deployment

1. Make a commit to `module/finanzas-api-mvp` branch
2. Watch the **Deploy Finanzas API (dev)** workflow
3. Verify:
   - ✅ Preflight validation passes
   - ✅ Deployment succeeds
   - ✅ Public smoke tests pass
   - ✅ JWT token generation succeeds
   - ✅ Protected smoke test returns valid JSON (201 or expected error)

## Troubleshooting

### Error: "Failed to obtain Cognito access token"

**Possible causes:**
1. **Invalid credentials**: Check `USERNAME` and `PASSWORD` secrets
2. **User not confirmed**: Ensure user status is CONFIRMED in Cognito
3. **App client flow disabled**: Enable USER_PASSWORD_AUTH or ADMIN_USER_PASSWORD_AUTH
4. **Missing IAM permissions**: If using ADMIN flow, ensure OIDC role has `cognito-idp:AdminInitiateAuth`

### Error: "Missing repo variable: COGNITO_WEB_CLIENT"

**Solution:** Add the missing variable in Settings → Secrets and variables → Actions → Variables

### Error: "Missing repo secret: USERNAME"

**Solution:** Add the missing secret in Settings → Secrets and variables → Actions → Secrets

### Newman tests fail with 401 Unauthorized

**Possible causes:**
1. **JWT expired**: This shouldn't happen in CI, but check JWT generation step succeeded
2. **User not in correct group**: Ensure user belongs to `SDT` or required Cognito group
3. **Authorization header format**: Should be `Authorization: Bearer {token}`

### Protected smoke test returns unexpected response

**Expected behaviors:**
- **201 Created**: Endpoint is implemented and working
- **400 Bad Request**: Endpoint exists but request validation failed
- **404 Not Found**: Endpoint not yet implemented (acceptable during development)
- **500 Internal Server Error**: Investigate API logs

## Security Notes

- JWT tokens are generated fresh for each workflow run (not reused)
- Tokens are masked in GitHub Actions logs
- Tokens expire after the Cognito-configured lifetime (typically 1 hour)
- Never commit JWT tokens or credentials to source code
- Use GitHub Environments for additional approval gates in production workflows

## Migration from Static DEV_JWT

If you were previously using a static `DEV_JWT` secret:

1. Configure all Variables and Secrets listed above
2. Test the new workflows
3. Once verified, delete the old `DEV_JWT` secret
4. Remove any references to `DEV_JWT` from other workflows

## Next Steps

- [ ] Configure required Variables in GitHub repository settings
- [ ] Configure required Secrets in GitHub repository settings
- [ ] Verify Cognito User Pool and App Client configuration
- [ ] Run contract tests workflow manually to verify setup
- [ ] Trigger a deployment to verify protected smoke tests
- [ ] Delete legacy `DEV_JWT` secret (if applicable)
