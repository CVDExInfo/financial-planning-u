# Finanzas SD – Arquitectura técnica

## Frontend
- **Finanzas Home**: entrada `/finanzas/` con accesos rápidos a proyectos y conciliación.
- **Projects**: creación y edición de proyectos, moneda, fechas y responsable.
- **Rubros Catalog**: consulta/selección del catálogo maestro (categoría, línea de código, tipo de costo).
- **SDMT Catalog**: sincroniza rubros/line items contra SDMT y muestra estado de handoff.
- **Reconciliation**: carga de facturas y documentos, comparación contra forecast y line items.

## Backend (Lambdas por dominio)
- **projects**: alta/listado de proyectos y handoff.
- **rubros**: catálogo y asignación a proyectos.
- **line-items**: consulta y relación entre rubros y partidas.
- **allocation-rules / forecast**: reglas de distribución y cálculo de plan mensual.
- **invoices**: registro/actualización de facturas y prefacturas por proyecto.
- **upload-docs**: carga de documentos (module=`reconciliation`), metadatos enlazados a proyecto/line item/invoice.
- **health**: verificación de plataforma.

## Autenticación y autorización
- Tokens Cognito (grupos `EXEC_RO`, `PMO`, `SDMT`, `FIN`, `AUDIT`) se validan en API Gateway.
- La UI filtra vistas según grupo y envía el JWT en cada llamada; handlers rechazan accesos sin grupo requerido.

## Modelo de datos (DynamoDB)
- **Projects**: `pk=PROJECT#{id}`, `sk=METADATA`; campos: `nombre`, `cliente`, `moneda`, `estado`, `start_date`, `end_date`.
- **Rubros**: `pk=RUBRO#{id}`, `sk=CATALOGO`; campos: `nombre`, `categoria`, `linea_codigo`, `tipo_costo`, `unidad`, `moneda_base`.
- **Line items**: `pk=PROJECT#{id}`, `sk=LINE_ITEM#{lineItemId}` con referencia a `rubroId`, `monto`, `moneda`, `mes`.
- **Invoices/Reconciliation**: `pk=PROJECT#{id}`, `sk=INVOICE#{invoiceId}`; campos `monto`, `moneda`, `estatus`, `periodo`, `evidencias`.
- **Docs**: `pk=PROJECT#{id}`, `sk=DOC#{docId}`; metadatos `module`, `lineItemId` o `invoiceId`, `s3_key`, `uploader`.

## Integraciones e infraestructura compartida
- **S3**: `ukusi-ui-finanzas-prod` hospeda la UI y recibe cargas de `/uploads/docs` con metadatos.
- **API Gateway**: `finanzas-sd-api` con etapas dev/stg/prod expone los handlers anteriores.
- **EventBridge**: usado para tareas programadas (ej. forecast o alertas) cuando aplicable.

## Flujos clave
1. **Creación de proyecto** → API `POST /projects` persiste metadatos y genera handoff para SDMT.
2. **Selección de rubros** → `GET /catalog/rubros` lista el catálogo; `POST /projects/{projectId}/rubros` vincula rubros a un proyecto.
3. **Carga de evidencia** → `POST /uploads/docs` guarda archivo en S3 y metadatos en Dynamo, etiquetando `module=reconciliation`.
4. **Registro de factura** → `POST /projects/{projectId}/invoices` crea factura asociada a line items; `GET /invoices` filtra por `project_id` para conciliación.
