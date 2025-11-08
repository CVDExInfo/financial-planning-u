# Amazon Verified Permissions (AVP) Setup for Finanzas SD API

This directory contains the Cedar 4.5 schema, policies, and configuration for fine-grained authorization using Amazon Verified Permissions.

## Directory Structure

```
avp/
├── schema.cedar                # Cedar schema definition (entities, actions, context)
├── policies/                   # Cedar policy files
│   ├── 01-public-health.cedar
│   ├── 02-catalog-access.cedar
│   ├── 03-project-member-template.cedar
│   ├── 04-finance-write-template.cedar
│   ├── 05-payroll-ingest.cedar
│   ├── 06-close-month-template.cedar
│   ├── 07-prefactura-governance.cedar
│   └── 08-safety-deny.cedar
└── instantiations/             # Example policy instantiations (JSON)
    ├── project-member-acme-noc.json
    ├── finance-write-acme-noc.json
    └── close-month-acme-noc.json
```

## Setup Instructions

### 1. Create AVP Policy Store

Create a policy store in Amazon Verified Permissions:

```bash
aws verifiedpermissions create-policy-store \
  --validation-settings mode=STRICT \
  --region us-east-2
```

Save the returned `policyStoreId` for use in the next steps.

### 2. Upload Cedar Schema

Upload the schema to define entity types, actions, and context:

```bash
POLICY_STORE_ID=<your-policy-store-id>

aws verifiedpermissions put-schema \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/schema.cedar \
  --region us-east-2
```

### 3. Create Identity Source

Link the policy store to your Cognito User Pool:

```bash
COGNITO_USER_POOL_ARN=<your-cognito-user-pool-arn>

aws verifiedpermissions create-identity-source \
  --policy-store-id $POLICY_STORE_ID \
  --configuration cognitoUserPoolConfiguration={userPoolArn=$COGNITO_USER_POOL_ARN} \
  --principal-entity-type "Finanzas::User" \
  --region us-east-2
```

### 4. Upload Static Policies

Upload the static policies (non-template policies):

```bash
# Public health check
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/policies/01-public-health.cedar \
  --region us-east-2

# Catalog access
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/policies/02-catalog-access.cedar \
  --region us-east-2

# Payroll ingest
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/policies/05-payroll-ingest.cedar \
  --region us-east-2

# Prefactura governance
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/policies/07-prefactura-governance.cedar \
  --region us-east-2

# Safety deny
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/policies/08-safety-deny.cedar \
  --region us-east-2
```

### 5. Create Policy Templates

Create policy templates for project-scoped access:

```bash
# Project member access template
aws verifiedpermissions create-policy-template \
  --policy-store-id $POLICY_STORE_ID \
  --statement file://avp/policies/03-project-member-template.cedar \
  --region us-east-2

# Finance write access template
aws verifiedpermissions create-policy-template \
  --policy-store-id $POLICY_STORE_ID \
  --statement file://avp/policies/04-finance-write-template.cedar \
  --region us-east-2

# Close month access template
aws verifiedpermissions create-policy-template \
  --policy-store-id $POLICY_STORE_ID \
  --statement file://avp/policies/06-close-month-template.cedar \
  --region us-east-2
```

### 6. Instantiate Templates for Projects

For each project, create policy instances from templates:

```bash
PROJECT_ID="PRJ-ACME-NOC"
TEMPLATE_ID=<template-id-from-step-5>

# Instantiate project member access
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition templateLinked={policyTemplateId=$TEMPLATE_ID,resource={entityType="Finanzas::Project",entityId=$PROJECT_ID}} \
  --region us-east-2
```

### 7. Configure Lambda Environment

Add the policy store ID to your Lambda environment variables:

```yaml
# In template.yaml under Globals.Function.Environment.Variables
POLICY_STORE_ID: <your-policy-store-id>
```

Or via CloudFormation parameter:

```bash
sam deploy \
  --parameter-overrides PolicyStoreId=<your-policy-store-id>
```

## Testing Authorization

Test authorization locally using the AWS CLI:

```bash
ID_TOKEN=<cognito-id-token>

aws verifiedpermissions is-authorized-with-token \
  --policy-store-id $POLICY_STORE_ID \
  --identity-token $ID_TOKEN \
  --action actionType=Finanzas::Action,actionId=ViewRubros \
  --resource entityType=Finanzas::Rubro,entityId=Catalog \
  --region us-east-2
```

Expected response:

```json
{
  "decision": "ALLOW",
  "determiningPolicies": [...]
}
```

## Action Mapping Reference

| Route                             | Method | Cedar Action        | Resource Type         |
| --------------------------------- | ------ | ------------------- | --------------------- |
| `/health`                         | GET    | ViewHealth          | Finanzas::Project     |
| `/catalog/rubros`                 | GET    | ViewRubros          | Finanzas::Rubro       |
| `/allocation-rules`               | GET    | ViewRules           | Finanzas::Rule        |
| `/projects`                       | GET    | ViewProjects        | Finanzas::Project     |
| `/projects`                       | POST   | CreateProject       | Finanzas::Project     |
| `/projects/{id}/allocations:bulk` | PUT    | BulkAllocate        | Finanzas::Allocation  |
| `/projects/{id}/plan`             | GET    | ViewPlan            | Finanzas::Project     |
| `/projects/{id}/rubros`           | GET    | ViewRubros          | Finanzas::Rubro       |
| `/projects/{id}/rubros`           | POST   | CreateAdjustment    | Finanzas::Adjustment  |
| `/adjustments`                    | GET    | ViewAdjustments     | Finanzas::Adjustment  |
| `/adjustments`                    | POST   | CreateAdjustment    | Finanzas::Adjustment  |
| `/providers`                      | GET    | ViewProviders       | Finanzas::Provider    |
| `/providers`                      | POST   | UpsertProvider      | Finanzas::Provider    |
| `/payroll/ingest`                 | POST   | IngestPayroll       | Finanzas::PayrollFile |
| `/close-month`                    | POST   | CloseMonth          | Finanzas::Project     |
| `/prefacturas/webhook`            | POST   | SendPrefactura      | Finanzas::Prefactura  |
| `/prefacturas/webhook`            | GET    | ViewPrefactura      | Finanzas::Prefactura  |

## Group-Based Access Summary

| Group    | Permissions                                                      |
| -------- | ---------------------------------------------------------------- |
| SDT      | View catalog, rules; Project member access                       |
| FIN      | All SDT + Write rules/providers/allocations, ingest payroll      |
| AUD      | View catalog, rules, prefacturas (read-only)                     |
| PMO      | View and approve prefacturas                                     |
| EXEC_RO  | (Future: read-only executive dashboard)                          |
| VENDOR   | (Future: limited provider self-service)                          |

## Important Notes

1. **ID Token Only**: AVP's JWT audit expects the **ID token** (has `aud` and `cognito:groups`). Don't send the access token.

2. **Context**: Keep it small and consistent; `jwt_groups`, `project_id`, and `env` are usually enough.

3. **Health Route**: Public or environment-gated (no strict auth required).

4. **Deny Beats Permit**: Cedar enforces `forbid` policies; keep one safety `forbid` policy for suspended users/org states.

5. **Development Mode**: If `POLICY_STORE_ID` is not set, AVP checks are skipped for local development.

## Troubleshooting

### Authorization Denied

Check CloudWatch logs for AVP decision details:

```bash
aws logs tail /aws/lambda/<function-name> --since 15m --follow
```

Look for lines starting with `[avp]` to see authorization decisions.

### Invalid Token Format

Ensure you're using the ID token, not the access token:

```bash
# Get ID token from Cognito
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=<user>,PASSWORD=<pass>
```

Use the `IdToken` field from the response, not `AccessToken`.

### Policy Not Matching

Verify that:
1. User has the required Cognito groups
2. Policy template is instantiated for the project
3. Context values match policy conditions
4. Schema is up to date in the policy store

## Terraform/CloudFormation (Optional)

For automated infrastructure setup, add to `template.yaml`:

```yaml
Parameters:
  PolicyStoreId:
    Type: String
    Description: AVP Policy Store ID
    Default: ""

Globals:
  Function:
    Environment:
      Variables:
        POLICY_STORE_ID: !Ref PolicyStoreId

# Grant Lambda permissions to call AVP
Resources:
  # Add to each Lambda function's Policies
  - Statement:
      - Effect: Allow
        Action:
          - verifiedpermissions:IsAuthorizedWithToken
        Resource: !Sub "arn:aws:verifiedpermissions:${AWS::Region}:${AWS::AccountId}:policy-store/${PolicyStoreId}"
```
