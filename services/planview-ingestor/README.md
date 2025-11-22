# Planview Ingestor (QA Smoke Test)

This AWS SAM service performs a minimal end-to-end connectivity check against Planview QA and stores the raw response in S3.

## What it does
1. Fetches OAuth client credentials from **planview/qa/oauth**.
2. Requests an OAuth access token using application/x-www-form-urlencoded (client_credentials grant).
3. Calls the Planview Work endpoint for the configured test project.
4. Writes the raw JSON response to the designated S3 bucket.
5. Optionally performs a lightweight OData `$metadata` check using **planview/qa/odata**.

## Deployment
- Default region: **us-east-2**
- Default stack name: `planview-ingestor-qa`
- Default bucket: `planview-ingest-qa-703671891952`
- Runtime: **nodejs20.x**

### Parameters
| Name | Default | Description |
| --- | --- | --- |
| `StackName` | `planview-ingestor-qa` | Base name for resources. |
| `RawBucketName` | `planview-ingest-qa-703671891952` | Bucket for raw Planview JSON dumps. |
| `OAuthSecretId` | `planview/qa/oauth` | Secrets Manager ID for OAuth client credentials. |
| `ODataSecretId` | `planview/qa/odata` | Secrets Manager ID for optional OData credentials. |
| `TestProjectId` | `12345` | Project ID used for the smoke query (override post-deploy). |

### Build & Validate
```bash
cd services/planview-ingestor
npm install
npm run build
npm test
npm run sam:validate
```

### Deploy
Use OIDC (no static credentials) and run a guided deploy to set/confirm parameters:
```bash
sam build
sam deploy --guided \
  --stack-name planview-ingestor-qa \
  --region us-east-2 \
  --capabilities CAPABILITY_IAM
```
After deployment, update `TEST_PROJECT_ID` in the Lambda environment if needed.

### Expected Logs (CloudWatch)
```
Starting Planview QA smoke test
Planview QA smoke test complete { workItems: <n>, bucket: <bucket>, key: <key>, odataStatus: <ok|failed|skipped> }
```

## Local Testing
Unit tests mock HTTP calls and Secrets Manager for deterministic validation. The handler itself is intended for cloud execution with real secrets and Planview connectivity.

### Secrets Format

**planview/qa/oauth**

```json
{
  "client_id": "<access key>",
  "client_secret": "<token/secret>",
  "base_url": "https://ikusi-sb.pvcloud.com/planview/public-api/v1"
}
```

**planview/qa/odata**

```json
{
  "username": "<access key or OData user>",
  "password": "<token/secret or \"\">",
  "odata_url": "https://ikusi-sb.pvcloud.com/planview/odataservice/odataservice.svc"
}
```
