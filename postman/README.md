# Finanzas API Contract Tests - Quick Start

This directory contains the Postman/Newman contract test suite for the Finanzas SD API.

## Files

- **finanzas-sd-api-collection.json** - Main Postman collection with all contract tests
- **finanzas-sd-dev.postman_environment.json** - Environment configuration for dev stage
- **Finanzas.postman_collection.json** - Legacy full collection (kept for backward compatibility)
- **finanzas-smokes.json** - Basic smoke tests

## Quick Local Test

To run the contract tests locally against the dev environment:

### 1. Install Newman

```bash
npm install -g newman newman-reporter-junit
```

### 2. Set Environment Variables

```bash
export DEV_API_URL="https://your-api-id.execute-api.us-east-2.amazonaws.com/dev"
export ACCESS_TOKEN="your-jwt-token-here"
```

To get an access token, use AWS CLI:

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=your-user@example.com,PASSWORD=your-password \
  --region us-east-2 \
  --query 'AuthenticationResult.AccessToken' \
  --output text
```

### 3. Run Newman

```bash
# Remove trailing slash from URL
BASE="${DEV_API_URL%/}"

# Run the collection
newman run finanzas-sd-api-collection.json \
  -e finanzas-sd-dev.postman_environment.json \
  --env-var "baseUrl=$BASE" \
  --env-var "access_token=$ACCESS_TOKEN" \
  --reporters cli,json \
  --reporter-json-export ./newman-report.json
```

### 4. View Results

Results are printed to console and saved to `newman-report.json`.

## No-Fallback Guard

The collection includes a **global test script** that fails if any response contains:

- `DEFAULT (healthcare)`
- `Returning DEFAULT`
- `DEFAULT_FALLBACK`
- `MOCK_DATA`

This ensures no mock/DEFAULT data leaks into real environments.

## CI/CD

The collection runs automatically in GitHub Actions:

- **On PR**: When files in `postman/` or `services/finanzas-api/` change
- **Nightly**: Every day at 2 AM UTC
- **Manual**: Via workflow dispatch

See `.github/workflows/api-contract-tests.yml` for details.

## Documentation

Full documentation is available in:
- [docs/api-contracts.md](../docs/api-contracts.md) - Complete API contract documentation
- [openapi/finanzas.yaml](../openapi/finanzas.yaml) - OpenAPI specification

## Endpoints Tested

- Health check
- Catalog (rubros)
- Projects (list, get)
- Handoff (get, create, update)
- Project Rubros (attach, list, detach)
- Allocations (get, rules)
- Payroll actuals
- Reconciliation
- Adjustments (create, list)

## Troubleshooting

### "access_token not set"
Ensure you've exported `ACCESS_TOKEN` before running Newman.

### "Response must not contain fallback marker"
The API returned mock/DEFAULT data. Check the API implementation.

### 401 Unauthorized
Your JWT token may be expired or invalid. Generate a new one.

## Adding New Tests

1. Import `finanzas-sd-api-collection.json` into Postman desktop app
2. Add new requests with test scripts
3. Export collection (Collection v2.1)
4. Replace `finanzas-sd-api-collection.json` with exported file
5. Update documentation in `docs/api-contracts.md`
