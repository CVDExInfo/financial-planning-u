# Finanzas API Contracts - Project Rubros & Handoff

## Overview

This document describes the API endpoints for project-scoped handoff and rubros (service tiers) management in the Finanzas SD API.

## Authentication & Authorization

All endpoints require JWT authentication via Cognito. The JWT must be passed in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### RBAC Groups

- **PM** (Project Manager) - Can create, read, and update handoffs and rubros
- **SDT** (Service Delivery Team) - Can create, read, and update handoffs and rubros
- **FIN** (Finance) - Can read handoffs and rubros
- **AUD** (Audit) - Can read handoffs and rubros

## Handoff Endpoints

### 1. GET /projects/{projectId}/handoff

Retrieves the current handoff record for a project.

**Authorization**: Any authenticated user with PM, SDT, FIN, or AUD group

**Response (200)**:
```json
{
  "handoffId": "handoff_abc123",
  "projectId": "P-TEST-1",
  "owner": "pm@example.com",
  "fields": {
    "mod_total": 1500000,
    "pct_ingenieros": 65,
    "pct_sdm": 35,
    "notes": "First handoff"
  },
  "version": 1,
  "createdAt": "2025-11-15T10:00:00Z",
  "updatedAt": "2025-11-15T10:00:00Z"
}
```

**Response (404)**: Handoff not found

---

### 2. POST /projects/{projectId}/handoff

Creates or replaces the handoff record for a project. This operation is idempotent.

**Authorization**: PM or SDT group required

**Required Headers**:
- `Authorization: Bearer <jwt>`
- `X-Idempotency-Key: <unique_key>` (required for idempotent operation)

**Request Body**:
```json
{
  "owner": "pm@example.com",
  "fields": {
    "mod_total": 1500000,
    "pct_ingenieros": 65,
    "pct_sdm": 35,
    "notes": "First handoff"
  }
}
```

**Response (201)**: Handoff created
**Response (200)**: Idempotent response (same idempotency key)
**Response (409)**: Conflict - same idempotency key with different payload

---

### 3. PUT /handoff/{handoffId}

Updates an existing handoff record by ID. Supports optimistic concurrency control via version number.

**Authorization**: PM or SDT group required

**Request Body**:
```json
{
  "projectId": "P-TEST-1",
  "fields": {
    "mod_total": 1600000,
    "pct_ingenieros": 70,
    "pct_sdm": 30,
    "notes": "Updated handoff"
  },
  "version": 1
}
```

**Response (200)**: Handoff updated
**Response (412)**: Precondition Failed - version mismatch

---

## Rubros (Service Tiers) Endpoints

### 4. GET /catalog/rubros

Retrieves the global Ikusi service tiers (rubros taxonomy). This endpoint is already implemented.

**Authorization**: No authentication required (public catalog)

**Response (200)**:
```json
{
  "data": [
    {
      "rubro_id": "R-IKUSI-GO",
      "nombre": "Ikusi GO",
      "categoria": "SERVICE_TIER",
      "tier": "go",
      "descripcion": "Basic service tier"
    }
  ],
  "total": 1
}
```

---

### 5. POST /projects/{projectId}/rubros

Attaches one or more rubros (service tiers) to a project.

**Authorization**: PM or SDT group required

**Request Body**:
```json
{
  "rubroIds": ["R-IKUSI-GO", "R-IKUSI-GOLD"]
}
```

**Response (200)**:
```json
{
  "message": "Attached 2 rubros to project P-TEST-1",
  "attached": ["R-IKUSI-GO", "R-IKUSI-GOLD"]
}
```

---

### 6. GET /projects/{projectId}/rubros

Lists all rubros attached to a specific project.

**Authorization**: Any authenticated user with PM, SDT, FIN, or AUD group

**Response (200)**:
```json
{
  "data": [
    {
      "projectId": "P-TEST-1",
      "rubroId": "R-IKUSI-GO",
      "tier": "go",
      "category": "SERVICE_TIER",
      "createdAt": "2025-11-15T10:00:00Z",
      "createdBy": "pm@example.com"
    }
  ],
  "total": 1
}
```

---

### 7. DELETE /projects/{projectId}/rubros/{rubroId}

Detaches a specific rubro from a project.

**Authorization**: PM or SDT group required

**Response (200)**:
```json
{
  "message": "Detached rubro R-IKUSI-GO from project P-TEST-1"
}
```

**Response (404)**: Rubro attachment not found

---

## Data Model

### Handoff Record (DynamoDB)

Stored in the `projects` table with the following structure:

```
pk: PROJECT#<projectId>
sk: HANDOFF#<handoffId>
handoffId: string
projectId: string
owner: string (email)
fields: object (generic key/value payload)
version: number (for optimistic concurrency)
createdAt: timestamp
updatedAt: timestamp
createdBy: string (email)
```

### Idempotency Record

Stored in the `projects` table:

```
pk: IDEMPOTENCY#HANDOFF
sk: <idempotency-key>
payload: object (original request)
result: object (response returned)
ttl: number (24 hours TTL)
```

### Project Rubro Attachment (DynamoDB)

Stored in the `rubros` table:

```
pk: PROJECT#<projectId>
sk: RUBRO#<rubroId>
projectId: string
rubroId: string
tier: string (optional)
category: string (optional)
metadata: object (optional)
createdAt: timestamp
createdBy: string (email)
```

---

## Error Responses

### 400 Bad Request
Missing required parameters or invalid JSON

### 401 Unauthorized
Missing or invalid JWT token

### 403 Forbidden
User does not have required group membership

### 404 Not Found
Resource does not exist

### 409 Conflict
Idempotency key conflict (different payload)

### 412 Precondition Failed
Version mismatch in optimistic concurrency control

### 500 Internal Server Error
Unexpected server error

---

## CORS Configuration

All endpoints support CORS with the following configuration:
- **Allowed Origins**: CloudFront domain(s) only
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Authorization, Content-Type, X-Idempotency-Key
- **Max Age**: 600 seconds

---

## Audit Logging

All write operations (POST, PUT, DELETE) are logged to the `audit_log` table with the following information:

- Action performed
- User email
- Timestamp
- Before/after state
- Source IP address
- User agent

---

## Example Workflow

1. **Create a handoff for a project**:
   ```bash
   POST /projects/P-TEST-1/handoff
   Headers:
     Authorization: Bearer <jwt>
     X-Idempotency-Key: test-key-123
   Body:
     { "owner": "pm@example.com", "fields": { "notes": "Initial handoff" } }
   ```

2. **Attach rubros to the project**:
   ```bash
   POST /projects/P-TEST-1/rubros
   Headers:
     Authorization: Bearer <jwt>
   Body:
     { "rubroIds": ["R-IKUSI-GO", "R-IKUSI-GOLD"] }
   ```

3. **Read the handoff**:
   ```bash
   GET /projects/P-TEST-1/handoff
   Headers:
     Authorization: Bearer <jwt>
   ```

4. **Update the handoff**:
   ```bash
   PUT /handoff/{handoffId}
   Headers:
     Authorization: Bearer <jwt>
   Body:
     { "projectId": "P-TEST-1", "fields": { "notes": "Updated" }, "version": 1 }
   ```

5. **Detach a rubro**:
   ```bash
   DELETE /projects/P-TEST-1/rubros/R-IKUSI-GO
   Headers:
     Authorization: Bearer <jwt>
   ```
