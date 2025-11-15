#!/bin/bash
# AWS Credentials Setup for DynamoDB Access
# Run this script to configure AWS credentials for the dev container

set -e

echo "🔐 AWS Credentials Setup"
echo "========================"
echo ""

# Check if credentials are already configured
if aws sts get-caller-identity &>/dev/null; then
    echo "✅ AWS credentials already configured!"
    aws sts get-caller-identity
    exit 0
fi

echo "⚠️  AWS credentials not found. Please set up credentials using ONE of these methods:"
echo ""
echo "METHOD 1: Export environment variables (Temporary - current session only)"
echo "--------------------------------------------------------------------------"
echo "export AWS_ACCESS_KEY_ID=your_access_key_id"
echo "export AWS_SECRET_ACCESS_KEY=your_secret_access_key"
echo "export AWS_DEFAULT_REGION=us-east-2"
echo ""

echo "METHOD 2: Configure AWS CLI (Persistent)"
echo "-----------------------------------------"
echo "aws configure"
echo "  AWS Access Key ID: [paste your key]"
echo "  AWS Secret Access Key: [paste your secret]"
echo "  Default region name: us-east-2"
echo "  Default output format: json"
echo ""

echo "METHOD 3: Use GitHub OIDC (For GitHub Actions)"
echo "-----------------------------------------------"
echo "Already configured via GitHub Actions OIDC token"
echo "Role ARN: arn:aws:iam::703671891952:role/ProjectplaceLambdaRole"
echo ""

echo "After configuring, verify with:"
echo "  aws sts get-caller-identity"
echo ""

# If running in GitHub Codespaces, provide specific instructions
if [ -n "$CODESPACES" ]; then
    echo "📍 Running in GitHub Codespaces"
    echo "-------------------------------"
    echo "Use Codespaces secrets to store AWS credentials:"
    echo "1. Go to: https://github.com/settings/codespaces"
    echo "2. Add secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    echo "3. Restart this Codespace"
    echo ""
fi
