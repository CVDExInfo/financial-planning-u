# S3 bucket for Financial Planning UI
resource "aws_s3_bucket" "finanzas_ui" {
  bucket = var.s3_bucket_name

  tags = {
    Name        = "Financial Planning UI - Production"
    Application = "finanzas-ui"
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "finanzas_ui" {
  bucket = aws_s3_bucket.finanzas_ui.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "finanzas_ui" {
  bucket = aws_s3_bucket.finanzas_ui.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with AES256
resource "aws_s3_bucket_server_side_encryption_configuration" "finanzas_ui" {
  bucket = aws_s3_bucket.finanzas_ui.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle policy to manage old versions
resource "aws_s3_bucket_lifecycle_configuration" "finanzas_ui" {
  bucket = aws_s3_bucket.finanzas_ui.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket policy to allow CloudFront Origin Access Control
resource "aws_s3_bucket_policy" "finanzas_ui" {
  bucket = aws_s3_bucket.finanzas_ui.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.finanzas_ui.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${var.aws_account_id}:distribution/${var.cloudfront_distribution_id}"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.finanzas_ui]
}
