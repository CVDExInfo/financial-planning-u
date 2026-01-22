# Taxonomy Validation & Remediation Workflow - Implementation Summary

## Overview

This PR implements a comprehensive taxonomy validation and reconciliation workflow to ensure that the DynamoDB table `finz_rubros_taxonomia` is the authoritative single source of truth (SOT) for all taxonomy data, and that both frontend and backend code remain in sync with it.

## Implementation Status

### ✅ Completed

1. **Validator Script** (`scripts/validate-taxonomy-dynamo-full.cjs`)
   - Parses frontend canonical taxonomy from `src/lib/rubros/canonical-taxonomy.ts`
   - Parses backend mapping from `services/finanzas-api/src/lib/rubros-taxonomy.ts`
   - Scans DynamoDB table `finz_rubros_taxonomia`
   - Produces detailed JSON report in `tmp/taxonomy_report_full.json` with:
     - IDs missing in Dynamo but present in frontend
     - IDs present in Dynamo but not in frontend
     - Backend-derived IDs missing in frontend and vice versa
     - Attribute mismatches (descripcion, categoria, fuente_referencia, etc.)
     - Key mismatches (items where pk ≠ 'TAXONOMY' or sk ≠ 'RUBRO#<linea_codigo>')
     - Duplicate entries

2. **Remediation Script** (`scripts/remediate-taxonomy-dynamo.cjs`)
   - Interactive CLI tool for applying fixes with operator approval
   - Implements prioritized remediation:
     - **P1**: Key mismatches (copy→put→delete with backups)
     - **P2**: Missing canonical IDs (create minimal items)
     - **P3**: Attribute mismatches (update existing items)
     - **P4**: Extra/legacy items (manual review)
   - Creates backups in `tmp/backups/` before any modifications
   - Logs all actions to `tmp/remediation-log.json`

3. **CI Integration** (`.github/workflows/deploy-ui.yml`)
   - Added validation step after AWS credentials are configured
   - Runs validator against live Dynamo table on every deployment
   - Fails PR if mismatches detected
   - Displays summary of issues in CI output

4. **Backend Configuration** (`services/finanzas-api/src/lib/dynamo.ts`)
   - Updated `tableName()` function to support `TAXONOMY_TABLE` environment variable
   - Allows overriding table name via `TAXONOMY_TABLE=finz_rubros_taxonomia`
   - Maintains backward compatibility with existing `TABLE_RUBROS_TAXONOMIA` env var

5. **Infrastructure**
   - Created `tmp/` directory for reports and backups
   - Updated `.gitignore` to exclude temporary files
   - All AWS SDK dependencies already present in package.json

## Usage Instructions

### Running the Validator

```bash
# Basic usage (uses default table: finz_rubros_taxonomia)
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/validate-taxonomy-dynamo-full.cjs

# Output: tmp/taxonomy_report_full.json
```

The validator requires:
- AWS credentials with `dynamodb:Scan` permission on `finz_rubros_taxonomia`
- Node 18+ environment

### Running the Remediation Script

```bash
# Apply fixes interactively (requires report from validator)
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json

# The script will:
# 1. Prompt for approval for each fix
# 2. Create backups in tmp/backups/
# 3. Apply approved changes
# 4. Log all actions to tmp/remediation-log.json
```

The remediation script requires:
- AWS credentials with permissions:
  - `dynamodb:GetItem`
  - `dynamodb:PutItem`
  - `dynamodb:UpdateItem`
  - `dynamodb:DeleteItem`
- Valid report file from validator

### Example: Fixing a Single Item (MOD-IN2)

If the validator identifies that `MOD-IN2` has a key mismatch (e.g., stored with wrong pk/sk):

#### Option 1: Use the Interactive Script

```bash
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json
# Answer 'y' when prompted for MOD-IN2
```

#### Option 2: Manual CLI Commands

```bash
# 1. Backup old item (if it exists with wrong keys)
aws dynamodb get-item \
  --table-name finz_rubros_taxonomia \
  --key '{"pk":{"S":"WRONG_PK"},"sk":{"S":"WRONG_SK"}}' \
  --region us-east-2 > tmp/backups/backup_OLD_ITEM.json

# 2. Create corrected item with proper key schema
aws dynamodb put-item \
  --table-name finz_rubros_taxonomia \
  --region us-east-2 \
  --item '{
    "pk": {"S":"TAXONOMY"},
    "sk": {"S":"RUBRO#MOD-IN2"},
    "linea_codigo": {"S":"MOD-IN2"},
    "linea_gasto": {"S":"Ingeniero Soporte N2"},
    "descripcion": {"S":"Ingeniero Soporte N2"},
    "categoria_codigo": {"S":"MOD"},
    "categoria": {"S":"Mano de Obra Directa"},
    "fuente_referencia": {"S":"MSP"},
    "tipo_costo": {"S":"OPEX"},
    "tipo_ejecucion": {"S":"mensual"}
  }'

# 3. Delete old item (if it had wrong keys)
aws dynamodb delete-item \
  --table-name finz_rubros_taxonomia \
  --key '{"pk":{"S":"WRONG_PK"},"sk":{"S":"WRONG_SK"}}' \
  --region us-east-2

# 4. Verify fix
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/validate-taxonomy-dynamo-full.cjs
```

**Note**: The correct key schema per `services/finanzas-api/src/lib/dynamo.ts:getRubroTaxonomy()` is:
- `pk`: `"TAXONOMY"` (static value for all taxonomy items)
- `sk`: `"RUBRO#<linea_codigo>"` (e.g., `"RUBRO#MOD-IN2"`)

## CI/CD Integration

The workflow is automatically integrated into the deployment pipeline:

1. **On every PR/push to main**:
   - CI configures AWS credentials
   - Runs `validate-taxonomy-dynamo-full.cjs`
   - **Fails if mismatches detected**
   - Shows summary in CI logs

2. **Expected CI Output** (when passing):
   ```
   🔎 Running Dynamo taxonomy validation against finz_rubros_taxonomia
   ℹ️  This validates that frontend canonical taxonomy and backend mapping are in sync with DynamoDB
   Scanning Dynamo table finz_rubros_taxonomia
   WROTE tmp/taxonomy_report_full.json
   ✅ Taxonomy validation passed
   ```

3. **Expected CI Output** (when failing):
   ```
   ❌ Taxonomy validation failed. Check tmp/taxonomy_report_full.json for details
   Report summary:
   Missing in Dynamo: 5
   Extra in Dynamo: 12
   Attribute mismatches: 3
   ```

## Report Structure

The validator produces `tmp/taxonomy_report_full.json` with this structure:

```json
{
  "meta": {
    "region": "us-east-2",
    "table": "finz_rubros_taxonomia",
    "scannedItems": 150,
    "frontendCount": 120,
    "backendDerivedCount": 25
  },
  "missingInDynamo": ["MOD-XYZ", "GSV-ABC"],
  "extraInDynamo": ["OLD-RUBRO-1", "DEPRECATED-2"],
  "backendMissingFrontend": ["MOD-TEMP"],
  "frontendMissingBackend": ["MOD-UNUSED"],
  "attributeMismatches": {
    "MOD-ING": [
      {
        "sampleKey": "TAXONOMY|RUBRO#MOD-ING",
        "diffs": [
          {
            "attr": "descripcion/linea_gasto",
            "frontend": "Ingenieros de soporte (mensual)",
            "table": "Ingeniero de Soporte"
          }
        ],
        "sample": { /* full DynamoDB item */ }
      }
    ]
  },
  "samples": {
    "frontendSample": [ /* first 5 frontend entries */ ],
    "tableSamples": [ /* first 5 Dynamo items */ ]
  }
}
```

## Remediation Governance

### Approval Flow

1. **Developer** runs validator locally or reviews CI failure
2. **Developer** reviews `tmp/taxonomy_report_full.json`
3. **Developer** creates remediation plan based on report
4. **Operator/Lead** approves remediation plan for production
5. **Developer** runs interactive remediation script (prompts for each change)
6. **System** logs all changes to `tmp/remediation-log.json`
7. **Developer** re-runs validator to verify fixes
8. **Backups** stored in `tmp/backups/` and optionally uploaded to S3

### Safety Measures

- ✅ All destructive operations require explicit 'y' confirmation
- ✅ Automatic backups created before any modifications
- ✅ Complete audit log in `tmp/remediation-log.json`
- ✅ Rollback possible by re-putting backed-up items
- ✅ Dry-run mode available (read-only validation)

## Acceptance Criteria

Before closing this implementation as complete, verify:

- [x] Validator script created and executable
- [x] Remediation script created and executable  
- [x] CI integration added to deploy-ui.yml
- [x] Backend dynamo.ts supports TAXONOMY_TABLE env var
- [ ] Validator run produces clean report (zero critical mismatches)
- [ ] CI validation step passes in staging environment
- [ ] Documentation complete
- [ ] Backups mechanism tested

## Next Steps for Operators

1. **Run Initial Validation**
   ```bash
   AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia \
   node scripts/validate-taxonomy-dynamo-full.cjs
   ```

2. **Review Report**
   - Check `tmp/taxonomy_report_full.json`
   - Prioritize PK mismatches (P1)
   - Identify missing canonical IDs (P2)
   - Review attribute mismatches (P3)

3. **Execute Remediation** (in staging first!)
   ```bash
   AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia_staging \
   node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json
   ```

4. **Verify**
   - Re-run validator
   - Test SDMTForecast UI with sample projects
   - Verify allocations render correctly

5. **Promote to Production**
   - Run remediation script with production table
   - Monitor logs
   - Keep backups for 30 days

## Files Changed

- `scripts/validate-taxonomy-dynamo-full.cjs` - New validator script
- `scripts/remediate-taxonomy-dynamo.cjs` - New remediation script
- `.github/workflows/deploy-ui.yml` - Added CI validation step
- `services/finanzas-api/src/lib/dynamo.ts` - Added TAXONOMY_TABLE support
- `.gitignore` - Excluded tmp/ directory
- `tmp/.gitkeep` - Preserves tmp directory structure

## Testing

### Unit Tests
Not included in this implementation per instructions to make minimal changes. Existing taxonomy validation tests remain unchanged.

### Integration Tests
The CI validation step serves as the integration test, running on every deployment.

### Manual Testing Required
Operators should manually test the scripts in a staging environment with AWS credentials before running in production.

## Security Considerations

- Scripts require AWS credentials with DynamoDB permissions
- Backups are stored locally in `tmp/backups/` (should be uploaded to S3 for production)
- Audit log tracks all changes with timestamps
- Interactive approval required for each modification
- No secrets or credentials stored in code

## Rollback Plan

If issues occur after remediation:

1. **Stop** all ongoing operations
2. **Identify** affected items from `tmp/remediation-log.json`
3. **Restore** backed-up items from `tmp/backups/` using:
   ```bash
   aws dynamodb put-item \
     --table-name finz_rubros_taxonomia \
     --item file://tmp/backups/backup_LINEA-XXX_CATEGORIA-YYY.json \
     --region us-east-2
   ```
4. **Verify** restoration with validator
5. **Investigate** root cause before retrying

## Known Limitations

1. Validator requires AWS access (not available in sandbox)
2. No automatic remediation - all changes require operator approval
3. Extra items in Dynamo require manual review (not auto-deleted)
4. Backups stored locally (should be uploaded to S3 for production use)

## References

- Frontend Taxonomy: `src/lib/rubros/canonical-taxonomy.ts`
- Backend Mapping: `services/finanzas-api/src/lib/rubros-taxonomy.ts`
- DynamoDB Table: `finz_rubros_taxonomia` (us-east-2)
- CI Workflow: `.github/workflows/deploy-ui.yml`
