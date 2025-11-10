# Entity Relationship Diagram / Diagrama de Relación de Entidades

## EN: Data Model Overview

### Core Entities

The Finanzas SD system uses the following core data entities stored in Amazon DynamoDB:

#### 1. Users
Stores user profiles and authentication information.
- **Primary Key**: `userId` (String)
- **Attributes**:
  - `email` - User email address
  - `name` - Full name
  - `role` - User role (SDM, PM, FIN, AUD)
  - `department` - Department assignment
  - `cognitoSub` - Cognito user identifier
  - `createdAt` - Timestamp
  - `updatedAt` - Timestamp
  - `isActive` - Boolean flag

#### 2. Projects
Project metadata and budget allocations.
- **Primary Key**: `projectId` (String)
- **Attributes**:
  - `projectName` - Project name
  - `managerId` - Project manager user ID
  - `budgetAllocated` - Total budget amount
  - `budgetSpent` - Spent amount
  - `budgetRemaining` - Remaining amount
  - `status` - Project status (active, completed, on-hold)
  - `startDate` - Project start date
  - `endDate` - Project end date
  - `createdAt` - Timestamp
  - `updatedAt` - Timestamp

- **Sort Key**: `createdAt` (String)
- **Attributes**:
  - `projectId` - Associated project
  - `submittedBy` - User ID who submitted
  - `amount` - Invoice amount
  - `description` - Invoice description
  - `category` - Expense category
  - `status` - Status (draft, pending, approved, rejected)
  - `approvedBy` - User ID who approved (if applicable)
  - `approvalDate` - Approval timestamp
  - `rejectionReason` - Reason for rejection (if applicable)
  - `attachments` - S3 URLs for attachments
  - `createdAt` - Timestamp
  - `updatedAt` - Timestamp

#### 4. Budgets
Budget allocation and tracking records.
- **Primary Key**: `budgetId` (String)
- **Attributes**:
  - `projectId` - Associated project
  - `fiscalYear` - Fiscal year
  - `quarter` - Fiscal quarter (Q1, Q2, Q3, Q4)
  - `allocatedAmount` - Allocated budget
  - `spentAmount` - Amount spent
  - `remainingAmount` - Remaining amount
  - `status` - Budget status
  - `createdBy` - User ID who created
  - `approvedBy` - User ID who approved
  - `createdAt` - Timestamp
  - `updatedAt` - Timestamp

#### 5. Approvals
Approval workflow state management.
- **Primary Key**: `approvalId` (String)
- **Attributes**:
  - `entityId` - ID of the entity being approved
  - `requestedBy` - User ID who requested approval
  - `assignedTo` - User ID assigned to approve
  - `status` - Approval status (pending, approved, rejected)
  - `comments` - Approval comments
  - `decidedAt` - Decision timestamp
  - `createdAt` - Timestamp

#### 6. Documents
Document metadata for generated PDFs and CSVs.
- **Primary Key**: `documentId` (String)
- **Attributes**:
  - `documentType` - Type (pdf, csv, excel)
  - `entityType` - Related entity type
  - `entityId` - Related entity ID
  - `fileName` - Original file name
  - `s3Url` - S3 storage URL
  - `sharepointUrl` - SharePoint URL (if uploaded)
  - `generatedBy` - User ID who generated
  - `size` - File size in bytes
  - `createdAt` - Timestamp

#### 7. Audit Logs
Comprehensive audit trail for compliance.
- **Primary Key**: `logId` (String)
- **Sort Key**: `timestamp` (String)
- **Attributes**:
  - `userId` - User who performed action
  - `action` - Action performed
  - `entityType` - Entity affected
  - `entityId` - Entity ID affected
  - `ipAddress` - Client IP address
  - `userAgent` - Client user agent
  - `changes` - JSON of changes made
  - `timestamp` - Action timestamp

#### 8. Notifications
System notifications for users.
- **Primary Key**: `notificationId` (String)
- **Attributes**:
  - `userId` - Target user ID
  - `type` - Notification type
  - `title` - Notification title
  - `message` - Notification message
  - `read` - Read status (boolean)
  - `actionUrl` - Link to related entity
  - `createdAt` - Timestamp

#### 9. Settings
System configuration and user preferences.
- **Primary Key**: `settingKey` (String)
- **Attributes**:
  - `value` - Setting value (JSON)
  - `description` - Setting description
  - `scope` - Scope (system, user)
  - `userId` - User ID (if user-scoped)
  - `updatedBy` - User who last updated
  - `updatedAt` - Timestamp

### Relationships

```
Users (1) ─── manages ──> (N) Projects
Projects (1) ─── has ──> (N) Budgets
Budgets (1) ─── requires ──> (1) Approvals
Users (1) ─── receives ──> (N) Notifications
Users (1) ─── performs ──> (N) Audit Logs
```

### Access Patterns

3. **Get pending approvals for user**: Query by `assignedTo` and `status=pending` using GSI
4. **Get user's notifications**: Query by `userId` and sort by `createdAt`
5. **Get audit logs for entity**: Query by `entityId` using GSI
6. **Get budget by project and fiscal period**: Query by `projectId`, `fiscalYear`, `quarter`

---

## ES: Descripción General del Modelo de Datos

### Entidades Principales

El sistema Finanzas SD utiliza las siguientes entidades de datos principales almacenadas en Amazon DynamoDB:

[La traducción completa sigue el mismo patrón que la sección EN con 9 tablas principales y sus relaciones]

### Relaciones entre Entidades


![ERD Diagram](img/roles-and-responsibilities.svg)
