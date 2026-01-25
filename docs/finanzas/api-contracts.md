# Finanzas SD – API Contracts

**Last updated:** 2025-12-06  
**Audience:** Engineers, Integration Teams  
**Purpose:** Detailed API contracts with request/response examples

Autenticación: JWT Cognito. Grupos típicos: `PMO`, `SDMT`, `FIN`, `EXEC_RO`. A menos que se indique, se requiere token con uno de estos grupos.

## Rubros Catalog
### GET /catalog/rubros
- **Purpose**: Lista el catálogo maestro de rubros.
- **Auth**: `PMO`, `SDMT`, `FIN`.
- **Response**:
```json
[
  {
    "id": "RUB-1001",
    "nombre": "Servicios Profesionales",
    "categoria": "OPEX",
    "linea_codigo": "6100",
    "tipo_costo": "variable",
    "moneda_base": "USD"
  }
]
```

## Projects
### GET /projects
- **Purpose**: Listar proyectos visibles para el usuario.
- **Auth**: `PMO`, `SDMT`, `EXEC_RO`.
- **Response**:
```json
[
  {
    "id": "PRJ-001",
    "nombre": "Implementación NOC",
    "cliente": "Ikusi",
    "moneda": "USD",
    "estado": "en_progreso",
    "start_date": "2025-01-15"
  }
]
```

### POST /projects
- **Purpose**: Crear proyecto en Finanzas SD.
- **Auth**: `PMO`, `FIN`.
- **Request**:
```json
{
  "nombre": "Implementación NOC",
  "cliente": "Ikusi",
  "moneda": "USD",
  "start_date": "2025-01-15",
  "end_date": "2025-06-30",
  "responsable": "pmo.user@ikusi.com"
}
```
- **Response**:
```json
{
  "id": "PRJ-001",
  "message": "project created"
}
```

## Line items y rubros por proyecto
### GET /line-items?project_id=PRJ-001
- **Purpose**: Consultar line items asociados a un proyecto y sus rubros.
- **Auth**: `PMO`, `SDMT`, `FIN`.
- **Response**:
```json
[
  {
    "id": "LI-01",
    "project_id": "PRJ-001",
    "rubro_id": "RUB-1001",
    "descripcion": "Ingeniería",
    "monto": 15000,
    "moneda": "USD",
    "mes": "2025-02"
  }
]
```

### POST /projects/{projectId}/rubros
- **Purpose**: Adjuntar rubros del catálogo a un proyecto.
- **Auth**: `PMO`, `FIN`.
- **Request**:
```json
{
  "rubros": [
    { "rubro_id": "RUB-1001", "monto": 15000, "moneda": "USD" },
    { "rubro_id": "RUB-2001", "monto": 8000, "moneda": "USD" }
  ]
}
```
- **Response**:
```json
{ "project_id": "PRJ-001", "attached": 2 }
```

## SDMT Catalog
### GET /catalog/sdmt
- **Purpose**: Consulta sincronizada del catálogo SDMT usado para line items.
- **Auth**: `SDMT`, `PMO`.
- **Response**:
```json
[
  { "id": "SDMT-001", "nombre": "Servicio administrado", "categoria": "NOC" }
]
```

## Reconciliation y facturas
### POST /uploads/docs
- **Purpose**: Cargar documentos de conciliación (module=`reconciliation`).
- **Auth**: `PMO`, `FIN`.
- **Request (multipart JSON metadata)**:
```json
{
  "module": "reconciliation",
  "project_id": "PRJ-001",
  "line_item_id": "LI-01",
  "filename": "factura-febrero.pdf"
}
```
- **Response**:
```json
{
  "doc_id": "DOC-abc123",
  "s3_key": "projects/PRJ-001/docs/DOC-abc123.pdf"
}
```

### POST /projects/{projectId}/invoices
- **Purpose**: Registrar factura o prefactura para conciliación.
- **Auth**: `PMO`, `FIN`.
- **Request**:
```json
{
  "invoice_number": "FAC-2025-001",
  "periodo": "2025-02",
  "moneda": "USD",
  "monto": 23000,
  "line_items": [
    { "line_item_id": "LI-01", "monto": 15000 },
    { "line_item_id": "LI-02", "monto": 8000 }
  ]
}
```
- **Response**:
```json
{
  "invoice_id": "INV-001",
  "status": "registrada"
}
```

### GET /invoices?project_id=PRJ-001
- **Purpose**: Listar facturas de un proyecto para conciliación.
- **Auth**: `PMO`, `FIN`, `SDMT` (solo lectura).
- **Response**:
```json
{
  "data": [
    {
      "invoice_id": "INV-001",
      "project_id": "PRJ-001",
      "periodo": "2025-02",
      "monto": 23000,
      "moneda": "USD",
      "estatus": "registrada",
      "rubro_canonical": "MOD-ING",
      "month": "2025-02",
      "amount": 23000
    }
  ],
  "projectId": "PRJ-001",
  "total": 1
}
```
- **Notes**:
  - Response includes `rubro_canonical` field computed from linea_codigo → rubroId → rubro → description for reliable matching
  - `month` normalized from invoiceDate (YYYY-MM format)
  - `amount` normalized from amount/total fields

## Budgets

### GET /budgets/all-in/monthly?year=2026
- **Purpose**: Obtener presupuestos mensuales para un año específico.
- **Auth**: `SDMT`, `EXEC_RO`, `ADMIN`.
- **Response**:
```json
{
  "year": 2026,
  "currency": "USD",
  "months": [
    { "month": "2026-01", "amount": 1000000 },
    { "month": "2026-02", "amount": 6000000 }
  ],
  "monthlyMap": {
    "2026-01": 1000000,
    "2026-02": 6000000
  },
  "updated_at": "2026-01-15T10:30:00Z",
  "updated_by": "admin@example.com"
}
```
- **Notes**:
  - `monthlyMap` added for O(1) month-to-amount lookups
  - `months` array preserved for backward compatibility

