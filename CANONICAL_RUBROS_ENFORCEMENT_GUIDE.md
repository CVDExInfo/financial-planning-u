# Canonical Rubro Enforcement Guide

## Overview

This repository enforces that **every** write to DynamoDB must use the single source-of-truth `data/rubros.taxonomy.json` for the `line_item_id` field, with **no exceptions**. This ensures data consistency across the entire application.

## Key Concepts

### Single Source of Truth

- **File**: `data/rubros.taxonomy.json`
- **Field**: `linea_codigo` (e.g., "MOD-SDM", "MOD-LEAD", "TEC-HW-FIELD")
- **Format**: Uppercase, hyphen-separated codes

All rubro IDs stored in DynamoDB MUST match a `linea_codigo` from this file.

### Enforcement Helper

The `requireCanonicalRubro()` function is the **required** helper for all DynamoDB writes:

```typescript
import { requireCanonicalRubro } from "@/lib/rubros";

// ✅ CORRECT - Throws error if not in taxonomy
const canonical = requireCanonicalRubro("mod-lead-ingeniero-delivery");
// Returns: "MOD-LEAD"

// ❌ WRONG - Will throw error
const canonical = requireCanonicalRubro("INVALID-RUBRO");
// Throws: "Unknown or non-canonical rubro id: INVALID-RUBRO — operation blocked"
```

## Implementation Guide

### Frontend Usage

```typescript
import { requireCanonicalRubro } from "@/lib/rubros";

// When creating or updating estimates
const normalizeEstimate = (estimate: Estimate) => {
  // Strict enforcement - throws if invalid
  const canonical = requireCanonicalRubro(estimate.rubroId);
  
  return {
    ...estimate,
    line_item_id: canonical,
    rubro_canonical: canonical,
  };
};
```

### Backend Usage

```typescript
import { requireCanonicalRubro } from "../lib/requireCanonical";
import { ensureTaxonomyLoaded } from "../lib/canonical-taxonomy";

export const handler = async (event) => {
  // CRITICAL: Load taxonomy at handler startup
  await ensureTaxonomyLoaded();
  
  // Parse request
  const { rubroId } = JSON.parse(event.body);
  
  // Strict enforcement - throws if invalid
  const canonical = requireCanonicalRubro(rubroId);
  
  // Write to DynamoDB with canonical ID
  await ddb.send(new PutCommand({
    TableName: tableName("allocations"),
    Item: {
      pk: `PROJECT#${projectId}`,
      sk: `ALLOCATION#${baselineId}#${month}#${canonical}`,
      line_item_id: canonical,
      rubro_canonical: canonical,
      // ... other fields
    }
  }));
};
```

## Legacy Mappings

The system supports legacy rubro IDs through automatic mapping:

### Common Mappings

| Legacy ID | Canonical ID | Description |
|-----------|--------------|-------------|
| `MOD-PM` | `MOD-LEAD` | Project Manager |
| `MOD-ENGINEER` | `MOD-ING` | Engineer |
| `RB0001` | `MOD-ING` | Old catalog format |
| `mod-lead-ingeniero-delivery` | `MOD-LEAD` | Human-readable alias |
| `service-delivery-manager` | `MOD-SDM` | Human-readable role |

See `services/finanzas-api/src/lib/canonical-taxonomy.ts` for the complete list.

## Migrating Existing Data

A migration script is provided to update existing DynamoDB data:

```bash
# Dry run (preview changes)
FINZ_ALLOCATIONS_TABLE=finz_allocations \
  node scripts/migrate-finz-allocations-canonical.js

# Apply changes
FINZ_ALLOCATIONS_TABLE=finz_allocations \
  node scripts/migrate-finz-allocations-canonical.js --apply
```

**IMPORTANT**: Always run in dry-run mode first and back up your table before applying.

## Files Updated

### Core Enforcement

- `src/lib/rubros/requireCanonical.ts` - Frontend enforcement helper
- `services/finanzas-api/src/lib/requireCanonical.ts` - Backend enforcement helper
- `src/lib/rubros/index.ts` - Export for frontend consumption

### Updated Modules

1. **seed-line-items.ts** - Baseline seeding enforces canonical rubros
2. **materializers.ts** - Allocation materialization enforces canonical rubros
3. **normalizeEstimates.ts** - PMO Estimator enforces canonical rubros
4. **allocations.ts** - Bulk allocation updates enforce canonical rubros

### Legacy Support

- `services/finanzas-api/src/lib/canonical-taxonomy.ts` - Legacy ID mappings
- `src/lib/rubros/canonical-taxonomy.ts` - Frontend taxonomy helpers

## Testing

The implementation includes comprehensive tests:

- Frontend: `src/lib/rubros/__tests__/requireCanonical.test.ts`
- Backend: `services/finanzas-api/src/lib/__tests__/requireCanonical.test.ts`

Run tests:

```bash
# Backend tests
cd services/finanzas-api
npm test

# All tests should pass (571+ tests)
```

## Error Handling

When an invalid rubro ID is encountered:

```typescript
try {
  const canonical = requireCanonicalRubro("INVALID-ID");
} catch (error) {
  // Error message:
  // "[rubro] Unknown or non-canonical rubro id: INVALID-ID — operation blocked. 
  //  All rubros must exist in data/rubros.taxonomy.json"
  
  // Handle error appropriately:
  // - Frontend: Show user-friendly error
  // - Backend: Return 400 Bad Request
}
```

## Adding New Rubros

To add a new rubro to the taxonomy:

1. Edit `data/rubros.taxonomy.json`
2. Add new entry with required fields:
   ```json
   {
     "pk": "LINEA#NEW-CODE",
     "sk": "CATEGORIA#CAT",
     "categoria": "Category Name",
     "categoria_codigo": "CAT",
     "linea_codigo": "NEW-CODE",
     "linea_gasto": "Description",
     "descripcion": "Detailed description",
     "tipo_costo": "OPEX",
     "tipo_ejecucion": "mensual",
     "fuente_referencia": "Source"
   }
   ```
3. Deploy updated taxonomy file
4. Code automatically picks up new entries (no code changes needed)

## Adding Legacy Aliases

To support a legacy rubro ID:

1. Edit `services/finanzas-api/src/lib/canonical-taxonomy.ts`
2. Add mapping to `LEGACY_RUBRO_ID_MAP`:
   ```typescript
   export const LEGACY_RUBRO_ID_MAP: Record<string, string> = {
     // ... existing mappings
     'OLD-ID': 'CANONICAL-ID',
   };
   ```
3. Run tests to verify
4. Deploy

## Best Practices

1. **Always use `requireCanonicalRubro()`** for DynamoDB writes
2. **Call `ensureTaxonomyLoaded()`** in Lambda handler startup
3. **Never hardcode rubro IDs** - always reference taxonomy
4. **Use meaningful error messages** when validation fails
5. **Test with both canonical and legacy IDs**

## Security Summary

**CodeQL Analysis**: ✅ No vulnerabilities found

The enforcement mechanism:
- Prevents injection of invalid data
- Ensures data consistency
- Provides clear error messages
- Maintains audit trail with `line_item_id_original`

## Support

For questions or issues:

1. Check `data/rubros.taxonomy.json` for canonical IDs
2. Check `LEGACY_RUBRO_ID_MAP` for legacy mappings
3. Run migration script in dry-run mode to preview changes
4. Review test files for usage examples
