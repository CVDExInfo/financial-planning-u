# S3 CORS Configuration for Document Uploads - Deployment Guide

## Problem Statement

Browser-based document uploads to S3 were failing with CORS errors:
- **Error**: `Access-Control-Allow-Origin – Missing Header`
- **Symptom**: `TypeError: Failed to fetch` in browser console when uploading invoices
- **Root Cause**: S3 bucket CORS configuration was missing or not applied

## Solution Overview

The `template.yaml` includes a complete CORS configuration for the `DocsBucket` (ukusi-ui-finanzas-prod) that allows browser-based uploads from the Finanzas UI CloudFront distribution.

## CORS Configuration Details

The CORS configuration in `template.yaml` (lines 131-149) includes:

```yaml
CorsConfiguration:
  CorsRules:
    - AllowedMethods:
        - PUT
        - GET
        - HEAD
      AllowedOrigins:
        - Fn::Sub: https://${CloudFrontDomain}
        - Fn::If:
            - HasAdditionalUploadOrigin
            - Ref: AdditionalUploadOrigin
            - Ref: AWS::NoValue
      AllowedHeaders:
        - "*"
      ExposedHeaders:
        - ETag
        - x-amz-request-id
        - x-amz-id-2
      MaxAge: 300
```

### Key Features

1. **Allowed Methods**: PUT (uploads), GET (downloads), HEAD (metadata checks)
2. **Allowed Origins**: 
   - Primary: CloudFront domain from `CloudFrontDomain` parameter (default: `d7t9x3j66yd8k.cloudfront.net`)
   - Optional: Additional origin via `AdditionalUploadOrigin` parameter
3. **Allowed Headers**: All headers (`*`) to support various client implementations
4. **Exposed Headers**: ETag, x-amz-request-id, x-amz-id-2 for debugging and verification
5. **Max Age**: 300 seconds (5 minutes) for preflight cache

## Deployment Steps

### 1. Verify CloudFront Domain Parameter

Ensure the `CloudFrontDomain` parameter in `template.yaml` matches your actual CloudFront distribution:

```bash
# Check current CloudFront domain from environment
cat ../../.env.production | grep VITE_CLOUDFRONT_URL
# Should show: VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net

# Verify template parameter
grep -A 2 "CloudFrontDomain:" template.yaml
# Should show: Default: d7t9x3j66yd8k.cloudfront.net
```

If they don't match, update the `CloudFrontDomain` parameter default in `template.yaml` or override it during deployment.

### 2. Deploy the CloudFormation Stack

Deploy the updated stack to apply CORS configuration:

```bash
cd services/finanzas-api

# Build the SAM application
sam build

# Deploy to dev environment
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=<your-pool-arn> \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m \
    StageName=dev \
    DocsBucketName=ukusi-ui-finanzas-prod \
    CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net
```

**Note**: If the bucket already exists, CloudFormation will update its CORS configuration. The `DeletionPolicy: Retain` ensures the bucket won't be deleted if the stack is removed.

### 3. Verify CORS Configuration Was Applied

After deployment, verify the S3 bucket has the correct CORS rules:

```bash
aws s3api get-bucket-cors --bucket ukusi-ui-finanzas-prod
```

Expected output:
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": ["https://d7t9x3j66yd8k.cloudfront.net"],
      "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
      "MaxAgeSeconds": 300
    }
  ]
}
```

### 4. Test the Upload Pipeline

Use the health check script to validate end-to-end functionality:

```bash
# Set environment variables
export FINZ_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
export AUTH_TOKEN=<your-cognito-id-token>

# Run the health check
npm run check-upload-docs
```

The script will:
1. Request a presigned URL from `/uploads/docs`
2. Perform a PUT request to S3 with the presigned URL
3. Report success or failure with detailed logs

Expected output on success:
```
Requesting presigned URL from /uploads/docs
Presign response { status: 201, body: { uploadUrl: '...', objectKey: '...' } }
PUT to S3 result { status: 200, ok: true, statusText: 'OK' }
Health check upload succeeded { bucket: 'ukusi-ui-finanzas-prod', objectKey: 'docs/...' }
```

### 5. Test from Browser

1. Navigate to the Finanzas UI: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
2. Log in with valid credentials
3. Go to the Reconciliation page: `/finanzas/sdmt/cost/reconciliation`
4. Attempt to upload an invoice with all required fields:
   - Invoice Number
   - Invoice Date
   - Vendor
   - Amount
   - File attachment
5. Open Browser DevTools → Network tab
6. Verify:
   - POST to `/uploads/docs` returns 201 with presigned URL
   - PUT to S3 presigned URL returns 200
   - No CORS errors in console
   - Invoice appears in "Invoices & Documentation" list

## Troubleshooting

### CORS Errors Still Occur

If you still see CORS errors after deployment:

1. **Verify stack was deployed successfully**:
   ```bash
   aws cloudformation describe-stacks --stack-name finanzas-sd-api-dev \
     --query 'Stacks[0].StackStatus'
   ```
   Should show: `"UPDATE_COMPLETE"` or `"CREATE_COMPLETE"`

2. **Check CloudFormation events for errors**:
   ```bash
   aws cloudformation describe-stack-events --stack-name finanzas-sd-api-dev \
     --max-items 20 \
     --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`CREATE_FAILED`]'
   ```

3. **Verify bucket CORS matches template**:
   ```bash
   aws s3api get-bucket-cors --bucket ukusi-ui-finanzas-prod
   ```

4. **Check CloudFront domain matches**:
   - Browser origin in error: `https://d7t9x3j66yd8k.cloudfront.net`
   - Bucket CORS AllowedOrigins: `https://d7t9x3j66yd8k.cloudfront.net`
   - Template parameter: `d7t9x3j66yd8k.cloudfront.net`

### Multiple CloudFront Domains

If you use multiple CloudFront distributions or domains (e.g., for dev/staging/prod):

```bash
sam deploy ... --parameter-overrides \
  CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net \
  AdditionalUploadOrigin=https://other-distribution.cloudfront.net
```

### Preflight Request Failures

If preflight OPTIONS requests fail:
- Verify `AllowedHeaders: ["*"]` is in the CORS config
- Check that the browser is sending `Origin` header
- Ensure no proxy or network policy is blocking OPTIONS requests

### 403 Forbidden on PUT

If PUT requests return 403:
- Verify Lambda has `s3:PutObject` permission (check IAM policy in template.yaml line 735-740)
- Check presigned URL hasn't expired (default: 10 minutes)
- Verify bucket encryption settings don't block unsigned uploads

## Additional Origins

If you need to allow uploads from additional domains (e.g., local development, staging):

### Option 1: Use AdditionalUploadOrigin Parameter

```bash
sam deploy ... --parameter-overrides \
  AdditionalUploadOrigin=https://staging.example.com
```

### Option 2: Modify Template for Multiple Origins

Edit `template.yaml` to add more origins:

```yaml
AllowedOrigins:
  - Fn::Sub: https://${CloudFrontDomain}
  - https://localhost:5173  # Local dev
  - https://staging.example.com  # Staging
```

**Warning**: Never use `*` (wildcard) for production origins as it allows any domain to upload files to your bucket.

## Testing Without Credentials

If you don't have Cognito credentials but want to test CORS:

```bash
# Test CORS preflight (OPTIONS request)
curl -X OPTIONS \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" \
  -v \
  "https://ukusi-ui-finanzas-prod.s3.us-east-2.amazonaws.com/test.txt"

# Look for these headers in response:
# Access-Control-Allow-Origin: https://d7t9x3j66yd8k.cloudfront.net
# Access-Control-Allow-Methods: PUT, GET, HEAD
# Access-Control-Max-Age: 300
```

## Summary

✅ **CORS configuration is complete in template.yaml**
✅ **Health check script exists at `scripts/check-upload-docs.ts`**
✅ **Deployment updates existing bucket CORS configuration**
✅ **No code changes needed - only infrastructure deployment**

After deploying the stack, browser-based uploads from the Finanzas UI will work without CORS errors.
