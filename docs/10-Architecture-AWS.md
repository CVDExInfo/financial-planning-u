# Finanzas SD - AWS Architecture

**Version:** 1.0  
**Last Updated:** November 10, 2025  
**AWS Region:** us-east-2 (Ohio)  
**Architecture Style:** Serverless Web Application

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Details](#component-details)
3. [Data Flow](#data-flow)
4. [Security Architecture](#security-architecture)
5. [Scalability & Performance](#scalability--performance)
6. [Cost Optimization](#cost-optimization)

---

## Architecture Overview

Finanzas SD is built on AWS serverless architecture following the **AWS Well-Architected Framework** principles. The system uses a layered approach with clear separation of concerns across presentation, API, business logic, and data layers.

### High-Level Architecture Diagram

![AWS Architecture Overview](../docs/diagrams/01-aws-architecture-overview.png){ width=100% }

*Figure 1: AWS Architecture Overview - Shows the complete serverless stack with CloudFront CDN, API Gateway, Lambda functions, DynamoDB tables, and external integrations.*

---

## Component Details

### 1. Global Edge & CDN Layer

#### CloudFront Distribution
- **Distribution ID**: `d7t9x3j66yd8k.cloudfront.net`
- **Path Pattern**: `/finanzas/*` → Routes to S3 origin
- **SSL/TLS**: ACM certificate with TLS 1.3
- **Caching**: Browser cache 1 hour, edge cache 24 hours
- **Compression**: Gzip/Brotli enabled
- **WAF**: Rate limiting (10,000 req/sec), SQL injection filter, XSS protection

#### S3 UI Bucket
- **Bucket**: Private (no public access)
- **Access Control**: Origin Access Control (OAC) only
- **Encryption**: AES-256 server-side
- **Versioning**: Enabled (previous versions retained)
- **Contents**: React 19 SPA, static assets (JS, CSS, images)
- **Error Handling**: Custom 404/403 → `/finanzas/index.html` for SPA routing

---

### 2. Authentication & Authorization Layer

#### AWS Cognito User Pool
- **Pool ID**: `us-east-2_FyHLtOhiY`
- **Client ID**: `dshos5iou44tuach7ta3ici5m`
- **Authentication Methods**:
  - Username/password (USER_PASSWORD_AUTH)
  - OAuth 2.0 implicit flow (Hosted UI)
- **MFA**: Optional (SMS or TOTP)
- **Password Policy**: Min 8 chars, uppercase, lowercase, numbers, symbols
- **Groups**: PMO, SDMT, VENDOR, EXEC_RO, FINANCE
- **Token Expiry**: Access 1 hour, Refresh 30 days

#### Amazon Verified Permissions (AVP)
- **Policy Store ID**: Configured via SAM parameter
- **Policy Language**: Cedar
- **Resources**: Project, Budget, Forecast, Invoice, Catalog
- **Actions**: View, Create, Update, Delete, Approve, Send
- **Authorization Model**: RBAC with resource-level permissions

---

### 3. API Gateway Layer

#### API Gateway REST
- **Endpoint**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- **API Name**: `finanzas-api`
- **Stage**: dev, staging, prod
- **Throttling**: 10,000 requests per second, burst 5,000
- **Integration**: Lambda proxy integration
- **CORS**: Enabled for CloudFront origin
- **Logging**: CloudWatch Logs (14-day retention)

#### Custom Authorizer Lambda
- **Function**: JWT token validation
- **Cache TTL**: 5 minutes (300 seconds)
- **Validation**: Token signature, expiry, issuer
- **AVP Integration**: Permission check for resource access
- **Performance**: < 50ms authorization latency

---

### 4. Business Logic Layer (Lambda Functions)

All Lambda functions use:
- **Runtime**: Node.js 20.x
- **Architecture**: x86_64
- **Memory**: 256 MB (configurable per function)
- **Timeout**: 15 seconds
- **Tracing**: X-Ray active
- **Environment**: VPC not required (public subnet acceptable)

#### PMO Service Lambda
- **Purpose**: Project estimation and baseline management
- **Endpoints**: `/projects`, `/baselines`, `/estimates`
- **Key Features**:
  - Multi-step wizard state management
  - Digital signature generation (SHA-256)
  - Baseline immutability enforcement
  - PDF/Excel export generation
- **DynamoDB Tables**: Projects, Baselines, Audit Log
- **S3 Access**: Document bucket for exports

#### SDMT Service Lambda
- **Purpose**: Cost catalog management
- **Endpoints**: `/catalog`, `/tiers`, `/services`
- **Key Features**:
  - Service tier CRUD operations
  - Pricing model management
  - ROI calculations
  - Version control for catalog items
- **DynamoDB Tables**: Catalog, Rubros, Rubros Taxonomia

#### Forecast Service Lambda
- **Purpose**: 60-month budget allocation
- **Endpoints**: `/forecasts`, `/allocations`, `/periods`
- **Key Features**:
  - Sparse index for period queries
  - Batch operations for grid updates
  - Variance calculations
  - Pattern application algorithms
- **DynamoDB Tables**: Forecast Allocations, Projects
- **Performance**: Supports 60-month × 100 projects = 6,000 records per query

#### Reconciliation Service Lambda
- **Purpose**: Invoice processing and matching
- **Endpoints**: `/invoices`, `/reconcile`, `/disputes`
- **Key Features**:
  - ML-based matching algorithm
  - OCR integration (future)
  - Dispute workflow management
  - Automated approval triggers
- **DynamoDB Tables**: Invoices, Forecast Allocations
- **S3 Access**: Invoice attachments bucket

#### Analytics Service Lambda
- **Purpose**: Cash flow analysis and reporting
- **Endpoints**: `/analytics/cashflow`, `/analytics/margins`, `/dashboards`
- **Key Features**:
  - Time-series aggregations
  - Margin and profitability calculations
  - Trend detection
  - Chart data generation
- **DynamoDB Tables**: All tables (read-only)
- **EventBridge**: Triggered by scheduled rules for nightly processing

---

### 5. Data Persistence Layer

#### DynamoDB Tables

| Table Name | Purpose | Key Schema | GSI | Backup |
|------------|---------|------------|-----|--------|
| `finz_projects` | Project metadata | PK: `PROJECT#{id}`, SK: `METADATA` | status, pm_id | PITR enabled |
| `finz_rubros` | Cost catalog | PK: `CATEGORY#{cat}`, SK: `ITEM#{id}` | tier, category | Daily backup |
| `finz_rubros_taxonomia` | Catalog taxonomy | PK: `TAX#{id}`, SK: `VERSION#{v}` | - | Daily backup |
| `finz_allocations` | Forecast data | PK: `PROJECT#{id}`, SK: `PERIOD#{yyyymm}` | project+period | PITR enabled |
| `finz_payroll_actuals` | Labor actuals | PK: `PROJECT#{id}`, SK: `PAYROLL#{id}` | - | Daily backup |
| `finz_adjustments` | Budget adjustments | PK: `PROJECT#{id}`, SK: `ADJ#{id}` | - | Daily backup |
| `finz_alerts` | System alerts | PK: `ALERT#{id}`, SK: `TIMESTAMP` | user_id, status | 30-day TTL |
| `finz_providers` | Vendor information | PK: `VENDOR#{id}`, SK: `METADATA` | name | Daily backup |
| `finz_audit_log` | Audit trail | PK: `USER#{id}`, SK: `TIMESTAMP` | action, resource | 90-day retention |

**Capacity Mode**: On-demand (pay per request)  
**Encryption**: AWS-managed KMS keys  
**Backup**: Point-in-time recovery (PITR) for critical tables

#### S3 Buckets

**Documents Bucket** (`finanzas-documents-{env}`)
- **Purpose**: PDF exports, Excel templates, invoice attachments
- **Encryption**: SSE-S3 (AES-256)
- **Versioning**: Enabled
- **Lifecycle**: Move to Glacier after 90 days, delete after 2 years
- **Access**: Lambda execution roles only

**UI Assets Bucket** (`finanzas-ui-{env}`)
- **Purpose**: React SPA and static assets
- **Encryption**: SSE-S3
- **Access**: CloudFront OAC only
- **Versioning**: Enabled for rollback capability

---

### 6. External Integrations

#### SharePoint Online
- **Integration**: Microsoft Graph API
- **Authentication**: OAuth 2.0 client credentials flow
- **Operations**: Upload documents, create folders, update metadata
- **Rate Limit**: 1,200 requests per minute (Microsoft limit)
- **Document Types**: PDF reports, Excel exports, signed baselines

#### Amazon SES (Email)
- **Purpose**: Transactional email delivery
- **From Address**: noreply@finanzas.ikusi.com
- **Verified Domain**: ikusi.com
- **Email Types**: Budget alerts, approval notifications, threshold warnings
- **Throttling**: 14 emails per second (default sandbox limit)

---

### 7. Event Processing

#### EventBridge Rules
- **Nightly Aggregation**: Triggers Analytics Lambda at 02:00 UTC
- **Monthly Rollup**: Triggers at 1st of month for period closure
- **Threshold Alerts**: Event pattern matching for budget variances

#### SNS Topics
- **Budget Alerts**: Publishes to email subscribers
- **System Events**: Integration events for cross-service communication
- **Approval Notifications**: Workflow triggers

---

### 8. Observability & Monitoring

#### CloudWatch
- **Log Groups**: One per Lambda function (14-day retention)
- **Metrics**: Custom metrics for business KPIs
  - Active projects count
  - Forecast variance percentage
  - Invoice reconciliation rate
  - API response time (p50, p95, p99)
- **Dashboards**: Real-time operational view
- **Alarms**: 
  - API error rate > 5%
  - Lambda duration > 10 seconds
  - DynamoDB throttled requests > 10

#### X-Ray
- **Tracing**: End-to-end request tracing
- **Service Map**: Visualizes Lambda dependencies
- **Performance**: Identifies bottlenecks and slow queries
- **Sampling**: 10% of requests traced

---

## Data Flow

### Typical Request Flow

```
1. User Browser → CloudFront (HTTPS)
2. CloudFront → S3 UI Bucket (OAC authenticated)
3. React SPA → Cognito (login/signup)
4. Cognito → Browser (JWT tokens)
5. React SPA → API Gateway (API call + JWT)
6. API Gateway → Custom Authorizer Lambda
7. Authorizer → Cognito (validate token)
8. Authorizer → AVP (check permissions)
9. API Gateway → Business Logic Lambda
10. Lambda → DynamoDB (data operations)
11. Lambda → S3/SharePoint (optional document ops)
12. Lambda → API Gateway (response)
13. API Gateway → React SPA (JSON response)
```

---

## Security Architecture

### Network Security Diagram

![Network & Security Architecture](../docs/diagrams/05-network-security.png){ width=100% }

*Figure 2: Network & Security Architecture - Shows security layers, encryption points, and authentication flow.*

### Security Controls

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Edge** | DDoS Protection | AWS Shield Standard + WAF |
| **Edge** | Rate Limiting | WAF rules (10k req/sec) |
| **CDN** | SSL/TLS | CloudFront with ACM certificate |
| **Storage** | Encryption at Rest | S3 SSE-S3, DynamoDB KMS |
| **Storage** | Access Control | IAM policies, bucket policies, OAC |
| **API** | Authentication | Cognito JWT validation |
| **API** | Authorization | AVP fine-grained permissions |
| **API** | Throttling | API Gateway quotas |
| **Compute** | Least Privilege | Lambda execution roles (scoped) |
| **Audit** | Logging | CloudTrail all API activity |

---

## Scalability & Performance

### Horizontal Scalability
- **Lambda**: Auto-scales to 1,000 concurrent executions (soft limit)
- **DynamoDB**: On-demand capacity scales automatically
- **API Gateway**: Scales to 10,000 req/sec (adjustable)
- **CloudFront**: Global edge network, unlimited capacity

### Performance Optimizations
- **CloudFront Caching**: Reduces origin load by 80%
- **DynamoDB DAX** (Optional): < 1ms read latency for hot data
- **Lambda Provisioned Concurrency** (Optional): Eliminates cold starts
- **API Gateway Response Caching**: 5-minute TTL for GET requests

---

## Cost Optimization

### Monthly Cost Estimate (Production)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 10M invocations, 256MB, 1s avg | $50 |
| DynamoDB | 1M writes, 10M reads | $125 |
| API Gateway | 10M requests | $35 |
| S3 Storage | 100GB | $2.30 |
| Data Transfer | 500GB out | $45 |
| CloudFront | 1TB transfer | $85 |
| CloudWatch | Logs + metrics | $25 |
| **Total** | | **~$367/month** |

### Cost Optimization Strategies
1. Use on-demand DynamoDB (no upfront cost)
2. CloudFront caching reduces API calls
3. S3 Intelligent-Tiering for documents
4. Lambda memory optimization (256MB sweet spot)
5. CloudWatch log retention limits (14 days)

---

## Disaster Recovery

- **RPO (Recovery Point Objective)**: 24 hours (DynamoDB backup retention)
- **RTO (Recovery Time Objective)**: 4 hours (CloudFormation re-deployment)
- **Multi-AZ**: All services are multi-AZ by default
- **Backup Strategy**: Daily automated backups to S3 Glacier
- **Rollback**: CloudFormation automatic rollback on stack failures

---

## Related Documentation

- [CI/CD Pipeline](11-CICD-Pipeline.md) - Deployment automation
- [Network Security](05-network-security.mmd) - Detailed security architecture
- [Runbook](20-Runbook.md) - Operational procedures
- [API Contracts](30-API-Contracts.md) - API specifications

---

**Last Review**: 2025-11-10  
**Next Review**: 2026-02-10  
**Architecture Owner**: Platform Team
