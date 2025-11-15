# Finanzas API Contract Tests

## Overview

This document describes the API contract testing suite for the Finanzas Service Delivery API. The tests validate API behavior, response structure, and include a **no-fallback guard** that prevents mock/DEFAULT data from leaking into dev/stage/prod environments.

## Test Suite Components

### Postman Collection

**File**: `postman/finanzas-sd-api-collection.json`

The collection includes contract tests for all critical Finanzas SD endpoints:

#### Health & Monitoring
- `GET /health` - Health check endpoint (no auth required)
  - **Contract**: Returns JSON with `ok: true` (canonical requirement)
  - **Optional fields**: `status` (if present, must be "ok", "UP", or "healthy"), `env`, `version`
  - **Example response**:
    ```json
    {
      "ok": true,
      "env": "dev",
      "version": "1.0.0"
    }
    ```

#### Catalog
- `GET /catalog/rubros` - Service tiers catalog (no auth required)

#### Projects
- `GET /projects` - List all projects
- `GET /projects/{projectId}` - Get specific project

#### Handoff Management
- `GET /projects/{projectId}/handoff` - Get project handoff record
- `POST /projects/{projectId}/handoff` - Create/update handoff (requires X-Idempotency-Key)
- `PUT /handoff/{handoffId}` - Update existing handoff by ID

#### Project Rubros
- `POST /projects/{projectId}/rubros` - Attach rubros to project
- `GET /projects/{projectId}/rubros` - List project rubros
- `DELETE /projects/{projectId}/rubros/{rubroId}` - Detach rubro from project

#### Allocations
- `GET /allocations?projectId=...` - Get project allocations
- `GET /allocation-rules` - Get allocation rules

#### Payroll & Reconciliation
- `GET /payroll/actuals?projectId=&month=YYYY-MM` - Get payroll actuals
- `GET /recon?projectId=&month=YYYY-MM` - Get reconciliation data

#### Adjustments
- `POST /adjustments` - Create budget adjustment
- `GET /adjustments?projectId=...` - List adjustments for project

### Environment File

**File**: `postman/finanzas-sd-dev.postman_environment.json`

Contains environment variables:
- `baseUrl` - API base URL (injected by CI)
- `username` / `password` - Cognito credentials (injected by CI)
- `access_token` - JWT token (set by auth flow or CI)
- `cognito_client_id` - Cognito app client ID
- `aws_region` - AWS region (default: us-east-2)
- `projectId_seed` - Test project ID
- `handoffId_seed` - Test handoff ID
- `month_seed` - Test month (YYYY-MM format)

## Authentication & Authorization

All endpoints require JWT authentication via Cognito. The JWT must be passed in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### RBAC Groups

- **PM** (Project Manager) - Can create, read, and update handoffs and rubros
- **SDT** (Service Delivery Team) - Can create, read, and update handoffs and rubros
- **FIN** (Finance) - Can read handoffs and rubros
- **AUD** (Audit) - Can read handoffs and rubros

## No-Fallback Guard

### Purpose

The no-fallback guard ensures that API responses **never contain mock or DEFAULT data markers**. This prevents test/mock data from contaminating real environments.

### Implementation

The guard is implemented as a **global test script** that runs after every request in the collection:

```javascript
const body = pm.response.text();
const forbiddenMarkers = [
    'DEFAULT (healthcare)',
    'Returning DEFAULT',
    'DEFAULT_FALLBACK',
    'MOCK_DATA'
];

forbiddenMarkers.forEach(marker => {
    pm.test(`Response must not contain fallback marker: ${marker}`, function () {
        pm.expect(body.includes(marker)).to.be.false;
    });
});
```

### Forbidden Markers

Current forbidden markers:
- `DEFAULT (healthcare)` - Mock healthcare rubro
- `Returning DEFAULT` - Generic fallback indicator
- `DEFAULT_FALLBACK` - Explicit fallback flag
- `MOCK_DATA` - Mock data indicator

### Adding New Markers

To add new forbidden markers:

1. Edit `postman/finanzas-sd-api-collection.json`
2. Find the global `test` event listener in the root `event` array
3. Add the new marker string to the `forbiddenMarkers` array
4. Commit and push the change

Example:
```javascript
const forbiddenMarkers = [
    'DEFAULT (healthcare)',
    'Returning DEFAULT',
    'DEFAULT_FALLBACK',
    'MOCK_DATA',
    'YOUR_NEW_MARKER'  // Add here
];
```

## Running Tests Locally

### Prerequisites

1. Install Newman:
   ```bash
   npm install -g newman newman-reporter-junit
   ```

2. Set environment variables:
   ```bash
   export DEV_API_URL="https://your-api.execute-api.us-east-2.amazonaws.com/dev"
   export COGNITO_USER_POOL_ID="us-east-2_xxxxx"
   export COGNITO_WEB_CLIENT="your-client-id"
   export USERNAME="test-user@example.com"
   export PASSWORD="your-password"
   ```

3. Obtain a JWT token:
   ```bash
   # Use the cognito-generate-jwt action or AWS CLI
   aws cognito-idp initiate-auth \
     --auth-flow USER_PASSWORD_AUTH \
     --client-id $COGNITO_WEB_CLIENT \
     --auth-parameters USERNAME=$USERNAME,PASSWORD=$PASSWORD \
     --region us-east-2
   ```

### Running the Collection

```bash
# Remove trailing slash from base URL
BASE="${DEV_API_URL%/}"

# Run Newman
newman run postman/finanzas-sd-api-collection.json \
  -e postman/finanzas-sd-dev.postman_environment.json \
  --env-var baseUrl="$BASE" \
  --env-var access_token="$ACCESS_TOKEN" \
  --env-var username="$USERNAME" \
  --env-var password="$PASSWORD" \
  --env-var cognito_client_id="$COGNITO_WEB_CLIENT" \
  --reporters cli,junit,json \
  --reporter-junit-export newman-junit.xml \
  --reporter-json-export newman-report.json \
  --timeout-request 10000 \
  --timeout-script 5000
```

### Testing the No-Fallback Guard

To verify the no-fallback guard is working:

1. Temporarily modify an API handler to return a response containing `"DEFAULT (healthcare)"`
2. Run the Newman collection
3. The test should **fail** with a message indicating the forbidden marker was found
4. Revert the API handler change

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/api-contract-tests.yml`

### Triggers

- **Pull Requests**: Runs when PRs modify:
  - `postman/**`
  - `services/finanzas-api/**`
  - `.github/workflows/api-contract-tests.yml`
  
- **Schedule**: Nightly at 2 AM UTC (cron: `0 2 * * *`)

- **Manual**: Via `workflow_dispatch`

### Required Secrets & Variables

**Variables** (Repository → Settings → Variables):
- `DEV_API_URL` - Dev API base URL
- `COGNITO_USER_POOL_ID` - Cognito user pool ID
- `COGNITO_WEB_CLIENT` - Cognito app client ID
- `AWS_REGION` - AWS region (default: us-east-2)

**Secrets** (Repository → Settings → Secrets):
- `USERNAME` - Cognito test user email
- `PASSWORD` - Cognito test user password
- `OIDC_AWS_ROLE_ARN` - AWS IAM role for OIDC authentication

### Workflow Steps

1. **Preflight checks** - Validates all required variables and secrets exist
2. **AWS OIDC configuration** - Authenticates with AWS using OIDC
3. **JWT generation** - Obtains Cognito JWT using test credentials
4. **Newman execution** - Runs the contract test collection
5. **Report generation** - Parses results and generates summary
6. **Artifact upload** - Uploads JSON and JUnit reports

### Interpreting Results

The workflow generates a GitHub Step Summary with:

- **Total/Passed/Failed** test counts
- **Failed tests** with error messages (if any)
- **Endpoints tested** with HTTP status codes and response times
- **No-fallback guard status** - Shows violations if any DEFAULT markers detected
- **Configuration** - API base URL, collection file, environment

### Failure Modes

The workflow will **fail** if:
1. Any endpoint returns an unexpected HTTP status code
2. Response structure is missing required fields
3. Any response contains a forbidden marker (`DEFAULT (healthcare)`, etc.)
4. Request timeout exceeds 10 seconds
5. Newman execution errors occur

## Test Assertions

Each request includes test scripts that validate:

### Status Codes
```javascript
pm.test('Status code is 200', function () {
    pm.response.to.have.status(200);
});
```

### Response Structure
```javascript
pm.test('Response has data array', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
    pm.expect(jsonData.data).to.be.an('array');
});
```

### Response Time
```javascript
pm.test('Response time is less than 2000ms', function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

### Required Fields
```javascript
pm.test('Each rubro has required fields', function () {
    const jsonData = pm.response.json();
    if (jsonData.data.length > 0) {
        const rubro = jsonData.data[0];
        pm.expect(rubro).to.have.property('rubro_id');
        pm.expect(rubro).to.have.property('nombre');
    }
});
```

## Maintenance

### Adding New Endpoints

1. Open `postman/finanzas-sd-api-collection.json`
2. Add a new request to the appropriate folder/section
3. Include test scripts for status codes and response structure
4. Update this documentation with the new endpoint

### Updating Test Credentials

Test credentials are stored as GitHub Secrets. To update:

1. Go to Repository → Settings → Secrets and variables → Actions
2. Update `USERNAME` and `PASSWORD` secrets
3. Ensure the user exists in the Cognito user pool and has appropriate group memberships

### Modifying Expected Status Codes

Some endpoints may return `501 Not Implemented` during development. To adjust:

1. Edit the test script for the specific request
2. Update the expected status codes:
   ```javascript
   pm.test('Status code is 200, 404, or 501', function () {
       pm.expect(pm.response.code).to.be.oneOf([200, 404, 501]);
   });
   ```

## Troubleshooting

### Newman Fails with "access_token not set"

**Solution**: Ensure the JWT generation step in the workflow succeeded. Check:
- Cognito credentials are correct
- User exists in the user pool
- User has appropriate permissions

### Tests Fail with "DEFAULT (healthcare)" Error

**Cause**: API is returning mock/fallback data.

**Solution**: 
1. Check the API handler implementation
2. Ensure DynamoDB tables are seeded with real data
3. Verify no hardcoded DEFAULT values in code

### Request Timeout

**Cause**: API endpoint taking longer than 10 seconds.

**Solution**:
1. Check API logs for performance issues
2. Optimize database queries
3. Increase timeout if legitimately needed (edit workflow)

### 401 Unauthorized on Protected Endpoints

**Cause**: JWT token invalid or expired.

**Solution**:
1. Verify token generation in workflow logs
2. Check Cognito user pool settings
3. Ensure user has correct group memberships (PM, SDT, etc.)

## Newman Report Format

Newman generates two report formats:

### JSON Report (`newman-report.json`)
```json
{
  "run": {
    "stats": {
      "tests": {
        "total": 25,
        "passed": 25,
        "failed": 0
      }
    },
    "executions": [
      {
        "item": { "name": "GET /health" },
        "response": {
          "code": 200,
          "responseTime": 145
        },
        "assertions": [...]
      }
    ]
  }
}
```

### JUnit Report (`newman-junit.xml`)
Standard JUnit XML format compatible with CI/CD systems and test reporting tools.

## Related Documentation

- [OpenAPI Specification](../openapi/finanzas.yaml)
- [Finanzas API Architecture](../docs/FINANZAS_SERVICE_DELIVERY_ARCHITECTURE.md)
- [Testing Guide](../docs/TESTING_GUIDE.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)

---

## Handoff Endpoints

### 1. GET /projects/{projectId}/handoff

Retrieves the current handoff record for a project.

**Authorization**: Any authenticated user with PM, SDT, FIN, or AUD group

**Response (200)**:
```json
{
  "handoffId": "handoff_abc123",
  "projectId": "P-TEST-1",
  "owner": "pm@example.com",
  "fields": {
    "mod_total": 1500000,
    "pct_ingenieros": 65,
    "pct_sdm": 35,
    "notes": "First handoff"
  },
  "version": 1,
  "createdAt": "2025-11-15T10:00:00Z",
  "updatedAt": "2025-11-15T10:00:00Z"
}
```

**Response (404)**: Handoff not found

---

### 2. POST /projects/{projectId}/handoff

Creates or replaces the handoff record for a project. This operation is idempotent.

**Authorization**: PM or SDT group required

**Required Headers**:
- `Authorization: Bearer <jwt>`
- `X-Idempotency-Key: <unique_key>` (required for idempotent operation)

**Request Body**:
```json
{
  "owner": "pm@example.com",
  "fields": {
    "mod_total": 1500000,
    "pct_ingenieros": 65,
    "pct_sdm": 35,
    "notes": "First handoff"
  }
}
```

**Response (201)**: Handoff created
**Response (200)**: Idempotent response (same idempotency key)
**Response (409)**: Conflict - same idempotency key with different payload

---

### 3. PUT /handoff/{handoffId}

Updates an existing handoff record by ID. Supports optimistic concurrency control via version number.

**Authorization**: PM or SDT group required

**Request Body**:
```json
{
  "projectId": "P-TEST-1",
  "fields": {
    "mod_total": 1600000,
    "pct_ingenieros": 70,
    "pct_sdm": 30,
    "notes": "Updated handoff"
  },
  "version": 1
}
```

**Response (200)**: Handoff updated
**Response (412)**: Precondition Failed - version mismatch

---

## Rubros (Service Tiers) Endpoints

### 4. GET /catalog/rubros

Retrieves the global Ikusi service tiers (rubros taxonomy). This endpoint is already implemented.

**Authorization**: No authentication required (public catalog)

**Response (200)**:
```json
{
  "data": [
    {
      "rubro_id": "R-IKUSI-GO",
      "nombre": "Ikusi GO",
      "categoria": "SERVICE_TIER",
      "tier": "go",
      "descripcion": "Basic service tier"
    }
  ],
  "total": 1
}
```

---

### 5. POST /projects/{projectId}/rubros

Attaches one or more rubros (service tiers) to a project.

**Authorization**: PM or SDT group required

**Request Body**:
```json
{
  "rubroIds": ["R-IKUSI-GO", "R-IKUSI-GOLD"]
}
```

**Response (200)**:
```json
{
  "message": "Attached 2 rubros to project P-TEST-1",
  "attached": ["R-IKUSI-GO", "R-IKUSI-GOLD"]
}
```

---

### 6. GET /projects/{projectId}/rubros

Lists all rubros attached to a specific project.

**Authorization**: Any authenticated user with PM, SDT, FIN, or AUD group

**Response (200)**:
```json
{
  "data": [
    {
      "projectId": "P-TEST-1",
      "rubroId": "R-IKUSI-GO",
      "tier": "go",
      "category": "SERVICE_TIER",
      "createdAt": "2025-11-15T10:00:00Z",
      "createdBy": "pm@example.com"
    }
  ],
  "total": 1
}
```

---

### 7. DELETE /projects/{projectId}/rubros/{rubroId}

Detaches a specific rubro from a project.

**Authorization**: PM or SDT group required

**Response (200)**:
```json
{
  "message": "Detached rubro R-IKUSI-GO from project P-TEST-1"
}
```

**Response (404)**: Rubro attachment not found

---

## Data Model

### Handoff Record (DynamoDB)

Stored in the `projects` table with the following structure:

```
pk: PROJECT#<projectId>
sk: HANDOFF#<handoffId>
handoffId: string
projectId: string
owner: string (email)
fields: object (generic key/value payload)
version: number (for optimistic concurrency)
createdAt: timestamp
updatedAt: timestamp
createdBy: string (email)
```

### Idempotency Record

Stored in the `projects` table:

```
pk: IDEMPOTENCY#HANDOFF
sk: <idempotency-key>
payload: object (original request)
result: object (response returned)
ttl: number (24 hours TTL)
```

### Project Rubro Attachment (DynamoDB)

Stored in the `rubros` table:

```
pk: PROJECT#<projectId>
sk: RUBRO#<rubroId>
projectId: string
rubroId: string
tier: string (optional)
category: string (optional)
metadata: object (optional)
createdAt: timestamp
createdBy: string (email)
```

---

## Error Responses

### 400 Bad Request
Missing required parameters or invalid JSON

### 401 Unauthorized
Missing or invalid JWT token

### 403 Forbidden
User does not have required group membership

### 404 Not Found
Resource does not exist

### 409 Conflict
Idempotency key conflict (different payload)

### 412 Precondition Failed
Version mismatch in optimistic concurrency control

### 500 Internal Server Error
Unexpected server error

---

## CORS Configuration

All endpoints support CORS with the following configuration:
- **Allowed Origins**: CloudFront domain(s) only
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Authorization, Content-Type, X-Idempotency-Key
- **Max Age**: 600 seconds

---

## Audit Logging

All write operations (POST, PUT, DELETE) are logged to the `audit_log` table with the following information:

- Action performed
- User email
- Timestamp
- Before/after state
- Source IP address
- User agent

---

## Example Workflow

1. **Create a handoff for a project**:
   ```bash
   POST /projects/P-TEST-1/handoff
   Headers:
     Authorization: Bearer <jwt>
     X-Idempotency-Key: test-key-123
   Body:
     { "owner": "pm@example.com", "fields": { "notes": "Initial handoff" } }
   ```

2. **Attach rubros to the project**:
   ```bash
   POST /projects/P-TEST-1/rubros
   Headers:
     Authorization: Bearer <jwt>
   Body:
     { "rubroIds": ["R-IKUSI-GO", "R-IKUSI-GOLD"] }
   ```

3. **Read the handoff**:
   ```bash
   GET /projects/P-TEST-1/handoff
   Headers:
     Authorization: Bearer <jwt>
   ```

4. **Update the handoff**:
   ```bash
   PUT /handoff/{handoffId}
   Headers:
     Authorization: Bearer <jwt>
   Body:
     { "projectId": "P-TEST-1", "fields": { "notes": "Updated" }, "version": 1 }
   ```

5. **Detach a rubro**:
   ```bash
   DELETE /projects/P-TEST-1/rubros/R-IKUSI-GO
   Headers:
     Authorization: Bearer <jwt>
   ```
