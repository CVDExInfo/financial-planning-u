output "s3_bucket_name" {
  description = "Name of the S3 bucket for Financial Planning UI"
  value       = aws_s3_bucket.finanzas_ui.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.finanzas_ui.arn
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.finanzas_ui.bucket_regional_domain_name
}

output "cloudfront_distribution_id" {
  description = "Existing CloudFront distribution ID"
  value       = var.cloudfront_distribution_id
}

output "deployment_url" {
  description = "URL where the Financial Planning UI will be accessible"
  value       = "https://${data.aws_cloudfront_distribution.existing.domain_name}/finanzas/"
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution for Finanzas (use for VITE_CLOUDFRONT_URL)"
  value       = "https://${data.aws_cloudfront_distribution.existing.domain_name}"
}
