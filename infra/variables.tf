variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
  default     = "703671891952"
}

variable "s3_bucket_name" {
  description = "S3 bucket name for Financial Planning UI"
  type        = string
  default     = "ukusi-ui-finanzas-prod"
}

variable "cloudfront_distribution_id" {
  description = "Existing CloudFront distribution ID"
  type        = string
  default     = "EPQU7PVDLQXUA"
}
