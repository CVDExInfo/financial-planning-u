# Auth.ts Test Mode Implementation

## Summary

The `src/lib/auth.ts` module has been implemented to be **fail-fast in real environments** while being **test-friendly for Jest**. This prevents unit tests from failing at module import time when `COGNITO_CLIENT_ID` is not set, while maintaining strict validation in production.

## Implementation Details

### Changes Made to `src/lib/auth.ts`

#### 1. Test Mode Detection (Lines 36-38)

```typescript
const isTestMode =
  process.env.FINZ_AUTH_ALLOW_MISSING_CLIENT_ID_FOR_TESTS === "true" ||
  process.env.NODE_ENV === "test";
```

- Detects test mode using two environment variables:
  - `NODE_ENV === "test"` (standard Jest convention)
  - `FINZ_AUTH_ALLOW_MISSING_CLIENT_ID_FOR_TESTS === "true"` (explicit override)

#### 2. Conditional Module Initialization (Lines 41-52)

```typescript
if (!configuredClientIds.length) {
  const message =
    "[auth] COGNITO_CLIENT_ID environment variable is required. JWT audience validation cannot proceed.";

  if (isTestMode) {
    console.warn(
      "[auth] COGNITO_CLIENT_ID missing in test mode; audience validation is relaxed for unit tests."
    );
  } else {
    throw new Error(message);
  }
}
```

**Behavior:**

- **In production/non-test environments**: Throws an error immediately at module load time if `COGNITO_CLIENT_ID` is missing
- **In test environments**: Logs a warning but allows module to load at module load time

#### 3. Verifier Configuration (Lines 63-65)

```typescript
const verifierClientIds = configuredClientIds.length
  ? configuredClientIds
  : undefined;
```

- Sets `clientId` to `undefined` when no client IDs are configured
- This allows the JWT verifier to be created without audience validation

#### 4. Relaxed Audience Validation (Lines 128-133)

```typescript
if (
  configuredClientIds.length &&
  (audience ? !configuredClientIds.includes(audience) : true)
) {
  throw authError(401, "unauthorized: invalid audience");
}
```

- Only performs audience validation when `configuredClientIds.length > 0`
- In test mode with no client IDs, audience validation is effectively skipped

## Test Behavior

### Jest Configuration

The `tests/jest.env.setup.js` file provides default test environment variables:

```javascript
if (!process.env.COGNITO_USER_POOL_ID) {
  process.env.COGNITO_USER_POOL_ID = "us-east-2_FyHLtOhiY";
}

if (!process.env.COGNITO_CLIENT_ID) {
  process.env.COGNITO_CLIENT_ID = "test-client-id-for-jest";
}

if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = "us-east-2";
}
```

This ensures tests have sensible defaults while allowing individual tests to override as needed.

### Test Results

All unit tests pass successfully:

```
Test Suites: 18 passed, 18 total
Tests:       108 passed, 108 total
```

Including the specific tests mentioned in the requirements:
- ✅ `tests/unit/forecast.spec.ts`
- ✅ `tests/unit/adjustments.handler.spec.ts`
- ✅ `tests/unit/providers.handler.spec.ts`
- ✅ `tests/unit/projects.spec.ts`

## Differences Between Test and Non-Test Behavior

| Aspect | Test Mode (NODE_ENV=test) | Production Mode |
|--------|---------------------------|-----------------|
| Missing COGNITO_CLIENT_ID | Logs warning, continues | Throws error, stops |
| Module Import | Always succeeds | Fails without COGNITO_CLIENT_ID |
| Audience Validation | Relaxed (JWT verification proceeds without validating the audience claim when no clientIds configured) | Strict (audience claim must match configured client IDs) |
| Error Messages | Warning logged to console | Exception thrown |

## Security Considerations

- **No compromise to production security**: Real Lambda environments still require valid `COGNITO_CLIENT_ID`
- **Test isolation**: Tests that need to verify auth behavior can still mock or provide valid tokens
- **Fail-fast behavior preserved**: Production code fails immediately on misconfiguration
- **Backward compatible**: Existing auth/RBAC semantics unchanged

## Environment Variables

| Variable | Purpose | Required In Production | Required In Tests |
|----------|---------|----------------------|-------------------|
| `COGNITO_CLIENT_ID` | JWT audience validation | Yes (throws if missing) | No (warns if missing) |
| `COGNITO_USER_POOL_ID` | JWT issuer validation | Recommended (defaults to `us-east-2_FyHLtOhiY`) | No (test default provided) |
| `AWS_REGION` | Cognito region | Recommended (defaults to us-east-2) | No (test default provided) |
| `NODE_ENV` | Environment detection | - | Set to "test" by Jest |
| `FINZ_AUTH_ALLOW_MISSING_CLIENT_ID_FOR_TESTS` | Explicit test mode override | No | Optional (NODE_ENV=test is sufficient) |

## No Changes Required to Tests

The implementation does not require modifications to existing test files because:

1. The test mode detection is automatic via `NODE_ENV`
2. The `jest.env.setup.js` provides sensible defaults
3. Tests that mock auth functions continue to work unchanged
4. Tests that use `__verifiedClaims` bypass token verification entirely

## Validation

To verify the implementation works correctly:

1. **With COGNITO_CLIENT_ID in test mode**: Tests pass normally
2. **Without COGNITO_CLIENT_ID in test mode**: Tests pass with warning logged
3. **Without COGNITO_CLIENT_ID in production**: Module throws at import time
4. **With COGNITO_CLIENT_ID in production**: Normal strict validation applies

Run all tests:
```bash
npm test -- --runInBand
```

Expected result: All 18 test suites pass with 108 tests passing.
