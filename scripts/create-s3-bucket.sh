#!/bin/bash
set -e

# Helper script to create S3 bucket for Financial Planning UI
# This is automatically done in the CI/CD pipeline, but can be run manually if needed

# Configuration
BUCKET_NAME="${S3_BUCKET_NAME:-ukusi-ui-finanzas-prod}"
AWS_REGION="${AWS_REGION:-us-east-2}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-EPQU7PVDLQXUA}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-703671891952}"

echo "=========================================="
echo "S3 Bucket Creation Script"
echo "=========================================="
echo "Bucket Name: $BUCKET_NAME"
echo "Region: $AWS_REGION"
echo "CloudFront Distribution: $CLOUDFRONT_DIST_ID"
echo "AWS Account: $AWS_ACCOUNT_ID"
echo ""

# Check if bucket exists
if aws s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1; then
  echo "✅ Bucket already exists: $BUCKET_NAME"
  exit 0
fi

echo "Creating S3 bucket..."

# Create bucket
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

echo "✅ Bucket created: $BUCKET_NAME"

# Block all public access
echo "Configuring public access block..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "✅ Public access blocked"

# Enable versioning
echo "Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

echo "✅ Versioning enabled"

# Enable encryption
echo "Enabling encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

echo "✅ Encryption enabled"

# Create bucket policy for CloudFront OAC
echo "Creating bucket policy for CloudFront OAC..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${CLOUDFRONT_DIST_ID}"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///tmp/bucket-policy.json

rm /tmp/bucket-policy.json

echo "✅ Bucket policy applied"

echo ""
echo "=========================================="
echo "✅ S3 Bucket Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify CloudFront distribution has a behavior for /finanzas/*"
echo "2. Verify Origin Access Control (OAC) is configured"
echo "3. Verify custom error responses (403/404 -> /finanzas/index.html)"
echo ""
echo "Run deployment:"
echo "  npm ci && npm run build"
echo "  aws s3 sync dist/ s3://$BUCKET_NAME/ --delete"
echo "  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths '/finanzas/*'"
echo ""
