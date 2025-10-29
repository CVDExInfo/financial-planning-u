# Financial Planning UI - Infrastructure README

This directory contains Terraform configuration for the Financial Planning UI infrastructure on AWS.

## Overview

- **S3 Bucket**: `ukusi-ui-finanzas-prod` (us-east-2)
- **CloudFront Distribution**: `EPQU7PVDLQXUA` (d7t9x3j66yd8k.cloudfront.net)
- **Path**: `/finanzas/*`
- **Region**: us-east-2 (S3, IAM, SSM)

## Prerequisites

1. **AWS CLI** installed and configured
2. **Terraform** >= 1.0 installed
3. **AWS Credentials** with appropriate permissions:
   - S3: Create bucket, manage policies, versioning, encryption
   - CloudFront: Read distribution, create OAC, create cache policies
   - Note: Modifying the distribution itself may require console access

## Quick Start

### Initialize Terraform

```bash
cd infra
terraform init
```

### Plan Changes

```bash
terraform plan
```

This will show:
- S3 bucket creation (ukusi-ui-finanzas-prod)
- Origin Access Control (OAC) creation
- Cache policies creation
- Outputs with manual CloudFront configuration instructions

### Apply Changes

```bash
terraform apply
```

Review the plan and type `yes` to create resources.

### View Outputs

```bash
terraform output
```

This will display:
- S3 bucket details
- Manual CloudFront configuration instructions
- Deployment URL

## What Terraform Creates

### 1. S3 Bucket (`s3.tf`)

- **Name**: ukusi-ui-finanzas-prod
- **Access**: Private (all public access blocked)
- **Versioning**: Enabled (for rollback)
- **Encryption**: AES256 server-side encryption
- **Lifecycle**: 
  - Old versions deleted after 90 days
  - Incomplete uploads aborted after 7 days
- **Policy**: Allows CloudFront OAC access

### 2. CloudFront Resources (`cloudfront.tf`)

- **Origin Access Control**: Modern S3 access control for CloudFront
- **Cache Policies**:
  - `finanzas-assets-cache-policy`: 1-year TTL for immutable assets
  - `finanzas-html-cache-policy`: 0 TTL for HTML files
- **Data Source**: Reads existing distribution (does NOT modify it)

## Manual CloudFront Configuration

⚠️ **IMPORTANT**: Terraform cannot fully manage the existing CloudFront distribution without risk of disrupting other behaviors. After running `terraform apply`, you must manually add the new origin and behavior.

After running `terraform apply`, follow the instructions in the `manual_cloudfront_update_instructions` output:

1. **Add New Origin** in CloudFront console
2. **Add New Behavior** for `/finanzas/*` path pattern
3. **Add Custom Error Responses** for SPA deep linking (403/404 → /finanzas/index.html)
4. **Verify** that existing behaviors remain unchanged

See the detailed instructions in the terraform output after applying.

## State Management

Currently using local state. For production, consider:

```hcl
terraform {
  backend "s3" {
    bucket = "ukusi-terraform-state"
    key    = "finanzas-ui/terraform.tfstate"
    region = "us-east-2"
  }
}
```

## Rollback

To rollback S3 changes:

```bash
# List object versions
aws s3api list-object-versions \
  --bucket ukusi-ui-finanzas-prod \
  --prefix index.html

# Restore specific version
aws s3api copy-object \
  --bucket ukusi-ui-finanzas-prod \
  --copy-source ukusi-ui-finanzas-prod/index.html?versionId=VERSION_ID \
  --key index.html
```

To remove infrastructure:

```bash
# Remove CloudFront behavior and origin manually first
terraform destroy
```

## Fallback: AWS CLI Commands

If Terraform is not available, use these AWS CLI commands:

### Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://ukusi-ui-finanzas-prod --region us-east-2

# Block public access
aws s3api put-public-access-block \
  --bucket ukusi-ui-finanzas-prod \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ukusi-ui-finanzas-prod \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket ukusi-ui-finanzas-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Add bucket policy
aws s3api put-bucket-policy \
  --bucket ukusi-ui-finanzas-prod \
  --policy file://bucket-policy.json
```

### Create Origin Access Control

```bash
# Create OAC
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "finanzas-ui-oac",
    "Description": "Origin Access Control for Financial Planning UI",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }'
```

### Update CloudFront Distribution

⚠️ Updating CloudFront via CLI is complex. Use the AWS Console for:
- Adding the new origin
- Adding the new behavior for `/finanzas/*`
- Adding custom error responses

## Verification

After setup is complete:

1. **Test S3 Access** (should fail - bucket is private):
   ```bash
   curl https://ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com/index.html
   ```

2. **Test CloudFront Access** (should work):
   ```bash
   curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   ```

3. **Test Deep Linking** (should return index.html):
   ```bash
   curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/pmo/prefactura/estimator
   ```

## Security Considerations

- S3 bucket is **private** - no public access
- CloudFront uses **Origin Access Control** (OAC) - modern replacement for OAI
- All communication uses **HTTPS** (redirect-to-https)
- Server-side encryption with **AES256**
- Bucket versioning enabled for **audit trail**
- No static AWS credentials in CI/CD - **OIDC only**

## Support

For issues or questions:
1. Check GitHub Actions logs for deployment failures
2. Review CloudFront distribution configuration
3. Verify S3 bucket permissions and policies
4. Check AWS CloudWatch logs for errors
