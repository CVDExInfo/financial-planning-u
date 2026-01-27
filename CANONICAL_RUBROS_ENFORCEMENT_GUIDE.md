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

The `requireCanonicalRubro()` function is the **required** helper for all DynamoDB writes. It performs three-stage validation:

1. **Input presence** - Throws if input is missing or empty
2. **Canonical mapping** - Throws if ID cannot be canonicalized (unknown alias/legacy ID)
3. **Taxonomy existence** - Throws if taxonomy entry is missing for canonical ID

```typescript
import { requireCanonicalRubro } from "@/lib/rubros";

// ✅ CORRECT - Returns canonical ID if valid
const canonical = requireCanonicalRubro("mod-lead-ingeniero-delivery");
// Returns: "MOD-LEAD"

// ❌ WRONG - Throws "[rubro] missing input"
const canonical = requireCanonicalRubro("");

// ❌ WRONG - Throws "[rubro] Unknown rubro (no canonical mapping): ..."
const canonical = requireCanonicalRubro("INVALID-RUBRO");

// ❌ WRONG - Throws "[rubro] Taxonomy missing for canonical id: ..."
// (if somehow canonical ID exists but taxonomy entry is missing)
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

## Validation & Monitoring

### Validation Script

A validation script checks all existing allocations for non-canonical values:

```bash
# Check for non-canonical values (does not fail)
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts

# Check and fail if mismatches found
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts --fail-on-mismatch
```

The script:
- Loads all canonical IDs from `data/rubros.taxonomy.json`
- Scans the allocations table
- Generates `scripts/migrations/validate-canonical-report.json`
- Exits with code 1 if mismatches found and `--fail-on-mismatch` is set

### CI Integration

A GitHub Actions workflow automatically validates canonical compliance:

**Workflow**: `.github/workflows/validate-canonical-lineitems.yml`

**Runs on**:
- Pull requests to main/develop
- Pushes to main/develop

**Actions**:
1. Runs validation script with `--fail-on-mismatch`
2. Uploads validation report as artifact
3. Fails the build if non-canonical values found

**Configuration**: Set these secrets in your repository:
- `AWS_ACCESS_KEY_ID` - AWS credentials for table access
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_REGION` - AWS region (default: us-east-1)
- `TABLE_PREFIX` - Table prefix (default: finz_)

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

### Pre-Migration: Validate Current State

Before migrating, check what needs to be fixed:

```bash
# Dry run validation
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts
```

Review the generated `scripts/migrations/validate-canonical-report.json` to see which items need migration.

### Migration: Fix Non-Canonical Values

Two migration scripts are available:

#### 1. Allocations Migration (Recommended for allocations table)

```bash
# Dry run (preview changes)
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 node scripts/migrations/migrate-finz-allocations-canonical.js

# Apply changes
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 node scripts/migrations/migrate-finz-allocations-canonical.js --apply
```

#### 2. Full Taxonomy Migration (For all taxonomy-related tables)

```bash
# Dry run
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/migrate-taxonomy-storage.ts --dry-run

# Apply
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/migrate-taxonomy-storage.ts --apply
```

**IMPORTANT**: 
- Always run in dry-run mode first
- Back up your DynamoDB tables before applying
- Review the migration report
- The `--apply` mode includes automatic backup

### Post-Migration: Verify

After migration, validate that all values are now canonical:

```bash
# Should show zero mismatches
TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts --fail-on-mismatch
```

## Files Updated

### Core Enforcement

- `src/lib/rubros/requireCanonical.ts` - Frontend enforcement helper
- `services/finanzas-api/src/lib/requireCanonical.ts` - Backend enforcement helper
- `src/lib/rubros/index.ts` - Export for frontend consumption

### Updated Modules (All DynamoDB Writers)

1. **Frontend**
   - `src/api/finanzas.ts` - Invoice upload enforces canonical rubros
   - `src/features/pmo/prefactura/Estimator/utils/normalizeEstimates.ts` - PMO Estimator enforcement

2. **Backend**
   - `services/finanzas-api/src/lib/seed-line-items.ts` - Baseline seeding enforcement
   - `services/finanzas-api/src/lib/materializers.ts` - Allocation materialization enforcement
   - `services/finanzas-api/src/handlers/allocations.ts` - Bulk allocation updates enforcement
   - `services/finanzas-api/src/handlers/invoices.ts` - Already has `ensureTaxonomyLoaded()`

### Migration & Validation Tools

- `scripts/migrations/validate-canonical-lineitems.ts` - Validation script
- `scripts/migrations/migrate-finz-allocations-canonical.js` - Allocations migration
- `scripts/migrations/migrate-taxonomy-storage.ts` - Full taxonomy migration
- `.github/workflows/validate-canonical-lineitems.yml` - CI workflow

### Tests

- `src/lib/rubros/__tests__/requireCanonical.test.ts` - Frontend unit tests
- `services/finanzas-api/src/lib/__tests__/requireCanonical.test.ts` - Backend unit tests
- `tests/integration/canonical-lineitems.test.ts` - Integration tests

## Testing

### Unit Tests

The implementation includes comprehensive unit tests for the enforcement helper:

```bash
# Backend tests (includes requireCanonical tests)
cd services/finanzas-api
npm test

# All tests should pass (571+ tests)
```

### Integration Tests

Integration tests validate the validation script and enforcement behavior:

```bash
# Run integration tests
npm test tests/integration/canonical-lineitems.test.ts
```

## Error Handling

When an invalid rubro ID is encountered, the helper throws with specific error messages:

```typescript
try {
  const canonical = requireCanonicalRubro(input);
} catch (error) {
  // Error types:
  
  // 1. Missing input
  // "[rubro] missing input"
  
  // 2. Unknown/non-canonical
  // "[rubro] Unknown rubro (no canonical mapping): \"INVALID-ID\""
  
  // 3. Taxonomy entry missing
  // "[rubro] Taxonomy missing for canonical id: \"CANONICAL-ID\""
  
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
6. **Run validation script** before and after deployments
7. **Monitor CI validation** for early detection of issues

## Troubleshooting

### Validation Script Fails

If the validation script fails with non-canonical values:

1. Review the report: `scripts/migrations/validate-canonical-report.json`
2. Check if the values are legacy IDs that need mapping
3. Add legacy mappings if appropriate
4. Run migration script to fix existing data
5. Re-run validation to confirm

### CI Build Fails on Validation

If CI fails on the validation check:

1. Download the validation report artifact from GitHub Actions
2. Review non-canonical values
3. Determine if they need legacy mappings or migration
4. Fix the data using migration scripts
5. Push changes and re-run CI

### Migration Script Issues

If migration script reports errors:

1. Check the error messages for specific rubros that can't be canonicalized
2. Verify those rubros exist in taxonomy or need legacy mappings
3. Add mappings as needed
4. Re-run migration

## Security Summary

**CodeQL Analysis**: ✅ No vulnerabilities found

The enforcement mechanism:
- Prevents injection of invalid data
- Ensures data consistency
- Provides clear error messages
- Maintains audit trail with `line_item_id_original`
- Three-stage validation prevents bypass

## Support

For questions or issues:

1. Check `data/rubros.taxonomy.json` for canonical IDs
2. Check `LEGACY_RUBRO_ID_MAP` for legacy mappings
3. Run validation script to identify issues
4. Review test files for usage examples
5. Check CI workflow runs for validation reports
