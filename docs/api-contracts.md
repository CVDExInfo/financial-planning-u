# Finanzas API - Contract Documentation

## Overview

The Finanzas API provides comprehensive endpoints for managing financial planning, project tracking, payroll integration, budget allocations, and service delivery control. This API supports the complete financial workflow from project creation and handoff to monthly closing and coverage reporting.

**API Version**: 1.0.0  
**Base URL**: `https://api.finanzas.example.com/finanzas`  
**Region**: us-east-2  
**Base Path**: `/finanzas/`

## Authentication

The Finanzas API uses **AWS Cognito JWT tokens** for authentication via OIDC (OpenID Connect).

### Authorization Header

Include the JWT token in the `Authorization` header with each request:

```
Authorization: Bearer <your-cognito-jwt-token>
```

### RBAC (Role-Based Access Control)

Access control is managed through JWT group claims. The following groups are supported:

- **SDT** (Service Delivery Team): Full access to service delivery operations, project management, and financial tracking
- **PMO**: Access to project creation and handoff operations
- **Finance**: Access to payroll, adjustments, and closing operations

Your JWT token must include the appropriate group in the `cognito:groups` claim to access protected endpoints.

### Example JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "cognito:groups": ["SDT", "Finance"],
  "iss": "https://cognito-idp.us-east-2.amazonaws.com/...",
  "exp": 1730000000
}
```

## API Endpoints Summary

The API is organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Projects** | 3 endpoints | Project creation, listing, and handoff |
| **Catalog** | 3 endpoints | Budget rubros (line items) management |
| **Allocations** | 2 endpoints | Budget allocation and financial planning |
| **Payroll** | 3 endpoints | Payroll ingestion, monthly closing, and coverage reports |
| **Adjustments** | 2 endpoints | Budget adjustments with pro-rata distribution |
| **Movements** | 5 endpoints | Financial movements with approval workflow |
| **Alerts** | 1 endpoint | Financial alerts and notifications |
| **Providers** | 2 endpoints | Provider/vendor management |
| **Webhooks** | 1 endpoint | External prefactura event integration |

**Total**: 22 endpoints across 9 categories

---

## Detailed Examples

### 1. Create a New Project

Creates a new project with initial configuration and financial parameters.

**Endpoint**: `POST /projects`

**Request**:

```bash
curl -X POST https://api.finanzas.example.com/finanzas/projects \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile Banking App MVP",
    "code": "PROJ-2025-001",
    "client": "Global Bank Corp",
    "start_date": "2025-01-15",
    "end_date": "2025-12-31",
    "currency": "USD",
    "mod_total": 1500000,
    "description": "MVP for mobile banking application with core features"
  }'
```

**Response** (201 Created):

```json
{
  "id": "proj_7x9k2m4n8p",
  "name": "Mobile Banking App MVP",
  "code": "PROJ-2025-001",
  "client": "Global Bank Corp",
  "start_date": "2025-01-15",
  "end_date": "2025-12-31",
  "currency": "USD",
  "mod_total": 1500000,
  "status": "active",
  "description": "MVP for mobile banking application with core features",
  "created_at": "2025-10-31T03:12:00Z",
  "updated_at": "2025-10-31T03:12:00Z"
}
```

**Key Fields**:
- `mod_total`: Total project budget (MOD = Monto Original Dealsheet)
- `code`: Unique project identifier following pattern `PROJ-YYYY-NNN`
- `status`: Project status (`active`, `completed`, `on_hold`, `cancelled`)

---

### 2. Process Project Handoff

Registers the handoff of a project from sales to service delivery with budget distribution between engineers and SDM (Service Delivery Management).

**Endpoint**: `POST /projects/{id}/handoff`

**Request**:

```bash
curl -X POST https://api.finanzas.example.com/finanzas/projects/proj_7x9k2m4n8p/handoff \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "mod_total": 1500000,
    "pct_ingenieros": 65,
    "pct_sdm": 35,
    "aceptado_por": "juan.perez@company.com",
    "fecha_handoff": "2025-11-01",
    "notas": "Budget approved by PMO, team allocation confirmed"
  }'
```

**Response** (200 OK):

```json
{
  "id": "handoff_2k4m6n8p0r",
  "project_id": "proj_7x9k2m4n8p",
  "status": "accepted",
  "budget_ingenieros": 975000,
  "budget_sdm": 525000,
  "aceptado_por": "juan.perez@company.com",
  "fecha_handoff": "2025-11-01",
  "created_at": "2025-10-31T03:15:00Z"
}
```

**Budget Calculation**:
- Engineers: $1,500,000 × 65% = $975,000
- SDM: $1,500,000 × 35% = $525,000

This split represents the typical distribution of project resources between engineering and service delivery management roles.

---

### 3. Get Project Financial Plan

Retrieves the financial plan for a specific project and month, including planned costs breakdown for engineers, SDM, and non-recurring expenses.

**Endpoint**: `GET /projects/{id}/plan?mes=YYYY-MM`

**Request**:

```bash
curl -X GET "https://api.finanzas.example.com/finanzas/projects/proj_7x9k2m4n8p/plan?mes=2025-10" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response** (200 OK):

```json
{
  "project_id": "proj_7x9k2m4n8p",
  "mes": "2025-10",
  "plan_ing": 65000,
  "plan_sdm": 35000,
  "non_recurrentes": [
    {
      "rubro_id": "rubro_k1l2m3n4o5",
      "nombre": "Capacitación Equipo",
      "monto": 8000
    },
    {
      "rubro_id": "rubro_p6q7r8s9t0",
      "nombre": "Licencias Software",
      "monto": 5000
    }
  ],
  "total_mes": 113000,
  "currency": "USD"
}
```

**Key Components**:
- **plan_ing**: Planned engineering costs (recurring monthly)
- **plan_sdm**: Planned SDM costs (recurring monthly)
- **non_recurrentes**: One-time or milestone-based expenses
- **total_mes**: Total monthly budget including all components

This breakdown helps track whether the project is on budget and properly allocated between different cost categories.

---

### 4. Close Monthly Period

Closes the financial period for a month and generates a comprehensive coverage report comparing planned revenue against actual payroll costs.

**Endpoint**: `POST /close-month?mes=YYYY-MM`

**Request**:

```bash
curl -X POST "https://api.finanzas.example.com/finanzas/close-month?mes=2025-10" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response** (200 OK):

```json
{
  "mes": "2025-10",
  "cobertura": 114.72,
  "nomina": 98500,
  "ingresos_facturados": 113000,
  "gap": 15500,
  "alertas": [
    {
      "type": "coverage_above_target",
      "severity": "warning",
      "message": "Coverage exceeded 110% target"
    },
    {
      "type": "positive_gap",
      "severity": "info",
      "message": "Positive gap of $15,500"
    }
  ],
  "closed_at": "2025-10-31T23:59:59Z",
  "closed_by": "finance.manager@company.com"
}
```

**Coverage Metrics**:
- **cobertura**: Coverage percentage = (ingresos_facturados / nomina) × 100 = (113,000 / 98,500) × 100 = 114.72%
- **gap**: Financial gap = ingresos_facturados - nomina = $15,500 (positive is good)
- **nomina**: Total payroll for the month
- **ingresos_facturados**: Total invoiced/planned revenue

A coverage above 105-110% indicates healthy project margins. This endpoint locks the monthly period and generates alerts for any anomalies.

---

### 5. Create Budget Adjustment with Pro-Rata Distribution

Creates a budget adjustment (exceso/overage) with automatic pro-rata distribution across future months. This is critical for managing scope changes and budget overruns.

**Endpoint**: `POST /adjustments`

**Request**:

```bash
curl -X POST https://api.finanzas.example.com/finanzas/adjustments \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_7x9k2m4n8p",
    "tipo": "exceso",
    "monto": 1000000,
    "origen_rubro_id": "rubro_1a2b3c4d5e",
    "fecha_inicio": "2025-11",
    "metodo_distribucion": "pro_rata_forward",
    "justificacion": "Ampliación de alcance aprobada por cliente",
    "solicitado_por": "pm.leader@company.com"
  }'
```

**Response** (201 Created):

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
  "meses_impactados": ["2025-11", "2025-12", "2026-01"],
  "distribucion": [
    {
      "mes": "2025-11",
      "monto": 333333.33
    },
    {
      "mes": "2025-12",
      "monto": 333333.33
    },
    {
      "mes": "2026-01",
      "monto": 333333.34
    }
  ],
  "created_at": "2025-10-31T03:30:00Z"
}
```

**Distribution Methods**:
- **pro_rata_forward**: Distributes excess evenly across remaining months (shown above)
- **pro_rata_all**: Distributes across all project months
- **single_month**: Applies full amount to a single month

The $1,000,000 excess is automatically distributed evenly across 3 months ($333,333.33 each, with final month adjusted for rounding). This adjustment requires approval before being applied to the budget.

---

### 6. Approve Financial Movement

Approves a pending financial movement, allowing it to be reflected in the budget tracking.

**Endpoint**: `POST /movements/{id}/approve`

**Request**:

```bash
curl -X POST https://api.finanzas.example.com/finanzas/movements/mov_4n5o6p7q8r/approve \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "aprobado_por": "finance.manager@company.com",
    "comentarios": "Aprobado - documentación correcta"
  }'
```

**Response** (200 OK):

```json
{
  "id": "mov_4n5o6p7q8r",
  "project_id": "proj_7x9k2m4n8p",
  "tipo": "gasto",
  "monto": 25000,
  "estado": "approved",
  "aprobado_por": "finance.manager@company.com",
  "aprobado_en": "2025-10-31T03:40:00Z",
  "comentarios": "Aprobado - documentación correcta"
}
```

---

### 7. List Projects with Filtering

Retrieves a paginated list of projects with optional filtering by status.

**Endpoint**: `GET /projects`

**Request**:

```bash
curl -X GET "https://api.finanzas.example.com/finanzas/projects?status=active&limit=20&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "proj_7x9k2m4n8p",
      "name": "Mobile Banking App MVP",
      "code": "PROJ-2025-001",
      "client": "Global Bank Corp",
      "status": "active",
      "mod_total": 1500000,
      "currency": "USD"
    },
    {
      "id": "proj_3a5b7c9d1e",
      "name": "ERP System Upgrade",
      "code": "PROJ-2025-002",
      "client": "Manufacturing Inc",
      "status": "active",
      "mod_total": 2800000,
      "currency": "USD"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

### 8. Bulk Update Budget Allocations

Updates budget allocations for multiple rubros across different months in a single operation, improving efficiency for large planning updates.

**Endpoint**: `PUT /projects/{id}/allocations:bulk`

**Request**:

```bash
curl -X PUT https://api.finanzas.example.com/finanzas/projects/proj_7x9k2m4n8p/allocations:bulk \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "allocations": [
      {
        "rubro_id": "rubro_1a2b3c4d5e",
        "mes": "2025-11",
        "monto_planeado": 30000
      },
      {
        "rubro_id": "rubro_1a2b3c4d5e",
        "mes": "2025-12",
        "monto_planeado": 32000
      },
      {
        "rubro_id": "rubro_6f7g8h9i0j",
        "mes": "2025-11",
        "monto_planeado": 15000
      }
    ]
  }'
```

**Response** (200 OK):

```json
{
  "updated_count": 3,
  "allocations": [
    {
      "rubro_id": "rubro_1a2b3c4d5e",
      "mes": "2025-11",
      "monto_planeado": 30000,
      "status": "updated"
    },
    {
      "rubro_id": "rubro_1a2b3c4d5e",
      "mes": "2025-12",
      "monto_planeado": 32000,
      "status": "updated"
    },
    {
      "rubro_id": "rubro_6f7g8h9i0j",
      "mes": "2025-11",
      "monto_planeado": 15000,
      "status": "updated"
    }
  ]
}
```

---

## Error Responses

All endpoints return standardized error responses with appropriate HTTP status codes.

### 400 Bad Request

Invalid request parameters or malformed JSON.

```json
{
  "code": "BAD_REQUEST",
  "message": "Invalid request parameters",
  "details": {
    "field": "mod_total",
    "error": "Must be a positive number"
  },
  "timestamp": "2025-10-31T03:55:00Z"
}
```

### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "details": {
    "reason": "Missing or invalid JWT token"
  },
  "timestamp": "2025-10-31T03:55:00Z"
}
```

### 403 Forbidden

Insufficient permissions to access the resource.

```json
{
  "code": "FORBIDDEN",
  "message": "Insufficient permissions to access this resource",
  "details": {
    "required_group": "SDT",
    "user_groups": ["users"]
  },
  "timestamp": "2025-10-31T03:55:00Z"
}
```

### 404 Not Found

Requested resource does not exist.

```json
{
  "code": "NOT_FOUND",
  "message": "Resource not found",
  "details": {
    "resource_type": "project",
    "resource_id": "proj_invalid123"
  },
  "timestamp": "2025-10-31T03:55:00Z"
}
```

---

## Data Models

### Key Enumerations

**Project Status**:
- `active`: Project is currently active
- `completed`: Project has been completed
- `on_hold`: Project is temporarily paused
- `cancelled`: Project has been cancelled

**Execution Types** (tipo_ejecucion):
- `mensual`: Monthly recurring costs
- `puntual`: One-time costs
- `por_hito`: Milestone-based costs

**Movement Types**:
- `gasto`: Expense/cost
- `ingreso`: Income/revenue
- `ajuste`: Adjustment

**Approval States**:
- `pending`: Awaiting approval
- `approved`: Approved and active
- `rejected`: Rejected

**Alert Severities**:
- `critical`: Requires immediate attention
- `warning`: Requires attention soon
- `info`: Informational only

---

## Pagination

List endpoints support pagination using `limit` and `offset` query parameters:

```bash
# Get first page (20 items)
GET /projects?limit=20&offset=0

# Get second page (20 items)
GET /projects?limit=20&offset=20
```

Responses include pagination metadata:

```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

## Rate Limiting

The API implements rate limiting to ensure service stability:

- **Rate Limit**: 1000 requests per hour per user
- **Burst Limit**: 100 requests per minute

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1730000000
```

---

## Webhooks

The API supports webhook integration for external systems to push prefactura events.

### Prefactura Webhook

**Endpoint**: `POST /prefacturas/webhook`

External systems can send prefactura events for automatic processing:

```bash
curl -X POST https://api.finanzas.example.com/finanzas/prefacturas/webhook \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "prefactura.created",
    "event_id": "evt_9r8s7t6u5v",
    "timestamp": "2025-10-31T03:50:00Z",
    "data": {
      "project_id": "proj_7x9k2m4n8p",
      "rubro_id": "rubro_1a2b3c4d5e",
      "monto": 30000,
      "mes": "2025-11",
      "folio": "PREFACT-2025-110001",
      "descripcion": "Desarrollo backend - Noviembre 2025"
    }
  }'
```

**Response** (202 Accepted):

```json
{
  "status": "accepted",
  "event_id": "evt_9r8s7t6u5v",
  "message": "Prefactura event queued for processing"
}
```

---

## Support and Feedback

For API support, questions, or feedback:

- **Email**: support@finanzas.example.com
- **Documentation**: https://docs.finanzas.example.com
- **Status Page**: https://status.finanzas.example.com

---

## Changelog

### Version 1.0.0 (2025-10-31)

- Initial release with complete financial planning API
- Support for projects, budget tracking, payroll integration
- Approval workflows for movements and adjustments
- Coverage reporting and financial alerts
- Webhook integration for prefactura events
