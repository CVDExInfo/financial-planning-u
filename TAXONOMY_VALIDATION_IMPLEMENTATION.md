# Taxonomy Validation & Remediation Implementation

## Overview

This document summarizes the implementation of DynamoDB taxonomy validation and remediation scripts for the financial-planning-u repository.

## Problem Solved

The repository needed a robust way to:
1. Validate synchronization between the frontend canonical taxonomy (`src/lib/rubros/canonical-taxonomy.ts`) and the DynamoDB table (`finz_rubros_taxonomia`)
2. Identify discrepancies such as missing entries, attribute mismatches, and PK inconsistencies
3. Provide a safe, interactive way to remediate identified issues

## Implementation

### Scripts Created

#### 1. validate-taxonomy-dynamo.cjs (6.6 KB)

**Purpose**: Validates the canonical taxonomy against DynamoDB and generates a detailed report.

**Features**:
- ✅ Full table scan with proper pagination (ExclusiveStartKey)
- ✅ Identifies missing IDs in DynamoDB
- ✅ Identifies extra IDs in DynamoDB (not in canonical)
- ✅ Detects attribute mismatches (descripcion, linea_gasto, categoria_codigo)
- ✅ Detects PK mismatches (pk not matching LINEA#<id> format)
- ✅ Outputs comprehensive JSON report
- ✅ Read-only operation (safe to run)

**Usage**:
```bash
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia \
  node scripts/validate-taxonomy-dynamo.cjs > taxonomy_report.json
```

#### 2. remediate-taxonomy-dynamo.cjs (6.9 KB)

**Purpose**: Interactively applies fixes based on validation report.

**Features**:
- ✅ Updates attribute mismatches with UpdateItem
- ✅ Creates missing items with sensible defaults
- ✅ Fixes PK mismatches using copy-put-delete pattern
- ✅ Applies attribute updates to new items when PK changes
- ✅ Interactive prompts for safety (requires 'y' to proceed)
- ✅ Reports extra items but doesn't delete them
- ✅ Clear logging of all operations

**Usage**:
```bash
AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia \
  node scripts/remediate-taxonomy-dynamo.cjs taxonomy_report.json
```

### Documentation Updates

#### scripts/README.md

Added comprehensive documentation including:
- Script purpose and capabilities
- Prerequisites (AWS credentials, environment variables)
- Detailed usage examples
- Safety features
- Warning about testing on staging first
- Integration with existing script categories

#### New Category: "Taxonomy & Data Management"

Added to script categories:
- `validate-taxonomy-dynamo.cjs` - Validate taxonomy against DynamoDB
- `remediate-taxonomy-dynamo.cjs` - Fix taxonomy mismatches in DynamoDB
- `validate-taxonomy-sync.cjs` - Validate frontend/backend taxonomy sync

## Technical Details

### Dependencies
- Uses existing AWS SDK packages (no new dependencies):
  - `@aws-sdk/client-dynamodb` (^3.970.0)
  - `@aws-sdk/util-dynamodb` (^3.970.0)

### Parser Implementation
- Window-based regex parser for TypeScript canonical taxonomy file
- Looks for `id:` field and captures nearby fields (±8 lines)
- Extracts: id, linea_gasto, descripcion, categoria, categoria_codigo
- Successfully parses 72 taxonomy entries

### DynamoDB Operations
- **Validation**: Uses ScanCommand with proper pagination
- **Remediation**: Uses PutItemCommand, UpdateItemCommand, DeleteItemCommand
- **PK Mismatch Handling**: Copy-put-delete pattern (cannot update PK directly)

## Code Quality

### Code Review Fixes Applied
1. ✅ Fixed DynamoDB scan pagination - added `ExclusiveStartKey` parameter
2. ✅ Removed redundant `categoria_codigo` check
3. ✅ Fixed PK update logic - applies attribute updates to new item when PK changes

### Testing
- ✅ Syntax validation passed (node -c)
- ✅ Module imports verified
- ✅ Executable permissions confirmed
- ✅ Usage messages tested
- ✅ Taxonomy parser tested (72 entries found)
- ✅ Documentation completeness verified
- ✅ No security vulnerabilities (CodeQL passed)

## Safety Features

### Validation Script
- Read-only operation
- Only requires DynamoDB Scan permissions
- Safe to run in production

### Remediation Script
- Interactive prompts before each change
- Requires explicit 'y' confirmation
- Extra items reported but never deleted
- PK changes use safe copy-put-delete pattern
- Recommended to test on staging first

## Usage Workflow

### Step 1: Run Validation
```bash
./scripts/validate-taxonomy-dynamo.cjs > taxonomy_report.json
```

### Step 2: Review Report
```bash
cat taxonomy_report.json | jq '.missingInDynamo'
cat taxonomy_report.json | jq '.mismatches'
cat taxonomy_report.json | jq '.extraInTable'
```

### Step 3: Apply Fixes (Optional)
```bash
./scripts/remediate-taxonomy-dynamo.cjs taxonomy_report.json
# Respond 'y' to apply each suggested fix
```

### Step 4: Re-validate
```bash
./scripts/validate-taxonomy-dynamo.cjs > taxonomy_report_after.json
# Verify issues are resolved
```

## Example Report Structure

```json
{
  "meta": {
    "region": "us-east-2",
    "table": "finz_rubros_taxonomia",
    "scannedItems": 150,
    "frontendCount": 72,
    "tableLineaCount": 145
  },
  "missingInDynamo": ["MOD-NEW-1", "MOD-NEW-2"],
  "mismatches": {
    "MOD-IN2": {
      "frontend": {
        "id": "MOD-IN2",
        "descripcion": "Ingeniero Soporte N2",
        "categoria_codigo": "MOD"
      },
      "tableSample": {
        "pk": "LINEA#MOD-EXT",
        "sk": "CATEGORIA#MOD",
        "linea_codigo": "MOD-IN2"
      },
      "diffs": [
        {
          "attr": "pk",
          "info": "pk not matching LINEA#<id>",
          "pks": ["LINEA#MOD-EXT"]
        }
      ]
    }
  },
  "extraInTable": ["OLD-DEPRECATED-1"],
  "rawSample": {
    "sampleFrontend": [...],
    "sampleTableItems": [...]
  }
}
```

## Integration Recommendations

### CI/CD Integration
Add to GitHub Actions workflow:
```yaml
- name: Validate Taxonomy Sync
  env:
    AWS_REGION: us-east-2
    TAXONOMY_TABLE: finz_rubros_taxonomia
  run: |
    node scripts/validate-taxonomy-dynamo.cjs > taxonomy_report.json
    if grep -q '"missingInDynamo":\[' taxonomy_report.json; then
      echo "⚠️  Missing entries detected - review required"
      cat taxonomy_report.json
      exit 1
    fi
```

### Scheduled Validation
Run validation periodically to catch drift:
```bash
# Daily cron job
0 2 * * * cd /path/to/repo && ./scripts/validate-taxonomy-dynamo.cjs > reports/taxonomy-$(date +\%Y\%m\%d).json
```

## Manual CLI Commands

For one-off fixes, the problem statement includes AWS CLI commands for:
- Creating items with correct PK
- Deleting items with incorrect PK
- Updating individual attributes

See the original problem statement for detailed CLI examples.

## Success Metrics

- ✅ 2 new scripts created and tested
- ✅ Comprehensive documentation added
- ✅ All code quality checks passed
- ✅ No new dependencies required
- ✅ Safe-by-default implementation
- ✅ Addresses all requirements from problem statement

## Next Steps

1. Run validation script against staging table
2. Review generated report
3. Test remediation script on staging
4. Apply to production if needed
5. Consider adding to CI/CD pipeline
6. Set up periodic validation monitoring

## Support Resources

- Script headers contain detailed usage information
- `scripts/README.md` has comprehensive documentation
- Problem statement in PR description provides context
- Manual AWS CLI commands available for reference

---

**Implementation Date**: 2026-01-22
**Status**: ✅ Complete
**Testing**: ✅ Passed
**Security**: ✅ No vulnerabilities
