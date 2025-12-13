# Finanzas SD Validation Module

This directory contains TypeScript/Zod validation schemas that mirror the OpenAPI 3.1 component schemas defined in `openapi/finanzas.yaml`.

## Purpose

The validation module provides:
- **Runtime type safety** - Validates data at runtime using Zod schemas
- **Type inference** - Automatic TypeScript types derived from schemas
- **Consistent contracts** - Mirrors OpenAPI definitions exactly
- **Parse functions** - Easy-to-use parse and safeParse functions for each entity

## Usage

### Basic Validation

```typescript
import { parseHealthResponse, parseHandoff, parseEstimatorItem } from '../validation';

// Parse and validate (throws on error)
const health = parseHealthResponse(data);

// Safe parse (returns result object)
const result = safeParseHandoff(data);
if (result.success) {
  console.log('Valid handoff:', result.data);
} else {
  console.error('Validation errors:', result.error);
}
```

### In Handlers

```typescript
import { parseEstimatorItem } from '../validation/estimator';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedItem = parseEstimatorItem(body);
    
    // validatedItem is now type-safe and validated
    await saveToDatabase(validatedItem);
    
    return {
      statusCode: 201,
      body: JSON.stringify(validatedItem),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Validation failed',
          details: error.errors 
        }),
      };
    }
    throw error;
  }
};
```

## Available Validators

| Module | Schemas | Description |
|--------|---------|-------------|
| `health.ts` | HealthResponse | Health check endpoint response |
| `handoff.ts` | Handoff | Project handoff data |
| `rubros.ts` | Rubro, ProjectRubroAttachment, RubroCreate | Budget line items |
| `estimator.ts` | EstimatorItem, EstimatorItemCreate | Estimator/baseline items |
| `allocations.ts` | Allocation, AllocationCreate, AllocationBulk | Budget allocations |
| `payroll.ts` | PayrollActual, PayrollIngest | Payroll actuals and imports |
| `adjustments.ts` | Adjustment, AdjustmentCreate | Budget adjustments |
| `recon.ts` | ReconSummary | Reconciliation summaries |

## Schema Alignment

These schemas are aligned with:
- OpenAPI 3.1 definitions in `openapi/finanzas.yaml`
- QA/Postman tests (L4)
- Frontend typed client (L2)

Any changes to schemas should be made in **both** OpenAPI and this validation module to maintain consistency.

## Testing

Unit tests for validators are in `tests/unit/validation.*.spec.ts`. Run tests with:

```bash
npm test
```

## References

- OpenAPI Spec: `openapi/finanzas.yaml`
- Seeding has been removed from the platform. Use real user flows to create data when validating schemas.
