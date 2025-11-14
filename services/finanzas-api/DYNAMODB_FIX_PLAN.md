# DynamoDB Tables - Root Cause Analysis & Fixes

**Date**: November 14, 2025  
**API**: finanzas-sd-api-dev (m3g6am67aj.execute-api.us-east-2.amazonaws.com)  
**Issue**: All DynamoDB tables showing 0 items

---

## Root Cause Analysis

### Issue #1: AWS SDK Version Mismatch ⚠️

**Problem**: Lambda handlers mixing AWS SDK v2 and v3
```typescript
// dynamo.ts uses AWS SDK v3
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// BUT also imports AWS SDK v2 (unused)
import AWS from "aws-sdk";  // ❌ This line causes confusion
```

**Impact**:
- `ddb.put().promise()` is AWS SDK v2 syntax
- AWS SDK v3 uses `await ddb.put()` (no `.promise()`)
- This causes operations to fail silently

**Fix**: Remove AWS SDK v2, use v3 consistently

---

### Issue #2: Missing Data Seeding

**Problem**: Tables exist but have never been populated with initial data

**Evidence**:
```
finz_projects          - 0 items (empty)
finz_rubros           - 0 items (empty)
finz_rubros_taxonomia - 0 items (empty)
finz_allocations      - 0 items (empty)
finz_payroll_actuals  - 0 items (empty)
finz_adjustments      - 0 items (empty)
finz_alerts           - 0 items (empty)
finz_providers        - 0 items (empty)
finz_audit_log        - 0 items (empty)
```

**Impact**: Frontend shows empty state because API returns empty arrays

**Fix**: Run seeding script to populate initial data

---

### Issue #3: Frontend Using Mock Data

**Problem**: Frontend `api.ts` returns hardcoded mock data, not calling real API

**Evidence**:
```typescript
// src/lib/api.ts
static async getProjects(): Promise<Project[]> {
  await this.delay(100);
  return [
    {
      id: "PRJ-HEALTHCARE-MODERNIZATION",
      name: "Healthcare System Modernization",
      // ... hardcoded data
    }
  ];
}
```

**Impact**: Frontend never hits DynamoDB-backed API endpoints

**Fix**: Replace mock API calls with real HTTP requests to Lambda functions

---

## Solutions

### Fix #1: Update dynamo.ts (AWS SDK v3 only)

**File**: `services/finanzas-api/src/lib/dynamo.ts`

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true
  }
});

const env = process.env;

type TableKey =
  | "projects"
  | "rubros"
  | "rubros_taxonomia"  // Added missing
  | "allocations"
  | "payroll_actuals"
  | "adjustments"
  | "alerts"
  | "providers"
  | "audit_log";

// Fallback to table names for local/dev
const FALLBACKS: Record<TableKey, string> = {
  projects: "finz_projects",
  rubros: "finz_rubros",
  rubros_taxonomia: "finz_rubros_taxonomia",
  allocations: "finz_allocations",
  payroll_actuals: "finz_payroll_actuals",
  adjustments: "finz_adjustments",
  alerts: "finz_alerts",
  providers: "finz_providers",
  audit_log: "finz_audit_log"
};

export const tableName = (key: TableKey): string => {
  const envKey = `TABLE_${key.toUpperCase()}`;
  const name = env[envKey] || FALLBACKS[key];
  if (!name) {
    throw new Error(`Table name for ${key} not found (env: ${envKey})`);
  }
  return name;
};
```

---

### Fix #2: Update projects.ts Handler (AWS SDK v3 syntax)

**File**: `services/finanzas-api/src/handlers/projects.ts`

**BEFORE** (AWS SDK v2 syntax):
```typescript
await ddb.put({ TableName: tableName('projects'), Item: item }).promise();
const items = await ddb.scan({ TableName: tableName('projects'), Limit: 50 }).promise();
```

**AFTER** (AWS SDK v3 syntax):
```typescript
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

// PUT
await ddb.send(new PutCommand({
  TableName: tableName('projects'),
  Item: item
}));

// SCAN
const result = await ddb.send(new ScanCommand({
  TableName: tableName('projects'),
  Limit: 50
}));
const items = result.Items ?? [];
```

---

### Fix #3: Seed Initial Data

**Script**: `services/finanzas-api/scripts/seed-dynamodb.ts`

**Run**:
```bash
cd services/finanzas-api
npx ts-node scripts/seed-dynamodb.ts
```

**What it does**:
1. Checks all 9 tables for existence and item count
2. Seeds:
   - 2 demo projects (P-001, P-002)
   - 5 rubros categories (MOD, GSV, TEC, INF, TEL)
   - 5 line items (MOD-ING, MOD-SDM, TEC-LIC-MON, INF-CLOUD, TEL-CCTS)
   - 2 allocations for P-001
   - 2 providers (AWS, Microsoft)
3. Verifies seeding was successful

---

### Fix #4: Connect Frontend to Real API

**File**: `src/lib/api.ts`

**Current Issue**: Methods return hardcoded mock data

**Solution**: Replace with real HTTP calls to API Gateway

**Example**:
```typescript
// BEFORE (mock)
static async getProjects(): Promise<Project[]> {
  await this.delay(100);
  return [/* hardcoded data */];
}

// AFTER (real API)
static async getProjects(): Promise<Project[]> {
  const API_BASE = 'https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev';
  const token = localStorage.getItem('cognito_id_token');
  
  const response = await fetch(`${API_BASE}/projects`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}
```

---

## Implementation Plan

### Phase 1: Fix Lambda Handlers (AWS SDK v3)

**Priority**: HIGH  
**Estimated Time**: 30 minutes  
**Risk**: LOW (backward compatible)

**Files to Update**:
1. `services/finanzas-api/src/lib/dynamo.ts` - Remove AWS SDK v2, add v3 commands
2. `services/finanzas-api/src/handlers/projects.ts` - Replace `.promise()` syntax
3. `services/finanzas-api/src/handlers/rubros.ts` - Replace `.promise()` syntax
4. `services/finanzas-api/src/handlers/catalog.ts` - Replace `.promise()` syntax
5. `services/finanzas-api/src/handlers/handoff.ts` - Replace `.promise()` syntax

**Commands**:
```bash
cd services/finanzas-api
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm uninstall aws-sdk  # Remove v2
sam build
sam deploy --no-confirm-changeset
```

---

### Phase 2: Seed DynamoDB Tables

**Priority**: HIGH  
**Estimated Time**: 5 minutes  
**Risk**: NONE (read-only diagnostics, then write)

**Commands**:
```bash
cd services/finanzas-api
npx ts-node scripts/seed-dynamodb.ts
```

**Expected Output**:
```
🔍 DynamoDB Table Diagnostic & Seeding Tool

📊 Step 1: Diagnosing tables...
  Checking finz_projects... ✅ EXISTS (0 items, ACTIVE)
  Checking finz_rubros... ✅ EXISTS (0 items, ACTIVE)
  ...

🌱 Step 2: Seeding data...
  Seeding projects table...
  ✅ Seeded 2 projects
  Seeding rubros table...
  ✅ Seeded 5 rubros
  ...

🔍 Step 3: Verifying seeded data...
  finz_projects: 2 items
  finz_rubros: 5 items
  finz_rubros_taxonomia: 5 items
  finz_allocations: 2 items
  finz_providers: 2 items

✅ All operations complete!
```

---

### Phase 3: Connect Frontend to Real API

**Priority**: MEDIUM  
**Estimated Time**: 1 hour  
**Risk**: MEDIUM (breaking changes to API interface)

**Strategy**:
1. Create `src/lib/api-client.ts` with real HTTP calls
2. Update `src/lib/api.ts` to call `api-client.ts` instead of returning mocks
3. Add error handling and loading states
4. Test authentication flow (Cognito JWT)

**Key Changes**:
- Replace `ApiService.getProjects()` mock with real GET /projects
- Replace `ApiService.getLineItems()` mock with real GET /catalog
- Add Bearer token from Cognito to all requests
- Handle 401/403 errors (redirect to login)

---

## Testing Checklist

### Backend (Lambda + DynamoDB)

- [ ] AWS SDK v3 migration complete (no `.promise()` calls)
- [ ] All 9 tables seeded with initial data
- [ ] GET /projects returns 2 demo projects
- [ ] GET /rubros returns 5 categories
- [ ] POST /projects creates new project
- [ ] CloudWatch logs show successful DynamoDB operations

### Frontend (React + API)

- [ ] Login with Cognito (christian.valencia@ikusi.com)
- [ ] Navigate to SDMT → Cost Catalog
- [ ] Dropdowns load 5 rubros categories
- [ ] Can select category and see line items
- [ ] Add Line Item creates entry in DynamoDB
- [ ] Statistics update after operations
- [ ] No console errors

---

## Verification Commands

### Check Table Item Counts (AWS CLI)
```bash
aws dynamodb scan --table-name finz_projects --select COUNT --region us-east-2
aws dynamodb scan --table-name finz_rubros --select COUNT --region us-east-2
aws dynamodb scan --table-name finz_allocations --select COUNT --region us-east-2
```

### Test API Endpoint (curl)
```bash
# Get Cognito token first (from browser localStorage)
TOKEN="<your_cognito_id_token>"

curl -H "Authorization: Bearer $TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/projects
```

### Check Lambda Logs
```bash
aws logs tail /aws/lambda/finanzas-sd-api-dev-ProjectsFn-WJzowRSnvW4Y \
  --follow --region us-east-2
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AWS SDK v3 breaks existing code | LOW | HIGH | Test thoroughly in dev, use TypeScript for type safety |
| Seeding script fails | LOW | MEDIUM | Script has error handling, can re-run safely |
| Frontend API changes break UI | MEDIUM | HIGH | Keep mock fallback, gradual rollout |
| Cognito auth issues | LOW | HIGH | Already working, token verified |

---

## Rollback Plan

If issues occur:

1. **Lambda handlers**: Redeploy previous SAM template
   ```bash
   sam deploy --no-confirm-changeset --parameter-overrides "Version=previous"
   ```

2. **DynamoDB**: Tables unchanged (only data added, no schema changes)

3. **Frontend**: Revert to mock API (already in place)
   ```typescript
   const USE_MOCK_API = true;  // Toggle back to mock
   ```

---

## Next Steps After Fix

1. **Monitor CloudWatch Metrics**:
   - Lambda invocation count
   - DynamoDB read/write capacity
   - API Gateway 4xx/5xx errors

2. **Add More Seed Data**:
   - Expand to all 21 cost categories
   - Add 99 line items from business matrix
   - Create realistic allocation data for 12 months

3. **Frontend Integration**:
   - Replace remaining mock endpoints
   - Add API error boundary
   - Implement retry logic for failed requests

4. **Documentation**:
   - API endpoint reference
   - DynamoDB schema documentation
   - Deployment runbook

---

## Contact

- **Backend Issues**: Check `services/finanzas-api/src/handlers/*.ts`
- **DynamoDB Schema**: See `services/finanzas-api/template.yaml`
- **Seeding Script**: Run `services/finanzas-api/scripts/seed-dynamodb.ts`
- **Frontend API**: Update `src/lib/api.ts`

---

**Status**: 🔴 CRITICAL - Requires immediate action  
**Priority**: P0  
**Owner**: DevOps + Backend team
