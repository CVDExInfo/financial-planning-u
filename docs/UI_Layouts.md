# UI Layouts / Diseños de Interfaz de Usuario

## EN: User Interface Layouts

### Dashboard Layout

#### Overview
The main dashboard provides a comprehensive view of financial operations for all user roles.

#### Components
1. **Header Navigation**
   - Logo (CVDex/Ikusi)
   - Navigation menu
   - User profile dropdown
   - Notifications bell icon
   - Language switcher (EN/ES)

2. **Summary Cards**
   - Pending Approvals
   - Budget Utilization
   - Recent Activities

3. **Quick Actions Panel**
   - Approve Requests (FIN role)
   - View Reports (All roles)
   - Manage Budgets (SDM/FIN roles)

4. **Recent Activity Feed**
   - Chronological list of recent actions
   - Filterable by type and user
   - Real-time updates


#### Layout
- **Section 1: Project Selection**
  - Dropdown: Select project
  - Display: Current budget status
  - Display: Remaining budget

  - Input: Amount ($)
  - Dropdown: Category
  - Textarea: Description
  - File upload: Attachments (optional)

- **Section 3: Review**
  - Summary of entered information
  - Budget impact preview
  - Confirmation checkbox

- **Actions**
  - Button: Save as Draft
  - Button: Submit for Approval
  - Button: Cancel

### Approval Workflow Screen

#### Layout
  - Project name and ID
  - Submitter information
  - Amount and category
  - Description
  - Attachments (if any)
  - Submission date

- **Budget Impact Panel**
  - Current budget
  - This request amount
  - Projected remaining
  - Utilization percentage

- **Historical Context Panel**
  - Average approval time
  - Approval patterns

- **Approval Actions**
  - Button: Approve
  - Button: Reject
  - Textarea: Comments (optional for approve, required for reject)

### Budget Management Screen

#### Layout
- **Budget Overview Table**
  - Columns: Project, Allocated, Spent, Remaining, Utilization%
  - Sortable and filterable
  - Color-coded utilization (green < 70%, yellow 70-90%, red > 90%)

- **Budget Details Modal**
  - Budget allocation history
  - Monthly trends chart
  - Adjustment history

- **Actions**
  - Button: Create Budget
  - Button: Adjust Budget
  - Button: Export Report

### Reports Screen

#### Layout
- **Report Selection Panel**
  - Dropdown: Report type
    - Budget Utilization
    - Approval History
    - Month-End Close
    - Annual Summary
  - Date range picker
  - Project filter (multi-select)
  - Category filter (multi-select)

- **Preview Panel**
  - Report preview (first page)
  - Estimated file size
  - Generation time estimate

- **Actions**
  - Button: Generate PDF
  - Button: Generate CSV
  - Button: Schedule Report

### Audit Trail Viewer

#### Layout
- **Filter Panel**
  - Date range picker
  - User filter
  - Action type filter
  - Entity type filter
  - Entity ID search

- **Audit Log Table**
  - Columns: Timestamp, User, Action, Entity, Details, IP
  - Expandable rows for full details
  - Export functionality

- **Details Modal**
  - Full audit record
  - Before/after comparison (for updates)
  - Related events
  - User session information

### Responsive Design

#### Desktop (> 1024px)
- Full sidebar navigation
- Multi-column layouts
- Expandable panels
- Rich data tables

#### Tablet (768px - 1024px)
- Collapsible sidebar
- Two-column layouts adapt to single column
- Simplified tables with scrolling

#### Mobile (< 768px)
- Bottom navigation bar
- Single-column layouts
- Card-based interfaces
- Touch-optimized controls

### Accessibility Features

- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader compatible
- High contrast mode
- Adjustable font sizes
- Alt text for all images
- ARIA labels for interactive elements

### Color Scheme

#### Primary Colors
- Primary: #0C6E4F (Ikusi green)
- Accent: #4AC795 (Light green)
- Secondary: #003366 (Dark blue)

#### Status Colors
- Success: #28a745
- Warning: #ffc107
- Error: #dc3545
- Info: #17a2b8

#### Neutral Colors
- Dark: #343a40
- Gray: #5B6770
- Light: #f8f9fa
- White: #ffffff

---

## ES: Diseños de Interfaz de Usuario

### Diseño del Panel de Control

#### Descripción General
El panel de control principal proporciona una vista integral de las operaciones financieras para todos los roles de usuario.

#### Componentes
1. **Navegación del Encabezado**
   - Logo (CVDex/Ikusi)
   - Menú de navegación
   - Menú desplegable de perfil de usuario
   - Icono de campana de notificaciones
   - Selector de idioma (EN/ES)

[Traducción de todas las secciones de diseño de UI]

### Diseño Responsivo

#### Escritorio (> 1024px)
[Traducción de especificaciones de escritorio]

#### Tableta (768px - 1024px)
[Traducción de especificaciones de tableta]

#### Móvil (< 768px)
[Traducción de especificaciones móviles]

### Características de Accesibilidad

- Cumplimiento con WCAG 2.1 Nivel AA
- Soporte de navegación por teclado
- Compatible con lectores de pantalla
- Modo de alto contraste
- Tamaños de fuente ajustables
