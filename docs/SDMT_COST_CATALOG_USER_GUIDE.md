# SDMT Cost Catalog - Quick Reference Guide

**Business Matrix Integration**  
**Date**: November 14, 2025

---

## Quick Access

**Production URL**: https://d7t9x3j66yd8k.cloudfront.net/  
**Module**: SDMT → Cost Catalog  
**Feature**: Add/Edit Line Item with Business Matrix

---

## Using the Cascading Dropdowns

### Step-by-Step: Adding a Cost Line Item

1. **Click "Add Line Item"** button (top right of Cost Catalog page)

2. **Select Categoría** (Category) - Required

   ```
   Dropdown shows 21 business categories:
   ├─ MOD - Mano de Obra Directa
   ├─ GSV - Gestión del Servicio
   ├─ REM - Servicios Remotos / Campo
   ├─ TEC - Equipos y Tecnología
   ├─ INF - Infraestructura / Nube / Data Center
   ├─ TEL - Telecomunicaciones
   ├─ SEC - Seguridad y Cumplimiento
   ├─ LOG - Logística y Repuestos
   ├─ RIE - Riesgos y Penalizaciones
   ├─ ADM - Administración / PMO / Prefactura
   ├─ QLT - Calidad y Mejora Continua
   ├─ PLT - Plataformas de Gestión
   ├─ DEP - Depreciación y Amortización
   ├─ NOC - NOC / Operación 24x7
   ├─ COL - Colaboración / Productividad
   ├─ VIA - Viajes Corporativos (no campo)
   ├─ INV - Inventarios / Almacén
   ├─ LIC - Licencias de Red y Seguridad
   ├─ CTR - Cumplimiento Contractual
   └─ INN - Innovación y Roadmap
   ```

3. **Select Línea de Gasto** (Line Item) - Auto-enabled after category

   ```
   Example: If you selected "MOD - Mano de Obra Directa", you'll see:
   ├─ MOD-ING - Ingenieros de soporte (mensual)
   ├─ MOD-LEAD - Ingeniero líder / coordinador
   ├─ MOD-SDM - Service Delivery Manager (SDM)
   ├─ MOD-OT - Horas extra / guardias
   ├─ MOD-CONT - Contratistas técnicos internos
   └─ MOD-EXT - Contratistas externos (labor)
   ```

   **Note on MOD Roles**: When defining MOD in project baselines and handoffs, the following
   specific roles are used:
   - Ingeniero Delivery
   - Ingeniero Soporte N1, N2, N3
   - Service Delivery Manager
   - Project Manager
   
   These roles are mapped to the catalog line items for consistent cost tracking.

4. **Description Auto-Fills**

   ```
   Example: Selected "MOD-SDM"
   → Description: "Gestión operativa, relación con cliente, reportes, SLAs."
   → You can edit this if needed
   ```

5. **Metadata Badges Appear**

   ```
   [mensual] - Execution frequency
   [OPEX]    - Cost type (OPEX or CAPEX)
   [Modelo Service Delivery] - Business reference source
   ```

6. **Enter Cost Details**

   - **Quantity**: Number of units (e.g., 1 for one person)
   - **Unit Cost**: Cost per unit (e.g., 8000.00)
   - **Currency**: Select USD, EUR, MXN, or COP

7. **Click "Add Line Item"** → Item saved with business taxonomy

---

## Complete Category Reference

### Labor & Human Resources

| Code    | Category                  | Line Items                                                    |
| ------- | ------------------------- | ------------------------------------------------------------- |
| **MOD** | Mano de Obra Directa      | 6 items (Engineers, Leads, SDM, Overtime, Contractors)        |
| **GSV** | Gestión del Servicio      | 4 items (Meetings, Reports, Audits, Training)                 |
| **REM** | Servicios Remotos / Campo | 6 items (Preventive/Corrective Maintenance, Travel, Expenses) |

### Technology & Equipment

| Code    | Category                             | Line Items                                                   |
| ------- | ------------------------------------ | ------------------------------------------------------------ |
| **TEC** | Equipos y Tecnología                 | 6 items (Monitoring licenses, ITSM, Lab equipment, Hardware) |
| **INF** | Infraestructura / Nube / Data Center | 4 items (Cloud, Energy, Racks, Backup)                       |
| **TEL** | Telecomunicaciones                   | 4 items (Circuits, UCaaS, Mobile plans, DIDs)                |
| **LIC** | Licencias de Red y Seguridad         | 3 items (Firewall, Network subscriptions, EDR)               |

### Security & Compliance

| Code    | Category                 | Line Items                                                  |
| ------- | ------------------------ | ----------------------------------------------------------- |
| **SEC** | Seguridad y Cumplimiento | 3 items (SOC monitoring, Vulnerability assessments, Audits) |
| **CTR** | Cumplimiento Contractual | 2 items (SLA management, OLA agreements)                    |

### Operations & Support

| Code    | Category                 | Line Items                                                     |
| ------- | ------------------------ | -------------------------------------------------------------- |
| **LOG** | Logística y Repuestos    | 3 items (Spare pool, RMA, Shipping)                            |
| **RIE** | Riesgos y Penalizaciones | 3 items (SLA penalties, Contingencies, Insurance)              |
| **NOC** | NOC / Operación 24x7     | 3 items (24x7 monitoring, Alert management, Capacity planning) |

### Administration & Management

| Code    | Category                          | Line Items                                                |
| ------- | --------------------------------- | --------------------------------------------------------- |
| **ADM** | Administración / PMO / Prefactura | 5 items (PMO, Billing, Accounting, Admin licenses, Legal) |
| **QLT** | Calidad y Mejora Continua         | 3 items (ISO certifications, Kaizen, CSAT surveys)        |
| **PLT** | Plataformas de Gestión            | 4 items (Planview, Salesforce, SAP, Data Lake)            |
| **DEP** | Depreciación y Amortización       | 2 items (Hardware depreciation, Software amortization)    |

### Collaboration & Travel

| Code    | Category                     | Line Items                                             |
| ------- | ---------------------------- | ------------------------------------------------------ |
| **COL** | Colaboración / Productividad | 3 items (UCC licenses, Storage, Email)                 |
| **VIA** | Viajes Corporativos          | 2 items (Internal travel, Client visits)               |
| **INV** | Inventarios / Almacén        | 3 items (Warehouse, WMS software, Inventory insurance) |

### Innovation

| Code    | Category             | Line Items                          |
| ------- | -------------------- | ----------------------------------- |
| **INN** | Innovación y Roadmap | 2 items (POC pilots, Automation/AI) |

---

## Common Use Cases

### Example 1: Service Delivery Manager Salary

```
Category:     MOD - Mano de Obra Directa
Line Item:    MOD-SDM - Service Delivery Manager (SDM)
Description:  Gestión operativa, relación con cliente, reportes, SLAs.
Badges:       [mensual] [OPEX] [Modelo Service Delivery]
Quantity:     1
Unit Cost:    8000.00
Currency:     USD
Result:       $8,000 USD/month OPEX cost
```

### Example 2: Firewall Subscription

```
Category:     LIC - Licencias de Red y Seguridad
Line Item:    LIC-FW - Suscripciones firewall/IPS
Description:  Soporte/firmware/feeds de seguridad.
Badges:       [mensual] [OPEX] [Seguridad]
Quantity:     10
Unit Cost:    120.00
Currency:     USD
Result:       $1,200 USD/month OPEX cost (10 firewalls)
```

### Example 3: Cloud Hosting

```
Category:     INF - Infraestructura / Nube / Data Center
Line Item:    INF-CLOUD - Servicios Cloud / hosting
Description:  SaaS/IaaS/PaaS asociados al servicio.
Badges:       [mensual] [OPEX] [Cloud OPEX]
Quantity:     1
Unit Cost:    2500.00
Currency:     USD
Result:       $2,500 USD/month OPEX cost
```

### Example 4: Laboratory Equipment (CAPEX)

```
Category:     TEC - Equipos y Tecnología
Line Item:    TEC-LAB - Equipamiento de laboratorio/soporte
Description:  Equipos de prueba, bancos de ensayo.
Badges:       [puntual/hito] [CAPEX] [Operación técnica]
Quantity:     3
Unit Cost:    15000.00
Currency:     USD
Result:       $45,000 USD one-time CAPEX investment
```

---

## Metadata Badge Meanings

### Execution Type (tipo_ejecucion)

- **`[mensual]`** - Recurring monthly cost
- **`[puntual/hito]`** - One-time or milestone-based cost

### Cost Type (tipo_costo)

- **`[OPEX]`** - Operating Expense (recurring operational costs)
- **`[CAPEX]`** - Capital Expenditure (asset investments)

### Business Reference (fuente_referencia)

Examples:

- `[Modelo Service Delivery]` - Based on Service Delivery methodology
- `[ITIL / SLA]` - ITIL framework and SLA requirements
- `[Ciberseguridad Ikusi]` - Ikusi cybersecurity standards
- `[PMO]` - Project Management Office governance
- `[Vendors]` - Vendor contracts and support agreements

---

## Tips & Best Practices

### ✅ DO

- **Select the most specific line item** that matches your cost
- **Review the auto-filled description** - it provides business context
- **Check metadata badges** to confirm OPEX/CAPEX classification
- **Use consistent currencies** within the same project when possible

### ❌ DON'T

- **Don't manually type categories** - always use the dropdowns
- **Don't skip the line item selection** - it ensures standardization
- **Don't ignore the metadata** - it's used for financial reporting
- **Don't mix OPEX/CAPEX** - they're handled differently in accounting

---

## Troubleshooting

### "Línea de Gasto dropdown is disabled"

**Solution**: You must first select a Categoría. The line item dropdown cascades from the category selection.

### "I can't find my cost type"

**Solution**: Check all 21 categories. Many have 4-6 line items each. If truly missing, contact the Finance team to add it to the master matrix.

### "Description doesn't match my exact need"

**Solution**: The description is pre-filled from the business matrix but **can be edited**. Modify it to be more specific while keeping the business context.

### "Wrong metadata badges showing"

**Solution**: The badges are determined by the selected line item. If incorrect, select a different line item code that better matches your cost type.

---

## Test Data & Demo Projects

### Overview

For testing and demos, the Finanzas SD system uses **7 canonical demo projects** with realistic data. These projects are automatically seeded in dev/test environments and provide consistent scenarios for:

- Unit and integration testing
- UI demos and screenshots
- Training and onboarding
- Role-based scenario walkthroughs

### Canonical Demo Projects

| Project ID | Name | Client | Service Type | Duration | Budget |
|------------|------|--------|--------------|----------|--------|
| P-NOC-CLARO-BOG | NOC Claro Bogotá | Claro Colombia | NOC 24x7 | 60 months | $18.5M |
| P-SOC-BANCOL-MED | SOC Bancolombia Medellín | Bancolombia | SOC/Security | 36 months | $12.8M |
| P-WIFI-ELDORADO | WiFi Aeropuerto El Dorado | Avianca | WiFi Infrastructure | 24 months | $4.2M |
| P-CLOUD-ECOPETROL | Cloud Ops Ecopetrol | Ecopetrol | Cloud Operations | 48 months | $22.5M |
| P-SD-TIGO-CALI | Service Delivery Tigo Cali | Tigo Colombia | Managed Services | 36 months | $9.6M |
| P-CONNECT-AVIANCA | Connectivity Avianca | Avianca | SD-WAN/MPLS | 48 months | $15.3M |
| P-DATACENTER-ETB | Datacenter ETB | ETB | Datacenter Ops | 60 months | $25.0M |

**Total Portfolio**: ~$108M USD across 7 active projects

### Test Data Structure

Each canonical project includes:

1. **Project metadata** (client, name, dates, budget, status)
2. **Baseline/handoff** (approved by PM, accepted by SDM)
3. **Catalog rubros** (from standard business matrix categories)
4. **Project-rubro attachments** (1:1 with baseline items)
5. **Estimator items** (detailed cost breakdown)
6. **Allocations** (first 3 months of monthly budget distribution)
7. **Payroll actuals** (first 3 months with realistic variance)
8. **Adjustments** (for projects with budget variances)

### Example: P-NOC-CLARO-BOG Line Items

This project demonstrates a **favorable margin** scenario (under budget).

**MOD Resources**:
- 8 × NOC Engineers (Gold tier) @ $75k/month
- 2 × NOC Leads (Premium tier) @ $110k/month
- 1 × SDM (Gold tier) @ $95k/month

**Catalog Rubros Used**:
1. **RB0001** - MOD: Ingenieros asignados al servicio (Gold)
2. **RB0002** - MOD: Perfil senior técnico / líder (Premium)
3. **RB0003** - MOD: Service Delivery Manager (Gold)
4. **RB0010** - TEC: Herramientas de monitoreo 24x7
5. **RB0015** - TEL: Circuitos y enlaces

**Monthly Budget**: ~$308k/month  
**Variance**: Consistently 3-5% under budget (favorable)

### Example: P-CLOUD-ECOPETROL Line Items

This project demonstrates a **challenged margin** scenario (over budget).

**MOD Resources**:
- 10 × Cloud Engineers (Premium tier) @ $100k/month
- 2 × Cloud Architects (Premium tier) @ $125k/month
- 1 × SDM (Premium tier) @ $100k/month

**Catalog Rubros Used**:
1. **RB0001** - MOD: Ingenieros asignados al servicio (Premium)
2. **RB0002** - MOD: Perfil senior técnico / arquitecto (Premium)
3. **RB0003** - MOD: Service Delivery Manager (Premium)
4. **RB0040** - INF: Servicios Cloud AWS/Azure
5. **RB0045** - TEC: Herramientas de observabilidad cloud
6. **RB0050** - SEC: Compliance y auditoría de seguridad cloud

**Monthly Budget**: ~$469k/month  
**Variance**: 2-5% over budget due to cloud cost overruns  
**Adjustments**: Includes approved budget increase in month 3

### Seeding Test Data

To reset and re-seed the canonical projects in dev/test:

```bash
cd services/finanzas-api

# Step 1: Reset environment (removes non-canonical projects)
npm run reset:dev-projects -- --dry-run   # Preview first
npm run reset:dev-projects                # Execute with confirmation

# Step 2: Create test projects
# TODO: seed:canonical-projects script has been removed.
# Create test projects through the application UI before verification.
```

**Safety**: The reset script never deletes canonical projects and will abort if run in production.

### Using Test Data in Manual Testing

#### PM Scenario: Create Baseline & Handoff
1. Navigate to project: **P-NOC-CLARO-BOG**
2. View baseline: **BL-NOC-CLARO-001**
3. Review line items (should show 5 rubros matching baseline)
4. Test handoff acceptance workflow

#### SDM Scenario: Forecast & Reconciliation
1. Navigate to project: **P-CLOUD-ECOPETROL**
2. View allocations for months 2025-01, 2025-02, 2025-03
3. Compare allocations vs actuals (should show 2-5% variance)
4. Review adjustment request for month 3 (cloud overrun)

#### FIN Scenario: Portfolio Dashboard
1. View all 7 projects in portfolio
2. Check total budget: ~$108M USD
3. Identify projects by margin profile:
   - Favorable: P-NOC-CLARO-BOG, P-SD-TIGO-CALI, P-DATACENTER-ETB
   - On-target: P-SOC-BANCOL-MED, P-WIFI-ELDORADO, P-CONNECT-AVIANCA
   - Challenged: P-CLOUD-ECOPETROL
4. Test variance reporting and drill-down

### Test Data Maintenance

**When to Reset**:
- Before demos or presentations
- After major development changes
- When test data becomes inconsistent
- Before QA testing cycles

**DO**:
- Use canonical project IDs in tests
- Rely on seeded data for predictable scenarios
- Test variance scenarios with P-CLOUD-ECOPETROL
- Test favorable scenarios with P-NOC-CLARO-BOG

**DON'T**:
- Create test projects manually in dev/test
- Hard-code project IDs other than canonical ones
- Modify canonical project data directly
- Delete canonical projects

### Related Documentation

- **Full project details**: `docs/data/finanzas-schemas-and-seeds.md`
- **Seed script source**: `services/finanzas-api/src/seed/seed_canonical_projects.ts`
- **Reset script source**: `services/finanzas-api/scripts/reset-dev-projects.ts`

---

## Getting Help

- **Technical Issues**: SDMT module maintainer
- **Business Matrix Updates**: Finance/Accounting team
- **Missing Categories**: PMO/Prefactura team
- **Test Data Issues**: See `docs/data/finanzas-schemas-and-seeds.md`
- **Documentation**: `docs/SDMT_BUSINESS_MATRIX_INTEGRATION.md`

---

**Last Updated**: December 10, 2025  
**Version**: 1.1 (Added Test Data Section)
