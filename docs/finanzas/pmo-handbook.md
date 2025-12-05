# Manual operativo PMO Colombia – Finanzas SD

Perspectiva ejecutiva: este manual guía a la PMO para ejecutar Finanzas SD con consistencia, evidencia trazable y roles claros entre PMO, Finanzas y SDMT. / Executive perspective: this handbook helps PMO run Finanzas SD consistently with traceable evidence and clear handoffs across PMO, Finance, and SDMT.

## Objetivo
Guía en español para que el PMO Colombia ejecute Finanzas SD de forma consistente, con controles de evidencia y sin mezclar Acta/Prefactura.

## Procesos operativos
1. **Alta de proyecto**: capturar nombre, cliente, moneda y fechas clave; guardar baseline inicial vía `/baseline`.
2. **Selección de rubros**: consultar `/catalog/rubros`, asociar sólo los rubros aprobados al proyecto y documentar supuestos.
3. **Reglas de asignación**: cargar allocations en lote (`/projects/{id}/allocations:bulk`), validar montos por periodo y aprobar forecast.
4. **Handoff a SDMT**: generar `/projects/{projectId}/handoff` cuando baseline y rubros estén cerrados; registrar versión de exportación.
5. **Registro de facturas**: usar `/projects/{projectId}/invoices` con referencias a line items y adjuntar evidencia antes de cambiar estado.
6. **Cierre mensual**: ejecutar `/close-month` después de reconciliar; documentar variaciones y alertas.

## RACI por módulo
| Módulo | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| Proyectos & Baseline | PMO Colombia | Director PMO | Finanzas | SDMT |
| Rubros & Line Items | PMO Colombia | Director PMO | Finanzas, SDMT | Auditoría |
| Forecast & Allocations | Finanzas | CFO Regional | PMO, SDMT | Auditoría |
| Handoff SDMT | PMO Colombia | Director PMO | SDMT | Finanzas |
| Facturas & Evidencia | Finanzas | CFO Regional | PMO | Auditoría |
| Cierre mensual / Alertas | Finanzas | CFO Regional | PMO, SDMT | Ejecutivos |

## Checklist de entrega base
- Proyecto creado con moneda y fechas completas.
- Baseline aprobado y versionado (sin rubros pendientes).
- Rubros del catálogo asociados y documentados.
- Reglas de asignación cargadas y forecast generado.
- Handoff generado y compartido con SDMT.
- Evidencias obligatorias configuradas por tipo de rubro/line item.

## SOP para manejo de evidencia
1. Subir archivos vía `/uploads/docs` indicando `projectId`, `module=reconciliation`, y referencias de line item o invoice.
2. Validar que el enlace S3 queda registrado en la tabla de documentos.
3. Para observaciones, crear alerta en `/alerts` con `reason` y `owner`.
4. Escalación: 
   - Nivel 1: PMO revisa metadatos y reintenta carga.
   - Nivel 2: Finanzas valida consistencia de montos y moneda.
   - Nivel 3: Auditoría revisa registros y solicita evidencia adicional.

## Escalamiento de tickets
- Tiempo objetivo de respuesta: 1 día hábil para PMO, 2 días hábiles para Finanzas/Auditoría.
- Usar canal de soporte interno con referencia al `projectId` y `invoiceId` afectado.

## Glosario
Consultar `glossary.md` para términos bilingües de roles, documentos y flujos.
