# Data Flows / Flujos de Datos

## EN: System Data Flows

### 1. Pre-factura Submission Flow

**Actors**: Project Manager (PM), System, Finance Team (FIN), SharePoint

**Flow**:
1. PM logs into Finanzas SD portal
2. PM navigates to "Create Pre-factura" form
3. PM fills in pre-factura details:
   - Project selection
   - Amount
   - Description
   - Category
   - Attachments (optional)
4. System validates input data
5. System creates pre-factura record in DynamoDB
6. System generates notification for Finance approver
7. FIN receives notification and reviews pre-factura
8. FIN approves or rejects with comments
9. System updates pre-factura status
10. System generates PDF document
11. System uploads PDF to S3
12. System deposits PDF to SharePoint (if configured)
13. System notifies PM of decision
14. PM receives notification and can download PDF

**Data Elements**:
- Input: Project ID, Amount, Description, Category, Attachments
- Processing: Validation, Budget check, Approval workflow
- Output: PDF document, S3 URL, SharePoint URL, Notifications

### 2. Budget Allocation Flow

**Actors**: San Diego Manager (SDM), Finance Team (FIN), System

**Flow**:
1. SDM or FIN creates budget allocation
2. System validates fiscal year and quarter
3. System checks for existing budget records
4. System calculates available funds
5. System creates budget record in DynamoDB
6. System triggers approval workflow (if required)
7. Approver reviews and approves budget
8. System activates budget for project
9. System notifies project team
10. Budget becomes available for pre-facturas

**Data Elements**:
- Input: Project ID, Fiscal Year, Quarter, Amount
- Processing: Validation, Duplicate check, Approval
- Output: Active budget record, Notifications

### 3. Report Generation Flow

**Actors**: Any authenticated user, System, S3, SharePoint

**Flow**:
1. User requests report (PDF or CSV)
2. System authenticates and authorizes user
3. System queries DynamoDB for data
4. System aggregates and formats data
5. System generates document (PDF or CSV)
6. System uploads document to S3
7. System creates document metadata record
8. System returns pre-signed S3 URL to user
9. User downloads document
10. Optional: System deposits to SharePoint

**Data Elements**:
- Input: Report type, Date range, Filters
- Processing: Data query, Aggregation, Formatting, Document generation
- Output: PDF/CSV file, S3 URL, Document metadata

### 4. Payroll Processing Flow

**Actors**: Finance Team (FIN), HR System, System

**Flow**:
1. FIN initiates payroll processing
2. System retrieves approved pre-facturas for period
3. System calculates totals by project and category
4. System generates payroll summary report
5. System exports data to CSV format
6. FIN reviews and validates totals
7. FIN exports to HR/Payroll system
8. System marks pre-facturas as processed
9. System generates audit log entries

**Data Elements**:
- Input: Payroll period, Approved pre-facturas
- Processing: Aggregation, Calculations, CSV generation
- Output: Payroll summary CSV, Updated pre-factura status, Audit logs

### 5. Month-End Close Flow

**Actors**: Finance Team (FIN), San Diego Manager (SDM), System

**Flow**:
1. FIN initiates month-end close process
2. System locks all pre-facturas for the month
3. System calculates budget utilization per project
4. System generates month-end reports:
   - Budget vs Actual
   - Pre-factura summary
   - Outstanding approvals
   - Variance analysis
5. System generates PDF reports
6. System uploads reports to S3 and SharePoint
7. System sends summary notifications to SDM
8. SDM reviews and signs off on reports
9. System archives month data
10. System unlocks system for next month

**Data Elements**:
- Input: Fiscal month, All pre-facturas, All budgets
- Processing: Calculations, Report generation, Data archival
- Output: Month-end reports (PDF), Variance analysis, Archived data

### 6. Audit Trail Lineage Flow

**Actors**: Auditor (AUD), System, CloudWatch

**Flow**:
1. AUD requests audit trail for specific entity or time period
2. System authenticates and authorizes AUD user
3. System queries audit_logs table in DynamoDB
4. System retrieves related CloudWatch logs
5. System aggregates all audit events
6. System formats audit trail report
7. System generates comprehensive audit PDF
8. AUD reviews audit trail
9. AUD can drill down into specific events
10. System tracks auditor's access in audit log

**Data Elements**:
- Input: Entity ID or Date range, Entity type
- Processing: Log aggregation, Event sequencing, Report formatting
- Output: Audit trail PDF, Event sequence, Change history

---

## ES: Flujos de Datos del Sistema

### 1. Flujo de Envío de Pre-factura

**Actores**: Gerente de Proyecto (PM), Sistema, Equipo de Finanzas (FIN), SharePoint

**Flujo**:
[Traducción del flujo de envío de pre-factura con los mismos 14 pasos]

### 2. Flujo de Asignación de Presupuesto

**Actores**: Gerente de San Diego (SDM), Equipo de Finanzas (FIN), Sistema

[Traducción del flujo de asignación de presupuesto]

### 3. Flujo de Generación de Informes

**Actores**: Cualquier usuario autenticado, Sistema, S3, SharePoint

[Traducción del flujo de generación de informes]

### 4. Flujo de Procesamiento de Nómina

**Actores**: Equipo de Finanzas (FIN), Sistema de RR.HH., Sistema

[Traducción del flujo de procesamiento de nómina]

### 5. Flujo de Cierre de Mes

**Actores**: Equipo de Finanzas (FIN), Gerente de San Diego (SDM), Sistema

[Traducción del flujo de cierre de mes]

### 6. Flujo de Linaje de Registro de Auditoría

**Actores**: Auditor (AUD), Sistema, CloudWatch

[Traducción del flujo de linaje de registro de auditoría]

![Data Flow Diagram](img/end-to-end-flow.svg)
