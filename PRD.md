# PMO Pre-Factura Estimator & SDMT Cost/Forecasting Platform

A comprehensive financial planning and management platform that enables project cost estimation, budget baseline creation, and ongoing financial forecasting for enterprise projects.

**Experience Qualities**:
1. **Professional** - Enterprise-grade interface that instills confidence in financial decisions
2. **Efficient** - Streamlined workflows that minimize time-to-insight for budget planning
3. **Transparent** - Clear visibility into cost drivers, variances, and financial projections

**Complexity Level**: Complex Application (advanced functionality, role-based access, multiple integrated modules)
- Requires sophisticated data modeling, chart integration, Excel export capabilities, and multi-step workflows

## Essential Features

### PMO Pre-Factura Estimator (Wizard)
- **Functionality**: Multi-step wizard for creating project cost baselines
- **Purpose**: Standardize estimation process and create signed budget agreements
- **Trigger**: PMO role accessing `/pmo/prefactura/estimator`
- **Progression**: Deal Inputs → Labor Costs → Non-Labor Costs → FX/Indexation → Review & Digital Signature
- **Success criteria**: Generates BaselineBudget with signature hash, exports to Excel/PDF

### SDMT Cost Catalog Management
- **Functionality**: CRUD operations for line items with file attachments
- **Purpose**: Maintain comprehensive cost item database
- **Trigger**: SDMT role accessing catalog tab
- **Progression**: View items → Add/Edit → Upload evidence → Save changes
- **Success criteria**: Persistent storage of categorized cost items

### Dynamic Forecast Grid
- **Functionality**: 60-month virtualized grid with inline editing
- **Purpose**: Track planned vs forecast vs actual costs over time
- **Trigger**: Forecast tab with project selection
- **Progression**: Select project → View grid → Edit forecasts → Import CSV/Excel → Export designed reports
- **Success criteria**: Real-time variance calculations and professional Excel exports

### Reconciliation Workflow
- **Functionality**: Invoice upload and matching against planned costs
- **Purpose**: Validate actual spending against forecasts
- **Trigger**: Reconciliation tab with evidence upload
- **Progression**: Upload invoices → Match to line items → Review disputes → Generate variance reports
- **Success criteria**: Status tracking (Pending/Matched/Disputed) with audit trail

### Cash Flow & Margin Analysis
- **Functionality**: Interactive charts showing inflows vs outflows
- **Purpose**: Monitor project profitability and cash position
- **Trigger**: Cash flow tab with project context
- **Progression**: View charts → Analyze trends → Drill to forecast details → Export insights
- **Success criteria**: Real-time margin calculations with drill-down capability

## Edge Case Handling
- **Empty States**: Guided onboarding for projects without baselines
- **Import Validation**: Detailed error reporting with mapping assistance
- **Role Restrictions**: Graceful permission denied with role switching for demo
- **Data Conflicts**: Clear resolution workflows for disputed invoices
- **Export Failures**: Retry mechanisms with progress indicators

## Design Direction
The interface should feel sophisticated and trustworthy, like enterprise financial software that CFOs would confidently present to executives - clean, data-dense when needed, but never overwhelming.

## Color Selection
Custom palette with Ikusi brand integration and module-specific accents.

- **Primary Color**: Ikusi Green `oklch(0.61 0.15 160)` - represents trust and financial stability
- **Secondary Colors**: 
  - PMO Module: `oklch(0.55 0.12 155)` - professional green accent
  - SDMT Module: `oklch(0.58 0.15 180)` - complementary teal accent
- **Accent Color**: Warm Orange `oklch(0.72 0.15 65)` - for CTAs and important data points
- **Foreground/Background Pairings**:
  - Background (Light mint): `oklch(0.98 0.02 160)` → Foreground: `oklch(0.15 0 0)` - Ratio 8.2:1 ✓
  - Card (Soft white): `oklch(1 0 0)` → Foreground: `oklch(0.15 0 0)` - Ratio 8.3:1 ✓
  - Primary (Ikusi Green): `oklch(0.61 0.15 160)` → White text: `oklch(1 0 0)` - Ratio 4.9:1 ✓
  - Accent (Warm Orange): `oklch(0.72 0.15 65)` → Dark text: `oklch(0.15 0 0)` - Ratio 5.1:1 ✓

## Font Selection
Inter for its exceptional readability in data-heavy interfaces and professional appearance in financial contexts.

- **Typographic Hierarchy**:
  - H1 (Module Titles): Inter Bold/32px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/24px/normal spacing  
  - H3 (Chart Titles): Inter Medium/18px/normal spacing
  - Body (Data Tables): Inter Regular/14px/relaxed spacing
  - Caption (Meta Info): Inter Regular/12px/wide spacing

## Animations
Subtle and purposeful motion that enhances data comprehension without distraction, appropriate for professional financial software.

- **Purposeful Meaning**: Smooth transitions reinforce data relationships and guide attention to important changes
- **Hierarchy of Movement**: Charts animate on data updates, form transitions are smooth, loading states are elegant

## Component Selection
- **Components**: Dialog for wizards, Card for data panels, Table for grids, Chart containers for insights, Form with validation
- **Customizations**: Enhanced DataTable with virtualization, specialized ChartPanel with export, UploadDropzone with progress
- **States**: Clear loading, success, and error states for all async operations
- **Icon Selection**: Phosphor icons for consistency - calculator, chart-line, upload, download, user-check
- **Spacing**: Consistent 8px grid system with generous whitespace around financial data
- **Mobile**: Responsive tables with horizontal scroll, stacked cards on smaller screens, touch-friendly controls