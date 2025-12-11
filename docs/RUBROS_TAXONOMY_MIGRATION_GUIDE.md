# Rubros Taxonomy Migration Guide

## Overview

This guide documents the migration from multiple conflicting rubros data sources to a single canonical taxonomy. The migration ensures all rubro_ids across the application use consistent linea_codigo format (e.g., `MOD-ING`, `GSV-REU`, `TEC-LIC-MON`).

## Background

### Problem
The application had **three competing rubros taxonomies**:

1. **src/modules/rubros.taxonomia.ts** (CATALOGO_RUBROS)
   - 71 entries
   - Format: linea_codigo (MOD-ING, GSV-REU, etc.)
   - Most complete and client-approved
   - ✅ **This became the canonical source**

2. **src/modules/rubros.catalog.ts** (RUBROS)
   - 71 entries
   - Format: RB0001 through RB0071
   - Index-matched with taxonomy (RB0001 = MOD-ING)

3. **src/modules/finanzas/data/rubros.taxonomia.ts**
   - 5 entries only
   - Format: RUBRO-001 through RUBRO-005
   - Outdated and incomplete

### Issues
- **Mismatched IDs**: Project allocations used RB#### or RUBRO-### format
- **Empty graphs**: Charts couldn't join rubros because IDs didn't match
- **Partial data**: Some rubros appeared, others didn't
- **Confusion**: Developers unsure which ID format to use

## Solution: Canonical Taxonomy

### Single Source of Truth
**File**: `src/lib/rubros/canonical-taxonomy.ts`

- **71 canonical entries** from CATALOGO_RUBROS
- **linea_codigo format** as canonical ID (e.g., MOD-ING, GSV-REU)
- **Complete legacy mapping** for all old formats
- **Type-safe utilities** for validation and normalization

### Taxonomy Structure

```typescript
export interface CanonicalRubroTaxonomy {
  id: string;                    // Canonical linea_codigo
  categoria_codigo: string;      // MOD, GSV, TEC, etc.
  categoria: string;             // Category name (Spanish)
  linea_codigo: string;          // Same as id
  linea_gasto: string;           // Description
  descripcion: string;           // Detailed description
  tipo_ejecucion: 'mensual' | 'puntual/hito';
  tipo_costo: 'OPEX' | 'CAPEX';
  fuente_referencia: string;     // Reference source
  isActive: boolean;
}
```

### All 20 Categories Covered

| Code | Category Name |
|------|---------------|
| MOD  | Mano de Obra Directa |
| GSV  | Gestión del Servicio |
| REM  | Servicios Remotos / Campo |
| TEC  | Equipos y Tecnología |
| INF  | Infraestructura / Nube / Data Center |
| TEL  | Telecomunicaciones |
| SEC  | Seguridad y Cumplimiento |
| LOG  | Logística y Repuestos |
| RIE  | Riesgos y Penalizaciones |
| ADM  | Administración / PMO / Prefactura |
| QLT  | Calidad y Mejora Continua |
| PLT  | Plataformas de Gestión |
| DEP  | Depreciación y Amortización |
| NOC  | NOC / Operación 24x7 |
| COL  | Colaboración / Productividad |
| VIA  | Viajes Corporativos |
| INV  | Inventarios / Almacén |
| LIC  | Licencias de Red y Seguridad |
| CTR  | Cumplimiento Contractual |
| INN  | Innovación y Roadmap |

## Legacy ID Mapping

### Complete Mapping Table

| Legacy Format | Example | Canonical ID | Description |
|---------------|---------|--------------|-------------|
| RUBRO-001     | RUBRO-001 | MOD-ING | Old simple format (5 entries) |
| RB####        | RB0001 | MOD-ING | Old catalog format (71 entries) |
| RB####        | RB0017 | TEC-LIC-MON | |
| RB####        | RB0071 | INN-AUT | |
| RUBRO-*-*     | RUBRO-SENIOR-DEV | MOD-LEAD | Old seed format |
| RUBRO-*-*     | RUBRO-AWS-INFRA | INF-CLOUD | |
| RUBRO-*-*     | RUBRO-LICENSE | TEC-LIC-MON | |
| RUBRO-*-*     | RUBRO-CONSULTING | GSV-REU | |

### Mapping Examples

```typescript
// All RB#### entries (1-71) map by index
RB0001 → MOD-ING       (Ingenieros de soporte)
RB0002 → MOD-LEAD      (Ingeniero líder)
RB0003 → MOD-SDM       (Service Delivery Manager)
RB0007 → GSV-REU       (Reuniones de seguimiento)
RB0017 → TEC-LIC-MON   (Licencias de monitoreo)
RB0023 → INF-CLOUD     (Servicios Cloud)
RB0031 → SEC-SOC       (Monitoreo SOC)
RB0040 → ADM-PMO       (Costo PMO)
RB0054 → NOC-MON       (Monitoreo 24x7)
RB0071 → INN-AUT       (Automatización/IA)

// Old simple format (5 entries)
RUBRO-001 → MOD-ING         (Ingeniería)
RUBRO-002 → TEC-HW-FIELD    (Infraestructura)
RUBRO-003 → TEC-LIC-MON     (Software)
RUBRO-004 → GSV-REU         (Servicios)
RUBRO-005 → GSV-TRN         (Capacitación)

// Old seed format
RUBRO-SENIOR-DEV → MOD-LEAD
RUBRO-AWS-INFRA → INF-CLOUD
RUBRO-LICENSE → TEC-LIC-MON
RUBRO-CONSULTING → GSV-REU
```

## Migration Process

### Phase 1: Deploy Canonical Taxonomy ✅

**Status**: Complete

**Changes**:
- Created `src/lib/rubros/canonical-taxonomy.ts`
- Created `services/finanzas-api/src/lib/canonical-taxonomy.ts`
- Updated `src/api/helpers/rubros.ts`
- Updated `services/finanzas-api/src/handlers/rubros.ts`
- Updated `services/finanzas-api/src/seed/seed_project_rubros.ts`

**Result**:
- All new rubros use canonical IDs
- Backend auto-normalizes legacy IDs
- Frontend uses canonical taxonomy

### Phase 2: Run Migration Script

**Status**: Ready to execute

**Script**: `scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts`

#### Dry-Run First (Recommended)
```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts \
  --dry-run \
  --table-name=Finanzas-Rubros-dev
```

**Output**:
- Lists all rubros that would be updated
- Shows old ID → canonical ID mappings
- Identifies unmapped rubros (if any)
- Generates `/tmp/unmapped-rubros-*.json` report

#### Execute Migration
```bash
tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts \
  --table-name=Finanzas-Rubros-dev
```

**What it does**:
1. Scans all `PROJECT#*` / `RUBRO#*` records
2. For each rubro_id:
   - If canonical → skip (already aligned)
   - If legacy → map to canonical and update
   - If unmapped → log to report (no change)
3. Updates DynamoDB records with canonical IDs
4. Logs all changes to `/tmp/rubros-updates-*.json`

**Safety**:
- ✅ Idempotent (can run multiple times)
- ✅ No deletions (only ID updates)
- ✅ Dry-run mode for testing
- ✅ Audit logging for all changes
- ✅ Unmapped rubros preserved

### Phase 3: Monitor & Validate

**Post-Migration Checks**:

1. **Verify Graphs Show Data**
   ```bash
   # Check rubros-based charts in UI
   # Navigate to: /finanzas/projects/{projectId}
   # Verify MOD distribution chart shows data
   # Verify costs-by-rubro table is populated
   ```

2. **Check API Responses**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "$API_BASE/projects/{projectId}/rubros"
   
   # Verify all rubro_id values use canonical format
   # Verify linea_codigo matches rubro_id
   # Verify categoria_codigo is populated
   ```

3. **Review Unmapped Rubros**
   ```bash
   cat /tmp/unmapped-rubros-*.json
   
   # If any unmapped rubros exist:
   # 1. Determine correct canonical ID
   # 2. Add to LEGACY_RUBRO_ID_MAP
   # 3. Re-run migration
   ```

## API Behavior Changes

### Before Migration
```json
{
  "rubro_id": "RB0001",
  "nombre": "...",
  "categoria": null,
  "linea_codigo": null
}
```

### After Migration
```json
{
  "rubro_id": "MOD-ING",
  "nombre": "Ingenieros de soporte (mensual)",
  "categoria": "Mano de Obra Directa",
  "categoria_codigo": "MOD",
  "linea_codigo": "MOD-ING",
  "linea_gasto": "Ingenieros de soporte (mensual)",
  "tipo_costo": "OPEX",
  "tipo_ejecucion": "mensual"
}
```

### Backwards Compatibility

The API **still accepts legacy IDs** in requests:

```bash
# This works (legacy ID)
POST /projects/{id}/rubros
{
  "rubroIds": ["RB0001", "RUBRO-SENIOR-DEV"]
}

# Auto-normalized to:
# ["MOD-ING", "MOD-LEAD"]
```

**Response includes warning**:
```json
{
  "attached": ["MOD-ING", "MOD-LEAD"],
  "warnings": [
    "Legacy rubro_id 'RB0001' mapped to canonical 'MOD-ING'",
    "Legacy rubro_id 'RUBRO-SENIOR-DEV' mapped to canonical 'MOD-LEAD'"
  ]
}
```

## Developer Guide

### Using Canonical Taxonomy

#### Frontend
```typescript
import {
  CANONICAL_RUBROS_TAXONOMY,
  getCanonicalRubroId,
  isValidRubroId,
  getTaxonomyById,
} from '@/lib/rubros/canonical-taxonomy';

// Get all rubros
const allRubros = CANONICAL_RUBROS_TAXONOMY;

// Validate ID
if (isValidRubroId(rubroId)) {
  // Valid (canonical or legacy)
}

// Normalize legacy ID
const canonicalId = getCanonicalRubroId("RB0001"); // Returns "MOD-ING"

// Get taxonomy entry
const taxonomy = getTaxonomyById("MOD-ING");
console.log(taxonomy.linea_gasto); // "Ingenieros de soporte (mensual)"
```

#### Backend
```typescript
import {
  getCanonicalRubroId,
  normalizeRubroId,
  isValidRubroId,
} from "../lib/canonical-taxonomy";

// Validate and normalize
const result = normalizeRubroId(inputId);
if (result.isValid) {
  const canonicalId = result.canonicalId;
  if (result.isLegacy) {
    console.warn(result.warning); // "Legacy rubro_id..."
  }
}
```

### Adding New Rubros

1. **Add to canonical taxonomy**:
   ```typescript
   // src/lib/rubros/canonical-taxonomy.ts
   {
     id: 'NEW-CODE',
     categoria_codigo: 'XXX',
     categoria: 'New Category',
     linea_codigo: 'NEW-CODE',
     linea_gasto: 'Description',
     descripcion: 'Detailed description',
     tipo_ejecucion: 'mensual',
     tipo_costo: 'OPEX',
     fuente_referencia: 'Source',
     isActive: true,
   }
   ```

2. **Add to backend set**:
   ```typescript
   // services/finanzas-api/src/lib/canonical-taxonomy.ts
   export const CANONICAL_IDS = new Set([
     // ... existing
     'NEW-CODE',
   ]);
   ```

3. **Test**:
   ```bash
   npm test -- canonical-taxonomy.spec.ts
   ```

## Rollback Plan

If migration causes issues:

1. **Stop using migration script**
   ```bash
   # Don't run migration script until issue is resolved
   ```

2. **API continues to work**
   - Backend still accepts legacy IDs
   - Auto-normalizes to canonical
   - No user-facing impact

3. **Fix mapping if needed**
   ```typescript
   // Add/update in LEGACY_RUBRO_ID_MAP
   'PROBLEMATIC-ID': 'CORRECT-CANONICAL-ID'
   ```

4. **Re-run migration**
   ```bash
   tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts \
     --table-name=Finanzas-Rubros-dev
   ```

## Support

### Logs & Debugging

**Enable debug logging**:
```typescript
// Frontend
if (import.meta.env.DEV) {
  console.log('[rubros-taxonomy]', ...);
}

// Backend
console.info('attachRubros: normalized request', {
  rubroIds,
  legacyCount,
});
```

**Check migration reports**:
```bash
ls -lh /tmp/unmapped-rubros-*.json
ls -lh /tmp/rubros-updates-*.json
```

### Common Issues

**Issue**: Graph shows no data
**Fix**: Check if rubros are using canonical IDs
```bash
# Query project rubros
GET /projects/{id}/rubros
# Verify all rubro_id values are canonical (MOD-ING, GSV-REU, etc.)
```

**Issue**: "Unknown rubro_id" warning in logs
**Fix**: Add to legacy mapping
```typescript
// LEGACY_RUBRO_ID_MAP
'UNKNOWN-ID': 'CANONICAL-ID'
```

**Issue**: Migration script fails
**Fix**: Check AWS credentials and table name
```bash
export AWS_REGION=us-east-2
export AWS_PROFILE=finanzas-dev
tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts \
  --table-name=Finanzas-Rubros-dev
```

## Testing

### Unit Tests
```bash
cd services/finanzas-api
npm test -- canonical-taxonomy.spec.ts
```

**Coverage**:
- ✅ Canonical ID validation
- ✅ Legacy ID mapping (all 71 RB####)
- ✅ Edge cases (unknown IDs, empty strings)
- ✅ Taxonomy completeness (71 entries, 20 categories)

### Integration Tests
```bash
# Test rubros handler
npm test -- rubros.spec.ts

# Test with canonical IDs
curl -X POST "$API_BASE/projects/test-proj/rubros" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rubroIds": ["MOD-ING", "GSV-REU"]}'

# Test with legacy IDs (should auto-normalize)
curl -X POST "$API_BASE/projects/test-proj/rubros" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rubroIds": ["RB0001", "RUBRO-SENIOR-DEV"]}'
```

## Summary

✅ **Canonical taxonomy established**: 71 entries, 20 categories
✅ **Legacy mapping complete**: RB####, RUBRO-###, seed formats
✅ **Backend normalization**: Auto-converts legacy → canonical
✅ **Frontend integration**: Uses canonical taxonomy exclusively
✅ **Migration script ready**: Idempotent, safe, with dry-run
✅ **Tests passing**: 71 test cases covering all scenarios
✅ **Backwards compatible**: Legacy IDs still work in API
✅ **No data loss**: Only ID normalization, no deletions

**Next Steps**:
1. Run migration script in dry-run mode
2. Review unmapped rubros report
3. Execute migration
4. Validate graphs show correct data
5. Monitor for any issues
