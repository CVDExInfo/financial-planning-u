# Finanzas API Endpoints Status

This document tracks the status of API endpoints used by the Finanzas UI frontend.

Last Updated: 2024-11-18

## ✅ Implemented & Working

These endpoints are fully implemented in the backend and tested:

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/projects` | GET | projects.ts | List all projects |
| `/projects` | POST | projects.ts | Create a new project |
| `/baseline` | POST | baseline.ts | Create a baseline budget |
| `/baseline/{id}` | GET | baseline.ts | Get baseline by ID |
| `/projects/{id}/handoff` | POST | handoff.ts | Handoff project to SDMT |
| `/projects/{id}/handoff` | GET | handoff.ts | Get handoff details |
| `/projects/{projectId}/rubros` | GET | rubros.ts | List rubros for a project |
| `/projects/{projectId}/rubros` | POST | rubros.ts | Attach rubros to project |
| `/projects/{id}/billing` | GET | billing.ts | Summarize prefacturas into monthly inflows |
| `/projects/{id}/plan` | GET | plan.ts | Get financial plan/forecast data |
| `/plan/forecast` | GET | forecast.ts | Get forecast data with filters |
| `/catalog/rubros` | GET | catalog.ts | Get rubros catalog |
| `/prefacturas` | GET/POST | prefacturas.ts | Manage pre-invoices |
| `/health` | GET | health.ts | Health check endpoint |

## ⚠️ Missing / Not Yet Implemented

These endpoints are referenced in the frontend but don't exist in the backend yet:

| Endpoint | Frontend Method | Current Behavior | Recommendation |
|----------|----------------|------------------|----------------|
| `/projects/{id}/invoices` | `getInvoices()` | Returns empty array `[]` | Consider using `/prefacturas` endpoint instead |
| `/invoices/{id}/status` | `updateInvoiceStatus()` | Throws error | Implement invoice status update or use prefacturas |

## 📝 Frontend Graceful Degradation

The frontend has been updated to handle missing endpoints gracefully:

- API failures return empty arrays/objects instead of crashing
- Proper error logging helps with debugging
- UI components handle empty data states
- Users see appropriate "no data" messages instead of errors

## 🔧 Adding Missing Endpoints

If you need to implement the missing endpoints, follow this pattern:

### Example: Billing Handler

```typescript
// services/finanzas-api/src/handlers/billing.ts
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ensureSDT } from '../lib/auth';
import { ok, bad } from '../lib/http';
import { ddb, tableName, QueryCommand } from '../lib/dynamo';

export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);
  const projectId = event.queryStringParameters?.project_id;

  if (!projectId) {
    return bad('missing project_id parameter');
  }

  // Query billing data from DynamoDB
  // Return in format: { monthly_inflows: BillingPeriod[] }
  
  return ok({ monthly_inflows: [] });
};
```

Then add to `template.yaml`:

```yaml
BillingFn:
  Type: AWS::Serverless::Function
  Properties:
    Handler: billing.handler
    Events:
      GetBilling:
        Type: HttpApi
        Properties:
          Path: "/billing"
          Method: GET
```

## 🧪 Testing Endpoints

### Local Testing

```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/projects/{id}/plan

# Test forecast endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/plan/forecast?projectId=P-123&months=12"
```

### Check Backend Logs

```bash
# View CloudWatch logs for a specific function
aws logs tail /aws/lambda/finanzas-api-PlanFn --follow --region us-east-2
```

## 🔗 Related Documentation

- [OpenAPI Specification](./openapi/finanzas.yaml)
- [Authentication Flow](./AUTHENTICATION_FLOW.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
