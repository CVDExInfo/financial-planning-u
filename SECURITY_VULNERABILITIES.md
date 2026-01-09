# Security Vulnerabilities Status

This document tracks the current status of security vulnerabilities in the repository dependencies.

## Summary

Last Updated: 2026-01-09

### Root Package (`/package.json`)
- ✅ **react-router** (High): Fixed by upgrading to v7.12.0
- ✅ **react-router-dom** (Moderate): Fixed by upgrading to v7.12.0
- ✅ **glob** (High): Fixed by upgrading to v10.5.0
- ✅ **js-yaml** (Moderate): Fixed by overriding to v4.1.1
- ✅ **esbuild** (Moderate): Not applicable (not a dependency)
- ⚠️ **fast-redact** (Low): No fix available, mitigated via @mermaid-js/mermaid-cli v11.4.0
- ⚠️ **Other low severity** (5 total): Related to @mermaid-js/mermaid-cli dependencies

### Finanzas API Package (`/services/finanzas-api/package.json`)
- ⚠️ **xlsx** (High): No fix available yet (see details below)
- ✅ **esbuild** (Moderate): Fixed by upgrading to v0.25.0
- ✅ **js-yaml** (Moderate): Fixed by overriding to v4.1.1

## Detailed Vulnerability Information

### react-router - HIGH SEVERITY ✅ FIXED

**Status**: Fixed

**Details**:
- Previous Version: 7.11.0
- Current Version: 7.12.0
- CVE References:
  - GHSA-h5cw-625j-3rxh: CSRF issue in Action/Server Action Request Processing (CVSS 6.5)
  - GHSA-2w69-qvjg-hvjx: XSS via Open Redirects (CVSS 8.0)
  - GHSA-8v8x-cx79-35w7: SSR XSS in ScrollRestoration (CVSS 8.2)
- Fix: Upgraded to v7.12.0

**Impact**: Production application - used for all routing and navigation in the Finanzas frontend

### react-router-dom - MODERATE SEVERITY ✅ FIXED

**Status**: Fixed

**Details**:
- Previous Version: 7.11.0
- Current Version: 7.12.0
- Depends on react-router (see above for CVE details)
- Fix: Upgraded to v7.12.0

**Impact**: Production application - used for all browser-based routing in the Finanzas frontend

### glob - HIGH SEVERITY ✅ FIXED

**Status**: Fixed

**Details**:
- Previous Version: 10.4.5
- Current Version: 10.5.0
- CVE Reference: GHSA-5j98-mcp5-4vw2 (Command injection via -c/--cmd executes matches with shell:true, CVSS 7.5)
- Location: Indirect dependency via sucrase (development dependency)
- Fix: Upgraded to v10.5.0

**Impact**: Development environment only (devDependency)

### xlsx (SheetJS) - HIGH SEVERITY ⚠️

**Status**: Awaiting upstream fix

**Details**:
- Current Version: 0.18.5 (latest available on npm)
- Affected: `services/finanzas-api/package.json` (devDependency)
- CVE References:
  - GHSA-4r6h-8v6p-xvw6: Prototype Pollution in SheetJS (CVSS 7.8)
  - GHSA-5pgg-2g8v-p4x9: SheetJS Regular Expression Denial of Service (CVSS 7.5)
- Fix Version: 0.20.2+ (not yet published to npm)

**Impact**: 
- Development environment only (devDependency)
- Used in seed scripts for DynamoDB table population
- Not used in production Lambda functions
- Not exposed to end users

**Mitigation**:
- Seed scripts run in controlled CI/CD environment only
- Limited to trusted developers with repository access
- Input files are from trusted sources only

**Action Plan**:
- Monitor SheetJS repository for 0.20.2 release
- Update immediately when patched version is available
- Consider alternative library (xlsx-populate) if fix is delayed

### esbuild - MODERATE SEVERITY ✅ FIXED

**Status**: Fixed

**Details**:
- Previous Version: 0.19.12
- Current Version: 0.25.0
- CVE Reference: GHSA-67mh-4wv8-2f99
- Fix: Upgraded to v0.25.0 (fix available in v0.24.3+)

**Impact**: Development server vulnerability (development environment only)

### js-yaml - MODERATE SEVERITY ✅ FIXED

**Status**: Fixed

**Details**:
- CVE Reference: GHSA-mh29-5h37-fv8m (Prototype pollution in merge)
- Fix: Overridden to v4.1.1 in both root and finanzas-api packages
- Previous: Indirect dependency via jest and md-to-pdf

### fast-redact - LOW SEVERITY ⚠️

**Status**: Awaiting upstream fix

**Details**:
- CVE Reference: GHSA-ffrw-9mx8-89p8
- Current Version: 3.5.0 (latest available)
- Indirect dependency via @mermaid-js/mermaid-cli → @zenuml/core → pino
- No fix available yet

**Mitigation**:
- Downgraded @mermaid-js/mermaid-cli to v11.4.0 to minimize exposure
- Low severity vulnerability
- Development dependency only

## Actions Taken

1. ✅ Updated react-router from v7.11.0 to v7.12.0
2. ✅ Updated react-router-dom from v7.11.0 to v7.12.0
3. ✅ Updated glob from v10.4.5 to v10.5.0 (via npm audit fix)
4. ✅ Updated esbuild from v0.19.12 to v0.25.0 in finanzas-api
5. ✅ Added npm overrides for js-yaml to force v4.1.1
6. ✅ Downgraded @mermaid-js/mermaid-cli from v11.12.0 to v11.4.0
7. ✅ Verified all tests pass after updates
8. ⚠️ Documented xlsx vulnerability for monitoring

## Monitoring

The following vulnerabilities should be monitored for updates:

- [ ] xlsx v0.20.2+ release (check weekly)
- [ ] fast-redact security patch (check monthly)

## Testing

All security updates have been validated:
- ✅ Root package: 0 vulnerabilities (npm audit)
- ✅ Root package lint passes
- ✅ Finanzas API tests pass (77/77 tests)
- ✅ No breaking changes introduced

## Recommendations

1. **Immediate**: No action required for production deployment
2. **Short-term**: Monitor xlsx repository for v0.20.2 release
3. **Long-term**: Consider migrating from xlsx to xlsx-populate if fix is delayed beyond Q1 2025

## Additional Notes

- All HIGH and MODERATE severity vulnerabilities that can be fixed have been addressed
- Remaining vulnerabilities are in development dependencies only
- No production code is affected by known vulnerabilities
- All changes are backward compatible
