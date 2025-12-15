# Data Lineage Regression Fix - Root Cause Analysis & Solution

## Executive Summary

**Critical Issue**: The financial planning API was experiencing data corruption where creating a financial baseline would cause `projectId` and `baselineId` to drift or be overwritten, breaking data lineage and corrupting financial reports.

**Root Cause**: The `handoff.ts` handler (lines 378-383) used unconditional `PutCommand` operations that overwrote project metadata without any safeguards, allowing different baselines to overwrite the same project's `baseline_id` field.

**Solution**: Implemented atomic transactions with conditional writes, isolation of seed data, and comprehensive test coverage to prevent recurrence.

---

## Root Cause Analysis

### Exact Location: `services/finanzas-api/src/handlers/handoff.ts` (lines 378-383)

**Original Code (Vulnerable)**:
```typescript
// Store handoff record
await sendDdb(
  new PutCommand({
    TableName: tableName("projects"),
    Item: handoff,
  })
);

// Store or update project metadata for SDMT
await sendDdb(
  new PutCommand({
    TableName: tableName("projects"),
    Item: projectMetadata,  // ⚠️ UNCONDITIONAL OVERWRITE
  })
);
```

**Problem**: 
- Two separate write operations (non-atomic)
- No condition expression preventing overwrites
- If multiple baselines are created for the same project, the last one wins
- No safeguards against data corruption

---

## System Invariants (Ground Truth)

These rules are now enforced by the fix:

1. **ID Stability**
   - A `projectId` is permanent and NEVER altered after creation
   - A `baselineId` is generated ONCE during baseline creation and is immutable

2. **Mapping Integrity**
   - A single, stable, persistent 1:1 mapping exists between a `baselineId` and its parent `projectId`
   - The project's metadata document MUST reliably reference its `activeBaselineId`

3. **Data Isolation**
   - Seed/demo/canonical data operates in complete isolation
   - Scripts NEVER read, modify, or overwrite real user-generated data
   - Canonical data is marked with `canonical: true` flag

---

## Solution Implementation

### 1. Atomic Transaction with Conditional Write

**File**: `services/finanzas-api/src/handlers/handoff.ts`

**Changes**:
```typescript
await sendDdb(
  new TransactWriteCommand({
    TransactItems: [
      // Write handoff record
      {
        Put: {
          TableName: tableName("projects"),
          Item: handoff,
        },
      },
      // Write project metadata with condition
      {
        Put: {
          TableName: tableName("projects"),
          Item: projectMetadata,
          // CRITICAL: Prevent overwriting existing baseline_id
          ConditionExpression:
            "attribute_not_exists(pk) OR attribute_not_exists(baseline_id) OR baseline_id = :baselineId",
          ExpressionAttributeValues: {
            ":baselineId": baselineId,
          },
        },
      },
    ],
  })
);
```

**Benefits**:
- ✅ Atomic: Both writes succeed or both fail
- ✅ Conditional: Prevents overwriting existing baseline
- ✅ Safe: Returns 409 Conflict error if condition fails

### 2. Seed Data Isolation

**File**: `services/finanzas-api/scripts/cleanup-canonical-seed-data.ts`

**Changes**:
- Added `canonical: true` flag check in FilterExpression
- Script now ONLY deletes items marked as canonical
- User data is completely protected

**Before**:
```typescript
KeyConditionExpression: "pk = :pk",
```

**After**:
```typescript
KeyConditionExpression: "pk = :pk",
FilterExpression: "#canonical = :canonicalTrue",
ExpressionAttributeNames: {
  "#canonical": "canonical",
},
ExpressionAttributeValues: marshall({
  ":pk": pk,
  ":canonicalTrue": true,
}),
```

### 3. Materializer Idempotency

**File**: `services/finanzas-api/src/lib/materializers.ts`

**Changes**:
- Added retry logic with exponential backoff
- Improved error handling for batch writes
- Ensures duplicate prevention through deduplication

### 4. Diagnostic Logging

**Files**: `baseline.ts`, `handoff.ts`

**Added Logs**:
```typescript
console.info("[handoff] Writing baseline-project link", {
  level: "INFO",
  msg: "Writing baseline-project link",
  projectId: resolvedProjectId,
  baselineId,
  pk: `PROJECT#${resolvedProjectId}`,
  sk: "METADATA",
});
```

---

## Test Coverage

### New Test Suite: `handoff-baseline-lineage.spec.ts`

**Test 1: Idempotent ID Generation**
- ✅ Verifies projectId and baselineId remain stable across multiple calls
- ✅ Uses TransactWriteCommand for atomic writes

**Test 2: Overwrite Prevention**
- ✅ Prevents overwriting existing baseline with different baseline
- ✅ Returns 409 Conflict when condition fails
- ✅ Validates conditional check in transaction

**Test 3: Data Lineage Integrity**
- ✅ Ensures projectId in baseline matches parent project
- ✅ Verifies both handoff and metadata records have matching IDs

**Test 4: Atomic Transaction Behavior**
- ✅ Confirms TransactWriteCommand is used
- ✅ Validates ConditionExpression is present
- ✅ Ensures both records written together

### Test Results
```
Test Suites: 41 total (40 passed, 1 pre-existing failure)
Tests:       377 total (376 passed, 1 pre-existing failure)
```

---

## Manual Validation Plan

### Test A: Create Project and Baseline
```bash
# 1. Create a baseline
curl -X POST https://api.example.com/baseline \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "project_name": "Test Project Alpha",
    "client_name": "Test Client",
    "currency": "USD",
    "duration_months": 12,
    "labor_estimates": [],
    "non_labor_estimates": []
  }'

# Expected: Returns 201 with baselineId and projectId

# 2. Create handoff to link baseline to project
curl -X POST https://api.example.com/projects/P-test-alpha/handoff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-idempotency-key: test-key-001" \
  -d '{
    "baseline_id": "base_abc123",
    "project_name": "Test Project Alpha"
  }'

# Expected: Returns 201 with handoffId

# 3. Verify in DynamoDB
# Check PROJECT#P-test-alpha with sk=METADATA
# Should have baseline_id = "base_abc123"
```

### Test B: Attempt Second Baseline (Should Fail)
```bash
# 1. Try to create another baseline for same project
curl -X POST https://api.example.com/projects/P-test-alpha/handoff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-idempotency-key: test-key-002" \
  -d '{
    "baseline_id": "base_xyz789",
    "project_name": "Test Project Alpha"
  }'

# Expected: Returns 409 Conflict
# Error message: "baseline collision detected"
# activeBaselineId should remain "base_abc123"

# 2. Verify in DynamoDB
# Check PROJECT#P-test-alpha with sk=METADATA
# Should STILL have baseline_id = "base_abc123" (unchanged)
```

---

## Rollback Plan

**Simple Instruction**: Rollback by reverting the commit containing these changes.

```bash
git revert 7306adb
git push origin copilot/fix-data-lineage-regression
```

**Files Modified**:
1. `services/finanzas-api/src/lib/dynamo.ts` - Added TransactWriteCommand export
2. `services/finanzas-api/src/handlers/handoff.ts` - Atomic transaction with condition
3. `services/finanzas-api/src/handlers/baseline.ts` - Diagnostic logging
4. `services/finanzas-api/src/lib/materializers.ts` - Retry logic
5. `services/finanzas-api/scripts/cleanup-canonical-seed-data.ts` - Canonical flag filtering
6. `services/finanzas-api/tests/unit/handoff-baseline-lineage.spec.ts` - New test suite
7. `services/finanzas-api/tests/unit/handoff.spec.ts` - Updated mock

---

## Security Summary

### Vulnerabilities Discovered: None
- No new vulnerabilities introduced
- Fix actually improves security by preventing data corruption
- Conditional expressions add additional data integrity safeguards

### Security Improvements
1. **Data Integrity**: Atomic transactions prevent partial writes
2. **Access Control**: Canonical flag prevents accidental data deletion
3. **Audit Trail**: Diagnostic logging improves observability

---

## Performance Impact

**Minimal Impact**:
- TransactWriteCommand has same performance as two separate PutCommands
- Conditional expression adds negligible overhead
- Retry logic only activates on transient failures

**Benefits**:
- Reduced data corruption = fewer support tickets
- Better error messages = faster debugging
- Diagnostic logs = easier troubleshooting

---

## Deployment Notes

1. **No Database Migration Required**: Changes are code-only
2. **Backward Compatible**: Existing data works as-is
3. **No Downtime**: Rolling deployment safe
4. **Monitoring**: Watch for 409 Conflict responses (expected for invalid requests)

---

## Additional Recommendations

1. **Future Enhancement**: Add a Global Secondary Index on `baseline_id` for faster lookups
2. **Monitoring**: Set up CloudWatch alarms for `TransactionCanceledException` events
3. **Documentation**: Update API documentation with 409 Conflict response
4. **Training**: Brief team on new error handling for baseline conflicts

---

## Conclusion

The fix successfully addresses the critical data lineage regression by:
- ✅ Preventing baseline_id overwrites with conditional writes
- ✅ Ensuring atomic transactions for data consistency
- ✅ Isolating seed data from user data
- ✅ Adding comprehensive test coverage
- ✅ Improving observability with diagnostic logging

**Result**: Data lineage is now stable, predictable, and protected from corruption.
