# Optional SAM Template Updates for AVP Integration

This document describes optional updates to `template.yaml` to integrate AVP with your Lambda functions.

## Option 1: Add POLICY_STORE_ID as a Parameter

Add this to the Parameters section:

```yaml
Parameters:
  # ... existing parameters ...
  
  PolicyStoreId:
    Type: String
    Description: AVP Policy Store ID (leave empty to skip AVP authorization)
    Default: ""
```

## Option 2: Add POLICY_STORE_ID to Global Environment Variables

Update the Globals section:

```yaml
Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 15
    MemorySize: 256
    Architectures: [x86_64]
    Tracing: Active
    Environment:
      Variables:
        NODE_OPTIONS: --enable-source-maps
        TABLE_PROJECTS: !Sub "${TablePrefix}projects"
        TABLE_RUBROS: !Sub "${TablePrefix}rubros"
        TABLE_RUBROS_TAXONOMIA: !Sub "${TablePrefix}rubros_taxonomia"
        TABLE_ALLOC: !Sub "${TablePrefix}allocations"
        TABLE_PAYROLL: !Sub "${TablePrefix}payroll_actuals"
        TABLE_ADJ: !Sub "${TablePrefix}adjustments"
        TABLE_ALERTS: !Sub "${TablePrefix}alerts"
        TABLE_PROVIDERS: !Sub "${TablePrefix}providers"
        TABLE_AUDIT: !Sub "${TablePrefix}audit_log"
        STAGE_NAME: !Ref StageName
        # AVP Configuration
        POLICY_STORE_ID: !Ref PolicyStoreId
        SKIP_AVP: !Ref SkipAuth  # Reuse SkipAuth parameter for development
```

## Option 3: Add IAM Policy for AVP Authorization

Create a reusable IAM policy:

```yaml
Resources:
  # Add after existing resources
  
  AVPAuthorizationPolicy:
    Type: AWS::IAM::ManagedPolicy
    Condition: HasPolicyStore
    Properties:
      Description: Allow Lambda functions to call AVP IsAuthorizedWithToken
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - verifiedpermissions:IsAuthorizedWithToken
            Resource: !Sub "arn:aws:verifiedpermissions:${AWS::Region}:${AWS::AccountId}:policy-store/${PolicyStoreId}"
```

## Option 4: Add Condition for Optional AVP

Add a condition to enable AVP only when configured:

```yaml
Conditions:
  HasPolicyStore: !Not [!Equals [!Ref PolicyStoreId, ""]]
```

## Option 5: Update Individual Lambda Functions

Add AVP policy to functions that need authorization:

```yaml
AllocationsFn:
  Type: AWS::Serverless::Function
  Properties:
    # ... existing properties ...
    Policies:
      - AWSLambdaBasicExecutionRole
      - DynamoDBCrudPolicy:
          TableName: !Ref AllocationsTable
      # Add AVP authorization policy
      - !If
        - HasPolicyStore
        - !Ref AVPAuthorizationPolicy
        - !Ref AWS::NoValue
```

## Complete Example

Here's a complete snippet showing all changes:

```yaml
Parameters:
  # ... existing parameters ...
  PolicyStoreId:
    Type: String
    Description: AVP Policy Store ID (leave empty to skip AVP authorization)
    Default: ""

Conditions:
  HasPolicyStore: !Not [!Equals [!Ref PolicyStoreId, ""]]

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 15
    MemorySize: 256
    Architectures: [x86_64]
    Tracing: Active
    Environment:
      Variables:
        NODE_OPTIONS: --enable-source-maps
        # ... existing variables ...
        POLICY_STORE_ID: !Ref PolicyStoreId
        SKIP_AVP: !Ref SkipAuth

Resources:
  AVPAuthorizationPolicy:
    Type: AWS::IAM::ManagedPolicy
    Condition: HasPolicyStore
    Properties:
      Description: Allow Lambda functions to call AVP IsAuthorizedWithToken
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - verifiedpermissions:IsAuthorizedWithToken
            Resource: !Sub "arn:aws:verifiedpermissions:${AWS::Region}:${AWS::AccountId}:policy-store/${PolicyStoreId}"

  AllocationsFn:
    Type: AWS::Serverless::Function
    Properties:
      # ... existing properties ...
      Policies:
        - AWSLambdaBasicExecutionRole
        - DynamoDBCrudPolicy:
            TableName: !Ref AllocationsTable
        - !If
          - HasPolicyStore
          - !Ref AVPAuthorizationPolicy
          - !Ref AWS::NoValue

  # Repeat for other functions that need AVP authorization:
  # - ProjectsFn
  # - AdjustmentsFn
  # - ProvidersFn
  # - PayrollFn
  # - CloseMonthFn
  # - PlanFn
  # - PrefacturasFn
```

## Deployment

After updating the template, deploy with the Policy Store ID:

```bash
# First, deploy the AVP policy store
aws cloudformation deploy \
  --template-file avp-policy-store.yaml \
  --stack-name finanzas-avp-dev \
  --capabilities CAPABILITY_IAM

# Get the Policy Store ID
POLICY_STORE_ID=$(aws cloudformation describe-stacks \
  --stack-name finanzas-avp-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyStoreId`].OutputValue' \
  --output text)

# Then deploy the API with the Policy Store ID
sam build
sam deploy \
  --parameter-overrides \
    PolicyStoreId=$POLICY_STORE_ID \
    SkipAuth=false
```

## Notes

- **Backward Compatible**: The template changes are backward compatible. If `PolicyStoreId` is empty, AVP authorization is skipped.
- **Development Mode**: Set `SkipAuth=true` for local development to bypass AVP checks.
- **Minimal Changes**: These are optional updates. The AVP library works without template changes if you set `POLICY_STORE_ID` as an environment variable manually.
- **Gradual Rollout**: You can enable AVP per function by conditionally adding the policy to specific functions.

## Alternative: Manual Configuration

If you prefer not to modify the template, you can configure AVP manually:

1. Deploy Lambda functions without AVP configuration
2. Manually add `POLICY_STORE_ID` environment variable to each function
3. Manually attach AVP IAM policy to Lambda execution roles

This approach is useful for testing AVP before committing template changes.
