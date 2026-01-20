# VITE_ENABLE_RUBROS_ADAPTER Deployment Flag Update

## Summary

This document describes the changes made to ensure the `VITE_ENABLE_RUBROS_ADAPTER` feature flag introduced in PR #959 is properly propagated to deployed environments.

## Problem Statement

PR #959 introduced a new feature flag `VITE_ENABLE_RUBROS_ADAPTER` to enable incremental migration from the legacy forecast table to the new `ForecastRubrosAdapter`. However, the deployment workflow (`deploy-ui.yml`) did not include this flag, meaning:

- The flag would always be `undefined` or `false` in deployed environments
- The feature could not be enabled in staging or production via repository variables
- Testing the adapter in staging would be impossible without workflow updates

## Solution

Added the `VITE_ENABLE_RUBROS_ADAPTER` flag to the deployment workflow following the same pattern as other Vite feature flags.

## Changes Made

### 1. Updated `.github/workflows/deploy-ui.yml`

**Global Environment Section (lines 48-49):**
```yaml
# Incremental migration flags
VITE_ENABLE_RUBROS_ADAPTER: ${{ vars.VITE_ENABLE_RUBROS_ADAPTER || 'false' }}
```

**Build Finanzas SDT Portal Step (lines 235-236):**
```yaml
# Incremental migration flags
VITE_ENABLE_RUBROS_ADAPTER: ${{ env.VITE_ENABLE_RUBROS_ADAPTER }}
```

### 2. Updated `.env.example`

Added documentation for the new flag:
```bash
# Incremental Migration Flags
# Enable ForecastRubrosAdapter for Position #7 in SDMTForecast. Default: false (uses legacy table)
VITE_ENABLE_RUBROS_ADAPTER=false
```

## How to Use

### Local Development

Add to `.env.development` or `.env.local`:
```bash
VITE_ENABLE_RUBROS_ADAPTER=true
```

### Staging/Production Deployment

Set as a GitHub repository variable:

1. Go to Repository Settings → Secrets and variables → Actions → Variables
2. Click "New repository variable"
3. Name: `VITE_ENABLE_RUBROS_ADAPTER`
4. Value: `true` (to enable) or `false` (to disable)
5. Click "Add variable"

The next deployment will pick up this value.

## Validation

All changes have been validated:

✅ YAML syntax is valid
✅ Flag present in global env section
✅ Flag present in Build Finanzas step
✅ Default value is `'false'` (backward compatible)
✅ Pattern matches other VITE feature flags
✅ Documentation updated in `.env.example`

## Related PRs

- **PR #959**: feat(sdmt): ForecastRubrosAdapter for Position #7 with controlled viewMode and materialization tracking
- **This PR**: Updates deployment workflow to support the new flag

## References

- Feature flag implementation: `src/config/featureFlags.ts`
- Feature flag usage: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
- Documentation: `docs/FEATURE_FLAGS.md`
- Adapter component: `src/features/sdmt/cost/Forecast/components/ForecastRubrosAdapter.tsx`

## Rollout Plan

As documented in PR #959:

1. ✅ **Phase 1** (Current): Flag off by default → Legacy table in production
2. **Phase 2**: Enable flag in staging → Validation and QA testing
3. **Phase 3**: Enable flag in production → Adapter goes live
4. **Phase 4**: Implement remaining TODOs → Feature parity with legacy
5. **Phase 5**: Remove legacy code → Adapter becomes default
6. **Phase 6**: Remove adapter → Direct use of ForecastRubrosTable

## Testing Checklist

- [ ] Deploy to staging with `VITE_ENABLE_RUBROS_ADAPTER=false` (verify legacy table works)
- [ ] Deploy to staging with `VITE_ENABLE_RUBROS_ADAPTER=true` (verify adapter works)
- [ ] Verify browser console shows correct feature flag value
- [ ] Test viewMode toggle (Proyectos ↔ Rubros)
- [ ] Test budget editing functionality
- [ ] Test materialization banner display
- [ ] Compare data parity between legacy and adapter modes

---

**Date**: 2026-01-20
**Author**: GitHub Copilot
**Status**: Ready for Review
