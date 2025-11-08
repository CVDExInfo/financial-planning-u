# AVP Quick Reference for Developers

## Adding AVP to a Lambda Handler

### Step 1: Import the helper

```typescript
import { ensureAuthorized } from '../lib/avp';
```

### Step 2: Add authorization check

```typescript
export const handler = async (event: APIGatewayProxyEventV2) => {
  // Extract parameters
  const projectId = event.pathParameters?.id;

  // Check authorization (throws 403 if denied)
  await ensureAuthorized(
    event,
    'YourActionName',
    { type: 'Finanzas::EntityType', id: 'resource-id' },
    projectId // optional
  );

  // Your business logic here
};
```

## Common Actions and Resources

| Handler | Action | Resource Type | Resource ID Pattern |
|---------|--------|---------------|---------------------|
| GET /health | `ViewHealth` | `Finanzas::Project` | `*root*` |
| GET /catalog/rubros | `ViewRubros` | `Finanzas::Rubro` | `Catalog` |
| GET /allocation-rules | `ViewRules` | `Finanzas::Rule` | `*` |
| GET /projects | `ViewProjects` | `Finanzas::Project` | `*` |
| POST /projects | `CreateProject` | `Finanzas::Project` | `new` |
| PUT /projects/{id}/allocations:bulk | `BulkAllocate` | `Finanzas::Allocation` | `ALLOC-${projectId}` |
| GET /projects/{id}/plan | `ViewPlan` | `Finanzas::Project` | `${projectId}` |
| GET /adjustments | `ViewAdjustments` | `Finanzas::Adjustment` | `*` |
| POST /adjustments | `CreateAdjustment` | `Finanzas::Adjustment` | `new` |
| GET /providers | `ViewProviders` | `Finanzas::Provider` | `*` |
| POST /providers | `UpsertProvider` | `Finanzas::Provider` | `new` |
| POST /payroll/ingest | `IngestPayroll` | `Finanzas::PayrollFile` | `new` |
| POST /close-month | `CloseMonth` | `Finanzas::Project` | `${projectId}` |
| GET /prefacturas/webhook | `ViewPrefactura` | `Finanzas::Prefactura` | `*` |
| POST /prefacturas/webhook (send) | `SendPrefactura` | `Finanzas::Prefactura` | `new` |
| POST /prefacturas/webhook (approve) | `ApprovePrefactura` | `Finanzas::Prefactura` | `${id}` |

## Code Patterns

### Pattern 1: Simple authorization (throws on deny)

```typescript
import { ensureAuthorized } from '../lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  await ensureAuthorized(event, 'ViewProjects', { type: 'Finanzas::Project', id: '*' });
  // Business logic
};
```

### Pattern 2: Check authorization with custom error

```typescript
import { checkAuthFromEvent } from '../lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const authorized = await checkAuthFromEvent(
    event,
    'ViewPlan',
    { type: 'Finanzas::Project', id: projectId },
    projectId
  );

  if (!authorized) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }
  // Business logic
};
```

### Pattern 3: Manual token handling

```typescript
import {
  extractIdToken,
  parseGroupsFromJWT,
  buildAVPContext,
  checkAuthWithToken
} from '../lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idToken = extractIdToken(event);
  if (!idToken) return { statusCode: 401, body: 'Unauthorized' };

  const groups = parseGroupsFromJWT(idToken);
  const context = buildAVPContext(event, groups, projectId);

  const authorized = await checkAuthWithToken(
    idToken,
    'CreateProject',
    { type: 'Finanzas::Project', id: 'new' },
    context
  );
  // Handle result
};
```

## Who Can Do What?

### SDT (Development Team)
- ✅ View rubros, rules, projects, adjustments, plan
- ✅ Create adjustments (if project member)
- ❌ Modify rules, allocate, close month

### FIN (Finance)
- ✅ Everything SDT can do
- ✅ Modify rules, upsert providers, bulk allocate (if project member)
- ✅ Ingest payroll, close month (if project member)
- ✅ Send and approve prefacturas

### AUD (Audit)
- ✅ View rubros, rules
- ✅ View prefacturas
- ❌ Create, modify, or approve anything

### PMO (Project Management Office)
- ✅ View prefacturas
- ✅ Approve prefacturas
- ❌ Send prefacturas

## Testing Locally

### Skip AVP in Development

Set environment variables:

```bash
export SKIP_AVP=true
export STAGE=dev
```

The AVP helper will log a warning and allow all requests.

### Test with Real AVP

```bash
export POLICY_STORE_ID=<your-policy-store-id>
export SKIP_AVP=false
export STAGE=dev
```

## Debugging

### Enable Debug Logging

The AVP library logs authorization decisions:

```
[AVP] Authorization decision: {
  action: 'BulkAllocate',
  resource: 'ALLOC-PRJ-123',
  decision: 'ALLOW',
  determiningPolicies: 2
}
```

### Common Errors

**"No ID token found in request"**
- Check that Authorization header is present
- Ensure you're using `Bearer <token>` format

**"POLICY_STORE_ID environment variable not set"**
- Set POLICY_STORE_ID in Lambda configuration
- Or set SKIP_AVP=true for local dev

**"403 Forbidden"**
- Verify user has required Cognito groups (cognito:groups claim in JWT)
- Check that policy template is instantiated for the project
- Confirm context attributes match Cedar policy conditions

## Entity Types Reference

```
User            - Cognito users
Group           - SDT, FIN, AUD, PMO, EXEC_RO, VENDOR
Project         - Financial projects
Adjustment      - Budget adjustments
Allocation      - Resource allocations
Provider        - External vendors
PayrollFile     - Payroll data
Prefactura      - Pre-invoices
Rule            - Allocation rules
Rubro           - Budget line items
```

## Context Attributes

Every authorization request includes:

```typescript
{
  jwt_groups: { set: ['SDT', 'FIN'] },    // User's Cognito groups
  http_method: { string: 'PUT' },          // HTTP method
  route: { string: '/projects/123/...' }, // API route
  project_id: { string: 'PRJ-123' },      // Optional project ID
  env: { string: 'dev' }                   // Environment
}
```

## Policy Templates

Three templates require project-specific instantiation:

1. **ProjectMemberAccess** - SDT/FIN can view/create adjustments, view plan
2. **FinanceWriteAccess** - FIN can modify rules/providers/allocations
3. **CloseMonthAccess** - FIN can close month

To instantiate for a new project, run:

```bash
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition "TemplateLinked={
    PolicyTemplateId='<template-id>',
    Resource={EntityType='Finanzas::Project',EntityId='PRJ-YOUR-PROJECT'}
  }"
```

## See Also

- [Complete Documentation](./avp/README.md)
- [Deployment Guide](./AVP_DEPLOYMENT.md)
- [Example Handlers](./src/handlers/examples-with-avp.ts)
- [Template Updates](./AVP_TEMPLATE_UPDATES.md)
