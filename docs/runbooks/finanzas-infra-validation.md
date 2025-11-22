# Runbook: Finanzas SD Infra Validation (us-east-2)

This runbook replays the finance stack audit end-to-end in `us-east-2` using the ProjectplaceLambdaRole.

## 1) Environment prep
1. Ensure AWS CLI is available (`aws --version`). Install via `pip install awscli` if missing.
2. Export the provided bootstrap credentials, then assume the role:
   ```bash
   aws sts assume-role \
     --role-arn arn:aws:iam::703671891952:role/ProjectplaceLambdaRole \
     --role-session-name CodexFinanzasAudit > /tmp/assume.json
   export AWS_ACCESS_KEY_ID=$(jq -r .Credentials.AccessKeyId /tmp/assume.json)
   export AWS_SECRET_ACCESS_KEY=$(jq -r .Credentials.SecretAccessKey /tmp/assume.json)
   export AWS_SESSION_TOKEN=$(jq -r .Credentials.SessionToken /tmp/assume.json)
   aws sts get-caller-identity --region us-east-2
   ```
   Confirm the account is `703671891952` and region `us-east-2`.【055c3a†L1-L5】

## 2) Inventory expected resources (source of truth)
1. Review `services/finanzas-api/template.yaml` for table prefixes, Cognito IDs, and CloudFront domain defaults to know expected names and origins.【F:services/finanzas-api/template.yaml†L4-L120】
2. Build the Finanzas UI locally to produce the reference manifest:
   ```bash
   export VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
   npm run build:finanzas
   find dist-finanzas -type f | sort > /tmp/local-finanzas-manifest.txt
   ```
   Expect assets such as `dist-finanzas/assets/index-ppTbD_1B.js` and SPA entrypoints under `dist-finanzas/`.【d46f88†L9-L23】【c5c5ea†L15-L23】

## 3) Lambda + API Gateway validation
1. List deployed Lambdas and confirm all Finanzas dev functions are present:
   ```bash
   aws lambda list-functions --region us-east-2 \
     --query "Functions[?contains(FunctionName, 'finanzas-sd-api-dev')].FunctionName"
   ```
   Ensure entries include ProjectsFn, RubrosFn, ProvidersFn, PayrollFn, AllocationsFn, PrefacturasFn, CloseMonthFn, etc.【668cf0†L2-L22】
2. Validate HTTP API, routes, and authorizer:
   ```bash
   aws apigatewayv2 get-apis --query 'Items[].{Name:Name,Id:ApiId}'
   aws apigatewayv2 get-routes --api-id pyorjw6lbe --query 'Items[].RouteKey'
   aws apigatewayv2 get-authorizers --api-id pyorjw6lbe
   ```
   Confirm API `finanzas-sd-api-dev` exists, routes cover projects/rubros/providers/payroll/allocations/prefacturas/etc., and the JWT authorizer points to pool `us-east-2_FyHLtOhiY` client `dshos5iou44tuach7ta3ici5m`.【c195ba†L1-L12】【0b9af3†L1-L77】【c4f2b9†L1-L17】

## 4) DynamoDB validation
1. List tables and ensure all `finz_` prefixed tables exist (projects, rubros, allocations, payroll_actuals, adjustments, alerts, providers, audit_log, docs, prefacturas):
   ```bash
   aws dynamodb list-tables --region us-east-2
   ```
   【564a6a†L1-L17】
2. For each table, verify schema and billing:
   ```bash
   for t in finz_projects finz_rubros finz_allocations finz_payroll_actuals \
            finz_adjustments finz_alerts finz_providers finz_audit_log; do
     aws dynamodb describe-table --table-name $t \
       --query 'Table.{KeySchema:KeySchema,BillingMode:BillingModeSummary.BillingMode}'
   done
   ```
   Expect `pk`/`sk` keys and `PAY_PER_REQUEST` billing.【4f8aa9†L1-L21】【49e190†L1-L21】【13596a†L1-L21】【cffaba†L1-L11】

## 5) S3 + CloudFront validation
1. Identify the UI distribution and origin:
   ```bash
   aws cloudfront get-distribution --id EPQU7PVDLQXUA \
     --query 'Distribution.DistributionConfig.{Origins:Origins.Items,Behaviors:CacheBehaviors.Items}'
   ```
   Confirm `/finanzas*` behaviors target origin `ukusi-ui-finanzas-prod`.【f05cd1†L1-L17】【f56339†L1-L31】
2. Compare deployed vs. local manifests:
   ```bash
   aws s3 ls s3://ukusi-ui-finanzas-prod/ --recursive | sort > /tmp/s3-finanzas-manifest.txt
   diff -u /tmp/local-finanzas-manifest.txt /tmp/s3-finanzas-manifest.txt | head
   ```
   A healthy deploy should show matching hashes (e.g., JS bundle name). Current drift shows S3 has `finanzas/assets/index-BW0ovU_7.js` while local build emits `index-ppTbD_1B.js`.【225404†L33-L38】【d46f88†L9-L23】
3. Spot-check object metadata and CloudFront health:
   ```bash
   aws s3api head-object --bucket ukusi-ui-finanzas-prod --key finanzas/index.html
   curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
   ```
   Expect `ContentType: text/html` and HTTP 200 responses.【9ddfa6†L1-L10】【deb1e8†L1-L16】

## 6) Remediation workflow
1. If drift is detected, rebuild with the correct `VITE_API_BASE_URL` and sync S3:
   ```bash
   npm run build:finanzas
   aws s3 sync dist-finanzas/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete
   aws cloudfront create-invalidation --distribution-id EPQU7PVDLQXUA --paths "/finanzas*"
   ```
2. Re-run steps 3–5 to confirm manifests match, routes still resolve, and CloudFront serves the updated bundle.

