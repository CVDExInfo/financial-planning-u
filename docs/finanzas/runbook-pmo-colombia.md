# Runbook PMO Colombia – Finanzas SD

Perspectiva ejecutiva: este runbook resume los pasos diarios para que PMO y Finanzas operen Finanzas SD, desde intake hasta handoff a SDMT con evidencia completa. / Executive perspective: this runbook summarizes the day-to-day steps for PMO and Finance to run Finanzas SD from intake through SDMT handoff with complete evidence.

## 1. Flujo operativo PMO → Finanzas → SDMT
1. **Crear proyecto en Finanzas**: ingresar datos básicos (cliente, moneda, fechas) en el módulo Projects.
2. **Configurar rubros y line items**: usar el catálogo SDMT para seleccionar rubros, ajustar montos y asignar periodos.
3. **Conciliar facturas**: en Reconciliation, cargar facturas y evidencias, asociarlas a los line items y revisar contra el forecast antes de enviar a SDMT.

## 2. Procedimientos de uso
### Cómo crear un proyecto de Finanzas
- Ir a **Projects → Nuevo**.
- Completar: nombre del proyecto, cliente, moneda, fechas (inicio/fin), responsable.
- Guardar y verificar que el proyecto aparece en la lista.

### Cómo cargar rubros desde el catálogo y ajustar montos
- Abrir el proyecto y navegar a **Rubros Catalog**.
- Buscar rubros por categoría o línea de código.
- Seleccionar rubros y asignar **monto** y **moneda** por cada line item.
- Guardar cambios; los line items quedan listos para forecast y conciliación.

### Cómo usar la conciliación de facturas (Reconciliation)
- Ir a **Reconciliation** dentro del proyecto.
- Cargar factura/prefactura y documentos de soporte usando **Subir documento** (`POST /uploads/docs`).
- Registrar la factura con **Registrar factura** (`POST /projects/{projectId}/invoices`) indicando periodo y montos por line item.
- Revisar estado y totales en la lista de facturas (`GET /invoices?project_id=`) antes de enviar a SDMT.

## 3. Controles operativos
- **Campos obligatorios**: nombre del proyecto, cliente, moneda, fechas; cada factura requiere número, periodo y moneda.
- **Revisiones sugeridas**: confirmar moneda homogénea por proyecto, validar plazos de facturación, revisar que los rubros usados existen en el catálogo SDMT.
- **Roles y permisos**:
  - `PMO`: crea proyectos, adjunta rubros, registra facturas.
  - `FIN`: puede conciliar y ajustar montos.
  - `SDMT`: consulta y recibe handoff; permisos de edición limitados.
  - `EXEC_RO`: lectura ejecutiva.

## 4. Soporte y escalamiento
- Si Finanzas no carga o aparece error 500 en conciliación:
  - Capturar **screenshot**, hora exacta, proyecto afectado, mensaje de error y usuario.
  - Reintentar con recarga de sesión (logout/login) y validar conectividad.
  - Escalar a soporte SDMT/Finanzas incluyendo la información anterior y el ambiente (dev/stg/prod).
