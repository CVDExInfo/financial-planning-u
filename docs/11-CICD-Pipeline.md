# Finanzas SD - CI/CD Pipeline Documentation

**Version:** 1.0  
**Last Updated:** November 10, 2025  
**CI/CD Platform:** GitHub Actions  
**Deployment Tool:** AWS SAM (Serverless Application Model)

---

## Overview

The Finanzas SD CI/CD pipeline uses **GitHub Actions** with **OIDC authentication** to AWS, eliminating the need for long-lived credentials. The pipeline implements multi-stage deployment (dev → staging → production) with automated testing, security scanning, and rollback capabilities.

## CI/CD Pipeline Diagram

![CI/CD Pipeline](../docs/diagrams/02-cicd-pipeline.png){ width=100% }

*Figure 1: Multi-stage CI/CD pipeline with GitHub Actions, AWS OIDC, and SAM deployment*

---

## Pipeline Stages

### 1. Source Control (GitHub)
- **Repository**: `valencia94/financial-planning-u`
- **Branch Strategy**:
  - `main` → Production deploys
  - `staging` → Staging deploys
  - `dev` → Development deploys
  - `feature/*` → Feature branches (PR validation only)
- **Branch Protection**: Requires PR approval, status checks must pass

### 2. CI - Frontend Pipeline
**Workflow**: `.github/workflows/deploy-ui.yml`

```yaml
Steps:
1. Lint & Type Check (ESLint + TypeScript)
2. Unit Tests (Vitest) 
3. Build SPA (Vite production build)
4. Security Scan (npm audit, Snyk)
```

**Build Outputs**:
- Minified JavaScript bundles
- Optimized CSS (Tailwind)
- Static assets (images, fonts)
- `index.html` with hash-based filenames

### 3. CI - Backend Pipeline
**Workflow**: `.github/workflows/deploy-api.yml`

```yaml
Steps:
1. SAM Validate (template.yaml syntax)
2. OpenAPI Lint (Spectral rules)
3. Integration Tests (Lambda tests)
4. SAM Build (package Lambda functions)
5. Security Scan (CodeQL, Checkov IaC)
```

### 4. CI - Documentation Pipeline
**Workflow**: `.github/workflows/docs-generator.yml`

```yaml
Steps:
1. Validate Diagrams (Mermaid syntax)
2. Render Diagrams (PNG/SVG export)
3. Generate Documentation (Pandoc PDF/HTML)
4. Package for Distribution (ZIP archive)
```

---

## OIDC Authentication to AWS

### Configuration

**Trust Policy** (GitHub OIDC Provider):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:valencia94/financial-planning-u:*"
      }
    }
  }]
}
```

**GitHub Action Step**:
```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.OIDC_AWS_ROLE_ARN }}
    aws-region: us-east-2
```

**Benefits**:
- No long-lived AWS access keys
- Automatic credential rotation
- Scoped permissions per workflow
- Audit trail via CloudTrail

---

## Deployment Environments

### Development
- **Trigger**: Auto-deploy on push to `dev` branch
- **Approval**: Not required
- **Testing**: Smoke tests only
- **CloudFront**: `https://dev-finanzas.cloudfront.net`
- **API**: `https://xxx.execute-api.us-east-2.amazonaws.com/dev`

### Staging
- **Trigger**: Manual promotion from dev
- **Approval**: Tech Lead required
- **Testing**: Full E2E test suite + Postman collection
- **CloudFront**: `https://staging-finanzas.cloudfront.net`
- **API**: `https://xxx.execute-api.us-east-2.amazonaws.com/staging`

### Production
- **Trigger**: Manual promotion from staging
- **Approval**: Tech Lead + QA sign-off required
- **Testing**: Smoke tests + synthetic monitoring
- **CloudFront**: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- **API**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod`
- **Rollback**: Automatic on CloudFormation failure

---

## Deployment Steps

### Frontend Deployment (S3 + CloudFront)

```bash
# 1. Build SPA
npm run build:finanzas

# 2. Sync to S3
aws s3 sync dist/finanzas/ s3://finanzas-ui-prod/finanzas/ \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "index.html"

# 3. Upload index.html with no-cache
aws s3 cp dist/finanzas/index.html s3://finanzas-ui-prod/finanzas/index.html \
  --cache-control "no-cache"

# 4. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/finanzas/*"
```

### Backend Deployment (SAM)

```bash
# 1. Build Lambda functions
sam build --use-container

# 2. Package (upload to S3)
sam package \
  --s3-bucket finanzas-deployment-artifacts \
  --output-template-file packaged.yaml

# 3. Deploy (CloudFormation)
sam deploy \
  --template-file packaged.yaml \
  --stack-name finanzas-api-prod \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      StageName=prod \
      CognitoUserPoolArn=$COGNITO_ARN \
      AllowedCorsOrigin=$CLOUDFRONT_URL

# 4. Post-deployment tests
npm run test:smoke
```

---

## Quality Gates

### Pre-Deployment Checks
- [ ] All tests passing (unit + integration)
- [ ] Code coverage > 70%
- [ ] No high/critical security vulnerabilities
- [ ] OpenAPI contract validation passed
- [ ] SAM template validation passed

### Post-Deployment Validation
- [ ] Health check endpoint returns 200
- [ ] Smoke tests pass (critical paths)
- [ ] CloudWatch alarms not triggering
- [ ] X-Ray traces showing normal latency
- [ ] No increase in error rates

---

## Rollback Strategy

### Automatic Rollback (CloudFormation)
- Triggered on stack update failure
- Reverts to previous stable state
- Preserves data in DynamoDB
- Notifications sent to SNS topic

### Manual Rollback (Frontend)
```bash
# Restore previous S3 version
aws s3api list-object-versions \
  --bucket finanzas-ui-prod \
  --prefix finanzas/ \
  | jq -r '.Versions[1].VersionId'

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/finanzas/*"
```

### Manual Rollback (Backend)
```bash
# Rollback CloudFormation stack
aws cloudformation rollback-stack \
  --stack-name finanzas-api-prod

# Or redeploy previous template
sam deploy \
  --template-file previous-packaged.yaml \
  --stack-name finanzas-api-prod \
  --no-confirm-changeset
```

---

## Monitoring & Alerts

### Deployment Notifications
- **Slack**: Build status, deployment results
- **Email**: Failures and security issues
- **GitHub Actions Summary**: Detailed step-by-step results

### Post-Deployment Monitoring
- CloudWatch Synthetics canary (every 5 minutes)
- API Gateway 4xx/5xx error rate
- Lambda duration and error metrics
- DynamoDB throttled requests

---

## Security Scanning

### Frontend Security
- **npm audit**: Checks for known vulnerabilities
- **Snyk**: Continuous monitoring
- **Dependabot**: Automated dependency updates

### Backend Security
- **CodeQL**: Static application security testing (SAST)
- **Checkov**: Infrastructure as Code (IaC) scanning
- **SAM Policy Templates**: Least privilege IAM roles

### Compliance
- All API calls logged to CloudTrail
- No secrets in code (Secrets Manager)
- Encryption at rest and in transit
- Regular dependency updates

---

## Performance Optimization

### Build Optimizations
- **Vite**: Tree-shaking, code splitting
- **Tailwind CSS**: PurgeCSS removes unused styles
- **Lambda**: Minified TypeScript, source maps disabled
- **Dependencies**: Production-only packages in Docker image

### Deployment Optimizations
- **S3 Sync**: Only changed files uploaded
- **CloudFront Invalidation**: Specific paths only
- **SAM Deploy**: Only changed resources updated
- **Parallel Execution**: Frontend + Backend deployed simultaneously

---

## Troubleshooting

### Common Issues

**Issue**: CloudFormation stack stuck in UPDATE_ROLLBACK_FAILED
```bash
# Solution: Continue rollback
aws cloudformation continue-update-rollback \
  --stack-name finanzas-api-prod
```

**Issue**: Lambda function out of memory
```bash
# Solution: Increase memory in template.yaml
MemorySize: 512  # Increased from 256
```

**Issue**: API Gateway 403 Forbidden
```bash
# Solution: Check custom authorizer cache
# Clear cache by redeploying with updated authorizer
```

---

## Related Documentation

- [AWS Architecture](10-Architecture-AWS.md)
- [Runbook](20-Runbook.md)
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)

---

**Last Updated**: 2025-11-10  
**Maintained By**: Platform Team
