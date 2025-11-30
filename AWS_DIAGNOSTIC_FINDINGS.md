# Finanzas SD AWS End-to-End Diagnostic Findings

## Executive Summary

This document outlines the findings from a comprehensive code review and AWS infrastructure analysis of the Finanzas SD (Service Delivery) module. The analysis was conducted to identify why the Finanzas UI is mostly non-functional despite green deployments.

## Analysis Approach

Since direct AWS access requires running the diagnostic workflow (`.github/workflows/finanzas-aws-diagnostic.yml`), this analysis is based on:
1. Code review of Lambda handlers
2. SAM template configuration analysis
3. Frontend API client examination
4. Comparison with deployment workflow expectations

## Key Findings

### 1. Error Handling Issues (HIGH PRIORITY)

**Problem**: Lambda handlers catch all errors and return generic 500 responses, masking the root cause.

**Affected Files**:
- `services/finanzas-api/src/handlers/changes.ts` (lines 219-227)
- `services/finanzas-api/src/handlers/projects.ts` (lines 279-285)
- `services/finanzas-api/src/handlers/line-items.ts` (lines 62-67)

**Evidence**:
```typescript
// changes.ts - catches all errors generically
catch (error) {
  const authError = fromAuthError(error);
  if (authError) return authError;
  
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("Changes handler error", error);
  return serverError(message);  // Returns 500 for ALL errors
}
```

**Impact**: 
- Configuration errors (missing tables, wrong environment variables) appear as 500 instead of specific 4xx errors
- CloudWatch logs show generic errors without actionable details
- Difficult to diagnose production issues

**Recommended Fix**:
Add specific error handling for common failure modes:
```typescript
catch (error) {
  const authError = fromAuthError(error);
  if (authError) return authError;
  
  // Handle DynamoDB-specific errors
  if (error && (error as any).name === 'ResourceNotFoundException') {
    console.error('DynamoDB table not found', { error, table: tableName("changes") });
    return bad(`Required table not found: ${tableName("changes")}`, 503);
  }
  
  if (error && (error as any).name === 'AccessDeniedException') {
    console.error('DynamoDB access denied', { error, table: tableName("changes") });
    return bad('Database access denied - check IAM permissions', 503);
  }
  
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("Changes handler error", { error, stack: (error as Error).stack });
  return serverError(message);
}
```

### 2. DynamoDB Table Validation

**Problem**: No startup validation that required DynamoDB tables exist

**Affected Functions**: All Lambda handlers that use DynamoDB

**Required Tables** (from template.yaml):
- `finz_projects`
- `finz_changes`
- `finz_rubros`
- `finz_rubros_taxonomia`
- `finz_allocations`
- `finz_payroll_actuals`
- `finz_adjustments`
- `finz_alerts`
- `finz_providers`
- `finz_audit_log`
- `finz_docs`
- `finz_prefacturas`

**Evidence from Code**:
```typescript
// changes.ts lines 77-99
async function listChanges(projectId: string) {
  const changesTable = tableName("changes");
  console.info("Changes table resolved", { table: changesTable });
  
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: changesTable,
        // ...
      }),
    );
    // ...
  } catch (error) {
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);  // Should be 503
    }
    throw error;
  }
}
```

**Impact**:
- Handlers fail at runtime when tables don't exist
- Error appears as 500 in UI instead of clearer infrastructure error
- No way to validate infrastructure before deployment

**Recommended Fix**:
Add a health check endpoint that validates all required tables exist:
```typescript
// services/finanzas-api/src/handlers/health.ts
export const handler = async () => {
  const requiredTables = [
    'projects', 'changes', 'rubros', 'allocations',
    'payroll_actuals', 'adjustments', 'alerts', 'providers',
    'audit_log', 'docs', 'prefacturas'
  ];
  
  const missingTables = [];
  for (const table of requiredTables) {
    try {
      await ddb.send(new DescribeTableCommand({
        TableName: tableName(table)
      }));
    } catch (error) {
      if ((error as any).name === 'ResourceNotFoundException') {
        missingTables.push(tableName(table));
      }
    }
  }
  
  if (missingTables.length > 0) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        status: 'unhealthy',
        message: 'Required DynamoDB tables not found',
        missing_tables: missingTables
      })
    };
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok' })
  };
};
```

### 3. CloudFront Function Validation

**Expected Function** (from problem statement):
```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/finanzas/" || uri === "/finanzas") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  if (uri === "/finanzas/auth/callback.html") {
    return request;
  }

  if (uri.startsWith("/finanzas/") && !uri.match(/\.\w+$/)) {
    request.uri = "/finanzas/index.html";
    return request;
  }

  return request;
}
```

**Verification Required**:
- Function `finanzas-path-rewrite` exists in CloudFront
- Function is published to LIVE stage
- Function is associated with `/finanzas/*` behavior
- Distribution ID `EPQU7PVDLQXUA` has the correct behavior configuration

**How to Verify**:
Run the diagnostic workflow which includes:
```bash
aws cloudfront get-function --name finanzas-path-rewrite --stage LIVE
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA
```

### 4. API Gateway Route Configuration

**Required Routes** (from SAM template analysis):
```
GET  /health                          → HealthFn (no auth)
GET  /catalog/rubros                  → CatalogFn (no auth)
GET  /projects                        → ProjectsFn (auth required)
POST /projects                        → ProjectsFn (auth required)
GET  /projects/{projectId}/changes    → ChangesFn (auth required)
POST /projects/{projectId}/changes    → ChangesFn (auth required)
GET  /line-items?project_id=xxx       → LineItemsFn (auth required)
POST /baseline                        → BaselineFn (auth required)
GET  /baseline/{baseline_id}          → BaselineFn (auth required)
GET  /projects/{projectId}/handoff    → HandoffFn (auth required)
POST /projects/{projectId}/handoff    → HandoffFn (auth required)
```

**Verification Required**:
- All routes exist in API Gateway `pyorjw6lbe`
- Lambda integrations point to correct functions
- Cognito authorizer configured correctly
- CORS configuration allows `https://d7t9x3j66yd8k.cloudfront.net`

**Known CORS Configuration** (from template.yaml lines 332-350):
```yaml
CorsConfiguration:
  AllowOrigins:
    - Fn::Sub: https://${CloudFrontDomain}  # d7t9x3j66yd8k.cloudfront.net
  AllowHeaders:
    - Authorization
    - Content-Type
    - X-Amz-Date
    - X-Amz-Security-Token
    - X-Requested-With
    - X-Api-Key
  AllowMethods:
    - GET
    - POST
    - PUT
    - PATCH
    - DELETE
    - OPTIONS
  AllowCredentials: true
  MaxAge: 86400
```

### 5. Environment Variable Validation

**Required Environment Variables** (from template.yaml lines 46-96):
```
TABLE_PROJECTS=finz_projects
TABLE_RUBROS=finz_rubros
TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia
TABLE_ALLOCATIONS=finz_allocations
TABLE_PAYROLL_ACTUALS=finz_payroll_actuals
TABLE_ADJUSTMENTS=finz_adjustments
TABLE_CHANGES=finz_changes
TABLE_ALERTS=finz_alerts
TABLE_PROVIDERS=finz_providers
TABLE_AUDIT=finz_audit_log
TABLE_AUDIT_LOG=finz_audit_log
TABLE_DOCS=finz_docs
TABLE_PREFACTURAS=finz_prefacturas
STAGE_NAME=dev
POLICY_STORE_ID=(optional)
DOCS_BUCKET=ukusi-ui-finanzas-prod
ALLOWED_ORIGIN=https://d7t9x3j66yd8k.cloudfront.net
COGNITO_USER_POOL_ID=(from vars)
COGNITO_CLIENT_ID=(from vars)
COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/{pool_id}
```

**Verification Required**:
Check each Lambda function's environment variables match expected values

### 6. Catalog Handler Fallback Behavior

**Finding**: The catalog handler has a fallback mechanism that returns a minimal dataset on error (catalog.ts lines 33-44):

```typescript
const FALLBACK: RubroItem[] = [
  {
    rubro_id: "R-OPS-N1",
    nombre: "Operación / Infra",
    categoria: "OPEX",
    // ...
  },
];

try {
  // ... scan DynamoDB ...
} catch (err) {
  console.warn("/catalog/rubros fallback due to error:", err);
  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json", "X-Fallback": "true" },
    body: JSON.stringify({ data: FALLBACK, total: FALLBACK.length }),
  };
}
```

**Impact**:
- `/catalog/rubros` may return 200 OK with fallback data instead of failing
- UI might appear partially functional but using minimal dataset
- Look for `X-Fallback: true` header in API responses

## Recommended Actions

### Immediate Actions (To Run Diagnostic Workflow)

1. **Trigger the diagnostic workflow**:
   ```bash
   # Via GitHub UI: Actions → Finanzas AWS Diagnostic → Run workflow
   # Or via gh CLI:
   gh workflow run finanzas-aws-diagnostic.yml --ref main
   ```

2. **Review workflow output** for:
   - Missing DynamoDB tables
   - CloudFront function differences
   - API Gateway route mismatches
   - Lambda environment variable issues

### Code Fixes (Priority Order)

#### Priority 1: Improve Error Handling
- [ ] Update `changes.ts` handler to return specific 503 for table not found
- [ ] Update `projects.ts` handler to return specific 503 for table not found
- [ ] Update `line-items.ts` handler to return specific 503 for table not found
- [ ] Add structured logging with context (table names, operation, parameters)

#### Priority 2: Add Infrastructure Validation
- [ ] Enhance `/health` endpoint to check all required tables exist
- [ ] Add environment variable validation on Lambda cold start
- [ ] Return 503 Service Unavailable for infrastructure issues (not 500)

#### Priority 3: Improve Observability
- [ ] Add detailed CloudWatch logs with error context
- [ ] Include table names and operation details in error messages
- [ ] Add X-Request-ID header tracking through the call chain

#### Priority 4: Frontend Alignment
- [ ] Verify `src/lib/api.ts` error handling shows meaningful messages
- [ ] Add retry logic for 503 errors (infrastructure temporarily unavailable)
- [ ] Show specific error messages for auth vs infrastructure vs data errors

## Testing Plan

### Manual API Tests (using curl)

```bash
API_BASE="https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"

# 1. Test public endpoints (should work without auth)
curl -v "${API_BASE}/health"
curl -v "${API_BASE}/catalog/rubros"

# 2. Test protected endpoints (should return 401 without auth)
curl -v "${API_BASE}/projects"
curl -v "${API_BASE}/projects/test-id/changes"

# 3. Test with valid JWT token (obtain from Cognito)
TOKEN="<valid-jwt-token>"
curl -v -H "Authorization: Bearer ${TOKEN}" "${API_BASE}/projects"
curl -v -H "Authorization: Bearer ${TOKEN}" "${API_BASE}/line-items?project_id=test"
```

### CloudWatch Logs Analysis

Look for these patterns in logs:
- `ResourceNotFoundException` → Table doesn't exist
- `AccessDeniedException` → IAM permissions issue
- `ConditionalCheckFailedException` → Data integrity issue
- `ValidationException` → Malformed request to DynamoDB
- `"Changes table not found"` → Specific table issue

### Expected vs Actual Behavior Matrix

| Endpoint | Expected Status | Likely Actual | Root Cause Hypothesis |
|----------|----------------|---------------|----------------------|
| GET /health | 200 | 200 | ✅ Works (no dependencies) |
| GET /catalog/rubros | 200 | 200 (with fallback) | ⚠️ Table missing, returns fallback |
| GET /projects | 200 (with auth) | 500 | ❌ Table missing or IAM issue |
| GET /projects/{id}/changes | 200 (with auth) | 500 | ❌ Table missing or IAM issue |
| POST /projects/{id}/changes | 201 (with auth) | 500 | ❌ Table missing or IAM issue |
| GET /line-items | 200 (with auth) | 500 | ❌ Table missing or IAM issue |

## Next Steps

1. **Run Diagnostic Workflow**: Execute `.github/workflows/finanzas-aws-diagnostic.yml` to collect real AWS state
2. **Review CloudWatch Logs**: Check recent logs for ChangesFn, ProjectsFn, LineItemsFn for specific errors
3. **Implement Error Handling Fixes**: Update handlers to return 503 for infrastructure issues
4. **Validate Infrastructure**: Ensure all DynamoDB tables exist in us-east-2
5. **Test API Endpoints**: Use curl to test each endpoint and capture actual errors
6. **Deploy Fixes**: Create targeted PRs for each fix area

## Files Requiring Changes

### Handler Error Handling
- `services/finanzas-api/src/handlers/changes.ts` (lines 219-227)
- `services/finanzas-api/src/handlers/projects.ts` (lines 279-285)
- `services/finanzas-api/src/handlers/line-items.ts` (lines 62-67)
- `services/finanzas-api/src/handlers/catalog.ts` (lines 95-106)

### Health Check Enhancement
- `services/finanzas-api/src/handlers/health.ts` (entire file)

### Frontend Error Handling
- `src/lib/api.ts` (error handling logic)
- `src/config/api.ts` (error message mapping)

## Conclusion

The primary issue is likely a combination of:
1. **Missing or misconfigured DynamoDB tables** in the target environment
2. **Error handling that masks the root cause** by returning generic 500 errors
3. **Lack of infrastructure validation** before handlers attempt operations

The diagnostic workflow will provide concrete evidence of the infrastructure state. Once run, we can create specific fixes based on actual errors found.

## Running the Diagnostic

To execute the diagnostic workflow and get real data:

```bash
# Option 1: Via GitHub UI
# 1. Go to https://github.com/CVDExInfo/financial-planning-u/actions
# 2. Click "Finanzas AWS Diagnostic" workflow
# 3. Click "Run workflow" → Select branch → Run

# Option 2: Via gh CLI (if GH_TOKEN is set)
export GH_TOKEN="<github-token>"
gh workflow run finanzas-aws-diagnostic.yml --ref main

# Option 3: Via GitHub API
curl -X POST \
  -H "Authorization: token <github-token>" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/CVDExInfo/financial-planning-u/actions/workflows/finanzas-aws-diagnostic.yml/dispatches \
  -d '{"ref":"main"}'
```

The workflow will output detailed information about:
- CloudFront distribution and function configuration
- S3 bucket contents and manifest
- API Gateway routes and integrations
- Lambda environment variables
- DynamoDB table existence and schemas
- CloudWatch logs with recent errors
- Direct API endpoint tests

This data will allow us to create precise, targeted fixes.
