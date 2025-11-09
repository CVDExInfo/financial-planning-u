# Operational Runbooks

This directory contains operational runbooks for the Financial Planning U platform, with a focus on the Finanzas SD module.

## Available Runbooks

### [Unified CloudFront & AVP Deployment](./cloudfront-avp-unified-deployment.md)

**Purpose:** Complete step-by-step guide for deploying the CloudFront distribution update and AVP policy store integration.

**When to use:**
- Initial setup of CloudFront proxy for Finanzas API
- Deploying AVP policy store for fine-grained authorization
- Integrating Cognito with AVP for token-based authorization
- Full production deployment of Finanzas SD infrastructure

**Phases covered:**
1. CloudFront Distribution Update (API proxy configuration)
2. AVP Policy Store Deployment (Cedar policies)
3. Cognito Identity Source Binding (manual step)
4. API Redeployment with AVP Integration

**Estimated time:** 45-60 minutes

---

### [CloudFront CDN Proxy](./cdn-proxy.md)

**Purpose:** Detailed documentation of the CloudFront distribution configuration that proxies the Finanzas API.

**When to use:**
- Understanding the CloudFront routing architecture
- Troubleshooting CDN-related issues
- Updating CORS configuration
- Rollback procedures for CloudFront changes

**Key topics:**
- Routing configuration (UI vs API traffic)
- Path rewrite function logic
- CORS configuration and security
- Authorization header forwarding
- Verification and smoke tests

---

### [Finanzas Access Diagnostics](./finanzas-access-diagnostics.md)

**Purpose:** Diagnostic procedures for troubleshooting access and authentication issues in the Finanzas module.

**When to use:**
- Users reporting 403 Forbidden errors
- Authentication flow failures
- Authorization policy debugging
- Cognito integration issues

---

## Quick Reference

### Common Operations

| Operation | Runbook | Section |
|-----------|---------|---------|
| Deploy new environment | [Unified Deployment](./cloudfront-avp-unified-deployment.md) | Complete guide |
| Update CloudFront only | [Unified Deployment](./cloudfront-avp-unified-deployment.md) | Phase 1 |
| Deploy AVP policies | [Unified Deployment](./cloudfront-avp-unified-deployment.md) | Phase 2 |
| Bind Cognito to AVP | [Unified Deployment](./cloudfront-avp-unified-deployment.md) | Phase 3 |
| Rollback CloudFront | [CDN Proxy](./cdn-proxy.md) | Rollback Procedures |
| Debug 403 errors | [Access Diagnostics](./finanzas-access-diagnostics.md) | - |
| Update CORS | [CDN Proxy](./cdn-proxy.md) | Updating CORS |

### Key Workflows

| Workflow | File | Documentation |
|----------|------|---------------|
| Update CloudFront | `.github/workflows/update-cloudfront.yml` | [Unified Deployment](./cloudfront-avp-unified-deployment.md#phase-1-cloudfront-distribution-update) |
| Deploy AVP | `.github/workflows/deploy-avp.yml` | [Unified Deployment](./cloudfront-avp-unified-deployment.md#phase-2-avp-policy-store-deployment) |
| Deploy API | `.github/workflows/deploy-api.yml` | [Unified Deployment](./cloudfront-avp-unified-deployment.md#phase-4-api-redeployment-with-avp-integration) |

### Key Resources

| Resource | Value | Environment |
|----------|-------|-------------|
| CloudFront Distribution ID | `EPQU7PVDLQXUA` | All |
| CloudFront Domain | `d7t9x3j66yd8k.cloudfront.net` | All |
| API Gateway ID | `m3g6am67aj` | dev |
| API Stage | `dev` | dev |
| Region | `us-east-2` | All |
| API Stack Name | `finanzas-sd-api-dev` | dev |
| AVP Stack Name | `finanzas-avp-dev` | dev |

---

## Contributing

When adding new runbooks:

1. Use clear, descriptive titles
2. Include a "Purpose" and "When to use" section
3. Provide step-by-step instructions with expected outputs
4. Include verification procedures
5. Add troubleshooting guidance
6. Reference related documentation
7. Update this README with a link to your runbook

## Related Documentation

- [Deployment Guide](../deploy.md) - General deployment instructions
- [API Contracts](../api-contracts.md) - API specifications
- [Authentication Flow](../../AUTHENTICATION_FLOW.md) - Auth architecture
- [Environment Config](../environment-config.md) - Environment variables
- [AVP Deployment Guide](../../services/finanzas-api/AVP_DEPLOYMENT_GUIDE.md) - AVP-specific details
