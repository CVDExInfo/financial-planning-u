# SDMT Forecast error diagnosis

## Observation
- UI console shows repeated recalculations with zero items and a `ServerError: Error interno en Finanzas` when loading forecast data for projects.
- UI fallback renders `Error interno en Finanzas` and zeroed metrics, indicating the backend `/plan/forecast` request failed.

## Source of the failure
- The `/plan/forecast` Lambda (`services/finanzas-api/src/handlers/forecast.ts`) wraps its logic in a try/catch and returns `serverError` when any unexpected error is thrown. That path produces the generic error string the UI displays. If the DynamoDB queries for allocations, payroll, or rubro attachments fail (missing tables, permissions, or malformed responses), the handler bubbles that failure into this `serverError` response.
- When the handler cannot build forecast rows because the upstream tables are empty or inaccessible, the resulting `forecastData` array remains empty and the UI shows zeros even before the error, matching the observed behaviour.

## Where to investigate next
- Check CloudWatch logs for the `forecast` Lambda around the failing requests to capture the actual exception. Look for DynamoDB `ResourceNotFoundException`, IAM access denied, or serialization errors.
- Verify the environment variables (`TABLE_ALLOCATIONS`, `TABLE_RUBROS`, `TABLE_PAYROLL_ACTUALS`) and IAM policies for the forecast function match the deployed table names. Missing/mismatched names will cause the `QueryCommand` calls (lines 63–92) to throw and trigger the server error.
- Confirm the recent backend changes that populate `allocations` and `rubros` are deployed and seeded in the target environment; otherwise the handler falls back to empty data and zeros.

## Relevant code references
- Forecast handler parameters, DynamoDB queries, and catch-all error path that emits the server error surfaced by the UI are in `services/finanzas-api/src/handlers/forecast.ts` lines 33–209.
