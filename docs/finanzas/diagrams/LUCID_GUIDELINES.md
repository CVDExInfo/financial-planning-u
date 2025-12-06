# Lucid Diagram Creation Guidelines

**Last updated:** 2025-12-06  
**Purpose:** Guidelines for recreating Finanzas SD diagrams in Lucidchart or similar tools

This document provides specifications for creating professional diagrams in Lucidchart that match our brand and architecture.

## Executive Architecture Diagram

### Layout
- **Orientation:** Horizontal (left to right)
- **Style:** Clean, minimal, business-friendly
- **Size:** 1920x1080 or larger for presentations

### Swimlanes
1. **Users** (leftmost)
2. **Presentation Layer**
3. **Cloud Platform**
4. **External Systems** (rightmost)

### Components

#### Swimlane 1: Users
- **Actor shape:** "Person" icon from Lucid library
- **Labels:** "PMO", "Finanzas", "SDMT"
- **Color:** #4A90E2 (blue)

#### Swimlane 2: Presentation Layer
- **Container:** Rounded rectangle
- **Title:** "Finanzas SD Web Application"
- **Components:** 
  - Projects (folder icon)
  - Rubros Catalog (list icon)
  - Reconciliation (checkmark icon)
  - Reports (chart icon)
- **Color:** #7ED321 (green)

#### Swimlane 3: Cloud Platform
- **Container:** Cloud shape
- **Title:** "AWS Cloud (Secure & Auditable)"
- **Components:**
  - "Project Data & Evidence" (database icon)
  - "Business Logic & Controls" (gear icon)
- **Color:** #F5A623 (orange)
- **Annotations:**
  - Cognito authentication
  - Role-based access
  - Audit trails
  - Secure storage

#### Swimlane 4: External Systems
- **Container:** Dashed rectangle
- **Title:** "External Systems"
- **Components:**
  - SDMT Cost Management (building icon)
  - SharePoint Reports (document icon)
- **Color:** #9013FE (purple)

### Connections
- **Users → Presentation:** Solid arrow, label "Access via browser (secure login)"
- **Presentation → Cloud:** Solid arrow, label "API calls"
- **Cloud → Data:** Bidirectional arrow, label "Store/retrieve"
- **Cloud → External:** Solid arrow, labels "Handoff" and "Reports"

### Notes & Callouts
- Add a note box next to "Presentation Layer" listing main modules
- Add a security callout highlighting authentication and audit features

---

## Technical AWS Architecture Diagram

### Layout
- **Orientation:** Vertical with tiers (top to bottom)
- **Style:** Technical, detailed, AWS-branded
- **Size:** 1920x1440 or larger

### Tiers (Swimlanes)
1. **Presentation Tier** (top)
2. **Identity & API Tier**
3. **Logic Tier**
4. **Data Tier**
5. **Observability** (bottom)

### AWS Icons
Use official AWS architecture icons (available in Lucid):
- CloudFront (orange wheel)
- S3 (orange bucket)
- Cognito (red shield)
- API Gateway (pink diamond)
- Lambda (orange lambda)
- DynamoDB (blue database)
- CloudWatch (pink graph)

### Tier 1: Presentation
**Components:**
- **Users:** Actor icons
- **CloudFront:** AWS CloudFront icon
  - Label: "d7t9x3j66yd8k.cloudfront.net"
- **S3 Static Hosting:** AWS S3 icon
  - Label: "ukusi-ui-finanzas-prod"

**Connections:**
- Users → CloudFront (HTTPS)
- CloudFront → S3 (Origin)

### Tier 2: Identity & API
**Components:**
- **Cognito:** AWS Cognito icon
  - Label: "User Pool us-east-2_FyHLtOhiY"
- **API Gateway:** AWS API Gateway icon
  - Label: "HTTP API finanzas-sd-api-dev"

**Connections:**
- Users → Cognito (Login)
- Cognito → Users (JWT token)
- Users → API Gateway (API calls + JWT)
- API Gateway → Cognito (Validate JWT)

### Tier 3: Logic
**Components:** Six Lambda function icons (arrange in 2 rows of 3)
- Lambda Projects (/projects)
- Lambda Rubros (/catalog/rubros)
- Lambda Allocations (/allocations)
- Lambda Invoices (/invoices)
- Lambda Uploads (/uploads/docs)
- Lambda Health (/health)

**Connections:**
- API Gateway fans out to each Lambda (show route paths)

### Tier 4: Data
**Components:**
- **DynamoDB:** AWS DynamoDB icon
  - Label: "12 tables (finz_*)"
  - Add callout listing all table names
- **S3 Evidence:** AWS S3 icon
  - Label: "Document storage"

**Connections:**
- All Lambdas → DynamoDB (Read/Write)
- Lambda Uploads → S3 Evidence (Store files)

### Tier 5: Observability
**Components:**
- **CloudWatch:** AWS CloudWatch icon
  - Label: "Logs & Metrics"

**Connections:**
- All Lambdas → CloudWatch (dotted lines, label "Logs")

### Annotations
- **Region callout:** "us-east-2" near API Gateway
- **Auth callout:** "JWT Authorizer\nGroups: PMO, FIN, SDMT, AUDIT, EXEC_RO"
- **Table list:** Show all 12 DynamoDB tables in a text box

### Colors
- Use AWS brand colors from the icons
- Background: White (#FFFFFF)
- Connections: Dark gray (#333333)
- Annotations: Light gray boxes with dark text

---

## Sequence Diagrams

### Style
- **Vertical orientation** (time flows downward)
- **Lifelines:** Vertical dashed lines
- **Actors:** Stick figures on the left
- **Components:** Rectangles across the top

### Handoff Flow
**Participants (left to right):**
1. PMO (actor)
2. Finanzas UI (rectangle)
3. API Gateway (rectangle)
4. Lambda Projects (rectangle)
5. DynamoDB (cylinder)

**Messages (numbered):**
1. PMO → UI: "Crear proyecto / baseline"
2. UI → APIGW: "POST /projects"
3. APIGW → Lambda: "validar JWT + payload"
4. Lambda → DynamoDB: "Guardar PROJECT + BASELINE"
5. DynamoDB → Lambda: "OK"
6. Lambda → APIGW: "201 + projectId"
7. APIGW → UI: "projectId"
8. (repeat for handoff generation)

### Reconciliation Flow
**Participants (left to right):**
1. Finanzas (actor)
2. Finanzas UI (rectangle)
3. API Gateway (rectangle)
4. Lambda Invoices (rectangle)
5. Lambda Uploads (rectangle)
6. DynamoDB (cylinder)
7. S3 (bucket)

**Messages:** Follow the sequence in finanzas-sequence-recon.puml

---

## General Guidelines

### Typography
- **Titles:** 18-24pt, Bold, Sans-serif (Helvetica or Arial)
- **Labels:** 12-14pt, Regular
- **Annotations:** 10-12pt, Italic

### Spacing
- Maintain consistent padding (20-30px) between components
- Use alignment guides to ensure clean vertical/horizontal lines
- Group related components with visual containers

### Brand Colors
- **Primary Blue:** #4A90E2
- **Success Green:** #7ED321
- **Warning Orange:** #F5A623
- **Error Red:** #D0021B
- **Neutral Gray:** #9B9B9B

### Export Settings
- **Format:** PNG or SVG
- **Resolution:** 300 DPI minimum for print
- **Naming:** `finanzas-architecture-executive-lucid.png`
- **Include:** Lucid source file (.lucid or .lucidchart) in repository

---

## Version Control

When creating or updating Lucid diagrams:
1. Save the Lucid source file with a descriptive name
2. Export to PNG/SVG for inclusion in documentation
3. Place both source and export in `docs/finanzas/diagrams/lucid/`
4. Update this guidelines document if you make significant style changes
5. Reference the diagram in relevant documentation files

---

## Example Implementation Notes

For each diagram type, you can:
1. **Start from template:** Use Lucid's AWS architecture template
2. **Import PlantUML:** Some tools can import PlantUML as a starting point
3. **Build from scratch:** Follow the component specifications above
4. **Iterate:** Share with stakeholders and refine based on feedback

The goal is consistency, clarity, and professional polish that represents our brand well in client deliverables.
