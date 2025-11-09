# UI Layouts and States

**UI Component Maps, Empty States, and Imputation Rules**  
**Mapas de Componentes UI, Estados Vacíos y Reglas de Imputación**

---

## EN: Key Screens

### PM — Pre-facturas Inbox

**Purpose**: Dashboard for Project Managers to manage pre-invoice requests

**Layout**:
- Header with user info and role badge
- Filters panel (collapsible):
  - Status (draft, submitted, approved, rejected)
  - Project (dropdown)
  - Provider (dropdown)
  - Rubro (dropdown)
  - Period (date range)
  - Amount range
- Main table with columns:
  - Folio (link to detail)
  - Project name
  - Provider name
  - Amount + currency
  - Status badge
  - Updated date
  - Actions (View, Edit, Cancel)
- Pagination controls
- "New Request" CTA button (top right)

**Empty State**:
```
🗂️ No pre-facturas found

You don't have any pre-invoice requests yet.

[Create Pre-factura Request]

Tip: Pre-facturas allow you to request approval for project expenses.
```

### Pre-factura Form

**Purpose**: Create or edit pre-invoice request

**Fields**:
1. **Project** (required)
   - Dropdown with active projects
   - Shows project budget status
   
2. **Provider** (required)
   - Dropdown with registered vendors
   - Link to add new provider
   
3. **Rubro** (required)
   - Filtered by selected project
   - Shows remaining budget
   
4. **Amount** (required)
   - Numeric input
   - Currency selector (COP, USD, EUR)
   - Real-time validation against budget
   
5. **Attachments** (optional)
   - File upload (PDF, Excel, images)
   - Multiple files supported
   - Auto-generates PDF on submit
   
6. **Comments** (required)
   - Text area (minimum 50 characters)
   - Business justification

**Validation**:
- All required fields must be filled
- Amount > 0 and <= remaining budget
- Project/provider relationship valid
- Comments meet minimum length

**Actions**:
- Save Draft (status: draft)
- Submit for Approval (status: submitted)
- Cancel (return to inbox)

## ES: Pantallas Clave

### PM — Bandeja de Pre-facturas

**Propósito**: Panel para Gerentes de Proyecto para gestionar solicitudes de pre-facturas

**Diseño**:
- Encabezado con info de usuario e insignia de rol
- Panel de filtros (colapsable):
  - Estado (borrador, enviado, aprobado, rechazado)
  - Proyecto (desplegable)
  - Proveedor (desplegable)
  - Rubro (desplegable)
  - Período (rango de fechas)
  - Rango de monto
- Tabla principal con columnas:
  - Folio (enlace a detalle)
  - Nombre del proyecto
  - Nombre del proveedor
  - Monto + moneda
  - Badge de estado
  - Fecha de actualización
  - Acciones (Ver, Editar, Cancelar)
- Controles de paginación
- Botón CTA "Nueva Solicitud" (arriba derecha)

**Estado Vacío**:
```
🗂️ No se encontraron pre-facturas

Aún no tiene solicitudes de pre-factura.

[Crear Solicitud de Pre-factura]

Consejo: Las pre-facturas le permiten solicitar aprobación para gastos del proyecto.
```

### Formulario de Pre-factura

**Propósito**: Crear o editar solicitud de pre-factura

**Campos**:
1. **Proyecto** (requerido)
   - Desplegable con proyectos activos
   - Muestra estado presupuestario del proyecto
   
2. **Proveedor** (requerido)
   - Desplegable con vendedores registrados
   - Enlace para agregar nuevo proveedor
   
3. **Rubro** (requerido)
   - Filtrado por proyecto seleccionado
   - Muestra presupuesto restante
   
4. **Monto** (requerido)
   - Entrada numérica
   - Selector de moneda (COP, USD, EUR)
   - Validación en tiempo real contra presupuesto
   
5. **Adjuntos** (opcional)
   - Carga de archivos (PDF, Excel, imágenes)
   - Múltiples archivos soportados
   - Auto-genera PDF al enviar
   
6. **Comentarios** (requerido)
   - Área de texto (mínimo 50 caracteres)
   - Justificación de negocio

**Validación**:
- Todos los campos requeridos deben completarse
- Monto > 0 y <= presupuesto restante
- Relación proyecto/proveedor válida
- Comentarios cumplen longitud mínima

**Acciones**:
- Guardar Borrador (estado: borrador)
- Enviar para Aprobación (estado: enviado)
- Cancelar (regresar a bandeja)

---

## EN: Finance Queue

**Purpose**: Dashboard for Finance team to review and approve requests

**Layout**:
- Header with approval metrics:
  - Pending count
  - Aging items (> 72 hours)
  - Today's approvals
  - Average approval time
- Filters:
  - Status (focus on "submitted")
  - Amount threshold (> 50M COP)
  - Aging (< 24h, 24-72h, > 72h, > 120h)
  - Project
  - Assignee (for distributed workload)
- Priority queue:
  - Urgent items (flagged by PM)
  - Aging items (> 72 hours)
  - High-value (> 50M COP)
  - Regular items
- Detail panel (side drawer or modal):
  - Full request details
  - Project budget status
  - Provider contract status
  - Approval history
  - Attached documents
  - Approve/Reject form

**Empty State** (all approved):
```
✅ All caught up!

No pending pre-facturas require approval.

Great work! Check back later for new requests.
```

### Budget Dashboard / Gestión de Presupuesto

**Purpose**: Monitor budget execution and deviations

**Tabs**:
1. **Plan vs Real**: Budget vs actual by project/rubro
2. **Desvíos**: Variances > threshold
3. **Aging**: Pending items by age
4. **Ajustes**: Budget adjustments history
5. **Export**: Download reports (PDF/CSV)

**Widgets**:
- Total budget vs spent (progress bars)
- Top 5 over-budget projects
- Top 5 under-budget projects
- Monthly trend chart
- Rubro breakdown (pie chart)

**Actions**:
- Drill down to project details
- Create adjustment
- Export reports
- Schedule email reports

## ES: Cola de Finanzas

**Propósito**: Panel para equipo de Finanzas para revisar y aprobar solicitudes

**Diseño**:
- Encabezado con métricas de aprobación:
  - Conteo pendiente
  - Elementos antiguos (> 72 horas)
  - Aprobaciones de hoy
  - Tiempo promedio de aprobación
- Filtros:
  - Estado (enfoque en "enviado")
  - Umbral de monto (> 50M COP)
  - Antigüedad (< 24h, 24-72h, > 72h, > 120h)
  - Proyecto
  - Asignado (para carga de trabajo distribuida)
- Cola de prioridad:
  - Elementos urgentes (marcados por PM)
  - Elementos antiguos (> 72 horas)
  - Alto valor (> 50M COP)
  - Elementos regulares
- Panel de detalle (cajón lateral o modal):
  - Detalles completos de solicitud
  - Estado presupuestario del proyecto
  - Estado de contrato del proveedor
  - Historial de aprobación
  - Documentos adjuntos
  - Formulario Aprobar/Rechazar

**Estado Vacío** (todo aprobado):
```
✅ ¡Todo al día!

No hay pre-facturas pendientes que requieran aprobación.

¡Excelente trabajo! Revise más tarde para nuevas solicitudes.
```

### Panel de Presupuesto / Budget Board

**Propósito**: Monitorear ejecución presupuestaria y desviaciones

**Pestañas**:
1. **Plan vs Real**: Presupuesto vs real por proyecto/rubro
2. **Desvíos**: Varianzas > umbral
3. **Aging**: Elementos pendientes por antigüedad
4. **Ajustes**: Historial de ajustes presupuestarios
5. **Exportar**: Descargar reportes (PDF/CSV)

**Widgets**:
- Presupuesto total vs gastado (barras de progreso)
- Top 5 proyectos sobre presupuesto
- Top 5 proyectos sub-presupuesto
- Gráfico de tendencia mensual
- Desglose de rubro (gráfico circular)

**Acciones**:
- Desglosar a detalles de proyecto
- Crear ajuste
- Exportar reportes
- Programar reportes por correo

---

## EN: Imputation Rules (Examples)

### Rule 1 — Direct Labor

**Condition**:
- Rubro = "Labor"
- Project cost_center = "SD-OPS"

**Action**:
- Charge 100% to SD-OPS cost center
- Apply in payroll_actual period

**Example**:
```
Employee: Juan Pérez
Project: Project Alpha (SD-OPS)
Amount: 5,000,000 COP
Period: 2024-11
→ Impute 100% to SD-OPS / Labor rubro
```

### Rule 2 — Vendor Spend by Project

**Condition**:
- Provider tagged "Managed Services"
- Amount > 5,000,000 COP

**Action**:
- Require FIN approval before charge
- If approved, charge to project's rubro
- If rejected or pending, hold in suspense account

**Example**:
```
Provider: Tech Services Inc. (Managed Services)
Amount: 8,000,000 COP
Project: Project Beta
→ Trigger FIN approval workflow
→ If approved: charge to Project Beta / External Services rubro
→ If rejected: hold in suspense, notify PM
```

### Rule 3 — Close Adjustments

**Condition**:
- Period = pre-close (last 3 business days)

**Action**:
- Block new allocations
- Allow only adjustments with:
  - Mandatory reason (>= 50 chars)
  - Dual approval (PM + FIN)
  - Supporting documentation

**Example**:
```
Period: 2024-11-27 (pre-close mode active)
Action: Create new allocation
→ System blocks: "Pre-close active. Only adjustments allowed."
Action: Create adjustment with reason and docs
→ System allows: Sends for PM + FIN approval
```

## ES: Reglas de Imputación (Ejemplos)

### Regla 1 — Mano de Obra Directa

**Condición**:
- Rubro = "Labor"
- Centro de costo del proyecto = "SD-OPS"

**Acción**:
- Cargar 100% a centro de costo SD-OPS
- Aplicar en período payroll_actual

**Ejemplo**:
```
Empleado: Juan Pérez
Proyecto: Proyecto Alpha (SD-OPS)
Monto: 5,000,000 COP
Período: 2024-11
→ Imputar 100% a SD-OPS / rubro Labor
```

### Regla 2 — Gasto de Proveedor por Proyecto

**Condición**:
- Proveedor etiquetado "Servicios Gestionados"
- Monto > 5,000,000 COP

**Acción**:
- Requerir aprobación FIN antes de cargar
- Si aprobado, cargar a rubro del proyecto
- Si rechazado o pendiente, mantener en cuenta suspense

**Ejemplo**:
```
Proveedor: Tech Services Inc. (Servicios Gestionados)
Monto: 8,000,000 COP
Proyecto: Proyecto Beta
→ Disparar flujo de aprobación FIN
→ Si aprobado: cargar a Proyecto Beta / rubro Servicios Externos
→ Si rechazado: mantener en suspense, notificar PM
```

### Regla 3 — Ajustes de Cierre

**Condición**:
- Período = pre-cierre (últimos 3 días hábiles)

**Acción**:
- Bloquear nuevas asignaciones
- Permitir solo ajustes con:
  - Razón obligatoria (>= 50 caracteres)
  - Aprobación dual (PM + FIN)
  - Documentación de soporte

**Ejemplo**:
```
Período: 2024-11-27 (modo pre-cierre activo)
Acción: Crear nueva asignación
→ Sistema bloquea: "Pre-cierre activo. Solo ajustes permitidos."
Acción: Crear ajuste con razón y docs
→ Sistema permite: Envía para aprobación PM + FIN
```

---

## EN: Success & Error States

### Success Messages
- **Toast Notification**: Green banner at top
- **Icon**: ✅ checkmark
- **Message**: Clear action confirmation
- **Duration**: 5 seconds auto-dismiss
- **Example**: "Pre-factura PRE-2024-00123 submitted successfully"

### Error Messages
- **Toast Notification**: Red banner at top
- **Icon**: ⚠️ warning
- **Message**: Clear error description + action
- **Server Trace ID**: For support escalation
- **Duration**: Manual dismiss (user clicks X)
- **Example**: 
  ```
  ⚠️ Failed to submit pre-factura
  
  Budget exceeded for Project Alpha / Labor rubro.
  Remaining budget: 2,000,000 COP
  Requested amount: 3,000,000 COP
  
  [Adjust Amount] [Contact Finance] [Dismiss]
  
  Trace ID: abc123-def456 (for support)
  ```

### Empty States
- **Centered layout**: Icon + message + CTA
- **Helpful**: Explain why empty + next action
- **Consistent**: Same format across screens
- **Examples**: See individual screens above

## ES: Estados de Éxito y Error

### Mensajes de Éxito
- **Notificación Toast**: Banner verde en la parte superior
- **Icono**: ✅ marca de verificación
- **Mensaje**: Confirmación de acción clara
- **Duración**: 5 segundos auto-descartar
- **Ejemplo**: "Pre-factura PRE-2024-00123 enviada exitosamente"

### Mensajes de Error
- **Notificación Toast**: Banner rojo en la parte superior
- **Icono**: ⚠️ advertencia
- **Mensaje**: Descripción de error clara + acción
- **ID de Rastreo del Servidor**: Para escalamiento de soporte
- **Duración**: Descarte manual (usuario hace clic en X)
- **Ejemplo**:
  ```
  ⚠️ Fallo al enviar pre-factura
  
  Presupuesto excedido para Proyecto Alpha / rubro Labor.
  Presupuesto restante: 2,000,000 COP
  Monto solicitado: 3,000,000 COP
  
  [Ajustar Monto] [Contactar Finanzas] [Descartar]
  
  ID de Rastreo: abc123-def456 (para soporte)
  ```

### Estados Vacíos
- **Diseño centrado**: Icono + mensaje + CTA
- **Útil**: Explicar por qué vacío + próxima acción
- **Consistente**: Mismo formato en todas las pantallas
- **Ejemplos**: Ver pantallas individuales arriba

---

## EN: Accessibility

- **Keyboard Navigation**: All actions accessible via Tab/Enter
- **Screen Reader**: Proper ARIA labels and roles
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Focus Indicators**: Visible keyboard focus outline
- **Error Announcements**: Screen reader alerts for errors

## ES: Accesibilidad

- **Navegación por Teclado**: Todas las acciones accesibles vía Tab/Enter
- **Lector de Pantalla**: Etiquetas y roles ARIA apropiados
- **Contraste de Color**: Cumple WCAG AA (mínimo 4.5:1)
- **Indicadores de Enfoque**: Contorno de enfoque de teclado visible
- **Anuncios de Error**: Alertas de lector de pantalla para errores

---

**Document Version**: 1.0  
**Effective Date**: November 2024  
**Review Date**: Quarterly / Trimestral  
**Owner**: UX Team / Equipo UX  
**Status**: Active / Activo
