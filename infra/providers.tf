terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-2"

  default_tags {
    tags = {
      Project     = "financial-planning-u"
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}

# CloudFront requires ACM certificates in us-east-1
# However, we are NOT creating/modifying certificates per requirements
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}
