# SOP: Pre-facturas - Ikusi

**Standard Operating Procedure: Pre-Invoice Management**  
**Procedimiento Operativo Estándar: Gestión de Pre-facturas**

---

## EN: Purpose

This Standard Operating Procedure defines the complete workflow for creating, approving, and managing pre-invoice requests (pre-facturas) in the Finanzas SD system for Ikusi operations.

## ES: Propósito

Este Procedimiento Operativo Estándar define el flujo de trabajo completo para crear, aprobar y gestionar solicitudes de pre-facturas en el sistema Finanzas SD para operaciones de Ikusi.

---

## EN: Scope

This SOP applies to:
- Project Managers (PM) creating pre-invoice requests
- Finance Team (FIN) approving requests
- Service Delivery Team (SDT) oversight
- Audit team (AUD) reviewing compliance

## ES: Alcance

Este SOP aplica a:
- Gerentes de Proyecto (PM) creando solicitudes de pre-facturas
- Equipo de Finanzas (FIN) aprobando solicitudes
- Equipo de Entrega de Servicios (SDT) supervisión
- Equipo de auditoría (AUD) revisando cumplimiento

---

## EN: Pre-factura Creation Process

### Step 1: PM Generates Request

**Mandatory Fields**:
- Project (dropdown selection)
- Provider (validated vendor)
- Rubro (cost category)
- Amount (numeric validation)
- Currency (COP, USD, EUR)
- Attachments (supporting documents)
- Comments (business justification)

**Validation Rules**:
- Amount must be > 0
- Project must be active
- Provider must be registered
- Rubro must exist for selected project
- Cross-check project/provider relationship

**Actions**:
1. Navigate to Pre-facturas → New Request
2. Complete all required fields
3. Upload supporting documents (PDF, Excel)
4. Click "Submit" button

### Step 2: System Processing

**Automatic Actions**:
1. **Persist Request**: Save to DynamoDB with status "submitted"
2. **Generate PDF**: Create PDF document with folio and official stamp
3. **Store in S3**: Upload PDF to S3 bucket with secure key
4. **Create Audit Log**: Record all details with timestamp and actor
5. **Send Notification**: Email initial notice to approver(s)

**Generated Artifacts**:
- Pre-factura Request ID (unique identifier)
- PDF Document with Folio (e.g., PRE-2024-00123)
- S3 Object Key
- SHA256 hash for document integrity

### Step 3: Notification to Approver

**Initial Email Contains**:
- Request ID and Folio
- Project name
- Provider name
- Amount and currency
- Link to review in system
- Deadline for approval (72 hours)

**Reminder Logic**:
- If no response after 72 hours → automatic reminder email
- Second reminder after 96 hours
- Escalation to SDT manager after 120 hours

### Step 4: Finance Review and Approval

**FIN Team Actions**:
1. Log into Finanzas SD → Finance Queue
2. Filter by status "pending approval"
3. Review request details:
   - Project budget availability
   - Provider contract status
   - Amount reasonableness
   - Supporting documentation
4. Make decision: Approve or Reject

**Approval Decision**:
- **Approve**: Add approval comment → Click "Approve"
- **Reject**: Add rejection reason (mandatory) → Click "Reject"

**System Response**:
- Record approval/rejection event with timestamp
- Update request status
- Write audit log entry
- Send notification to PM

### Step 5: SharePoint Deposit (Approved Requests Only)

**Automatic Actions After Approval**:
1. Retrieve PDF document from S3
2. Prepare metadata:
   - Project ID and name
   - Folio number
   - Provider information
   - Amount and currency
   - Approval date and approver
3. Connect to SharePoint via Microsoft Graph API
4. Deposit document to configured SharePoint site/path
5. Record SharePoint reference in DynamoDB
6. Update audit log

**SharePoint Structure**:
```
/Finanzas/Pre-facturas/
  ├── 2024/
  │   ├── 11-November/
  │   │   ├── PRE-2024-00123.pdf
  │   │   └── PRE-2024-00124.pdf
```

### Step 6: Traceability Reporting

**Available Reports**:
- Pre-factura status dashboard
- Approval timeline report
- Aging report (pending requests)
- Audit trail export (CSV/PDF)

**Export Options**:
- CSV for data analysis
- PDF for client presentation
- Excel with pivot tables

## ES: Proceso de Creación de Pre-factura

### Paso 1: PM Genera Solicitud

**Campos Obligatorios**:
- Proyecto (selección desplegable)
- Proveedor (vendedor validado)
- Rubro (categoría de costo)
- Monto (validación numérica)
- Moneda (COP, USD, EUR)
- Adjuntos (documentos de soporte)
- Comentarios (justificación de negocio)

**Reglas de Validación**:
- Monto debe ser > 0
- Proyecto debe estar activo
- Proveedor debe estar registrado
- Rubro debe existir para proyecto seleccionado
- Verificación cruzada de relación proyecto/proveedor

**Acciones**:
1. Navegar a Pre-facturas → Nueva Solicitud
2. Completar todos los campos requeridos
3. Cargar documentos de soporte (PDF, Excel)
4. Hacer clic en botón "Enviar"

### Paso 2: Procesamiento del Sistema

**Acciones Automáticas**:
1. **Persistir Solicitud**: Guardar en DynamoDB con estado "enviado"
2. **Generar PDF**: Crear documento PDF con folio y sello oficial
3. **Almacenar en S3**: Subir PDF a bucket S3 con clave segura
4. **Crear Registro de Auditoría**: Registrar todos los detalles con marca de tiempo y actor
5. **Enviar Notificación**: Correo electrónico de aviso inicial al(los) aprobador(es)

**Artefactos Generados**:
- ID de Solicitud de Pre-factura (identificador único)
- Documento PDF con Folio (ej., PRE-2024-00123)
- Clave de Objeto S3
- Hash SHA256 para integridad del documento

### Paso 3: Notificación al Aprobador

**Correo Inicial Contiene**:
- ID de Solicitud y Folio
- Nombre del proyecto
- Nombre del proveedor
- Monto y moneda
- Enlace para revisar en sistema
- Plazo para aprobación (72 horas)

**Lógica de Recordatorio**:
- Si no hay respuesta después de 72 horas → correo de recordatorio automático
- Segundo recordatorio después de 96 horas
- Escalamiento a gerente SDT después de 120 horas

### Paso 4: Revisión y Aprobación de Finanzas

**Acciones del Equipo FIN**:
1. Iniciar sesión en Finanzas SD → Cola de Finanzas
2. Filtrar por estado "aprobación pendiente"
3. Revisar detalles de solicitud:
   - Disponibilidad de presupuesto del proyecto
   - Estado de contrato del proveedor
   - Razonabilidad del monto
   - Documentación de soporte
4. Tomar decisión: Aprobar o Rechazar

**Decisión de Aprobación**:
- **Aprobar**: Agregar comentario de aprobación → Hacer clic en "Aprobar"
- **Rechazar**: Agregar razón de rechazo (obligatorio) → Hacer clic en "Rechazar"

**Respuesta del Sistema**:
- Registrar evento de aprobación/rechazo con marca de tiempo
- Actualizar estado de solicitud
- Escribir entrada de registro de auditoría
- Enviar notificación a PM

### Paso 5: Depósito en SharePoint (Solo Solicitudes Aprobadas)

**Acciones Automáticas Después de Aprobación**:
1. Recuperar documento PDF de S3
2. Preparar metadatos:
   - ID y nombre del proyecto
   - Número de folio
   - Información del proveedor
   - Monto y moneda
   - Fecha de aprobación y aprobador
3. Conectar a SharePoint vía API Microsoft Graph
4. Depositar documento en sitio/ruta SharePoint configurada
5. Registrar referencia de SharePoint en DynamoDB
6. Actualizar registro de auditoría

**Estructura de SharePoint**:
```
/Finanzas/Pre-facturas/
  ├── 2024/
  │   ├── 11-Noviembre/
  │   │   ├── PRE-2024-00123.pdf
  │   │   └── PRE-2024-00124.pdf
```

### Paso 6: Reportes de Trazabilidad

**Reportes Disponibles**:
- Panel de estado de pre-facturas
- Reporte de línea de tiempo de aprobación
- Reporte de antigüedad (solicitudes pendientes)
- Exportación de registro de auditoría (CSV/PDF)

**Opciones de Exportación**:
- CSV para análisis de datos
- PDF para presentación al cliente
- Excel con tablas dinámicas

---

## EN: Roles and Responsibilities

### Project Manager (PM)
- **Responsible**: Creating accurate pre-factura requests
- **Accountable**: Ensuring all required information is provided
- **Tasks**:
  - Validate project budget availability before request
  - Gather supporting documentation
  - Submit complete requests
  - Respond to approval decisions

### Finance Team (FIN)
- **Responsible**: Reviewing and approving/rejecting requests
- **Accountable**: Financial accuracy and budget compliance
- **Tasks**:
  - Review requests within 72 hours
  - Verify budget availability
  - Validate provider contracts
  - Approve or reject with clear justification

### Service Delivery Team (SDT)
- **Consulted**: On complex or high-value requests
- **Informed**: Of all approval decisions
- **Tasks**:
  - Oversee approval queue health
  - Escalate aging requests
  - Monitor system performance

### Audit Team (AUD)
- **Informed**: Complete audit trail available
- **Tasks**:
  - Review compliance
  - Generate audit reports
  - Validate process adherence

## ES: Roles y Responsabilidades

### Gerente de Proyecto (PM)
- **Responsable**: Crear solicitudes de pre-factura precisas
- **Responsable**: Asegurar que se proporcione toda la información requerida
- **Tareas**:
  - Validar disponibilidad de presupuesto del proyecto antes de solicitud
  - Reunir documentación de soporte
  - Enviar solicitudes completas
  - Responder a decisiones de aprobación

### Equipo de Finanzas (FIN)
- **Responsable**: Revisar y aprobar/rechazar solicitudes
- **Responsable**: Precisión financiera y cumplimiento presupuestario
- **Tareas**:
  - Revisar solicitudes dentro de 72 horas
  - Verificar disponibilidad de presupuesto
  - Validar contratos de proveedores
  - Aprobar o rechazar con justificación clara

### Equipo de Entrega de Servicios (SDT)
- **Consultado**: En solicitudes complejas o de alto valor
- **Informado**: De todas las decisiones de aprobación
- **Tareas**:
  - Supervisar salud de cola de aprobación
  - Escalar solicitudes antiguas
  - Monitorear rendimiento del sistema

### Equipo de Auditoría (AUD)
- **Informado**: Registro de auditoría completo disponible
- **Tareas**:
  - Revisar cumplimiento
  - Generar reportes de auditoría
  - Validar adherencia al proceso

---

## EN: Exception Handling

### High-Value Requests (> 50M COP)
- Require dual approval (FIN + SDT manager)
- Additional documentation required
- Extended review period (96 hours)

### Urgent Requests
- PM can flag request as "urgent"
- Notification sent to FIN manager directly
- 24-hour SLA for review
- Requires business justification in comments

### Provider Issues
- If provider not in system → Create provider first
- If provider contract expired → Reject request with note
- If provider on hold → Escalate to SDT

### System Errors
- PDF generation failure → Retry automatically (3 attempts)
- SharePoint connectivity issue → Queue for retry
- All errors logged in CloudWatch
- Notifications sent to operations team

## ES: Manejo de Excepciones

### Solicitudes de Alto Valor (> 50M COP)
- Requieren aprobación dual (FIN + gerente SDT)
- Documentación adicional requerida
- Período de revisión extendido (96 horas)

### Solicitudes Urgentes
- PM puede marcar solicitud como "urgente"
- Notificación enviada directamente a gerente FIN
- SLA de 24 horas para revisión
- Requiere justificación de negocio en comentarios

### Problemas con Proveedores
- Si proveedor no está en sistema → Crear proveedor primero
- Si contrato de proveedor expiró → Rechazar solicitud con nota
- Si proveedor en espera → Escalar a SDT

### Errores del Sistema
- Falla en generación de PDF → Reintentar automáticamente (3 intentos)
- Problema de conectividad SharePoint → Poner en cola para reintento
- Todos los errores registrados en CloudWatch
- Notificaciones enviadas a equipo de operaciones

---

## EN: Compliance and Audit

### Audit Trail
- Every action logged with:
  - Actor (user_id and email)
  - Timestamp (ISO 8601)
  - Action type (create, submit, approve, reject, deposit)
  - Entity ID (pre-factura ID)
  - Metadata (JSON with relevant details)

### Retention Policy
- DynamoDB records: 7 years
- S3 PDFs: 7 years (lifecycle policy to Glacier after 1 year)
- SharePoint documents: Follows client retention policy
- CloudWatch logs: 90 days (exportable to S3)

### Security
- All API calls require valid JWT token
- Cognito groups enforce RBAC
- S3 objects encrypted at rest (AES-256)
- TLS 1.2+ for all communications
- No static credentials in code (OIDC only)

## ES: Cumplimiento y Auditoría

### Registro de Auditoría
- Cada acción registrada con:
  - Actor (user_id y email)
  - Marca de tiempo (ISO 8601)
  - Tipo de acción (crear, enviar, aprobar, rechazar, depositar)
  - ID de entidad (ID de pre-factura)
  - Metadatos (JSON con detalles relevantes)

### Política de Retención
- Registros DynamoDB: 7 años
- PDFs S3: 7 años (política de ciclo de vida a Glacier después de 1 año)
- Documentos SharePoint: Sigue política de retención del cliente
- Registros CloudWatch: 90 días (exportables a S3)

### Seguridad
- Todas las llamadas API requieren token JWT válido
- Grupos Cognito aplican RBAC
- Objetos S3 encriptados en reposo (AES-256)
- TLS 1.2+ para todas las comunicaciones
- Sin credenciales estáticas en código (solo OIDC)

---

**Document Version**: 1.0  
**Effective Date**: November 2024  
**Review Date**: May 2025  
**Owner**: Finance Operations / Operaciones Financieras  
**Status**: Active / Activo
