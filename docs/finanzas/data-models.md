# Finanzas SD – Data models / Modelos de datos

**Last updated:** 2025-12-06  
**Audience:** Engineers, SDMT, Data Analysts  
**Purpose:** Data schemas and table structures for Finanzas SD

Executive perspective: these schemas keep each project, rubro, and evidence traceable from intake to reconciliation, balancing agility with auditable guardrails. / Perspectiva ejecutiva: estos esquemas mantienen cada proyecto, rubro y evidencia trazable desde el intake hasta la reconciliación, equilibrando agilidad con controles auditables.

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
