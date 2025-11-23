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
  "username": "<Authentication Token from Planview UI>",
  "password": "",
  "odata_url": "https://ikusi-sb.pvcloud.com/odataservice/odataservice.svc"
}
```

For Basic authentication, the ingestor uses the token for both the username and password (i.e., `token:token`), matching the official Planview E1 OData Postman collection.

## Planview OData Ingestor

The OData ingestor extracts datasets from Planview Portfolios OData and lands them in S3 for downstream Finanzas, Pre-factura, and PMO analytics. It is designed to run on a schedule (nightly/hourly) and is independent from the REST OAuth flows.

### Required secret
`planview/qa/odata`

```json
{
  "username": "PVA_...token...",
  "password": "",
  "odata_url": "https://ikusi-sb.pvcloud.com/odataservice/odataservice.svc"
}
```

The ingestor normalizes any `/planview` prefix out of `odata_url` so that calls are made against `/odataservice/odataservice.svc`.

### Environment variables
- `ODATA_SECRET_ID` – defaults to `planview/qa/odata`.
- `RAW_BUCKET` – `planview-ingest-qa-703671891952`.
- `ODATA_ENTITIES` – comma-separated list of OData entity/dataset names.
- `PROJECTS_TABLE` – DynamoDB table name for project dimension rows (default `PlanviewProjects`).
- `FINANCIAL_FACTS_TABLE` – DynamoDB table name for financial fact rows (default `PlanviewFinancialFacts`).

### Running locally
```bash
cd services/planview-ingestor
npm install
npm test
npm run build
sam build
sam local invoke PlanviewODataIngestFunction --event events/empty.json
```

### Expected behavior
- Each configured entity is fetched via OData with Basic authentication.
- Pagination via `@odata.nextLink` / `$skiptoken` is handled automatically.
- Data is written to S3 at `s3://planview-ingest-qa-703671891952/odata/<Entity>/run=<timestamp>.json` with the full JSON payload.
- CloudWatch logs summarize entities processed, counts, and S3 keys without exposing credentials.

### DynamoDB Schemas for Planview OData

#### PlanviewProjects (DynamoDB)

- Partition key: `ppl_code` (string)
- Attributes: `project_name`, `project_status`, `work_type`, `work_id`, `lifecycle_stage`, `overall_status_assessment`, optional `work_description`, and `raw`.

#### PlanviewFinancialFacts (DynamoDB)

- Partition key: `ppl_code` (string)
- Sort key: `period_id` (string)
- Attributes: `account_type`, `cost_amount`, `benefit_amount`, `baseline_cost`, `baseline_benefit`, `currency_code`, `currency_symbol`, `forecast_version_indicator`, `baseline_version_indicator`, and `raw`.

The OData ingest writes full JSON snapshots for each entity to S3 **and** hydrates the DynamoDB tables for cross-project analytics.
