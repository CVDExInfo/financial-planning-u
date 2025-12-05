# Finanzas SD – Data models / Modelos de datos

Executive perspective: these schemas keep each project, rubro, and evidence traceable from intake to reconciliation, balancing agility with auditable guardrails. / Perspectiva ejecutiva: estos esquemas mantienen cada proyecto, rubro y evidencia trazable desde el intake hasta la reconciliación, equilibrando agilidad con controles auditables.

## DynamoDB tables (resumen)
- **Projects**: `pk=PROJECT#{projectId}` / `sk=METADATA`; campos clave: `name`, `cliente`, `moneda`, `start_date`, `end_date`, `owner`, `status`, `baseline_id`.
- **Baselines**: `pk=PROJECT#{projectId}` / `sk=BASELINE#{baselineId}`; métricas de presupuesto, versión y aprobador.
- **Rubros (catalog)**: `pk=RUBRO#{rubroId}` / `sk=CATALOGO`; atributos `categoria`, `linea_codigo`, `tipo_costo`, `unidad`, `moneda_base`.
- **Project rubros**: `pk=PROJECT#{projectId}` / `sk=RUBRO#{rubroId}`; referencia al catálogo + `monto_aprobado`, `moneda`, `mes_inicio`.
- **Line items**: `pk=PROJECT#{projectId}` / `sk=LINE_ITEM#{lineItemId}`; `rubroId`, `descripcion`, `monto`, `moneda`, `periodo`, `estado`.
- **Allocation rules**: `pk=PROJECT#{projectId}` / `sk=ALLOCATION_RULE#{id}`; parámetros de distribución mensual, responsable y timestamps.
- **Plan/Forecast**: `pk=PROJECT#{projectId}` / `sk=PLAN#{periodo}`; valores calculados por `POST /plan/forecast`.
- **Invoices**: `pk=PROJECT#{projectId}` / `sk=INVOICE#{invoiceId}`; `monto`, `moneda`, `periodo`, `status`, `lineItemRefs[]`, `evidencia`.
- **Uploads/docs**: `pk=PROJECT#{projectId}` / `sk=DOC#{docId}`; `module`, `s3_key`, `uploader`, `linkedInvoiceId`/`lineItemId`.
- **Alerts & changes**: `pk=PROJECT#{projectId}` / `sk=ALERT#{id}` o `CHANGE#{id}`; usado para desviaciones y approvals.

## Relationships / Relaciones
- Un **project** puede tener múltiples **baselines** y versiones de **handoff** hacia SDMT.
- Los **rubros** del catálogo se asocian a un proyecto, generan **line items** y alimentan el **forecast**.
- Cada **invoice** referencia uno o más **line items** y guarda evidencia en S3.
- **Allocation rules** definen cómo se distribuyen montos de rubro/line item por periodo para el plan y el cierre mensual.

## Data quality guardrails / Controles
- Campos monetarios almacenan moneda explícita; no se mezclan divisas sin tasa definida.
- Cambios de baseline y approvals se auditan con `updated_by`, `timestamp` y `reason`.
- Uploads rechazan archivos sin metadatos de proyecto/line item/invoice.
