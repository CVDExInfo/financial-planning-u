# Finanzas Service Delivery Architecture

**Version**: 1.0  
**Last Updated**: 2025-11-02  
**Status**: Active  
**Region**: us-east-2

---

## Overview

The Finanzas Service Delivery (SD) module provides comprehensive financial planning, budget tracking, and service delivery control capabilities. This document describes the architecture, components, data flow, and security model.

## Architecture Diagram

### Mode A: Direct API Gateway Access (Current Implementation)

```
┌──────────────────────────────────────────────────────────────────┐
│                          Internet / Users                         │
└───────────────┬──────────────────────────────────┬────────────────┘
                │                                  │
                │ HTTPS                            │ HTTPS (API calls)
                │                                  │
                ▼                                  ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│      CloudFront CDN           │   │   API Gateway (finanzas-sd-api)     │
│  d7t9x3j66yd8k.cloudfront.net │   │   {api-id}.execute-api.us-east-2... │
│                               │   │                                     │
│  Distribution: EPQU7PVDLQXUA  │   │   • HTTP API (low latency)          │
└───────────────┬───────────────┘   │   • Cognito JWT Authorizer          │
                │                   │   • CORS: CloudFront domain         │
                │ /finanzas/*       │   • Throttling & quotas             │
                ▼                   └─────────────┬───────────────────────┘
┌───────────────────────────────┐                │
│         S3 Bucket             │                │ JWT validation
│  financial-planning-ui-bucket │                │ (SDT group check)
│                               │                ▼
│  • Static UI assets           │   ┌─────────────────────────────────────┐
│  • Vite build output          │   │   AWS Cognito User Pool             │
│  • Cache: immutable + 0       │   │   us-east-2_FyHLtOhiY               │
│  • OAC for CloudFront         │   │                                     │
└───────────────────────────────┘   │   • Shared across modules           │
                                    │   • SDT group for Finanzas SD       │
                                    │   • JWT issuer validation           │
                                    └─────────────────────────────────────┘
                                                 │
                    ┌────────────────────────────┴─────────────────────┐
                    │                                                  │
                    ▼                                                  ▼
┌──────────────────────────────────────┐      ┌─────────────────────────────┐
│      Lambda Functions                │      │    DynamoDB Tables          │
│                                      │      │                             │
│  • HealthFn         (GET /health)    │◄────►│  • finz_projects            │
│  • ProjectsFn       (CRUD projects)  │      │  • finz_rubros              │
│  • CatalogFn        (GET rubros)     │      │  • finz_allocations         │
│  • AllocationsFn    (bulk allocate)  │      │  • finz_payroll_actuals     │
│  • PayrollFn        (ingest payroll) │      │  • finz_adjustments         │
│  • CloseMonthFn     (month close)    │      │  • finz_alerts              │
│  • AdjustmentsFn    (budget adjust)  │      │  • finz_providers           │
│  • AlertsFn         (GET alerts)     │      │  • finz_audit_log           │
│  • ProvidersFn      (CRUD providers) │      │                             │
│  • PrefacturasFn    (webhook)        │      │  Billing: PAY_PER_REQUEST   │
│  • HandoffFn        (project handoff)│      │  GSI: As needed per table   │
│                                      │      │                             │
│  Runtime: Node.js 20.x               │      └─────────────────────────────┘
│  Build: esbuild + sourcemaps         │
│  Tracing: X-Ray enabled              │
└──────────────────┬───────────────────┘
                   │
                   │ (scheduled monthly)
                   ▼
┌──────────────────────────────────────┐
│    EventBridge Rule (PEP-3)          │
│                                      │
│  Schedule: cron(0 8 1 * ? *)         │
│  Target: AlertsPep3Fn                │
│  Purpose: Monthly budget variance    │
│           alert generation           │
└──────────────────────────────────────┘
```

### Mode B: CloudFront API Proxy (Optional Enhancement - Backlog)

```
┌──────────────────────────────────────────────────────────────────┐
│                          Internet / Users                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS (single domain)
                            ▼
        ┌────────────────────────────────────────────┐
        │      CloudFront CDN                        │
        │  d7t9x3j66yd8k.cloudfront.net              │
        │                                            │
        │  Behaviors:                                │
        │    /finanzas/*      → S3 Origin (UI)       │
        │    /api/finanzas/*  → API Gateway Origin   │
        │                                            │
        │  Origin Request Policy:                    │
        │    • Forward Authorization header          │
        │    • Forward all query strings             │
        │    • Cache policy: API responses           │
        └──────────────┬──────────────┬──────────────┘
                       │              │
          /finanzas/*  │              │ /api/finanzas/*
                       ▼              ▼
              ┌────────────┐   ┌──────────────────┐
              │  S3 Bucket │   │  API Gateway     │
              │    (UI)    │   │ (finanzas-sd-api)│
              └────────────┘   └──────────────────┘
```

**Note**: Mode B is documented for future consideration. It requires:
- Additional CloudFront behavior configuration
- Origin request policy for `Authorization` header forwarding
- CORS updates to accept CloudFront domain
- Testing of caching behavior for API responses

**Current Status**: Not implemented. Tracked as backlog item for potential performance optimization.

---

## Components

### 1. CloudFront Distribution

**Domain**: `d7t9x3j66yd8k.cloudfront.net`  
**ID**: `EPQU7PVDLQXUA`  
**Region**: Global (edge locations)

**Purpose**: Serve static UI assets with low latency and high availability.

**Configuration**:
- **Origin**: S3 bucket (financial-planning-ui-bucket)
- **Origin Access Control (OAC)**: Enabled for secure S3 access
- **Path Pattern**: `/finanzas/*`
- **Cache Behaviors**:
  - Immutable assets (JS, CSS, images): `max-age=31536000`
  - HTML files: `max-age=0, must-revalidate`
- **Security**: HTTPS only, TLS 1.2+

**Deployment**:
- Managed via GitHub Actions workflow: `.github/workflows/deploy.yml`
- Cache invalidation on each deployment: `/finanzas/*`

### 2. API Gateway (finanzas-sd-api)

**Type**: HTTP API (AWS::Serverless::HttpApi)  
**Region**: us-east-2  
**Stage**: dev (default)

**Purpose**: Route HTTP requests to Lambda functions with JWT authentication.

**Features**:
- **Low latency**: HTTP API optimized for serverless workloads
- **Pay-per-request**: No upfront costs, scales automatically
- **Built-in CORS**: Configured for CloudFront domain
- **JWT Authorizer**: Validates Cognito tokens
- **Metrics & Logging**: CloudWatch integration

**CORS Configuration**:
```yaml
AllowOrigins:
  - https://d7t9x3j66yd8k.cloudfront.net
AllowMethods: [GET, POST, PUT, OPTIONS]
AllowHeaders: ['Authorization', 'Content-Type']
MaxAge: 3600
```

**Endpoints**:
```
GET     /health                          → HealthFn (no auth)
GET     /catalog/rubros                  → CatalogFn (no auth)
POST    /projects                        → ProjectsFn (JWT + SDT)
GET     /projects                        → ProjectsFn (JWT + SDT)
POST    /projects/{id}/handoff           → HandoffFn (JWT + SDT)
POST    /projects/{id}/rubros            → RubrosFn (JWT + SDT)
GET     /projects/{id}/rubros            → RubrosFn (JWT + SDT)
PUT     /projects/{id}/allocations:bulk  → AllocationsFn (JWT + SDT)
GET     /projects/{id}/plan              → PlanFn (JWT + SDT)
POST    /payroll/ingest                  → PayrollFn (JWT + SDT)
POST    /close-month                     → CloseMonthFn (JWT + SDT)
POST    /adjustments                     → AdjustmentsFn (JWT + SDT)
GET     /adjustments                     → AdjustmentsFn (JWT + SDT)
GET     /alerts                          → AlertsFn (JWT + SDT)
POST    /providers                       → ProvidersFn (JWT + SDT)
GET     /providers                       → ProvidersFn (JWT + SDT)
POST    /prefacturas/webhook             → PrefacturasFn (JWT + SDT)
GET     /prefacturas/webhook             → PrefacturasFn (JWT + SDT)
```

**Authorization**:
- **Public endpoints**: `/health`, `/catalog/rubros`
- **Protected endpoints**: All others require valid JWT with `SDT` group membership

### 3. AWS Cognito

**User Pool ID**: `us-east-2_FyHLtOhiY`  
**Region**: us-east-2  
**Shared**: Yes (across multiple modules)

**Purpose**: Centralized identity and access management.

**Configuration**:
- **App Client**: Dedicated client for Finanzas SD UI
- **Groups**: `SDT` (Service Delivery Team) for financial operations
- **Token Lifetime**: Configurable (default: 1 hour access, 7 days refresh)
- **MFA**: Optional (recommended for production)

**JWT Claims**:
```json
{
  "sub": "user-uuid",
  "cognito:username": "john.doe",
  "cognito:groups": ["SDT"],
  "email": "john.doe@example.com",
  "iss": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY",
  "aud": "client-id",
  "exp": 1699999999
}
```

**Group Validation**: Lambda functions check `event.requestContext.authorizer.jwt.claims['cognito:groups']` includes `"SDT"`.

### 4. Lambda Functions

**Runtime**: Node.js 20.x  
**Architecture**: x86_64  
**Memory**: 256 MB (default, tunable per function)  
**Timeout**: 15 seconds  
**Build Tool**: esbuild (TypeScript → JavaScript with source maps)

**Environment Variables**:
```bash
TABLE_PROJECTS=finz_projects
TABLE_RUBROS=finz_rubros
TABLE_ALLOC=finz_allocations
TABLE_PAYROLL=finz_payroll_actuals
TABLE_ADJ=finz_adjustments
TABLE_ALERTS=finz_alerts
TABLE_PROVIDERS=finz_providers
TABLE_AUDIT=finz_audit_log
```

**IAM Policies**:
- Each function has least-privilege IAM policies
- DynamoDB: CRUD policies scoped to specific tables
- CloudWatch Logs: Write permissions
- X-Ray: Trace permissions

**Observability**:
- **Logs**: CloudWatch Logs (auto-created log groups)
- **Metrics**: Lambda metrics (invocations, errors, duration, throttles)
- **Tracing**: X-Ray enabled for distributed tracing

### 5. DynamoDB Tables

**Billing Mode**: PAY_PER_REQUEST (on-demand)  
**Table Prefix**: `finz_`  
**Region**: us-east-2

**Tables**:
1. **finz_projects**: Project master data
   - PK: `PROJECT#{projectId}`, SK: `METADATA`
   - Attributes: cliente, nombre, fecha_inicio, fecha_fin, moneda, estado
2. **finz_rubros**: Budget line items (rubros)
   - PK: `PROJECT#{projectId}`, SK: `RUBRO#{rubroId}`
3. **finz_allocations**: Monthly budget allocations
   - PK: `PROJECT#{projectId}`, SK: `ALLOC#{rubroId}#{YYYY-MM}`
4. **finz_payroll_actuals**: Monthly payroll actuals
   - PK: `PROJECT#{projectId}`, SK: `PAYROLL#{YYYY-MM}#{empleadoId}`
5. **finz_adjustments**: Budget adjustments and reallocations
   - PK: `PROJECT#{projectId}`, SK: `ADJ#{adjustmentId}`
6. **finz_alerts**: Budget variance alerts
   - PK: `PROJECT#{projectId}`, SK: `ALERT#{alertId}`
7. **finz_providers**: Provider/vendor master data
   - PK: `PROVIDER#{providerId}`, SK: `METADATA`
8. **finz_audit_log**: Audit trail for all operations
   - PK: `AUDIT#{entityType}#{entityId}`, SK: `TIMESTAMP#{iso8601}`

**Key Schema**: Single-table design with PK/SK for flexibility and cost optimization.

### 6. EventBridge (PEP-3 Monthly Alerts)

**Rule**: `Pep3Rule`  
**Schedule**: `cron(0 8 1 * ? *)` (Monthly, 1st day at 8 AM UTC)  
**Target**: `AlertsPep3Fn` Lambda

**Purpose**: Generate monthly budget variance alerts for projects exceeding thresholds.

**Logic** (to be implemented in AlertsPep3Fn):
1. Query all active projects
2. Calculate budget vs. actuals for each project
3. Identify projects with variance > threshold (e.g., ±10%)
4. Create alert records in `finz_alerts` table
5. (Optional) Send notifications via SNS/SES

---

## Data Flow

### 1. User Authentication
```
User → CloudFront (/finanzas) → S3 (UI loads)
  → UI redirects to Cognito (OAuth2 flow)
  → Cognito authenticates user
  → UI receives JWT (access + refresh tokens)
  → UI stores tokens in memory/sessionStorage
```

### 2. API Request (Protected Endpoint)
```
UI (with JWT) → API Gateway
  → API Gateway validates JWT with Cognito issuer
  → Extracts `cognito:groups` claim
  → Invokes Lambda with claims in event.requestContext
  → Lambda validates SDT group membership
  → Lambda processes request (DynamoDB CRUD)
  → Lambda returns response
  → API Gateway returns to UI
```

### 3. Health Check (Public Endpoint)
```
Monitoring Tool → API Gateway (/health)
  → API Gateway invokes HealthFn (no auth)
  → HealthFn returns { status: "ok", timestamp: "..." }
```

### 4. Monthly Alert Generation (EventBridge)
```
EventBridge (cron) → AlertsPep3Fn
  → Query finz_projects (active)
  → Query finz_allocations (budget)
  → Query finz_payroll_actuals (actuals)
  → Calculate variance
  → Write alerts to finz_alerts
  → (Optional) Publish to SNS topic
```

---

## Security Model

### 1. Authentication & Authorization

**Authentication**: AWS Cognito JWT tokens (OAuth2 / OIDC)
- **Token Type**: Bearer token in `Authorization` header
- **Validation**: API Gateway built-in JWT authorizer
- **Issuer**: `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY`

**Authorization**: Group-based RBAC
- **Group**: `SDT` (Service Delivery Team)
- **Enforcement**: Lambda functions check `cognito:groups` claim
- **Failure**: HTTP 403 Forbidden if group not present

### 2. Network Security

**CloudFront**:
- HTTPS only (no HTTP)
- TLS 1.2+ enforced
- Origin Access Control (OAC) for S3
- Geo-restrictions: (optional, configurable)

**API Gateway**:
- HTTPS only
- CORS restricted to CloudFront domain
- Throttling: (configurable, default limits apply)
- WAF: (optional, for DDoS protection)

**DynamoDB**:
- Private VPC endpoint (optional)
- IAM-based access control
- Encryption at rest (AWS-managed keys)
- Point-in-time recovery: (optional, recommended for prod)

### 3. IAM Policies

**Lambda Execution Roles**:
- Least-privilege principle
- Scoped to specific tables
- No wildcard actions unless necessary

**CI/CD (GitHub Actions)**:
- OIDC-based authentication (no static keys)
- Role assumption with session limits
- Scoped to deployment actions only

### 4. Data Protection

**Encryption**:
- **In Transit**: TLS 1.2+ for all connections
- **At Rest**: DynamoDB encryption (AWS-managed KMS keys)
- **S3**: Server-side encryption (AES-256)

**Audit Trail**:
- All mutations logged to `finz_audit_log`
- CloudWatch Logs for API access
- X-Ray traces for debugging

---

## Deployment

### CI/CD Pipelines

**API Deployment**: `.github/workflows/deploy-api.yml`
- Trigger: Push to `module/finanzas-api-mvp` branch
- Steps:
  1. Checkout code
  2. Preflight checks (env vars)
  3. Configure AWS via OIDC
  4. Install SAM CLI
  5. Build Lambda functions (npm ci + sam build)
  6. Deploy stack (sam deploy)
  7. Smoke test (`/health`, `/catalog/rubros`)
  8. Output API URL to GitHub summary

**UI Deployment**: `.github/workflows/deploy.yml`
- Trigger: Push to `main` branch
- Steps:
  1. Preflight checks (VITE_* env vars)
  2. Checkout code
  3. Install dependencies (npm ci)
  4. Build UI (npm run build)
  5. Configure AWS via OIDC
  6. Upload to S3 (aws s3 sync)
  7. Invalidate CloudFront cache (`/finanzas/*`)

### Environment Variables

**API Workflow**:
- `AWS_REGION`: us-east-2
- `FINZ_API_STACK`: finanzas-sd-api-dev
- `FINZ_API_STAGE`: dev
- `COGNITO_USER_POOL_ID`: us-east-2_FyHLtOhiY
- `COGNITO_USER_POOL_ARN`: arn:aws:cognito-idp:us-east-2:...:userpool/us-east-2_FyHLtOhiY

**UI Workflow**:
- `AWS_REGION`: us-east-2
- `S3_BUCKET`: financial-planning-ui-bucket
- `CLOUDFRONT_DIST_ID`: EPQU7PVDLQXUA
- `DISTRIBUTION_DOMAIN_NAME`: d7t9x3j66yd8k.cloudfront.net
- `VITE_API_BASE_URL`: https://{api-id}.execute-api.us-east-2.amazonaws.com/dev
- `VITE_ACTA_API_ID`: (Acta API integration)

---

## Monitoring & Observability

### CloudWatch Dashboards
- **API Metrics**: Request count, latency (p50, p99), error rate, throttles
- **Lambda Metrics**: Invocations, duration, errors, concurrent executions
- **DynamoDB Metrics**: Read/write capacity consumption, throttled requests

### Alarms
- **API 5xx Errors**: Alert if error rate > 1% for 5 minutes
- **Lambda Errors**: Alert if error count > 10 in 5 minutes
- **DynamoDB Throttles**: Alert on any throttled requests

### X-Ray Tracing
- Enabled for all Lambda functions
- Trace API Gateway → Lambda → DynamoDB
- Visualize latency bottlenecks and errors

### Logging
- **API Gateway Logs**: Access logs with request ID, latency, status
- **Lambda Logs**: Structured JSON logging with correlation IDs
- **Audit Log**: All write operations logged to `finz_audit_log`

---

## Cost Optimization

### Estimates (Development Environment)
- **API Gateway**: ~$1/million requests (HTTP API)
- **Lambda**: Free tier covers most dev workloads
- **DynamoDB**: PAY_PER_REQUEST ~$1.25/million reads, $6.25/million writes
- **CloudFront**: ~$0.085/GB (first 10TB)
- **S3**: ~$0.023/GB storage + $0.005/1k GET requests

**Expected Monthly Cost (Dev)**: < $10/month with typical development traffic.

### Optimization Strategies
1. **API Gateway**: Use HTTP API (cheaper than REST API)
2. **Lambda**: Right-size memory (256 MB default)
3. **DynamoDB**: On-demand billing for unpredictable workloads
4. **CloudFront**: Cache aggressively for static assets
5. **S3**: Lifecycle policies for old versions (optional)

---

## Disaster Recovery

### Backup Strategy
- **DynamoDB**: Point-in-time recovery (optional, enable for prod)
- **S3**: Versioning enabled for rollback
- **Code**: Git repository is source of truth

### Rollback Procedures
**API**: Redeploy previous stack version via `sam deploy` with older commit
**UI**: Restore previous S3 object versions and invalidate cache

**RTO**: < 15 minutes (Recovery Time Objective)  
**RPO**: < 5 minutes (Recovery Point Objective - DynamoDB PITR)

---

## Future Enhancements

### Short-Term (Next 3 months)
- [ ] Implement Mode B (CloudFront API proxy) for latency optimization
- [ ] Add WAF rules for DDoS protection
- [ ] Enable DynamoDB PITR for production environment
- [ ] Implement PEP-3 monthly alert logic in AlertsPep3Fn

### Mid-Term (3-6 months)
- [ ] Multi-region deployment for high availability
- [ ] Custom domain for API Gateway (e.g., `api.finanzas.example.com`)
- [ ] Advanced caching strategies (API Gateway caching, Lambda@Edge)
- [ ] Integration with external accounting systems (SAP, QuickBooks)

### Long-Term (6-12 months)
- [ ] Real-time budget alerts via WebSockets (API Gateway WebSocket API)
- [ ] Machine learning for budget forecasting
- [ ] GraphQL API for flexible client queries
- [ ] Mobile app integration

---

## References

- [ADR-0002: Separate API Gateway](../adr/ADR-0002-separate-api-gateway-finanzas.md)
- [SAM Template](../../services/finanzas-api/template.yaml)
- [OpenAPI Specification](../../openapi/finanzas.yaml)
- [Deploy API Workflow](../../.github/workflows/deploy-api.yml)
- [Deploy UI Workflow](../../.github/workflows/deploy.yml)
- [API Contracts](../api-contracts.md)
- [Auth Usage](../auth-usage.md)
- [Environment Config](../environment-config.md)

---

**Maintained by**: Service Delivery Team (SDT)  
**Review Cadence**: Quarterly or as needed for major changes
