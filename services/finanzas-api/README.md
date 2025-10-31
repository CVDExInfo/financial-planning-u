# Finanzas SD API (SAM)

- Region: us-east-2
- Auth: Cognito JWT (same pool as acta-ui), group `SDT` required.
- Deploy (dev):
  ```bash
  sam build
  sam deploy --no-confirm-changeset --stack-name finanzas-sd-api-dev --resolve-s3 --capabilities CAPABILITY_IAM \
    --parameter-overrides CognitoUserPoolArn=<your-userpool-arn> CognitoUserPoolId=<your-userpool-id> StageName=dev
  ```

* Test:

  ```bash
  npm ci
  npm test
  sam local start-api
  ```
