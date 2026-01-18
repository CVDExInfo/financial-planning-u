# Finanzas SD API

Finanzas API expone los endpoints de proyectos, rubros, line items, conciliación de facturas y carga de documentos usados por la UI de Finanzas SD (rutas `/finanzas/**`). Está implementada con AWS SAM y Lambda en us-east-2.

## Ejecutar localmente
```bash
npm ci
sam build
sam local start-api --env-vars env.dev.json
```

## Ejecutar pruebas
- Las pruebas de Jest se ejecutan en modo CommonJS usando `ts-jest` para evitar problemas de `exports is not defined` en entornos ESM.
- Comando recomendado: `npm test` (internamente ejecuta `jest --runInBand`).
- Para volver a probar el modo ESM en el futuro, cambie el preset en `jest.config.cjs` a `ts-jest/presets/default-esm` y habilite `useESM: true` en el transform, luego ejecute Jest con `node --experimental-vm-modules`.

## Contratos y referencias
- Contratos de endpoints: consulte `docs/finanzas/api-contracts.md`.
- Arquitectura y tablas: consulte `docs/finanzas/architecture.md`.

## Notas de autenticación
- Usa Cognito JWT con grupos `PMO`, `FIN`, `SDMT`, `EXEC_RO`.
- Asegure las variables de entorno de pool/cliente en `template.yaml` o `env.*.json` antes de levantar localmente.

## DynamoDB Table Schemas

### Allocations Table

The allocations table stores monthly budget allocations for projects. Both the materializer and the allocations handler must write items using the same key structure.

**Primary Key Structure:**
- `pk` (Partition Key): `PROJECT#{projectId}` - Groups all allocations by project
- `sk` (Sort Key): `ALLOCATION#{baselineId}#{calendarMonth}#{rubroId}` - Provides chronological ordering and uniqueness

**Required Attributes:**
- `project_id` (string): Project identifier (e.g., "P-7e4fbaf2-...")
- `projectId` (string): Same as project_id (for compatibility)
- `baseline_id` (string): Baseline identifier
- `baselineId` (string): Same as baseline_id (for compatibility)
- `rubro_id` (string): Budget line item identifier
- `calendar_month` (string): ISO month format (YYYY-MM)
- `month` (string): Same as calendar_month (for compatibility)
- `month_index` (number): Contract month (1-60)
- `planned` (number): Planned allocation amount
- `forecast` (number): Forecasted amount (initially equals planned)
- `actual` (number): Actual spent amount
- `allocation_type` (string): "planned" or "forecast"
- `createdAt` (string): ISO timestamp
- `updatedAt` (string): ISO timestamp

**Example Item:**
```json
{
  "pk": "PROJECT#P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7",
  "sk": "ALLOCATION#baseline-123#2025-05#MOD-ING",
  "project_id": "P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7",
  "projectId": "P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7",
  "baseline_id": "baseline-123",
  "baselineId": "baseline-123",
  "rubro_id": "MOD-ING",
  "calendar_month": "2025-05",
  "month": "2025-05",
  "month_index": 1,
  "planned": 10000,
  "forecast": 10000,
  "actual": 0,
  "allocation_type": "planned",
  "source": "baseline_materializer",
  "createdAt": "2025-01-16T19:00:00.000Z",
  "updatedAt": "2025-01-16T19:00:00.000Z"
}
```

**GSI Recommendations:**
- Consider adding a GSI on `baseline_id` to support queries by baseline
- Consider adding a GSI on `rubro_id` to support queries by budget line item

**Important Notes:**
- The SK format MUST be consistent between the materializer (`materializeAllocationsForBaseline`) and the allocations handler (`bulkUpdateAllocations`)
- The order in SK is: `ALLOCATION#{baselineId}#{calendarMonth}#{rubroId}` - NOT `ALLOCATION#{baselineId}#{rubroId}#{calendarMonth}`
- This ensures idempotent writes and allows the GET endpoint to find materialized data
- Always include both snake_case and camelCase versions of key attributes for backward compatibility
