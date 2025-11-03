# ADR-0002: Separate API Gateway per business domain (Finanzas SD)

**Status:** Accepted  
**Date:** 2025-11-03

## Context

Service Delivery (Finanzas SD) has distinct lifecycle, RBAC (Cognito group SDT), quotas, SLOs, and reporting requirements that warrant architectural isolation from other business domains.

Key considerations:
- The Finanzas SD domain operates independently with its own deployment cadence and rollback requirements
- Authentication and authorization differ from other modules, requiring SDT group membership in Cognito
- We host the UI under a shared CloudFront distribution at path `/finanzas/*`
- The API must support direct calls from the CloudFront-hosted frontend
- Separate cost tracking and quota management are required for financial compliance

## Decision

Create and maintain a dedicated API Gateway (`finanzas-sd-api`) for the SD domain.

Implementation details:
- **Mode A (Current)**: Frontend (CloudFront) calls API Gateway directly at `https://{apiId}.execute-api.us-east-2.amazonaws.com/{stage}/...`
- **Mode B (Optional Backlog)**: Proxy via CloudFront path `/api/finanzas/*` to API Gateway origin (deferred to reduce initial complexity)
- Region: us-east-2 for all components (API Gateway, Lambda, DynamoDB)
- Authentication: Cognito JWT with SDT group enforcement in handlers
- CORS: Configured to allow CloudFront origin `https://d7t9x3j66yd8k.cloudfront.net`

## Consequences

### Positive

- **Deployment Isolation**: Deploy and rollback Finanzas API independently without affecting other services
- **Cost Visibility**: Clear attribution of API Gateway, Lambda, and DynamoDB costs to Finanzas SD budget
- **Security Boundaries**: Dedicated WAF rules, throttling quotas, and usage plans specific to financial operations
- **Observability**: Separate CloudWatch dashboards, alarms, and logs for Finanzas SD
- **Team Autonomy**: Finanzas team can manage API lifecycle without cross-team coordination
- **Blast Radius Reduction**: Issues in Finanzas API don't impact other business domains

### Negative

- **Infrastructure Overhead**: Additional resources to provision and maintain (API Gateway, IAM roles, alarms)
- **Configuration Duplication**: Some CORS, authentication, and monitoring configs repeated across APIs
- **Slight Increase in Complexity**: Multiple APIs to manage instead of a monolithic gateway

## Alternatives Considered

### Single API for UI + SD (Rejected)

**Rationale**: Combining UI and Service Delivery domains in one API Gateway would create tight coupling, increase blast radius during deployments, and make cost attribution difficult. The lifecycle and authorization requirements are sufficiently different to warrant separation.

**Trade-off**: While a single API would reduce infrastructure overhead, the operational and organizational benefits of separation outweigh the marginal cost increase.

### CloudFront Proxy Only (Deferred)

**Rationale**: Implementing Mode B (CloudFront path `/api/finanzas/*` → API Gateway) adds configuration complexity in the CDN layer and introduces an additional network hop. We defer this until Mode A stabilizes and proves insufficient.

**Trade-off**: Direct API calls (Mode A) are simpler to implement and debug. If we later need unified domain handling or additional caching, we can implement Mode B without breaking Mode A clients.

## Rollout Plan

1. **Current State**: UI hosted at `/finanzas/*` on CloudFront (S3 origin) ✅
2. **API Setup**: Complete API Gateway provisioning with SAM template ✅
3. **CORS Configuration**: Enable CORS for CloudFront domain in API Gateway ✅
4. **SDT Enforcement**: Implement Cognito group checks in Lambda handlers 🚧
5. **Smoke Testing**: Validate health and catalog endpoints from CloudFront UI
6. **Production Deployment**: Roll out remaining API endpoints progressively

## Backlog

Future enhancements to consider:
- **Mode B Proxy**: CloudFront behavior `/api/finanzas/*` → API Gateway origin with custom headers and origin policy
- **Per-Route WAF**: Fine-grained WAF rules for sensitive endpoints (e.g., `/close-month`, `/payroll/ingest`)
- **Usage Plans**: API keys and throttling tiers for different client types
- **Multi-Region**: Deploy API Gateway in multiple regions for disaster recovery

## References

- [AWS API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)
- [CloudFront CORS Configuration](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/header-caching.html#header-caching-web-cors)
- [Cognito JWT Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- Repository: `services/finanzas-api/` (SAM template and Lambda handlers)
