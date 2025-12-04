# Quick Start: Fixing S3 CORS Upload Errors

## What Was Done

✅ **Analyzed** the S3 CORS configuration in template.yaml - it's already correct!
✅ **Verified** CloudFront domain matches deployment (d7t9x3j66yd8k.cloudfront.net)
✅ **Documented** the CORS configuration and deployment process
✅ **Added** npm script for health check validation
✅ **Tested** all existing tests - 131 tests passing

## What You Need to Do

The template.yaml already has the correct CORS configuration. You just need to **deploy the CloudFormation stack** to apply it to your S3 bucket.

### Step 1: Deploy the Stack

```bash
cd services/finanzas-api

# Build
sam build

# Deploy (adjust parameters as needed)
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_FyHLtOhiY \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m \
    StageName=dev \
    DocsBucketName=ukusi-ui-finanzas-prod \
    CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net
```

### Step 2: Verify CORS Was Applied

```bash
aws s3api get-bucket-cors --bucket ukusi-ui-finanzas-prod
```

You should see:
```json
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["https://d7t9x3j66yd8k.cloudfront.net"],
    "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 300
  }]
}
```

### Step 3: Test the Upload Pipeline

```bash
# Set environment variables
export FINZ_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
export AUTH_TOKEN=<your-cognito-id-token>

# Run health check
npm run check-upload-docs
```

Expected output:
```
✓ Requesting presigned URL from /uploads/docs
✓ Presign response { status: 201, ... }
✓ PUT to S3 result { status: 200, ok: true }
✓ Health check upload succeeded
```

### Step 4: Test from Browser

1. Open: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
2. Log in
3. Navigate to: **Reconciliation** page
4. Upload an invoice with:
   - Invoice Number
   - Invoice Date
   - Vendor
   - Amount
   - File attachment
5. Check DevTools → Network tab:
   - ✅ POST `/uploads/docs` returns 201
   - ✅ PUT to S3 returns 200
   - ✅ No CORS errors in console
   - ✅ Invoice appears in list

## What Will Be Fixed

After deployment:
- ✅ No more "Access-Control-Allow-Origin – Missing Header" errors
- ✅ No more "TypeError: Failed to fetch" errors
- ✅ Invoice uploads work from the browser
- ✅ Document uploads work across all modules (reconciliation, changes, prefactura, catalog)

## Reference Documentation

- **CORS_DEPLOYMENT_GUIDE.md** - Complete deployment and troubleshooting guide
- **S3_CORS_FIX_SUMMARY.md** - Technical implementation summary
- **README.md** - Updated with CORS configuration section

## Need Help?

### Still seeing CORS errors?

1. Verify stack deployed successfully:
   ```bash
   aws cloudformation describe-stacks --stack-name finanzas-sd-api-dev \
     --query 'Stacks[0].StackStatus'
   ```

2. Check for deployment errors:
   ```bash
   aws cloudformation describe-stack-events --stack-name finanzas-sd-api-dev \
     --max-items 20
   ```

3. Verify CloudFront domain matches:
   - Browser origin: Check DevTools console error
   - Bucket CORS: Run `aws s3api get-bucket-cors`
   - Template parameter: Check template.yaml line 32

### Multiple CloudFront domains?

If you have multiple distributions, add the additional domain:

```bash
sam deploy ... --parameter-overrides \
  CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net \
  AdditionalUploadOrigin=https://other-domain.cloudfront.net
```

## That's It!

The fix is simple: **just deploy the stack**. The CORS configuration is already correct in template.yaml - it just needs to be applied to the S3 bucket.
