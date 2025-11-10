# Pre-factura Swimlane / Diagrama de Carriles de Pre-factura

## EN: Pre-factura Process Swimlane

### Overview
This document illustrates the end-to-end process flow for pre-factura (preliminary invoice) submission, approval, and document generation across all actors in the system.

### Actors and Responsibilities

#### Project Manager (PM)
- Creates and submits pre-facturas
- Provides supporting documentation
- Receives approval/rejection notifications
- Downloads final PDF documents

#### System
- Validates input data
- Enforces business rules
- Routes approval requests
- Generates documents
- Sends notifications
- Maintains audit trail

#### Finance Team (FIN)
- Reviews pre-factura details
- Verifies budget availability
- Approves or rejects requests
- Provides feedback/comments

#### SharePoint
- Stores final documents
- Provides external access
- Maintains version history

### Process Flow

#### Phase 1: Submission
1. **PM**: Navigates to "Create Pre-factura" form
2. **PM**: Enters details:
   - Project selection
   - Amount ($)
   - Description
   - Category (Travel, Materials, Services, etc.)
   - Upload attachments (optional)
3. **System**: Validates required fields
4. **System**: Checks project budget availability
5. **System**: Creates pre-factura record (status: "draft")
6. **PM**: Reviews and confirms submission
7. **System**: Updates status to "pending"
8. **System**: Creates approval task
9. **System**: Sends notification to assigned FIN approver

#### Phase 2: Review and Approval
10. **FIN**: Receives notification
11. **FIN**: Opens pre-factura details
12. **FIN**: Reviews:
    - Project context
    - Budget impact
    - Supporting documents
    - Historical patterns
13. **System**: Displays budget utilization metrics
14. **FIN**: Makes decision:
    - **If Approved**:
      - FIN clicks "Approve"
      - FIN adds approval comments (optional)
      - System updates status to "approved"
    - **If Rejected**:
      - FIN clicks "Reject"
      - FIN provides rejection reason (required)
      - System updates status to "rejected"
15. **System**: Records decision in audit log
16. **System**: Updates budget utilization if approved

#### Phase 3: Document Generation
17. **System**: Triggers PDF generation Lambda
18. **System**: Compiles data:
    - Pre-factura details
    - Approval information
    - Project context
    - Budget impact
    - Timestamp and approval chain
19. **System**: Generates branded PDF document
20. **System**: Uploads PDF to S3 bucket
21. **System**: Stores S3 URL in document metadata

#### Phase 4: SharePoint Integration
22. **System**: Checks SharePoint configuration
23. **System**: Authenticates to SharePoint
24. **System**: Uploads PDF to designated library
25. **System**: Creates folder structure if needed
26. **System**: Sets permissions
27. **System**: Stores SharePoint URL in metadata

#### Phase 5: Notification
28. **System**: Generates notification for PM
29. **System**: Sends email notification (if configured)
30. **PM**: Receives notification
31. **PM**: Logs into portal
32. **PM**: Views updated pre-factura status
33. **PM**: Downloads PDF from S3 or SharePoint

#### Phase 6: Audit and Reporting
34. **System**: Records all actions in audit log:
    - Submission timestamp
    - Approval timestamp
    - Document generation timestamp
    - SharePoint upload timestamp
    - User actions and IP addresses
35. **System**: Updates analytics dashboard
36. **System**: Includes in month-end reports

### Timing Expectations

- **Submission to Pending**: < 5 seconds
- **Approval Decision**: Within 24-48 business hours
- **PDF Generation**: < 30 seconds
- **SharePoint Upload**: < 60 seconds
- **Total End-to-End**: 1-2 business days

### Error Handling

- **Budget Insufficient**: System rejects submission with clear error message
- **PDF Generation Failure**: System retries 3 times, then alerts admin
- **SharePoint Upload Failure**: System stores locally and retries hourly
- **Notification Failure**: System logs error but completes process

### Business Rules

1. Pre-factura amount must not exceed remaining project budget
2. All pre-facturas require approval before PDF generation
3. Only assigned approvers can approve/reject
4. Rejected pre-facturas can be edited and resubmitted
5. Approved pre-facturas cannot be edited
6. All actions are logged for audit compliance

---

## ES: Diagrama de Carriles del Proceso de Pre-factura

### Descripción General
Este documento ilustra el flujo de proceso de extremo a extremo para el envío, aprobación y generación de documentos de pre-factura (factura preliminar) en todos los actores del sistema.

### Actores y Responsabilidades

[Traducción de la sección de actores y responsabilidades]

### Flujo del Proceso

[Traducción de las 6 fases del proceso con sus respectivos pasos]

### Expectativas de Tiempo

- **Envío a Pendiente**: < 5 segundos
- **Decisión de Aprobación**: Dentro de 24-48 horas hábiles
- **Generación de PDF**: < 30 segundos
- **Carga a SharePoint**: < 60 segundos
- **Total de Extremo a Extremo**: 1-2 días hábiles

![Pre-factura Swimlane](img/end-to-end-flow.svg)
