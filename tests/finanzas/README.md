# Finanzas Test Scripts

This directory contains smoke test scripts for the Finanzas module APIs.

## Architecture Overview

### Test Modes

**GitHub Actions CI Mode (Automatic)**:
- Environment variables are provided by `.github/workflows/finanzas-tests.yml`
- Scripts run unauthenticated smoke tests (no Cognito login)
- Login is tested separately in `shared/run-login-test.sh`

**Local Manual Mode**:
- Create `shared/env.sh` from `shared/env-example.sh` template
- Manually source the env file: `source tests/finanzas/shared/env.sh`
- Scripts use the same unauthenticated approach as CI

### Safety Features

1. **Prod URL Guard**: All scripts check `FINZ_API_BASE` and fail if it contains `/prod`
2. **HTTP Validation**: Every curl call validates HTTP status codes (200/201 expected)
3. **Fail Fast**: Scripts exit with non-zero status on any error
4. **Dynamic Discovery**: Projects are discovered from `/projects` endpoint

### Test Scripts

| Script | Description |
|--------|-------------|
| `shared/run-login-test.sh` | Validates Cognito credentials work (CI only) |
| `projects/run-projects-tests.sh` | Tests `/projects` endpoint |
| `catalog/run-catalog-tests.sh` | Tests line items (rubros) CRUD |
| `forecast/run-forecast-tests.sh` | Tests forecast calculation |
| `reconciliation/run-reconciliation-tests.sh` | Tests invoice upload |
| `changes/run-changes-tests.sh` | Tests budget adjustments |
| `handoff/run-handoff-tests.sh` | Tests handoff creation |

## Local Testing

### Setup

1. Copy the example env file:
   ```bash
   cp tests/finanzas/shared/env-example.sh tests/finanzas/shared/env.sh
   ```

2. Edit `env.sh` with your actual values:
   - Set `FINZ_API_BASE` to dev endpoint (not prod!)
   - Configure Cognito test credentials if needed
   - Set `FINZ_LOG_DIR` (defaults to `/tmp`)

### Running Tests

Always source the env file first:

```bash
# Source environment
source tests/finanzas/shared/env.sh

# Run individual test scripts
bash tests/finanzas/projects/run-projects-tests.sh
bash tests/finanzas/catalog/run-catalog-tests.sh
bash tests/finanzas/forecast/run-forecast-tests.sh
bash tests/finanzas/reconciliation/run-reconciliation-tests.sh
bash tests/finanzas/changes/run-changes-tests.sh
bash tests/finanzas/handoff/run-handoff-tests.sh
```

## CI Testing

The workflow `.github/workflows/finanzas-tests.yml` runs all tests automatically:

1. **Login Test** runs first to validate Cognito credentials
2. If login succeeds, all other tests run in sequence
3. Each test discovers projects dynamically
4. Any HTTP error causes the workflow to fail

### Required GitHub Variables/Secrets

- `AWS_REGION` - AWS region (e.g., us-east-2)
- `DEV_API_URL` - Dev stage API endpoint
- `CF_DOMAIN` - CloudFront domain for UI
- `COGNITO_TESTER_USERNAME` - Test user email
- `COGNITO_TESTER_PASSWORD` - Test user password
- `COGNITO_USER_POOL_ID` - Cognito user pool ID
- `COGNITO_WEB_CLIENT` - Cognito web client ID

## Important Notes

### Why No Authentication in Smoke Tests?

The test scripts use **unauthenticated curl** for the following reasons:

1. **Separation of Concerns**: Authentication is tested separately in `run-login-test.sh`
2. **Faster Feedback**: Login failures are caught immediately in the first step
3. **Simpler Scripts**: Each test script focuses on API functionality, not auth
4. **Public Endpoint Testing**: Many endpoints may not require authentication

### Why No env-example.sh Auto-Sourcing?

The `lib.sh` library **no longer auto-sources** `env-example.sh` because:

1. **CI Clarity**: GitHub Actions provides env vars via workflow, not file sourcing
2. **Avoid Confusion**: Auto-sourcing in CI could mask misconfiguration
3. **Explicit is Better**: Local users must consciously source their env file

### Project Discovery

All test scripts (except `run-projects-tests.sh`) dynamically discover projects by calling `/projects?limit=50`. This means:

- No hard-coded project IDs in scripts
- Tests adapt to available projects in the environment
- Scripts gracefully skip if no projects exist

## Troubleshooting

### "FINZ_API_BASE not set"

You forgot to source the env file:
```bash
source tests/finanzas/shared/env.sh
```

### "FINZ_API_BASE points to a prod stage"

Your `FINZ_API_BASE` contains `/prod`. Change it to the dev endpoint in your `env.sh`.

### "❌ /projects call returned HTTP 404"

Check that `FINZ_API_BASE` is correct. The dev API endpoint should be accessible.

### "jq is not installed"

Install jq to parse JSON responses:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq
```

## Contributing

When modifying test scripts:

1. **Always validate HTTP codes**: Check response codes and exit non-zero on errors
2. **Add prod guard**: Ensure `FINZ_API_BASE` doesn't point to prod
3. **Use lib.sh helpers**: Use `finz_curl()` or `finz_curl_form()` for consistency
4. **Test locally first**: Source your env file and test before committing
5. **Update documentation**: Keep this README and `docs/EVIDENCE_FINZ.md` in sync
