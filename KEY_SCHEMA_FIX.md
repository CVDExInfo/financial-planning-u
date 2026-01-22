# Key Schema Fix - PR Review Response

## Issue Identified
Critical interoperability mismatch between validator/remediation scripts and server-side code.

## Problem
The scripts were using an incorrect DynamoDB key schema:
- **Scripts expected**: `pk: "LINEA#<id>"`, `sk: "CATEGORIA#<code>"`
- **Server uses**: `pk: "TAXONOMY"`, `sk: "RUBRO#<id>"`

This mismatch meant:
1. Validator would incorrectly flag all items as having PK mismatches
2. Remediation would create items the server couldn't read
3. `getRubroTaxonomy()` function in `services/finanzas-api/src/lib/dynamo.ts` would fail to find taxonomy items

## Root Cause
The scripts were designed without reference to the existing server-side implementation in `services/finanzas-api/src/lib/dynamo.ts:getRubroTaxonomy()` (lines 336-363), which clearly shows:

```typescript
Key: {
  pk: 'TAXONOMY',
  sk: `RUBRO#${rubroId}`,
}
```

## Solution Applied

### 1. Scripts Updated
**Validator** (`scripts/validate-taxonomy-dynamo-full.cjs`):
- Changed validation from `pk !== "LINEA#${id}"` to `pk !== "TAXONOMY"`
- Added SK validation: `sk !== "RUBRO#${id}"`
- Enhanced `indexByLinea()` to extract ID from sk pattern if not in attributes

**Remediation** (`scripts/remediate-taxonomy-dynamo.cjs`):
- Changed item creation to use `pk: "TAXONOMY", sk: "RUBRO#${id}"`
- Updated key mismatch detection to check both pk and sk
- Fixed all item creation logic

### 2. Documentation Updated
- `TAXONOMY_VALIDATION_IMPLEMENTATION_SUMMARY.md` - Examples corrected
- `OPERATOR_QUICK_START_TAXONOMY.md` - Priority descriptions and examples updated
- Added note explaining correct key schema

### 3. Verification
- Both scripts pass syntax validation
- Key schema now matches server implementation exactly
- Indexing logic handles both attribute-based and sk-based ID extraction

## Impact
- ✅ Scripts now compatible with existing server code
- ✅ Validator will correctly identify schema violations
- ✅ Remediation will create items server can read
- ✅ No breaking changes to other parts of the system

## Testing Required
1. Run validator against staging DynamoDB with AWS credentials
2. Verify report shows correct key schema expectations
3. Test remediation (dry-run) to ensure keys created correctly
4. Confirm server can read items created by remediation script

## Files Changed
1. `scripts/validate-taxonomy-dynamo-full.cjs`
2. `scripts/remediate-taxonomy-dynamo.cjs`
3. `TAXONOMY_VALIDATION_IMPLEMENTATION_SUMMARY.md`
4. `OPERATOR_QUICK_START_TAXONOMY.md`

## Commit
- Hash: `7244045`
- Message: "Fix key schema to match server-side implementation (TAXONOMY/RUBRO#id)"

---

**Status**: ✅ Ready for merge
**Reviewer**: @valencia94
**Date**: 2026-01-22
