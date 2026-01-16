# Dev URL Guard - Build Safety Documentation

## Overview

The Dev URL Guard is a build safety mechanism designed to prevent development URLs from leaking into production builds. These URLs (like `github.dev`, `codespaces`, `githubusercontent.com`, `localhost:3000`, `127.0.0.1`) can expose internal development environments, create security vulnerabilities, and cause broken functionality in production.

## Why This Guard Exists

Development URLs can leak into production builds through several paths:
1. **Source code**: Hardcoded URLs in configuration or code
2. **Dependencies**: Third-party packages with dev URLs
3. **Source maps**: Inline base64-encoded source maps containing file paths from development environments

The guard runs as part of the build process and CI/CD pipeline to catch these issues before deployment.

## Architecture

The guard consists of several components:

### 1. `scripts/find-dev-urls.js`
The main scanner that:
- Recursively scans `dist-finanzas` directory
- Detects literal dev URL patterns in all files
- Decodes inline base64 source maps in `.js` files
- Scans both `sources` and `sourcesContent` in source maps
- Exits with code 1 if any dev URLs are found

### 2. `scripts/find-dev-urls-report.js`
Generates a structured JSON report categorizing findings by:
- Origin type (literal, inline-sourcemap-sources, inline-sourcemap-content, dependency)
- File location
- Provides summary statistics

### 3. `scripts/sanitize-sourcemaps.js`
Source map sanitizer that:
- Scans all `.map` files in `dist-finanzas`
- Removes dev URLs from `sources` arrays (replaces with basename)
- Strips `sourcesContent` entries containing dev URLs
- Creates backups in `dist-finanzas/maps-backup/`
- Generates `reports/dev-url-guard-sanitize.json` report
- **Run this before the scanner** to clean source maps automatically

### 4. `scripts/repair-dev-urls.js`
Conservative automated repair tool that:
- Fixes dev URLs in git-tracked source files
- Creates `patch-package` patches for `node_modules` issues
- Rewrites inline source maps as a last resort
- Creates backups before any modifications
- Logs all changes to `scripts/repair-dev-urls.changes.json`

### 5. `scripts/build-guards-finanzas.sh`
Build guard script that:
- Runs `find-dev-urls.js` as a blocking check
- Generates timestamped reports on failure
- Provides helpful remediation guidance

## How to Use

### Running Locally

#### Sanitize source maps (recommended first step):
```bash
# Build first
BUILD_TARGET=finanzas pnpm run build:finanzas

# Sanitize .map files to remove dev URLs
pnpm run sanitize:maps

# Review what was sanitized
cat reports/dev-url-guard-sanitize.json
```

#### Check for dev URLs in your build:
```bash
# Build first
BUILD_TARGET=finanzas pnpm run build:finanzas

# Sanitize maps (recommended)
pnpm run sanitize:maps || echo "Maps sanitized"

# Run the scanner
pnpm run find:dev-urls
```

#### Generate a detailed report:
```bash
# This is automatically called by build guards
node scripts/find-dev-urls-report.js
```

#### Attempt automated repair:
```bash
# Review findings first
cat reports/dev-url-guard-findings.json

# Run repair tool
pnpm run repair:dev-urls

# Check the changes log
cat scripts/repair-dev-urls.changes.json

# Rebuild and verify
BUILD_TARGET=finanzas pnpm run build:finanzas
pnpm run find:dev-urls
```

### In CI/CD

The guard runs automatically in:
- **Preflight checks** (`.github/workflows/preflight.yml`)
  - Builds the project
  - **Sanitizes source maps** (automatic cleanup)
  - Scans for remaining dev URLs
  - Uploads findings as artifacts on failure
- **Build guards** (`scripts/build-guards-finanzas.sh`)

If the guard fails in CI:
1. Check the workflow logs for the failure details
2. Download the `dev-url-guard-findings` artifact
3. Review the JSON report to identify the sources
4. Apply fixes as described below

## Common Scenarios and Fixes

### Scenario 1: Hardcoded URL in Source Code

**Finding:**
```json
{
  "file": "src/config/api.ts",
  "line": 15,
  "text": "const API_URL = 'https://myproject.github.dev/api'",
  "origin": "literal"
}
```

**Fix:**
Replace with environment variable or production URL:
```typescript
// Before
const API_URL = 'https://myproject.github.dev/api';

// After
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

### Scenario 2: Dev URL in node_modules

**Finding:**
```json
{
  "file": "node_modules/some-package/dist/index.js",
  "line": 42,
  "text": "sourceMap: 'https://github.dev/...'",
  "origin": "literal"
}
```

**Fix:**
Use the repair tool to create a patch:
```bash
pnpm run repair:dev-urls
```

This will:
1. Create a patch in `patches/some-package+version.patch`
2. Add `patch-package` to devDependencies
3. Add a postinstall script to apply patches

Alternatively, update the package or report to the package maintainer.

### Scenario 3: Source Map (.map file) with Dev URLs

**Finding:**
```json
{
  "file": "dist-finanzas/assets/index-abc123.js.map",
  "line": 1,
  "text": "{\"version\":3,\"file\":\"index-abc123.js\",\"sources\":[\"../../node_modules/.pnpm/react@19.2.3/...",
  "origin": "literal"
}
```

**Root Cause:**
Source maps generated in Codespaces or with absolute paths contain references to:
- Development host (github.dev, codespaces)
- Absolute file system paths
- Raw githubusercontent.com URLs

**Fix (Automatic):**
Run the source map sanitizer:
```bash
pnpm run sanitize:maps
```

This will:
- Scan all `.map` files in `dist-finanzas`
- Replace dev URLs in `sources` with basenames
- Strip `sourcesContent` containing dev URLs
- Create backups in `dist-finanzas/maps-backup/`
- Generate a report in `reports/dev-url-guard-sanitize.json`

**Fix (Long-term):**
1. **Build in CI instead of Codespaces** (preferred)
   - CI runners don't embed codespaces/github.dev paths
   - Configure workflows to always build in GitHub Actions

2. **Configure Vite to use relative source paths:**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       sourcemap: true,
       rollupOptions: {
         output: {
           sourcemapPathTransform: (relativeSourcePath) => {
             // Return relative path without absolute prefixes
             return relativeSourcePath.replace(/^.*\/node_modules\//, 'node_modules/');
           }
         }
       }
     }
   })
   ```

3. **Disable sourcesContent** (reduces bundle size):
   ```typescript
   export default defineConfig({
     build: {
       sourcemap: true,
       rollupOptions: {
         output: {
           sourcemapExcludeSources: true  // Don't include source code in maps
         }
       }
     }
   })
   ```

### Scenario 4: Inline Source Map with Dev URLs

**Finding:**
```json
{
  "file": "dist-finanzas/assets/index-abc123.js",
  "location": "inline map source[0]",
  "text": "/home/runner/work/project/github.dev/src/main.tsx",
  "origin": "inline-sourcemap-sources"
}
```

**Fix:**
This typically indicates the build tool is including absolute paths. Options:

1. **Configure Vite to use relative source paths** (preferred):
   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       sourcemap: true,
       // Ensure source maps use relative paths
     }
   })
   ```

2. **Use the repair tool** (last resort):
   ```bash
   pnpm run repair:dev-urls
   ```
   This will rewrite the inline source map to replace dev URLs with `REMOVED_DEV_URL`.

3. **Disable inline source maps**:
   Generate separate `.map` files instead of inline maps.

### Scenario 4: GitHub Codespaces Path Leak

**Finding:**
```json
{
  "file": "dist-finanzas/assets/app-xyz789.js",
  "location": "inline map sourcesContent[5]",
  "text": "// /workspaces/financial-planning-u/codespaces/...",
  "origin": "inline-sourcemap-content"
}
```

**Fix:**
1. Ensure builds are done in a clean environment (not in Codespaces)
2. Use CI/CD for production builds
3. Or use repair tool to strip the paths

## Integration with CI

### Preflight Workflow

The `preflight.yml` workflow includes:
```yaml
- name: Check for dev URLs in build
  run: pnpm run find:dev-urls

- name: Upload dev URL findings on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: dev-url-guard-findings
    path: reports/dev-url-guard-*.json
```

### Build Guards

The `build-guards-finanzas.sh` script includes Guard 3 which:
- Calls `find-dev-urls.js`
- Generates detailed reports on failure
- Provides remediation guidance in error messages

## Reports and Artifacts

### Files Generated

1. **`reports/dev-url-guard-findings.json`**
   - Raw findings from the scanner
   - Array of findings with file, line, text, origin

2. **`reports/dev-url-guard-report.json`**
   - Categorized summary
   - Statistics by origin type
   - Grouped by file

3. **`reports/dev-url-guard-TIMESTAMP.txt`**
   - Timestamped report for CI artifacts
   - Created by build guards on failure

4. **`scripts/repair-dev-urls.changes.json`**
   - Log of all changes made by repair tool
   - Includes backup locations
   - Lists patched dependencies

### Backup Files

The repair tool creates backups before modifying files:
- Format: `{original-file}.backup-{timestamp}`
- Example: `src/config.ts.backup-1673981234567`
- Review and delete after confirming fixes

## Troubleshooting

### "dist-finanzas not found"
**Problem:** Scanner runs before build

**Solution:**
```bash
BUILD_TARGET=finanzas pnpm run build:finanzas
pnpm run find:dev-urls
```

### "No findings file found"
**Problem:** Trying to run repair/report without running scanner first

**Solution:**
```bash
pnpm run find:dev-urls
# Then run repair or report
```

### Repair tool fails to create patch
**Problem:** `patch-package` not installed or permissions issue

**Solution:**
```bash
# Install patch-package
pnpm add -D patch-package

# Manually create patch
# 1. Modify the file in node_modules
# 2. Run: npx patch-package package-name
```

### False positives
**Problem:** Scanner detects non-problematic occurrences

**Solution:**
1. Review the finding carefully
2. If it's in a comment or documentation, it's generally safe
3. If it's in actual code/config, it should be fixed
4. Update `.gitignore` to exclude test fixtures if needed

## Prevention Best Practices

1. **Use environment variables** for all URLs
   ```typescript
   const API_URL = import.meta.env.VITE_API_BASE_URL;
   ```

2. **Configure build tools properly**
   - Use relative paths in source maps
   - Consider separate `.map` files instead of inline

3. **Run checks before committing**
   ```bash
   # Add to pre-commit hook
   BUILD_TARGET=finanzas pnpm run build:finanzas
   pnpm run find:dev-urls
   ```

4. **Build in CI/CD, not locally**
   - Production builds should come from CI
   - Local builds may include environment-specific paths

5. **Keep dependencies updated**
   - Older packages may have source map issues
   - Report issues to package maintainers

## Related Scripts

- `scripts/find-tdz-suspects.js` - Detects temporal dead zone issues
- `scripts/build-guards-finanzas.sh` - Complete build validation suite
- `scripts/pre-build-validate.sh` - Pre-build validation checks

## Support

If you encounter issues not covered in this documentation:
1. Check the detailed error messages in CI logs
2. Review the generated JSON reports
3. Look for similar issues in closed PRs
4. Contact the DevOps or Platform team

## Version History

- **v1.0.0** (2026-01-16): Initial implementation
  - Base scanner with inline source map detection
  - Automated repair tool
  - CI/CD integration
  - Comprehensive documentation
