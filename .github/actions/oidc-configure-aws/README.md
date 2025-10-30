# OIDC Configure AWS Credentials

This is a local composite GitHub Action that configures AWS credentials using GitHub's OpenID Connect (OIDC) tokens. It allows secure authentication to AWS without storing long-lived credentials.

## Why This Action Exists

This repository's settings block third-party GitHub Marketplace actions. Instead of using `aws-actions/configure-aws-credentials@v4`, we implement the same functionality locally.

## Features

- ✅ **OIDC-based authentication** - No long-lived AWS credentials needed
- ✅ **Zero external dependencies** - Uses only GitHub Actions built-in features
- ✅ **Secure by default** - Automatically masks sensitive values in logs
- ✅ **Validation built-in** - Verifies credentials after assuming role
- ✅ **Standard AWS CLI** - Uses `aws sts assume-role-with-web-identity`

## Prerequisites

### 1. GitHub Workflow Permissions

Your workflow must have the `id-token: write` permission:

```yaml
permissions:
  id-token: write
  contents: read
```

### 2. AWS IAM OIDC Provider

Your AWS account must have a GitHub OIDC provider configured:

```bash
# Create OIDC provider (if not exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 3. AWS IAM Role with Trust Policy

Create an IAM role with a trust policy that allows GitHub Actions from your repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::703671891952:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:valencia94/financial-planning-u:*"
        }
      }
    }
  ]
}
```

### 4. IAM Role Permissions

The role needs permissions for the operations your workflow performs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ukusi-ui-finanzas-prod",
        "arn:aws:s3:::ukusi-ui-finanzas-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::703671891952:distribution/EPQU7PVDLQXUA"
    }
  ]
}
```

## Usage

### Basic Usage

```yaml
steps:
  - name: Configure AWS Credentials
    uses: ./.github/actions/oidc-configure-aws
    with:
      role_arn: ${{ secrets.OIDC_AWS_ROLE_ARN }}
      aws_region: us-east-2

  - name: Upload to S3
    run: |
      aws s3 sync dist/ s3://my-bucket/
```

### With Custom Session Name

```yaml
steps:
  - name: Configure AWS Credentials
    uses: ./.github/actions/oidc-configure-aws
    with:
      role_arn: ${{ secrets.OIDC_AWS_ROLE_ARN }}
      aws_region: us-east-2
      session_name: deploy-${{ github.run_id }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `role_arn` | AWS IAM Role ARN to assume | Yes | - |
| `aws_region` | AWS region for STS endpoint | No | `us-east-2` |
| `session_name` | Role session name for CloudTrail | No | `github-actions-oidc` |

## Outputs

| Output | Description |
|--------|-------------|
| `aws_access_key_id` | AWS Access Key ID from assumed role |
| `aws_secret_access_key` | AWS Secret Access Key from assumed role |
| `aws_session_token` | AWS Session Token from assumed role |

**Note:** Outputs are automatically exported to the environment as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, and `AWS_DEFAULT_REGION` for subsequent steps.

## How It Works

1. **Validate OIDC Context**: Checks that `ACTIONS_ID_TOKEN_REQUEST_URL` and `ACTIONS_ID_TOKEN_REQUEST_TOKEN` are available.

2. **Request GitHub OIDC Token**: Calls GitHub's OIDC token endpoint with audience `sts.amazonaws.com`.

3. **Assume AWS Role**: Uses `aws sts assume-role-with-web-identity` to exchange the GitHub token for temporary AWS credentials.

4. **Export Credentials**: Sets environment variables for AWS CLI and SDKs to use.

5. **Verify**: Calls `aws sts get-caller-identity` to verify credentials work.

## Security

- ✅ All sensitive values are masked using `::add-mask::` to prevent log exposure
- ✅ Credentials are temporary (1-hour duration by default)
- ✅ No long-lived credentials stored in GitHub Secrets
- ✅ Trust policy restricts access to specific repository
- ✅ Session names include workflow context for audit trails

## Troubleshooting

### Error: "OIDC token request environment variables not found"

**Cause**: Workflow doesn't have `id-token: write` permission.

**Fix**: Add to your workflow:
```yaml
permissions:
  id-token: write
  contents: read
```

### Error: "Failed to assume role with web identity"

**Possible causes**:
1. OIDC provider not configured in AWS
2. IAM role trust policy doesn't match repository
3. Role ARN is incorrect

**Debug**:
```bash
# Check OIDC provider exists
aws iam list-open-id-connect-providers

# Check role trust policy
aws iam get-role --role-name your-role-name
```

### Error: "Failed to extract AWS credentials from response"

**Cause**: `jq` parsing failed or AWS STS returned unexpected format.

**Fix**: Ensure `jq` is installed (it is by default on GitHub-hosted runners).

## Comparison to Marketplace Action

This action provides equivalent functionality to `aws-actions/configure-aws-credentials@v4`:

| Feature | Marketplace Action | This Action |
|---------|-------------------|-------------|
| OIDC Support | ✅ | ✅ |
| No external deps | ❌ | ✅ |
| Auto credential export | ✅ | ✅ |
| Secret masking | ✅ | ✅ |
| Credential verification | ✅ | ✅ |
| Session tagging | ✅ | ❌ (future) |

## References

- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS STS AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)
- [AWS IAM OIDC Provider Setup](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
