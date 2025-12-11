# Finanzas SD – Data models / Modelos de datos

**Last updated:** 2025-12-11  
**Audience:** Engineers, SDMT, Data Analysts  
**Purpose:** Data schemas and table structures for Finanzas SD

Executive perspective: these schemas keep each project, rubro, and evidence traceable from intake to reconciliation, balancing agility with auditable guardrails. / Perspectiva ejecutiva: estos esquemas mantienen cada proyecto, rubro y evidencia trazable desde el intake hasta la reconciliación, equilibrando agilidad con controles auditables.

---

## Canonical Project Schema

Starting from 2025-12-11, all projects use a **canonical English-only schema** for consistency and ABAC support. This schema normalizes the historical mix of Spanish/English field names into a single, stable representation.

### Project Core Fields

| Canonical Field | Type | Required | Description | ABAC Usage |
|----------------|------|----------|-------------|-----------|
| `projectId` | string | ✓ | Stable project identifier (e.g., "P-DATACENTER-ETB", "P-uuid") | Resource ID |
| `code` | string | ✓ | Human-friendly project code (e.g., "PROJ-2024-001", "P-8charhash") | Display |
| `name` | string | ✓ | Project name | Display |
| `client` | string | ✓ | Client/customer name | Display |
| `description` | string | | Project description | Display |
| `status` | string | ✓ | Project status (e.g., "active", "archived", "closed") | Filtering |
| `currency` | string | ✓ | ISO currency code ("USD", "EUR", "COP", "MXN") | Financial |
| `modTotal` | number | ✓ | Total MOD budget (labor costs) | Financial |
| `startDate` | string | ✓ | Project start date (ISO 8601) | Timeline |
| `endDate` | string | ✓ | Project end date (ISO 8601) | Timeline |
| `createdAt` | string | ✓ | Creation timestamp (ISO 8601) | Audit |
| `updatedAt` | string | ✓ | Last update timestamp (ISO 8601) | Audit |
| `createdBy` | string | | Creator email | Audit |
| `sdmManagerEmail` | string | | Service Delivery Manager email | **ABAC Key Field** |
| `sdmManagerName` | string | | Service Delivery Manager display name | Display |
| `pmLeadEmail` | string | | Project Manager email | Display |
| `baselineId` | string | | Linked baseline identifier | Traceability |
| `baselineStatus` | string | | Baseline approval status | Workflow |

### Field Mapping: Legacy → Canonical

The following table defines how to derive canonical fields from existing mixed Spanish/English data:

| Canonical Field | Derived From (Priority Order) | Notes |
|----------------|-------------------------------|-------|
| `projectId` | `project_id`, `projectId`, `id`, pk extraction | Stable identifier |
| `code` | `code`, `codigo` | First non-null wins |
| `name` | `name`, `nombre` | First non-null wins |
| `client` | `client`, `cliente` | First non-null wins |
| `description` | `description`, `descripcion` | First non-null wins |
| `status` | `status`, `estado` | First non-null wins |
| `currency` | `currency`, `moneda` | First non-null wins |
| `modTotal` | `mod_total`, `presupuesto_total`, `totalBudget` | Semantic preference: mod_total |
| `startDate` | `start_date`, `fecha_inicio`, `startDate` | First valid date |
| `endDate` | `end_date`, `fecha_fin`, `endDate` | First valid date |
| `createdAt` | `created_at`, `createdAt` | First non-null wins |
| `updatedAt` | `updated_at`, `updatedAt` | First non-null wins |
| `createdBy` | `created_by`, `createdBy` | First non-null wins |
| `sdmManagerEmail` | `sdm_manager_email`, `accepted_by`, `acceptedBy`, `aceptado_por` | See SDM extraction rules below |
| `sdmManagerName` | `sdm_manager_name`, `sd_manager_name` | First non-null wins |
| `pmLeadEmail` | `pm_lead_email`, (future PM-specific field) | Reserved for PM identity |
| `baselineId` | `baseline_id`, `baselineId` | First non-null wins |
| `baselineStatus` | `baseline_status`, `baselineStatus` | First non-null wins |

### SDM Field Extraction Rules

The `sdmManagerEmail` field is critical for ABAC (Attribute-Based Access Control). It identifies which Service Delivery Manager owns the project.

**Extraction priority:**
1. **Explicit field**: If `sdm_manager_email` exists, use it directly
2. **Baseline acceptance**: Check `accepted_by`, `acceptedBy`, `aceptado_por` fields on:
   - PROJECT#xxx METADATA record
   - BASELINE#xxx records linked to the project
   - HANDOFF# records linked to the project
3. **Heuristic**: If the email domain or pattern suggests SDM vs PM role, prefer SDM
4. **Default**: If no SDM can be determined, leave null (restrict access via ABAC)

**Note**: The migration script will populate `sdmManagerEmail` for existing projects by applying these rules.

### ABAC Resource Model

For Amazon Verified Permissions (AVP) integration:

```cedar
entity Project {
  projectId: String,
  sdmManagerEmail: String?,
  status: String,
  owner: User
}
```

**Access Control Rules:**
- **ADMIN role**: Full access to all projects
- **EXC_RO role**: Read-only access to all projects
- **SDM role**: Read/write access only to projects where `sdmManagerEmail == principal.email`
- **Other users**: No access (or explicit assignment via future user-project relationships)

## DynamoDB tables (resumen)
All tables use composite keys (`pk` as HASH, `sk` as RANGE) with PAY_PER_REQUEST billing mode as defined in `services/finanzas-api/template.yaml`.

- **finz_projects**: `pk=PROJECT#{projectId}` / `sk=METADATA`; campos clave: `name`, `cliente`, `moneda`, `start_date`, `end_date`, `owner`, `status`, `baseline_id`.
- **finz_rubros**: `pk=RUBRO#{rubroId}` / `sk=CATALOGO`; atributos `categoria`, `linea_codigo`, `tipo_costo`, `unidad`, `moneda_base`.
- **finz_rubros_taxonomia**: `pk=TAX#{category}` / `sk=RUBRO#{rubroId}`; relaciones de taxonomía y clasificación.
- **finz_allocations**: `pk=PROJECT#{projectId}` / `sk=ALLOCATION_RULE#{id}`; parámetros de distribución mensual.
- **finz_payroll_actuals**: `pk=PROJECT#{projectId}` / `sk=PAYROLL#{period}`; datos reales de nómina por periodo.
- **finz_adjustments**: `pk=PROJECT#{projectId}` / `sk=ADJUSTMENT#{adjustmentId}`; excesos, reducciones y reasignaciones.
- **finz_changes**: `pk=PROJECT#{projectId}` / `sk=CHANGE#{changeId}`; historial de cambios y aprobaciones.
- **finz_alerts**: `pk=PROJECT#{projectId}` / `sk=ALERT#{alertId}`; alertas de desviaciones y auditoría.
- **finz_providers**: `pk=PROVIDER#{providerId}` / `sk=METADATA`; proveedores y vendors registrados.
- **finz_audit_log**: `pk=PROJECT#{projectId}` / `sk=AUDIT#{timestamp}`; registros de auditoría completos.
- **finz_docs**: `pk=PROJECT#{projectId}` / `sk=DOC#{docId}`; `module`, `s3_key`, `uploader`, `linkedInvoiceId`/`lineItemId`.
- **finz_prefacturas**: `pk=PROJECT#{projectId}` / `sk=PREFACTURA#{prefacturaId}`; prefacturas y datos relacionados.

## Relationships / Relaciones
- Un **project** puede tener múltiples **baselines** y versiones de **handoff** hacia SDMT.
- Los **rubros** del catálogo se asocian a un proyecto, generan **line items** y alimentan el **forecast**.
- Cada **invoice** referencia uno o más **line items** y guarda evidencia en S3.
- **Allocation rules** definen cómo se distribuyen montos de rubro/line item por periodo para el plan y el cierre mensual.

## Data quality guardrails / Controles
- Campos monetarios almacenan moneda explícita; no se mezclan divisas sin tasa definida.
- Cambios de baseline y approvals se auditan con `updated_by`, `timestamp` y `reason`.
- Uploads rechazan archivos sin metadatos de proyecto/line item/invoice.
