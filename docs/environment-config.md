# Environment Configuration

This document describes the required GitHub repository/organization variables and secrets for the Financial Planning UI CI/CD pipeline.

## GitHub Variables (Repository or Organization Level)

These variables should be configured in GitHub repository settings under Settings → Secrets and variables → Actions → Variables.

### Required Variables

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `AWS_ACCOUNT_ID` | `703671891952` | AWS account ID for resource ARNs |
| `AWS_REGION` | `us-east-2` | AWS region for S3, IAM, and SSM resources |
| `S3_BUCKET_NAME` | `ukusi-ui-finanzas-prod` | S3 bucket name for static assets |
| `CLOUDFRONT_DIST_ID` | `EPQU7PVDLQXUA` | CloudFront distribution ID |
| `DISTRIBUTION_DOMAIN_NAME` | `d7t9x3j66yd8k.cloudfront.net` | CloudFront distribution domain name |

### Application Variables

| Variable Name | Example Value | Description |
|---------------|---------------|-------------|
| `VITE_API_BASE_URL` | `https://api.example.com` | Base URL for backend API |
| `VITE_ACTA_API_ID` | `acta-api-id-here` | ACTA API identifier |

### Optional Cognito Variables

| Variable Name | Example Value | Description |
|---------------|---------------|-------------|
| `COGNITO_CLIENT_ID` | `client-id-here` | AWS Cognito User Pool Client ID |
| `COGNITO_POOL_ID` | `us-east-2_XXXXX` | AWS Cognito User Pool ID |
| `COGNITO_DOMAIN` | `auth.example.com` | Cognito domain for authentication |

## GitHub Secrets (Repository or Organization Level)

These secrets should be configured in GitHub repository settings under Settings → Secrets and variables → Actions → Secrets.

### Required Secrets

| Secret Name | Description | Format |
|-------------|-------------|--------|
| `OIDC_AWS_ROLE_ARN` | IAM role ARN for OIDC authentication | `arn:aws:iam::703671891952:role/github-actions-finanzas-prod` |

### ⚠️ IMPORTANT: Do NOT Use Static AWS Keys

The repository may have the following secrets configured, but they should **NOT** be used:
- `AWS_ACCESS_KEY_ID` (legacy - do not use)
- `AWS_SECRET_ACCESS_KEY` (legacy - do not use)

The CI/CD pipeline uses **OIDC (OpenID Connect)** for authentication, which is more secure and does not require long-lived credentials.

## Setting Up Variables and Secrets

### Via GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **Variables** tab to add variables
4. Click **Secrets** tab to add secrets
5. Use **New repository variable/secret** or **New organization variable/secret**

### Organization-Level Configuration

For centralized management across multiple repositories:

1. Go to your Organization settings
2. Click **Secrets and variables** → **Actions**
3. Configure organization-level variables and secrets
4. Select repository access (e.g., `financial-planning-u` and `acta-ui`)

This ensures consistent naming conventions and prevents drift between related projects.

## Runtime Configuration with AWS SSM Parameter Store

For dynamic configuration that may change without redeployment, you can optionally fetch values from AWS SSM Parameter Store after OIDC authentication.

### SSM Parameter Naming Convention

```
/ui/shared/*        - Shared across all UI applications
/ui/finanzas/*      - Specific to Financial Planning UI
```

### Example SSM Parameters

```
/ui/shared/cognito_client_id
/ui/shared/cognito_pool_id
/ui/shared/cognito_domain
/ui/finanzas/api_base_url
/ui/finanzas/acta_api_id
```

### Fetching from SSM in Workflow

To enable runtime SSM parameter fetching, add this step after OIDC authentication:

```yaml
- name: Fetch Configuration from SSM
  run: |
    export VITE_API_BASE_URL=$(aws ssm get-parameter --name /ui/finanzas/api_base_url --query 'Parameter.Value' --output text)
    export VITE_ACTA_API_ID=$(aws ssm get-parameter --name /ui/finanzas/acta_api_id --query 'Parameter.Value' --output text)
    export VITE_COGNITO_CLIENT_ID=$(aws ssm get-parameter --name /ui/shared/cognito_client_id --query 'Parameter.Value' --output text)
    # Add to GITHUB_ENV for subsequent steps
    echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" >> $GITHUB_ENV
    echo "VITE_ACTA_API_ID=$VITE_ACTA_API_ID" >> $GITHUB_ENV
```

**Note**: This is optional and should be toggled based on your configuration management strategy.

## Verification

### Preflight Checks

The deployment workflow includes automatic verification of required variables:

```yaml
- name: Verify Required Variables
  run: |
    if [ "${{ vars.AWS_REGION }}" != "us-east-2" ]; then
      echo "❌ ERROR: AWS_REGION must be us-east-2"
      exit 1
    fi
    # ... additional checks
```

### Testing Locally

You cannot test OIDC authentication locally, but you can verify variable availability:

```bash
# Set environment variables (for local testing only)
export AWS_REGION=us-east-2
export S3_BUCKET=ukusi-ui-finanzas-prod
export DIST_ID=EPQU7PVDLQXUA
export VITE_API_BASE_URL=https://api.example.com
export VITE_ACTA_API_ID=acta-api-id

# Build with environment variables
npm run build
```

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use OIDC** instead of static AWS credentials
3. **Rotate secrets** regularly (if using any)
4. **Limit variable access** to specific repositories or workflows
5. **Use organization-level variables** for shared configuration
6. **Audit access** to secrets regularly

## Troubleshooting

### Missing Variable Error

```
Error: Required variable AWS_REGION is not set
```

**Solution**: Add the variable in GitHub repository/organization settings.

### OIDC Authentication Failed

```
Error: Failed to assume role arn:aws:iam::703671891952:role/...
```

**Solution**: 
1. Verify OIDC_AWS_ROLE_ARN secret is set correctly
2. Check IAM role trust relationship allows GitHub Actions
3. Ensure IAM role has required permissions

### Build-Time Variable Not Available

```
Error: VITE_API_BASE_URL is undefined
```

**Solution**: Vite environment variables must be prefixed with `VITE_` and set before running `npm run build`.

## References

- [GitHub Actions: Using secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions: Using variables](https://docs.github.com/en/actions/learn-github-actions/variables)
- [Configuring OpenID Connect in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
