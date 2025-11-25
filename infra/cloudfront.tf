# Data source to read existing CloudFront distribution
# Note: This reads the distribution metadata but does NOT manage the distribution itself
data "aws_cloudfront_distribution" "existing" {
  id = var.cloudfront_distribution_id
}

# Origin Access Control for S3
# This is the modern replacement for Origin Access Identity (OAI)
resource "aws_cloudfront_origin_access_control" "finanzas_ui" {
  name                              = "finanzas-ui-oac"
  description                       = "Origin Access Control for Financial Planning UI S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront function to normalize Finanzas SPA paths
resource "aws_cloudfront_function" "finanzas_rewrite" {
  name    = "cloudfront-function-finanzas-rewrite"
  comment = "Finanzas SPA path normalization and SPA fallback rewrites"
  runtime = "cloudfront-js-1.0"
  code    = file("${path.module}/cloudfront-function-finanzas-rewrite.js")
  publish = true
}

# Cache policy for immutable assets (JS, CSS, images with hashes)
resource "aws_cloudfront_cache_policy" "finanzas_assets" {
  name        = "finanzas-assets-cache-policy"
  comment     = "Cache policy for immutable Financial Planning UI assets"
  default_ttl = 31536000 # 1 year
  max_ttl     = 31536000 # 1 year
  min_ttl     = 31536000 # 1 year

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# Cache policy for HTML files (short TTL for updates)
resource "aws_cloudfront_cache_policy" "finanzas_html" {
  name        = "finanzas-html-cache-policy"
  comment     = "Cache policy for Financial Planning UI HTML files"
  default_ttl = 0
  max_ttl     = 86400 # 1 day max
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# Output information about the S3 origin and OAC
output "s3_origin_config" {
  description = "Configuration for adding S3 origin to CloudFront"
  value = {
    origin_id                = "S3-${var.s3_bucket_name}"
    domain_name              = aws_s3_bucket.finanzas_ui.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.finanzas_ui.id
  }
}

output "cache_policy_ids" {
  description = "CloudFront cache policy IDs"
  value = {
    assets_cache_policy_id = aws_cloudfront_cache_policy.finanzas_assets.id
    html_cache_policy_id   = aws_cloudfront_cache_policy.finanzas_html.id
  }
}

output "cloudfront_behavior_config" {
  description = "Configuration for the /finanzas/* CloudFront behavior"
  value = {
    path_pattern           = "/finanzas/*"
    target_origin_id       = "S3-${var.s3_bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.finanzas_assets.id
    function_associations = [
      {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.finanzas_rewrite.arn
      }
    ]
  }
}

output "custom_error_responses" {
  description = "Custom error responses for SPA deep linking"
  value = [
    {
      error_code            = 403
      response_code         = 200
      response_page_path    = "/finanzas/index.html"
      error_caching_min_ttl = 0
    },
    {
      error_code            = 404
      response_code         = 200
      response_page_path    = "/finanzas/index.html"
      error_caching_min_ttl = 0
    }
  ]
}

output "finanzas_rewrite_function_arn" {
  description = "Published ARN for the Finanzas CloudFront rewrite function"
  value       = aws_cloudfront_function.finanzas_rewrite.arn
}

output "manual_cloudfront_update_instructions" {
  description = "Instructions for manually updating CloudFront distribution"
  value       = <<-EOT
    
    =====================================================
    MANUAL CLOUDFRONT CONFIGURATION REQUIRED
    =====================================================
    
    Terraform has created the S3 bucket and Origin Access Control.
    
    You need to manually add the following to CloudFront distribution ${var.cloudfront_distribution_id}:
    
    1. ADD NEW ORIGIN:
       - Origin Domain: ${aws_s3_bucket.finanzas_ui.bucket_regional_domain_name}
       - Origin ID: S3-${var.s3_bucket_name}
       - Origin Access: Origin Access Control
       - Origin Access Control: ${aws_cloudfront_origin_access_control.finanzas_ui.name} (${aws_cloudfront_origin_access_control.finanzas_ui.id})
    
    2. ADD NEW BEHAVIOR (order matters - place before default):
       - Path Pattern: /finanzas/*
       - Origin: S3-${var.s3_bucket_name}
       - Viewer Protocol Policy: Redirect HTTP to HTTPS
       - Allowed HTTP Methods: GET, HEAD, OPTIONS
       - Cached HTTP Methods: GET, HEAD
       - Cache Policy: ${aws_cloudfront_cache_policy.finanzas_assets.name}
       - Function Association (Viewer request): ${aws_cloudfront_function.finanzas_rewrite.name}
       - Compress Objects: Yes
    
    3. ADD CUSTOM ERROR RESPONSES (applies to entire distribution):
       - Error Code: 403 → Response Code: 200, Response Page: /finanzas/index.html
       - Error Code: 404 → Response Code: 200, Response Page: /finanzas/index.html
    
    4. VERIFY:
       - Existing behaviors and origins remain unchanged
       - New behavior is ordered before the default (*) behavior
    
    After applying these changes, the CI/CD workflow will be able to deploy to S3 and invalidate CloudFront.
    
    =====================================================
  EOT
}
