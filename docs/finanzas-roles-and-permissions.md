# Finanzas SD – Roles, Groups & Permissions

_Last updated: 2025-11-25_

This document explains how **Cognito groups** in the Ikusi user pool map to **Finanzas SD roles**, and what each role can see and do inside the Finanzas SD module.

It is intended for:

- Ikusi admins who manage Cognito groups and access.  
- Developers who work on `AuthProvider`, `jwt.ts`, and `usePermissions`.  
- PMO / SDMT stakeholders who need to understand what each persona can and cannot do.

---

## 1. Sources of truth

### 1.1. Cognito User Pool

- User pool ID: **`us-east-2_FyHLtOhiY`**
- Current key groups used by Finanzas SD:

| Cognito Group      | Purpose / Notes                                  |
|--------------------|--------------------------------------------------|
| `admin`            | Ikusi admin users / super-users                  |
| `FIN`              | Finanzas / Service Delivery team                 |
| `AUD`              | Audit / control functions                        |
| `SDT`              | Service Delivery team (technical / SDMT users)   |
| `PM`               | Project Managers for Finanzas SD (write-capable) |
| `ikusi-acta-ui`    | _Legacy_ PMO / Acta UI portal group (not used for Finanzas SD authorization) |

> ⚠️  New Cognito groups can be added in the future. If they represent a new persona for Finanzas SD, update the mapping in `src/lib/jwt.ts`.

### 1.2. Application code

Finanzas SD uses three main layers for roles and permissions:

- `src/lib/jwt.ts`  
  - Functions:
    - `decodeJwt(token)` – decodes a Cognito JWT.  
    - `extractGroupsFromClaims(claims)` – normalizes `cognito:groups` into a string array.  
    - `mapGroupsToRoles(groups)` – converts Cognito groups into Finanzas roles (`"PMO" | "SDMT" | "VENDOR" | "EXEC_RO"`).

- `src/components/AuthProvider.tsx`  
  - Reads stored tokens (`cv.jwt`, `finz_jwt`, `idToken`, `cognitoIdToken`).  
  - Decodes claims via `decodeJwt` and `extractGroupsFromClaims`.  
  - Computes `roles: FinanzasRole[]` with `mapGroupsToRoles()` and exposes:
    - `user`, `groups`, `roles`, `currentRole`, `setRole()` via context.

- `src/hooks/usePermissions.ts` & `src/hooks/permissions-helpers.ts`  
  - `resolveFinanzasRole(groups, currentRole, availableRoles)` picks a **single effective role** using priority:  
    `SDMT` > `PMO` > `EXEC_RO` > `VENDOR`.  
  - `usePermissions()` exposes:
    - `isPMO`, `isSDMT`, `isVendor`, `isExecRO`.  
    - Capability flags such as `canManageCosts`, `canCreateBaseline`, `canUploadInvoices`, `canEdit`, etc.
  - UI components (nav, project screen, reconciliation, scenarios, etc.) consume these flags.

---

## 2. Finanzas Roles – Definitions

Finanzas SD works with five logical roles:

| Finanzas Role | Description                                                                                         |
|--------------|-----------------------------------------------------------------------------------------------------|
| `PM`         | Project Managers. **Strictly limited** to PMO estimator only (`/pmo/prefactura/estimator`). Cannot access any SDMT routes, catalogs, or cost management screens. |
| `PMO`        | PMO users. Focused on estimators and baseline hand-off; limited editing in Finanzas SD.             |
| `SDMT`       | Service Delivery / Finanzas team. Full cost management: projects, catalog, rules, forecast, etc.   |
| `VENDOR`     | External vendors / partners. Restricted to catalog + reconciliation (invoice uploads).             |
| `EXEC_RO`    | Executives / leadership. Read-only visibility across Finanzas SD modules for oversight/reporting.  |

> ℹ️  A user can have **multiple roles** inferred from multiple groups.  
> The effective role used by the UI is determined by `resolveFinanzasRole`, according to the priority: **SDMT → PMO → EXEC_RO → VENDOR → PM**.

---

## 3. Cognito Group → Finanzas Role Mapping

The mapping logic lives in `src/lib/jwt.ts` (`mapGroupsToRoles`).

At a high level:

- A Cognito group is lowercased and matched by **substring**, so `"ikusi-acta-ui"` matches `"acta-ui"`, etc.
- Multiple Financzas roles can be assigned from multiple groups.

### 3.1. Current mapping rules

For each group `g` (lowercased):

- **PM** (Project Manager - Limited Access)
  - If `g === "pm"` or `g.startsWith("pm-")`, and
  - Does NOT contain `"pmo"` (PMO groups are separate)
  - **UI Access**: Limited to PMO estimator only (`/pmo/prefactura/estimator`)
  - **No SDMT routes**: Cannot access `/sdmt/**`, `/catalog/**`, `/projects/**`
- **PMO**
  - If `g === "admin"`, or
  - `g` contains `"pmo"`.
- **SDMT**
  - If `g` contains `"sdt"`, `"sdmt"`, `"fin"`, or `"aud"`.
- **VENDOR**
  - If `g` contains `"vendor"`, `"proveedor"`, or `"partner"`.
  - **Note**: `"ikusi-acta-ui"` and `"acta-ui"` are explicitly ignored and do NOT grant VENDOR role.
- **EXEC_RO**
  - If `g === "admin"`, or
  - `g` contains `"exec"`, `"director"`, or `"manager"`.

If **no roles** match any groups, the default is:

- `EXEC_RO` (read-only) – configured as a conservative default.

### 3.2. Effective mapping for current groups

| Cognito Group      | Derived Finanzas Roles                | Notes                                          |
|--------------------|----------------------------------------|------------------------------------------------|
| `admin`            | `PMO`, `EXEC_RO`                      | Superuser; may be given SDMT via another group |
| `FIN`              | `SDMT`                                | Finanzas SD team (full cost management)        |
| `AUD`              | `SDMT`                                | Audit/control, but treated as SDMT in Finanzas |
| `SDT`              | `SDMT`                                | Service Delivery team                          |
| `PM`               | `PM`                                  | Project Manager (limited to estimator only)    |
| `ikusi-acta-ui`    | `EXEC_RO` (default)                   | **Ignored**: Legacy group; defaults to read-only. Does NOT grant VENDOR role. |
| `acta-ui`          | `EXEC_RO` (default)                   | **Ignored**: System/utility group; defaults to read-only |
| _no matching group_| `EXEC_RO`                             | Default read-only                              |

When a user belongs to multiple Cognito groups, all corresponding Finanzas roles are collected. The **effective role** (used in `usePermissions`) is the highest-priority role in this list:

```ts
ROLE_PRIORITY = ["SDMT", "PMO", "EXEC_RO", "VENDOR", "PM"];
```

Example:

* Groups: `["FIN", "ikusi-acta-ui"]` → roles `{SDMT}` → effective role = `SDMT` (ikusi-acta-ui is ignored).
* Groups: `["ikusi-acta-ui"]` → roles `{EXEC_RO}` → effective role = `EXEC_RO` (default for ignored groups).
* Groups: `["admin", "FIN"]` → roles `{PMO, EXEC_RO, SDMT}` → effective role = `SDMT`.
* Groups: `["pm"]` → roles `{PM}` → effective role = `PM` (limited to estimator only).

---

## 4. Permissions Matrix

The table below describes **high-level capabilities per role**. Concrete UI decisions are implemented via `usePermissions()`.

### 4.1. Capabilities

| Capability             |   PM   |                 PMO                 | SDMT |               VENDOR               | EXEC_RO |
| ---------------------- | :----: | :---------------------------------: | :--: | :--------------------------------: | :-----: |
| View Finanzas SD shell |   ⛔   |                  ✅                  |   ✅  |                  ✅                 |    ✅    |
| Manage cost data       |   ⛔   |                  ⛔                  |   ✅  |                  ⛔                 |    ⛔    |
| Create baseline        | ✅ (estimator only) | ✅ (via PMO estimator/hand-off only) |   ✅  |                  ⛔                 |    ⛔    |
| Upload invoices        |   ⛔   |                  ⛔                  |   ✅  |                  ✅                 |    ⛔    |
| Edit rules / catalog   |   ⛔   |                  ⛔                  |   ✅  |                  ⛔                 |    ⛔    |
| Edit projects          |   ⛔   |                  ⛔                  |   ✅  |                  ⛔                 |    ⛔    |
| Read all modules       | ⛔ (estimator only) |                  ✅                  |   ✅  | Partial (catalog & reconciliation) |    ✅    |
| Approve / delete       |   ⛔   |                  ⛔                  |   ✅  |                  ⛔                 |    ⛔    |

> **Implementation note**:
>
> * `canManageCosts` = SDMT only.
> * `canCreateBaseline` = SDMT (and PMO via PMO estimator UI, not via core Finanzas pages).
> * `canUploadInvoices` = SDMT or VENDOR.
> * `canEdit` / `canDelete` / `canApprove` = SDMT only.
> * EXEC_RO is always treated as read-only in the UI.

### 4.2. Module-level access

This table focuses on the main Finanzas SD modules. "RO" = read-only, "RW" = read/write, "N/A" = no access.

| Module / Screen              |  PM | PMO | SDMT | VENDOR | EXEC_RO | Notes                                     |
| ---------------------------- | :-: | :-: | :--: | :----: | :-----: | ----------------------------------------- |
| PMO Estimator                |  RW |  RW |  N/A |   N/A  |    RO   | PM can only access estimator              |
| Finanzas SD Landing / Shell  | N/A |  RO |  RW  |   RO   |    RO   | PM blocked; others see entry-point cards  |
| Proyectos                    | N/A |  RO |  RW  |   N/A  |    RO   | PM blocked; PMO sees baseline; SDMT edits |
| Catálogo de Costos           | N/A |  RO |  RW  |   RO   |    RO   | PM blocked; VENDOR can reference only     |
| Catálogo de Rubros           | N/A |  RO |  RW  |   RO   |    RO   | PM blocked; VENDOR can reference only     |
| Reglas de Asignación         | N/A |  RO |  RW  |   N/A  |    RO   | PM blocked; adjusted via SDMT only        |
| Ajustes                      | N/A | N/A |  RW  |   N/A  |    RO   | PM blocked; advanced SDMT only view       |
| Reconciliation (Prefacturas) | N/A |  RO |  RW  |   RW   |    RO   | PM blocked; Vendors + SDMT upload         |
| Forecast                     | N/A |  RO |  RW  |   N/A  |    RO   | PM blocked; SDMT input, PMO/Exec RO view  |
| Flujo de Caja (Premium)      | N/A |  RO |  RW  |   N/A  |    RO   | PM blocked; Premium feature               |
| Escenarios (Premium)         | N/A |  RO |  RW  |   N/A  |    RO   | PM blocked; Premium feature               |
| Proveedores                  | N/A | N/A |  RW  |   N/A  |    RO   | PM blocked; SDMT maintains list           |

Actual behaviour is enforced by:

* UI checks (`usePermissions()`, `canEdit`, `canUploadInvoices`, etc.).
* Backend checks (Cognito JWT + Verified Permissions).

### 4.3. Backend API RBAC (Finanzas SD)

The backend enforces coarse RBAC in `services/finanzas-api/src/lib/auth.ts` using Cognito groups:

| Capability | Cognito groups allowed | Notes |
| ---------- | ---------------------- | ----- |
| **Write**  | `SDT`, `PM`            | Project managers (`PM`) now have the same write path as SDT; no other groups can write. |
| **Read**   | `FIN`, `SDT`, `PM`, `AUD` | Read is intentionally limited to Finanzas SD personas only. |

> Legacy: `ikusi-acta-ui` does **not** grant read or write privileges for Finanzas SD APIs.

---

## 5. Examples

### 5.1. SDMT user (Service Delivery / Finanzas)

* Cognito groups: `["FIN"]` or `["FIN", "SDT"]`.
* Derived roles: `{SDMT}`.
* Effective role: `SDMT`.
* Experience:

  * Full Finanzas SD nav (Projects, Cost catalogs, Reconciliation, Forecast, etc.).
  * Can create/edit projects, upload invoices, adjust rules.
  * Sees SDMT-only controls (bulk actions, approvals, etc.).

### 5.2. Project Manager (PM) user

* Cognito groups: `["PM"]` (optionally combined with `"FIN"`/`"SDT"` for escalated SDMT behaviour).
* Backend access: read/write to Finanzas SD APIs (projects, uploads, catalog updates) alongside SDT.
* UI experience:

  * Similar to SDMT when write capabilities are exposed on the backend.
  * Can collaborate on project edits without relying on legacy Acta UI groups.

### 5.3. PMO user

* Cognito groups: a PM/PMO group (for example `"pmo"`).
* Derived roles: `{PMO}` (may also derive `{VENDOR}` if paired with a vendor group).
* Effective role: `PMO`.
* Experience:

  * Access to PMO estimator / hand-off flows.
  * Read-only view into Finanzas SD project/budget information.
  * Cannot modify core cost data.
  * Legacy note: membership in `ikusi-acta-ui` alone no longer grants Finanzas SD API permissions.

### 5.4. Vendor / Acta UI user

* Cognito groups: `["ikusi-acta-ui"]` (legacy portal group).
* Derived roles: `{VENDOR}`.
* Effective role: `VENDOR`.
* Experience:

  * Access to reconciliation (invoice upload) and the catalog views they need.
  * No access to configuration modules or destructive actions.
  * Finanzas SD backend authorization ignores this legacy group for read/write gating.

### 5.5. Executive / read-only user

* Cognito groups: `["admin"]` or a group containing `"exec"`, `"director"`, or `"manager"`.
* Derived roles: e.g. `{PMO, EXEC_RO}` or `{EXEC_RO}`.
* Effective role: `PMO` or `EXEC_RO` depending on group combination.
* Experience:

  * Access to all relevant dashboards and reports.
  * UI constrained to read-only; no “Create / Edit / Delete / Upload” CTAs.

---

## 6. Operational Checklist

When onboarding a user to Finanzas SD:

1. Add them to the appropriate Cognito group(s) in pool `us-east-2_FyHLtOhiY`:

   * SDMT: `FIN`, `AUD`, or `SDT`.
   * PM: `PM` (project managers with write permissions alongside SDT).
   * PMO: a PM/PMO group such as `pmo` (legacy `ikusi-acta-ui` no longer drives Finanzas SD authorization).
   * VENDOR: `ikusi-acta-ui` (legacy portal group) or a future vendor-specific group.
   * EXEC_RO: `admin` or an exec group containing `exec`, `director`, or `manager`.

2. Confirm their derived roles using the AuthProvider debug log in dev:

   * `"[AuthProvider] Derived roles"` in browser console.

3. Validate the behaviour:

   * Which tabs are visible in the Finanzas SD nav.
   * Whether they can or cannot edit, upload invoices, etc., according to the matrix above.

4. If actual behaviour diverges from this document:

   * Update the mapping in `src/lib/jwt.ts` and/or `src/hooks/usePermissions.ts`.
   * Add/update tests in `src/lib/__tests__/jwt.test.ts`.
   * Update this document.

---

*This document should be kept in sync with the code in `src/lib/jwt.ts`, `src/components/AuthProvider.tsx`, and `src/hooks/usePermissions.ts`. When the role model changes, update both the code and this file in the same PR.*
