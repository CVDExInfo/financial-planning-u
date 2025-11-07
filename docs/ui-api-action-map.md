# Finanzas UI ↔ API Action Map

Definitive mapping of UI controls to API endpoints with full request/response chain, auth requirements, and error handling.

## Scope

- **UI Layer:** `src/modules/finanzas/`, `src/components/` (Finanzas-specific)
- **Client Layer:** `src/api/finanzasClient.ts` (typed methods)
- **API Contract:** `openapi/finanzas.yaml` (authoritative routes)
- **Auth:** Cognito ID token stored in `localStorage.finz_jwt`; Bearer header on protected routes

---

## Action Map (R1 MVP)

| # | UI Element | Component File | Trigger | Client Method | HTTP Method & Path | Auth Required | Success Effect | Error Handling |
|---|---|---|---|---|---|---|---|---|
| 1 | "Cargar Catálogo" / Load Rubros | `src/modules/finanzas/catalog/RubrosCatalog.tsx` | `useEffect` on mount or click "Refresh" | `getRubros()` | `GET /catalog/rubros` | ✅ SDT JWT | Table renders, count shown | Toast + retry button |
| 2 | "Ver Reglas" / View Allocation Rules | `src/modules/finanzas/rules/AllocationRulesPanel.tsx` | `useEffect` on tab select or button click | `getAllocationRules()` | `GET /allocation-rules` | ✅ SDT JWT | Rules list renders, first rule highlighted | Toast + fallback empty state |
| 3 | "Crear Proyecto" / Create Project | `src/modules/finanzas/projects/ProjectForm.tsx` | `onSubmit` → `handleCreateProject()` | `createProject(data)` | `POST /projects` | ✅ SDT JWT | Modal closes, new project added to list, toast "Proyecto creado" | Toast with error reason, form stays open |
| 4 | "Asignar Allocations (Bulk)" / Allocate Budget | `src/modules/finanzas/allocations/BulkAllocationForm.tsx` | `onSubmit` → `handleBulkAllocate()` | `bulkAllocateRubros(projectId, allocations)` | `PUT /projects/{id}/allocations:bulk` | ✅ SDT JWT | Modal closes, table refreshes, toast "Asignaciones guardadas" | Toast with error, retry button, form persists |
| 5 | "Registrar Ajuste" / Record Adjustment | `src/modules/finanzas/adjustments/AdjustmentForm.tsx` | `onSubmit` → `handleRecordAdjustment()` | `recordAdjustment(data)` | `POST /adjustments` | ✅ SDT JWT | Toast "Ajuste registrado", adjustment appears in list | Toast with error reason, form stays open for retry |

---

## Client Methods (src/api/finanzasClient.ts)

### getRubros()

```typescript
export async function getRubros(): Promise<RubroItem[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = localStorage.getItem('finz_jwt')
  
  const response = await fetch(`${base}/catalog/rubros`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  
  if (!response.ok) throw new Error(`GET /catalog/rubros failed: ${response.status}`)
  const data = await response.json()
  return RubrosResponseSchema.parse(data).data
}
```

### getAllocationRules()

```typescript
export async function getAllocationRules(): Promise<AllocationRule[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = localStorage.getItem('finz_jwt')
  
  const response = await fetch(`${base}/allocation-rules`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  
  if (!response.ok) throw new Error(`GET /allocation-rules failed: ${response.status}`)
  const data = await response.json()
  return AllocationRulesResponseSchema.parse(data).data
}
```

### createProject(data: CreateProjectInput)

```typescript
export async function createProject(data: CreateProjectInput): Promise<Project> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = localStorage.getItem('finz_jwt')
  
  if (!token) throw new Error('Authentication required')
  
  const response = await fetch(`${base}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) throw new Error(`POST /projects failed: ${response.status}`)
  const result = await response.json()
  return ProjectSchema.parse(result)
}
```

### bulkAllocateRubros(projectId: string, allocations: Allocation[])

```typescript
export async function bulkAllocateRubros(projectId: string, allocations: Allocation[]): Promise<void> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = localStorage.getItem('finz_jwt')
  
  if (!token) throw new Error('Authentication required')
  
  const response = await fetch(`${base}/projects/${projectId}/allocations:bulk`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ allocations })
  })
  
  if (!response.ok) throw new Error(`PUT /projects/${projectId}/allocations:bulk failed: ${response.status}`)
}
```

### recordAdjustment(data: AdjustmentInput)

```typescript
export async function recordAdjustment(data: AdjustmentInput): Promise<Adjustment> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = localStorage.getItem('finz_jwt')
  
  if (!token) throw new Error('Authentication required')
  
  const response = await fetch(`${base}/adjustments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) throw new Error(`POST /adjustments failed: ${response.status}`)
  const result = await response.json()
  return AdjustmentSchema.parse(result)
}
```

---

## UX Flow per Action

### Action 1: Load Rubros

```
[User visits /finanzas/catalog/rubros]
  ↓
[useEffect triggers getRubros()]
  ↓
[Button disabled, spinner shown]
  ↓
[Fetch GET /catalog/rubros with Bearer <ID_TOKEN>]
  ↓
[On 200] Table renders with 71 rubros; spinner hides; count="71" shown
[On error] Toast: "Failed to load rubros. Retry?" + Retry button enabled
```

### Action 2: View Allocation Rules

```
[User clicks "Ver Reglas" tab]
  ↓
[useEffect triggers getAllocationRules()]
  ↓
[Spinner shown; tab disabled]
  ↓
[Fetch GET /allocation-rules with Bearer <ID_TOKEN>]
  ↓
[On 200] Panel renders with 2 rules (AR-MOD-ING-001, AR-TEC-LAB-001)
[On 501 (not implemented)] Toast: "Reglas no disponibles en este momento"
[On error] Toast with reason; panel shows empty state
```

### Action 3: Create Project

```
[User fills form + clicks "Crear"]
  ↓
[validateForm() runs; button disabled, spinner shown]
  ↓
[Fetch POST /projects with Bearer <ID_TOKEN>, JSON body]
  ↓
[On 201/200] Modal closes; new project appears in list; Toast: "Proyecto creado"
[On 400] Toast: "Invalid project data: ${reason}"; form stays open
[On 401/403] Toast: "Unauthorized"; user redirected to login
[On 5xx] Toast: "Server error. Please retry."; Retry button
```

### Action 4: Bulk Allocate

```
[User selects rubros + amounts + clicks "Guardar"]
  ↓
[validateAllocations() runs; button disabled, spinner shown]
  ↓
[Fetch PUT /projects/{id}/allocations:bulk with Bearer <ID_TOKEN>, JSON body]
  ↓
[On 200] Modal closes; table refreshes (refetch project allocations); Toast: "Asignaciones guardadas"
[On 400] Toast: "Invalid allocations: ${reason}"; form persists for correction
[On 404] Toast: "Proyecto no encontrado"; modal closes
[On 5xx] Toast: "Server error"; Retry button
```

### Action 5: Record Adjustment

```
[User fills adjustment form + clicks "Registrar"]
  ↓
[validateAdjustment() runs; button disabled, spinner shown]
  ↓
[Fetch POST /adjustments with Bearer <ID_TOKEN>, JSON body]
  ↓
[On 200/201] Toast: "Ajuste registrado"; adjustment appears in list (auto-refresh)
[On 400] Toast: "Invalid adjustment: ${reason}"; form stays open
[On 401/403] Toast: "Unauthorized"; redirect to login
[On 501] Toast: "Adjustments not yet implemented"; form disables with message
[On 5xx] Toast: "Server error"; Retry button
```

---

## API Endpoint Details (from openapi/finanzas.yaml)

### GET /catalog/rubros

- **Auth:** Cognito ID token (Bearer)
- **Response:** `{ data: RubroItem[] }`
- **Sample Response:**

  ```json
  {
    "data": [
      { "rubro_id": "RB0001", "nombre": "Costo mensual de ingenieros..." },
      { "rubro_id": "RB0002", "nombre": "Perfil senior técnico..." }
    ],
    "total": 71
  }
  ```

### GET /allocation-rules

- **Auth:** Cognito ID token (Bearer)
- **Response:** `{ data: AllocationRule[] }`
- **Sample Response:**

  ```json
  {
    "data": [
      { "rule_id": "AR-MOD-ING-001", "linea_codigo": "MOD-ING", "driver": "percent", "priority": 10 }
    ]
  }
  ```

### POST /projects

- **Auth:** Cognito ID token (Bearer)
- **Body:** `{ name: string, description?: string, ... }`
- **Response:** `{ project_id: string, name: string, ... }`

### PUT /projects/{id}/allocations:bulk

- **Auth:** Cognito ID token (Bearer)
- **Body:** `{ allocations: [ { rubro_id: string, amount: number }, ... ] }`
- **Response:** `{ success: true, updated_count: number }`

### POST /adjustments

- **Auth:** Cognito ID token (Bearer)
- **Body:** `{ project_id: string, type: string, amount: number, reason: string }`
- **Response:** `{ adjustment_id: string, ... }`

---

## Evidence Checklist

- [ ] All 5 client methods implemented in `src/api/finanzasClient.ts`
- [ ] All 5 UI components wire client methods to event handlers
- [ ] All client methods send Bearer token on protected routes
- [ ] All error cases handled with user-facing toasts
- [ ] All success cases show appropriate UX feedback (toast + data refresh)
- [ ] Action Map matches `openapi/finanzas.yaml` routes 1:1
- [ ] QA smokes verify each action triggers correct HTTP call
- [ ] QA smokes verify UI updates after each action

---

**Last Updated:** 2025-11-07  
**Status:** Initial version for R1 MVP  
**Owner:** Finanzas SDT Lane Lead
