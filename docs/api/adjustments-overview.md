# Adjustments API - Overview

## Endpoint
`POST /adjustments` - Create a new budget adjustment  
`GET /adjustments` - List adjustments with optional filtering

## Business Logic

The adjustments endpoint manages budget adjustments for projects, including:
- **Excesos**: Budget overages that need to be distributed across future months
- **Déficits**: Budget shortfalls requiring reallocation
- **Reajustes**: General budget adjustments

### Pro-Rata Distribution

When creating an adjustment with `metodo_distribucion: pro_rata_forward`, the system automatically distributes the adjustment amount evenly across the specified number of months, handling rounding to ensure the total matches exactly.

**Example**: A $1,000,000 excess distributed over 3 months:
- Month 1: $333,333.33
- Month 2: $333,333.33
- Month 3: $333,333.34 (adjusted for rounding)

## Authentication & Authorization

- **Required**: Valid Cognito JWT token with `SDT` group membership
- **RBAC**: All endpoints require SDT (Service Delivery Team) access

## Request Examples

### Create Adjustment with Pro-Rata Distribution

```bash
curl -X POST https://api.finanzas.example.com/adjustments \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_7x9k2m4n8p",
    "tipo": "exceso",
    "monto": 1000000,
    "origen_rubro_id": "rubro_1a2b3c4d5e",
    "fecha_inicio": "2025-11",
    "metodo_distribucion": "pro_rata_forward",
    "meses_impactados": 3,
    "justificacion": "Ampliación de alcance aprobada por cliente",
    "solicitado_por": "pm.leader@company.com"
  }'
```

**Response (201 Created)**:
```json
{
  "id": "adj_9c1d3e5f7g",
  "project_id": "proj_7x9k2m4n8p",
  "tipo": "exceso",
  "monto": 1000000,
  "estado": "pending_approval",
  "origen_rubro_id": "rubro_1a2b3c4d5e",
  "fecha_inicio": "2025-11",
  "metodo_distribucion": "pro_rata_forward",
  "distribucion": [
    { "mes": "2025-11", "monto": 333333.33 },
    { "mes": "2025-12", "monto": 333333.33 },
    { "mes": "2026-01", "monto": 333333.34 }
  ],
  "justificacion": "Ampliación de alcance aprobada por cliente",
  "solicitado_por": "pm.leader@company.com",
  "created_at": "2025-11-03T01:00:00Z",
  "created_by": "user-id"
}
```

### Create Simple Adjustment (Single Month)

```bash
curl -X POST https://api.finanzas.example.com/adjustments \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_7x9k2m4n8p",
    "tipo": "deficit",
    "monto": 50000,
    "justificacion": "Budget shortfall in Q4"
  }'
```

**Response (201 Created)**:
```json
{
  "id": "adj_a1b2c3d4e5",
  "project_id": "proj_7x9k2m4n8p",
  "tipo": "deficit",
  "monto": 50000,
  "estado": "pending_approval",
  "origen_rubro_id": null,
  "fecha_inicio": null,
  "metodo_distribucion": "single_month",
  "distribucion": null,
  "justificacion": "Budget shortfall in Q4",
  "solicitado_por": "user-id",
  "created_at": "2025-11-03T01:00:00Z",
  "created_by": "user-id"
}
```

### List All Adjustments

```bash
curl -X GET https://api.finanzas.example.com/adjustments \
  -H "Authorization: Bearer <jwt-token>"
```

**Response (200 OK)**:
```json
{
  "adjustments": [
    {
      "id": "adj_9c1d3e5f7g",
      "project_id": "proj_7x9k2m4n8p",
      "tipo": "exceso",
      "monto": 1000000,
      "estado": "pending_approval",
      "created_at": "2025-11-03T01:00:00Z"
    },
    {
      "id": "adj_a1b2c3d4e5",
      "project_id": "proj_7x9k2m4n8p",
      "tipo": "deficit",
      "monto": 50000,
      "estado": "approved",
      "created_at": "2025-11-03T01:05:00Z"
    }
  ],
  "count": 2
}
```

### Filter Adjustments by Project

```bash
curl -X GET "https://api.finanzas.example.com/adjustments?project_id=proj_7x9k2m4n8p" \
  -H "Authorization: Bearer <jwt-token>"
```

### Filter Adjustments by Estado

```bash
curl -X GET "https://api.finanzas.example.com/adjustments?estado=pending_approval" \
  -H "Authorization: Bearer <jwt-token>"
```

## Request Schema

### POST /adjustments

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string | Yes | Project identifier |
| tipo | string | Yes | Type: `exceso`, `deficit`, or `reajuste` |
| monto | number | Yes | Adjustment amount (positive number) |
| origen_rubro_id | string | No | Source budget line item ID |
| fecha_inicio | string | No | Start date (ISO format: YYYY-MM) |
| metodo_distribucion | string | No | Distribution method: `pro_rata_forward`, `pro_rata_all`, or `single_month` (default) |
| meses_impactados | number | No | Number of months for distribution (default: 3) |
| justificacion | string | No | Justification for the adjustment |
| solicitado_por | string | No | User who requested the adjustment |

### GET /adjustments

Query parameters:
- `project_id` (optional): Filter by project
- `estado` (optional): Filter by approval state (`pending_approval`, `approved`, `rejected`)

## Response Codes

- **201 Created**: Adjustment successfully created
- **200 OK**: Adjustments retrieved successfully
- **400 Bad Request**: Invalid input data or validation error
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User not in SDT group
- **500 Internal Server Error**: Server error

## Error Examples

### Missing Required Fields
```json
{
  "error": "Missing required fields: project_id, tipo, monto"
}
```

### Invalid Tipo
```json
{
  "error": "Invalid tipo. Must be exceso, deficit, or reajuste"
}
```

### Invalid Monto
```json
{
  "error": "monto must be a positive number"
}
```

## Notes

- All adjustments are created with `estado: pending_approval` by default
- Pro-rata distribution ensures the total distributed amount equals the original monto exactly
- The final month in a distribution receives any rounding adjustment
- Structured JSON logging includes route, method, status, userId, and latency
- DynamoDB partition key pattern: `ADJ#{id}`, sort key: `METADATA`
