# Amazon Verified Permissions (AVP) Integration

This directory contains the Amazon Verified Permissions (AVP) configuration for Finanzas SD, implementing fine-grained authorization using Cedar 4.5 policies.

## Overview

The AVP integration provides:
- **Cedar schema** defining entity types, relationships, and actions
- **Policy templates** with slots for project-scoped permissions
- **Static policies** for organization-wide access control
- **Node.js helper library** for Lambda authorization checks
- **CloudFormation template** for infrastructure deployment

## Architecture

```
┌─────────────────┐
│  Lambda Handler │
│   (API Request) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  AVP Helper Lib │────▶│  AVP Policy Store│
│  checkAuthWith  │     │  (Cedar Policies)│
│     Token()     │◀────│                  │
└─────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Allow / Deny    │
│   Response      │
└─────────────────┘
```

## Files

### Schema & Policies
- **`schema.cedar`**: Cedar schema defining entities, relationships, and actions
- **`policies.cedar`**: Cedar policy definitions (templates and static policies)
- **`policy-instantiations.json`**: Example policy template instantiations

### Infrastructure
- **`avp-policy-store.yaml`**: CloudFormation template to create AVP Policy Store

### Code
- **`../src/lib/avp.ts`**: Helper library for authorization checks
- **`../src/lib/avp-actions.ts`**: Action mapping configuration (routes → Cedar actions)

## Entity Model

```
User ──────────────> Group (SDT, FIN, AUD, PMO, EXEC_RO, VENDOR)
  │
  ├──────────────> Project (owner: User)
  │                   │
  │                   ├──> Adjustment (project, owner)
  │                   ├──> Allocation (project, owner)
  │                   ├──> Provider (project, owner)
  │                   ├──> PayrollFile (project, uploader)
  │                   ├──> Prefactura (project, createdBy, status)
  │                   └──> Rule (project, createdBy)
  │
  └──────────────> Rubro (organization-wide)
```

## Actions

| Action | Resource Type | Description |
|--------|---------------|-------------|
| `ViewHealth` | Project | Health check endpoint |
| `ViewRubros` | Rubro | Read catalog rubros |
| `ViewRules` | Rule | View allocation rules |
| `ModifyRules` | Rule | Modify allocation rules |
| `ViewProviders` | Provider | List providers |
| `UpsertProvider` | Provider | Create/update provider |
| `ViewAdjustments` | Adjustment | List adjustments |
| `CreateAdjustment` | Adjustment | Create adjustment |
| `ViewProjects` | Project | List projects |
| `CreateProject` | Project | Create project |
| `BulkAllocate` | Allocation | Bulk allocations update |
| `ViewPlan` | Project | View project plan |
| `IngestPayroll` | PayrollFile | Ingest payroll data |
| `CloseMonth` | Project | Close monthly period |
| `ViewPrefactura` | Prefactura | View prefacturas |
| `SendPrefactura` | Prefactura | Send prefactura |
| `ApprovePrefactura` | Prefactura | Approve prefactura |

## Policies

### Static Policies

1. **Health Check**: Allow all users in dev/stg/prod environments
2. **Catalog Read**: SDT/FIN/AUD can read rubros and rules
3. **Payroll Ingest**: FIN only
4. **Prefactura View**: AUD/FIN/PMO can view
5. **Prefactura Send**: FIN only
6. **Prefactura Approve**: PMO/FIN can approve
7. **Suspended User Deny**: Deny all actions for suspended users

### Policy Templates (with slots)

1. **ProjectMemberAccess**: Project members (SDT/FIN) can view/create adjustments and view plan
2. **FinanceWriteAccess**: FIN can modify rules/providers/allocations
3. **CloseMonthAccess**: FIN can close month with project membership

## Deployment

### Step 1: Deploy AVP Policy Store

```bash
cd services/finanzas-api
aws cloudformation deploy \
  --template-file avp-policy-store.yaml \
  --stack-name finanzas-avp-dev \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides PolicyStoreName=FinanzasPolicyStore
```

Get the Policy Store ID:

```bash
aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyStoreId`].OutputValue' \
  --output text
```

### Step 2: Update Lambda Environment Variables

Add the Policy Store ID to your Lambda functions:

```yaml
# In template.yaml, add to Globals > Function > Environment > Variables
POLICY_STORE_ID: !ImportValue finanzas-avp-dev-PolicyStoreId
```

Or set it manually:

```bash
export POLICY_STORE_ID="<policy-store-id>"
aws lambda update-function-configuration \
  --function-name <function-name> \
  --environment "Variables={POLICY_STORE_ID=$POLICY_STORE_ID}"
```

### Step 3: Instantiate Policy Templates

Create policy instances for your projects:

```bash
# Example: ACME NOC project
aws verifiedpermissions create-policy \
  --policy-store-id <policy-store-id> \
  --definition "TemplateLinked={PolicyTemplateId='<template-id>',Resource={EntityType='Finanzas::Project',EntityId='PRJ-ACME-NOC'}}"
```

See `policy-instantiations.json` for examples.

### Step 4: Grant Lambda IAM Permissions

Add IAM policy to Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "verifiedpermissions:IsAuthorizedWithToken"
      ],
      "Resource": "arn:aws:verifiedpermissions:*:*:policy-store/*"
    }
  ]
}
```

## Usage in Lambda Handlers

### Basic Usage

```typescript
import { ensureAuthorized } from './lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const projectId = event.pathParameters?.id;
  
  // Check authorization
  await ensureAuthorized(
    event,
    'BulkAllocate',
    { type: 'Finanzas::Allocation', id: `ALLOC-${projectId}` },
    projectId
  );
  
  // If we reach here, user is authorized
  // ... proceed with business logic
  
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
```

### Advanced Usage

```typescript
import { checkAuthFromEvent } from './lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const projectId = event.pathParameters?.id;
  
  const authorized = await checkAuthFromEvent(
    event,
    'ViewPlan',
    { type: 'Finanzas::Project', id: projectId },
    projectId
  );
  
  if (!authorized) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden' })
    };
  }
  
  // ... proceed with business logic
};
```

### Manual Token Handling

```typescript
import {
  extractIdToken,
  parseGroupsFromJWT,
  buildAVPContext,
  checkAuthWithToken
} from './lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idToken = extractIdToken(event);
  if (!idToken) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  const groups = parseGroupsFromJWT(idToken);
  const context = buildAVPContext(event, groups, projectId);
  
  const authorized = await checkAuthWithToken(
    idToken,
    'CreateProject',
    { type: 'Finanzas::Project', id: 'new' },
    context
  );
  
  // ... handle authorization result
};
```

## Context Attributes

The following context attributes are passed to AVP for authorization decisions:

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `jwt_groups` | Set\<String\> | Cognito groups from ID token | `["SDT", "FIN"]` |
| `http_method` | String | HTTP method | `"PUT"` |
| `route` | String | API route path | `"/projects/123/allocations:bulk"` |
| `project_id` | String? | Project ID from path (optional) | `"PRJ-ACME-NOC"` |
| `env` | String | Environment | `"dev"` \| `"stg"` \| `"prod"` |
| `suspended` | Boolean? | User suspension flag (optional) | `false` |

## Testing

### Unit Tests

```bash
cd services/finanzas-api
npm test
```

### Manual Testing with AWS CLI

```bash
# Test IsAuthorizedWithToken
aws verifiedpermissions is-authorized-with-token \
  --policy-store-id <policy-store-id> \
  --identity-token <id-token> \
  --action '{"actionType":"ACTION","actionId":"Finanzas::Action::\"ViewHealth\""}' \
  --resource '{"entityType":"Finanzas::Project","entityId":"*root*"}' \
  --context '{"contextMap":{"env":{"string":"dev"},"jwt_groups":{"set":["SDT"]},"http_method":{"string":"GET"},"route":{"string":"/health"}}}'
```

## Development Mode

For local development, you can skip AVP checks by setting:

```bash
export SKIP_AVP=true
export STAGE=dev
```

When `SKIP_AVP=true` and `STAGE=dev`, the authorization helper will log a warning and allow access.

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check that:
   - Policy Store ID is correctly set
   - User has required Cognito groups
   - Policy template is instantiated for the project
   - Lambda has IAM permissions for `IsAuthorizedWithToken`

2. **POLICY_STORE_ID not set**: Set environment variable in Lambda configuration

3. **Invalid JWT**: Ensure you're sending the **ID token**, not the access token

4. **Context mismatch**: Verify context attributes match Cedar schema

### Debugging

Enable debug logging in your Lambda:

```typescript
console.log('[AVP] Authorization check:', {
  action,
  resource,
  groups: parseGroupsFromJWT(idToken),
  projectId
});
```

Check CloudWatch Logs for AVP decision details:

```
[AVP] Authorization decision: {
  action: 'BulkAllocate',
  resource: 'ALLOC-PRJ-123',
  decision: 'ALLOW',
  determiningPolicies: 2
}
```

## Rollout Plan

1. ✅ Create AVP policy store
2. ✅ Load Cedar schema
3. ✅ Install policy templates
4. [ ] Instantiate policies for active projects
5. [ ] Add AVP helper to Lambda handlers
6. [ ] Update client to send ID token
7. [ ] Add smoke tests to CI
8. [ ] Monitor AVP decisions in CloudWatch

## References

- [Amazon Verified Permissions Documentation](https://docs.aws.amazon.com/verifiedpermissions/)
- [Cedar Policy Language](https://docs.cedarpolicy.com/)
- [AWS SDK for JavaScript - VerifiedPermissions](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-verifiedpermissions/)
