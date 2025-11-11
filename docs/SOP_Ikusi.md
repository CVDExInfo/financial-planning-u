# SOP: Gestión Presupuesto - Ikusi

**Standard Operating Procedure: Budget Management**  
**Procedimiento Operativo Estándar: Gestión Presupuestaria**

---

## EN: Purpose

This SOP defines the procedures for budget management (Gestión Presupuesto) in the Finanzas SD system, including pre-close processes, payroll ingestion, deviation analysis, and budget adjustments.

## ES: Propósito

Este SOP define los procedimientos para la gestión presupuestaria en el sistema Finanzas SD, incluyendo procesos de pre-cierre, ingesta de nómina, análisis de desviaciones y ajustes presupuestarios.

---

## EN: Monthly Pre-Close Process

### Step 1: Lock New Movements

**Timing**: Last 3 business days of the month

**Actions**:
1. System automatically blocks new allocations
2. Only adjustments with justification allowed
3. Notification sent to all PMs and FIN team
4. Dashboard shows "Pre-Close Mode" banner

### Step 2: Review Deviations

**FIN Team Tasks**:
- Review budget vs actual by project
- Identify variances > 10%
- Generate deviation report
- Flag items requiring adjustment

**Deviation Categories**:
- Over-budget (requires justification)
- Under-budget (analyze utilization)
- Missing imputations (payroll or vendor)
- Timing differences

### Step 3: Apply Justified Adjustments

**Adjustment Process**:
1. PM or FIN creates adjustment request
2. Mandatory fields:
   - Project and Rubro
   - Amount (positive or negative)
   - Reason (minimum 50 characters)
   - Supporting documents
3. Dual approval required (PM + FIN)
4. System records in audit log

**Common Adjustment Reasons**:
- Budget reallocation between rubros
- Timing corrections
- Currency adjustments
- Error corrections
- Contract modifications

### Step 4: Generate Execution Reports

**Available Reports**:
- Budget execution by project (Plan vs Real)
- Aging report (pending items)
- Deviation summary
- Vendor spending analysis
- Payroll allocation report

**Export Formats**:
- PDF for management presentations
- CSV for data analysis
- Excel with formulas for further processing

### Step 5: Preliminary Close Approval

**Approvers**:
- PM: Confirms project data accuracy
- FIN: Validates financial integrity
- SDT: Reviews overall portfolio health

**Final Steps**:
- All deviations documented
- All adjustments approved and applied
- Reports generated and distributed
- System transitions to new month

## ES: Proceso de Pre-Cierre Mensual

### Paso 1: Bloquear Nuevos Movimientos

**Tiempo**: Últimos 3 días hábiles del mes

**Acciones**:
1. Sistema bloquea automáticamente nuevas asignaciones
2. Solo ajustes con justificación permitidos
3. Notificación enviada a todos los PM y equipo FIN
4. Panel muestra banner "Modo Pre-Cierre"

### Paso 2: Revisar Desviaciones

**Tareas del Equipo FIN**:
- Revisar presupuesto vs real por proyecto
- Identificar variaciones > 10%
- Generar reporte de desviaciones
- Marcar elementos que requieren ajuste

**Categorías de Desviación**:
- Sobre-presupuesto (requiere justificación)
- Sub-presupuesto (analizar utilización)
- Imputaciones faltantes (nómina o proveedor)
- Diferencias de tiempo

### Paso 3: Aplicar Ajustes Justificados

**Proceso de Ajuste**:
1. PM o FIN crea solicitud de ajuste
2. Campos obligatorios:
   - Proyecto y Rubro
   - Monto (positivo o negativo)
   - Razón (mínimo 50 caracteres)
   - Documentos de soporte
3. Aprobación dual requerida (PM + FIN)
4. Sistema registra en log de auditoría

**Razones Comunes de Ajuste**:
- Reasignación presupuestaria entre rubros
- Correcciones de tiempo
- Ajustes de moneda
- Correcciones de errores
- Modificaciones de contrato

### Paso 4: Generar Reportes de Ejecución

**Reportes Disponibles**:
- Ejecución presupuestaria por proyecto (Plan vs Real)
- Reporte de antigüedad (elementos pendientes)
- Resumen de desviaciones
- Análisis de gasto de proveedores
- Reporte de asignación de nómina

**Formatos de Exportación**:
- PDF para presentaciones gerenciales
- CSV para análisis de datos
- Excel con fórmulas para procesamiento adicional

### Paso 5: Aprobación de Cierre Preliminar

**Aprobadores**:
- PM: Confirma precisión de datos del proyecto
- FIN: Valida integridad financiera
- SDT: Revisa salud general del portafolio

**Pasos Finales**:
- Todas las desviaciones documentadas
- Todos los ajustes aprobados y aplicados
- Reportes generados y distribuidos
- Sistema transiciona a nuevo mes

---

## EN: Payroll Ingestion

### Endpoint

`POST /payroll/ingest`

**Frequency**: Monthly (first 5 business days)

### Process

**Step 1: Prepare Payroll File**

**Required Format**: CSV or Excel
**Columns**:
- employee_id
- employee_name
- project_id
- amount
- period (YYYY-MM)
- cost_center
- department

**Validation**:
- All employees must exist in system
- All projects must be active
- Amounts must be positive
- Period must be valid (not future)

**Step 2: Upload via API or UI**

**API Method**:
```bash
POST /payroll/ingest
Content-Type: multipart/form-data
Authorization: Bearer {JWT}

{
  "file": <CSV/Excel>,
  "period": "2024-11",
  "dry_run": false
}
```

**UI Method**:
1. Navigate to Admin → Payroll Ingestion
2. Select file
3. Select period
4. Click "Validate" (dry run)
5. Review validation results
6. Click "Process" (actual ingestion)

**Step 3: Validation**

**System Checks**:
- File format correct
- All required columns present
- No duplicate entries
- Valid employee IDs
- Valid project IDs
- Amounts reasonable (not negative, not > threshold)
- Period matches expected

**Validation Report**:
- Total rows processed
- Successful imputations
- Errors (with line numbers)
- Warnings (e.g., high amounts)

**Step 4: Imputation by Project/Rubro**

**Automatic Actions**:
1. For each payroll entry:
   - Lookup project
   - Determine rubro based on employee role
   - Apply imputation rules
   - Create payroll_actual record
   - Update allocation actual amounts
2. Generate alerts if:
   - Missing imputations (employee without project)
   - Budget exceeded
   - Unusual patterns

**Imputation Rules** (see UI Documentation for detailed rules):
- Direct labor → Labor rubro
- Indirect costs → Overhead rubro
- Subcontractors → External Services rubro

**Step 5: Reconciliation**

**FIN Team Review**:
- Compare total payroll to expected
- Verify all employees imputed
- Check for missing projects
- Resolve discrepancies

**Missing Imputation Alert**:
- Email sent to PM if employees without project assignment
- Dashboard shows warning
- Requires manual assignment

## ES: Ingesta de Nómina

### Endpoint

`POST /payroll/ingest`

**Frecuencia**: Mensual (primeros 5 días hábiles)

### Proceso

**Paso 1: Preparar Archivo de Nómina**

**Formato Requerido**: CSV o Excel
**Columnas**:
- employee_id
- employee_name
- project_id
- amount
- period (YYYY-MM)
- cost_center
- department

**Validación**:
- Todos los empleados deben existir en sistema
- Todos los proyectos deben estar activos
- Montos deben ser positivos
- Período debe ser válido (no futuro)

**Paso 2: Cargar vía API o UI**

**Método API**:
```bash
POST /payroll/ingest
Content-Type: multipart/form-data
Authorization: Bearer {JWT}

{
  "file": <CSV/Excel>,
  "period": "2024-11",
  "dry_run": false
}
```

**Método UI**:
1. Navegar a Admin → Ingesta de Nómina
2. Seleccionar archivo
3. Seleccionar período
4. Hacer clic en "Validar" (ejecución en seco)
5. Revisar resultados de validación
6. Hacer clic en "Procesar" (ingesta real)

**Paso 3: Validación**

**Verificaciones del Sistema**:
- Formato de archivo correcto
- Todas las columnas requeridas presentes
- Sin entradas duplicadas
- IDs de empleado válidos
- IDs de proyecto válidos
- Montos razonables (no negativos, no > umbral)
- Período coincide con esperado

**Reporte de Validación**:
- Total de filas procesadas
- Imputaciones exitosas
- Errores (con números de línea)
- Advertencias (ej., montos altos)

**Paso 4: Imputación por Proyecto/Rubro**

**Acciones Automáticas**:
1. Para cada entrada de nómina:
   - Buscar proyecto
   - Determinar rubro según rol de empleado
   - Aplicar reglas de imputación
   - Crear registro payroll_actual
   - Actualizar montos reales de asignación
2. Generar alertas si:
   - Imputaciones faltantes (empleado sin proyecto)
   - Presupuesto excedido
   - Patrones inusuales

**Reglas de Imputación** (ver Documentación UI para reglas detalladas):
- Mano de obra directa → rubro Labor
- Costos indirectos → rubro Overhead
- Subcontratistas → rubro Servicios Externos

**Paso 5: Reconciliación**

**Revisión del Equipo FIN**:
- Comparar nómina total con esperado
- Verificar todos los empleados imputados
- Verificar proyectos faltantes
- Resolver discrepancias

**Alerta de Imputación Faltante**:
- Correo enviado a PM si empleados sin asignación de proyecto
- Panel muestra advertencia
- Requiere asignación manual

---

## EN: Budget Adjustments

### When to Create Adjustment

**Valid Scenarios**:
- Budget reallocation between rubros within same project
- Correction of errors in original allocation
- Contract change orders
- Currency exchange rate adjustments
- Timing corrections (accruals)

**Invalid Scenarios** (use different process):
- New budget requests → Use allocation creation
- Project closure → Use project close workflow
- Cross-project transfers → Requires executive approval

### Adjustment Workflow

**Step 1: Create Adjustment**
- Navigate to Project → Adjustments → New
- Select project and source rubro
- Select target rubro (if reallocation)
- Enter amount (positive for increase, negative for decrease)
- Enter detailed reason
- Attach supporting documents

**Step 2: PM Approval**
- PM receives notification
- Reviews adjustment details
- Approves or rejects with comment
- System records decision

**Step 3: FIN Validation**
- FIN reviews for financial accuracy
- Checks budget availability
- Validates business justification
- Approves or rejects

**Step 4: Application**
- If both approvals received:
  - Update allocation amounts
  - Create audit log entry
  - Send confirmation to PM
  - Update dashboards

## ES: Ajustes Presupuestarios

### Cuándo Crear Ajuste

**Escenarios Válidos**:
- Reasignación presupuestaria entre rubros dentro del mismo proyecto
- Corrección de errores en asignación original
- Órdenes de cambio de contrato
- Ajustes de tasa de cambio de moneda
- Correcciones de tiempo (devengos)

**Escenarios Inválidos** (usar proceso diferente):
- Nuevas solicitudes de presupuesto → Usar creación de asignación
- Cierre de proyecto → Usar flujo de cierre de proyecto
- Transferencias entre proyectos → Requiere aprobación ejecutiva

### Flujo de Trabajo de Ajuste

**Paso 1: Crear Ajuste**
- Navegar a Proyecto → Ajustes → Nuevo
- Seleccionar proyecto y rubro origen
- Seleccionar rubro destino (si reasignación)
- Ingresar monto (positivo para aumento, negativo para disminución)
- Ingresar razón detallada
- Adjuntar documentos de soporte

**Paso 2: Aprobación PM**
- PM recibe notificación
- Revisa detalles de ajuste
- Aprueba o rechaza con comentario
- Sistema registra decisión

**Paso 3: Validación FIN**
- FIN revisa precisión financiera
- Verifica disponibilidad de presupuesto
- Valida justificación de negocio
- Aprueba o rechaza

**Paso 4: Aplicación**
- Si ambas aprobaciones recibidas:
  - Actualizar montos de asignación
  - Crear entrada de log de auditoría
  - Enviar confirmación a PM
  - Actualizar paneles

---

**Document Version**: 1.0  
**Effective Date**: November 2024  
**Review Date**: May 2025  
**Owner**: Finance Operations / Operaciones Financieras  
**Status**: Active / Activo
