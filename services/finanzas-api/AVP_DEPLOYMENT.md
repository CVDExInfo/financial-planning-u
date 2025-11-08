# AVP Deployment Guide

This guide provides step-by-step instructions for deploying Amazon Verified Permissions (AVP) for Finanzas SD.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed (for Lambda deployment)
- CloudFormation permissions for creating AVP resources
- IAM permissions for Lambda execution roles

## Step 1: Deploy AVP Policy Store

Deploy the AVP Policy Store using CloudFormation:

```bash
cd services/finanzas-api

# Deploy the policy store
aws cloudformation deploy \
  --template-file avp-policy-store.yaml \
  --stack-name finanzas-avp-dev \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    PolicyStoreName=FinanzasPolicyStore \
    ValidationMode=STRICT \
  --region us-east-2

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name finanzas-avp-dev \
  --region us-east-2
```

## Step 2: Get Policy Store ID

Retrieve the Policy Store ID from the stack outputs:

```bash
export POLICY_STORE_ID=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyStoreId`].OutputValue' \
  --output text)

echo "Policy Store ID: $POLICY_STORE_ID"
```

## Step 3: Upload Cedar Schema

The schema is included in the CloudFormation template. To update it separately:

```bash
# Note: Schema is managed by CloudFormation
# To update manually, use:
aws verifiedpermissions put-schema \
  --policy-store-id $POLICY_STORE_ID \
  --definition file://avp/schema.cedar \
  --region us-east-2
```

## Step 4: Instantiate Policy Templates

Create policy instances for your active projects. Example for project PRJ-ACME-NOC:

```bash
# Get template IDs from stack outputs
export PROJECT_MEMBER_TEMPLATE=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ProjectMemberAccessTemplateId`].OutputValue' \
  --output text)

export FINANCE_WRITE_TEMPLATE=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`FinanceWriteAccessTemplateId`].OutputValue' \
  --output text)

export CLOSE_MONTH_TEMPLATE=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloseMonthAccessTemplateId`].OutputValue' \
  --output text)

# Create policy instance for ACME NOC project - Project Member Access
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition "TemplateLinked={
    PolicyTemplateId='$PROJECT_MEMBER_TEMPLATE',
    Resource={EntityType='Finanzas::Project',EntityId='PRJ-ACME-NOC'}
  }" \
  --region us-east-2

# Create policy instance for ACME NOC project - Finance Write Access
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition "TemplateLinked={
    PolicyTemplateId='$FINANCE_WRITE_TEMPLATE',
    Resource={EntityType='Finanzas::Project',EntityId='PRJ-ACME-NOC'}
  }" \
  --region us-east-2

# Create policy instance for ACME NOC project - Close Month Access
aws verifiedpermissions create-policy \
  --policy-store-id $POLICY_STORE_ID \
  --definition "TemplateLinked={
    PolicyTemplateId='$CLOSE_MONTH_TEMPLATE',
    Resource={EntityType='Finanzas::Project',EntityId='PRJ-ACME-NOC'}
  }" \
  --region us-east-2
```

## Step 5: Update Lambda Environment Variables

Add the Policy Store ID to your Lambda functions.

### Option A: Update template.yaml (Recommended)

Add to `template.yaml` in the `Globals > Function > Environment > Variables` section:

```yaml
Globals:
  Function:
    Environment:
      Variables:
        POLICY_STORE_ID: <paste-policy-store-id-here>
        # Or use CloudFormation import if deploying together:
        # POLICY_STORE_ID: !ImportValue finanzas-avp-dev-PolicyStoreId
```

Then redeploy:

```bash
sam build
sam deploy --config-env dev
```

### Option B: Update existing Lambda functions directly

```bash
# Update all Lambda functions with the Policy Store ID
for fn in $(aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'finanzas-sd-api')].FunctionName" --output text --region us-east-2); do
  echo "Updating $fn"
  aws lambda update-function-configuration \
    --function-name $fn \
    --environment "Variables={
      POLICY_STORE_ID=$POLICY_STORE_ID,
      SKIP_AVP=false
    }" \
    --region us-east-2
done
```

## Step 6: Add IAM Permissions to Lambda Execution Role

Lambda functions need permission to call AVP. Add this policy to the Lambda execution role:

### Option A: Update template.yaml (Recommended)

Add a managed policy to Lambda functions:

```yaml
Resources:
  AllocationsFn:
    Type: AWS::Serverless::Function
    Properties:
      Policies:
        - AWSLambdaBasicExecutionRole
        - DynamoDBCrudPolicy:
            TableName: !Ref AllocationsTable
        - Statement:
            - Effect: Allow
              Action:
                - verifiedpermissions:IsAuthorizedWithToken
              Resource: !Sub "arn:aws:verifiedpermissions:${AWS::Region}:${AWS::AccountId}:policy-store/*"
```

### Option B: Attach inline policy to execution role

```bash
# Get the Lambda execution role name
ROLE_NAME=$(aws iam list-roles --query "Roles[?contains(RoleName, 'finanzas-sd-api')].RoleName" --output text | head -1)

# Create and attach inline policy
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name AVPAuthorization \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "verifiedpermissions:IsAuthorizedWithToken"
        ],
        "Resource": "*"
      }
    ]
  }' \
  --region us-east-2
```

## Step 7: Update Lambda Handlers

Integrate AVP authorization into your Lambda handlers. See `src/handlers/examples-with-avp.ts` for examples.

Basic pattern:

```typescript
import { ensureAuthorized } from '../lib/avp';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const projectId = event.pathParameters?.id;
  
  await ensureAuthorized(
    event,
    'BulkAllocate',
    { type: 'Finanzas::Allocation', id: `ALLOC-${projectId}` },
    projectId
  );
  
  // ... business logic
};
```

## Step 8: Test Authorization

### Test with AWS CLI

```bash
# Get an ID token from Cognito
# You can get this from your client application or use aws cognito-idp commands

ID_TOKEN="<your-cognito-id-token>"

# Test authorization
aws verifiedpermissions is-authorized-with-token \
  --policy-store-id $POLICY_STORE_ID \
  --identity-token $ID_TOKEN \
  --action '{"actionType":"ACTION","actionId":"Finanzas::Action::\"ViewHealth\""}' \
  --resource '{"entityType":"Finanzas::Project","entityId":"*root*"}' \
  --context '{"contextMap":{
    "env":{"string":"dev"},
    "jwt_groups":{"set":["SDT"]},
    "http_method":{"string":"GET"},
    "route":{"string":"/health"}
  }}' \
  --region us-east-2
```

### Test with curl

```bash
# Get ID token from your auth flow
ID_TOKEN="<your-cognito-id-token>"

# Test a protected endpoint
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/projects/PRJ-ACME-NOC/allocations:bulk \
  -X PUT \
  -H "Content-Type: application/json" \
  -d '{"allocations": []}'
```

## Step 9: Monitor and Debug

### Check CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/finanzas-sd-api-AllocationsFn --follow --region us-east-2
```

Look for AVP decision logs:

```
[AVP] Authorization decision: {
  action: 'BulkAllocate',
  resource: 'ALLOC-PRJ-123',
  decision: 'ALLOW',
  determiningPolicies: 2
}
```

### List Policies

```bash
# List all policies in the policy store
aws verifiedpermissions list-policies \
  --policy-store-id $POLICY_STORE_ID \
  --region us-east-2
```

### Verify Policy Template Instantiations

```bash
# List policies linked to templates
aws verifiedpermissions list-policies \
  --policy-store-id $POLICY_STORE_ID \
  --filter "policyType=TEMPLATE_LINKED" \
  --region us-east-2
```

## Troubleshooting

### Issue: 403 Forbidden

**Possible causes:**
1. Policy Store ID not set in Lambda environment
2. User doesn't have required Cognito groups
3. Policy template not instantiated for the project
4. Lambda missing IAM permissions for IsAuthorizedWithToken

**Solution:**
- Check Lambda environment variable: `POLICY_STORE_ID`
- Verify user groups in JWT token
- Confirm policy instantiation for the project
- Verify Lambda execution role has AVP permissions

### Issue: POLICY_STORE_ID not set

**Solution:**
```bash
aws lambda update-function-configuration \
  --function-name <function-name> \
  --environment "Variables={POLICY_STORE_ID=$POLICY_STORE_ID}" \
  --region us-east-2
```

### Issue: Invalid JWT

**Cause:** Using access token instead of ID token

**Solution:** Use the ID token from Cognito, which contains the `cognito:groups` claim

### Development Mode

For local testing, set `SKIP_AVP=true` to bypass authorization:

```bash
export SKIP_AVP=true
export STAGE=dev
sam local start-api
```

## Rollout Checklist

- [x] Deploy AVP Policy Store (CloudFormation)
- [x] Create Cedar schema
- [x] Create static policies
- [x] Create policy templates
- [ ] Instantiate policies for active projects
- [ ] Update Lambda environment variables (POLICY_STORE_ID)
- [ ] Add IAM permissions to Lambda execution roles
- [ ] Integrate AVP in Lambda handlers
- [ ] Test authorization with sample requests
- [ ] Update client to send ID token (not access token)
- [ ] Add smoke tests to CI/CD pipeline
- [ ] Monitor AVP decisions in CloudWatch
- [ ] Document AVP policies and usage

## Next Steps

1. **Add more projects**: Instantiate policy templates for all active projects
2. **Fine-tune policies**: Adjust Cedar policies based on business requirements
3. **Add entity relationships**: Define user-project memberships in AVP
4. **Implement CI/CD**: Automate policy deployment with infrastructure-as-code
5. **Add monitoring**: Set up CloudWatch dashboards for AVP decisions
6. **Performance testing**: Measure AVP authorization overhead

## References

- [AVP README](./avp/README.md) - Detailed documentation
- [Cedar Schema](./avp/schema.cedar) - Entity model
- [Cedar Policies](./avp/policies.cedar) - Policy definitions
- [Example Handlers](./src/handlers/examples-with-avp.ts) - Integration examples
- [AWS Verified Permissions Docs](https://docs.aws.amazon.com/verifiedpermissions/)
