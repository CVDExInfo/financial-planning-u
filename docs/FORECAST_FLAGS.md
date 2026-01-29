# Forecast V2 Feature Flags Guide

This document provides a comprehensive guide to the Forecast V2 feature flags and their usage.

## Quick Reference

### Primary Flag (Preferred)
- **Name**: `VITE_FINZ_USE_FORECAST_V2`
- **Type**: Boolean
- **Default**: `true` (dev/non-prod branches), `false` (production/main branch)
- **Purpose**: Master control for Forecast V2 (Executive Dashboard)

### Legacy Flag (Backward Compatibility)
- **Name**: `VITE_FINZ_NEW_FORECAST_LAYOUT`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Maintained for backward compatibility with existing deployments

## Environment-Aware Defaults

### Development Branches (Non-Prod)
The GitHub workflow automatically sets **ALL V2 flags to `true`** for all branches except `main`. This includes:

**Computed in `.github/workflows/deploy-ui.yml` compute_env step:**
```yaml
if [[ "${DEPLOYMENT_ENV}" != "prod" ]]; then
  # Development/non-prod: enabled by default
  VITE_FINZ_USE_FORECAST_V2=true
  VITE_FINZ_V2_SHOW_KEYTRENDS=true
  VITE_FINZ_V2_SHOW_PORTFOLIO_KPIS=true
  VITE_FINZ_V2_ALLOW_BUDGET_EDIT=true
  VITE_FINZ_V2_MONTHS_DEFAULT=60
  VITE_FINZ_V2_SHOW_POSITION_1_EXEC_SUMMARY=true
  VITE_FINZ_V2_SHOW_POSITION_2_PAYROLL_MONTHLY=true
  VITE_FINZ_V2_SHOW_POSITION_3_FORECAST_GRID=true
  VITE_FINZ_V2_SHOW_POSITION_4_MATRIZ_MONTH_BAR=true
  VITE_FINZ_V2_SHOW_POSITION_5_CHARTS_PANEL=true
fi
```

**Result**: Developers can test and view the **fully-enabled Executive Dashboard** in dev without any manual configuration or repository variables.

### Production Branch (Main)
The workflow defaults **ALL V2 flags to `false`** for the `main` branch, keeping production safe until explicitly enabled via repository variables.

### Local Development
The `.env.development` file contains the same dev-friendly defaults, so local development with `pnpm dev` will show the complete Executive Dashboard without additional configuration.

## How It Works

### Feature Flag Logic

The `FEATURE_FLAGS.USE_FORECAST_V2` flag in `src/config/featureFlags.ts` uses OR logic:

```typescript
USE_FORECAST_V2: (import.meta.env.VITE_FINZ_USE_FORECAST_V2 === 'true') ||
                 (import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true')
```

**Either flag being `'true'` will enable Forecast V2.**

### Source of Truth

Both `Navigation.tsx` and `App.tsx` use the same centralized flag:

```typescript
import { FEATURE_FLAGS } from "@/config/featureFlags";

// In Navigation.tsx - filter nav items
if (item.id === "forecastV2" && !FEATURE_FLAGS.USE_FORECAST_V2) {
  return false;
}

// In App.tsx - conditional route
{FEATURE_FLAGS.USE_FORECAST_V2 && (
  <Route path="/sdmt/cost/forecast-v2" element={<SDMTForecastV2 />} />
)}
```

## Comprehensive Flag Reference

### Forecast V2 Position Flags

Control visibility of individual positions in the Executive Dashboard:

| Flag | Position | Description | Default (Prod) | Default (Dev) |
|------|----------|-------------|----------------|---------------|
| `VITE_FINZ_V2_SHOW_POSITION_1_EXEC_SUMMARY` | 1 | Executive summary card | `false` | `true` |
| `VITE_FINZ_V2_SHOW_POSITION_2_PAYROLL_MONTHLY` | 2 | Monthly payroll budget | `false` | `true` |
| `VITE_FINZ_V2_SHOW_POSITION_3_FORECAST_GRID` | 3 | Main forecast grid/table | `false` | `true` |
| `VITE_FINZ_V2_SHOW_POSITION_4_MATRIZ_MONTH_BAR` | 4 | Matrix monthly bar chart | `false` | `true` |
| `VITE_FINZ_V2_SHOW_POSITION_5_CHARTS_PANEL` | 5 | Charts panel with trends | `false` | `true` |

### Executive-Specific Flags

| Flag | Description | Default (Prod) | Default (Dev) |
|------|-------------|----------------|---------------|
| `VITE_FINZ_V2_SHOW_KEYTRENDS` | Shows key trends section | `false` | `true` |
| `VITE_FINZ_V2_SHOW_PORTFOLIO_KPIS` | Shows portfolio-level KPIs | `false` | `true` |
| `VITE_FINZ_V2_ALLOW_BUDGET_EDIT` | Allows budget editing (typically disabled for exec view) | `false` | `true` |
| `VITE_FINZ_V2_MONTHS_DEFAULT` | Default months to display (number) | `60` | `60` |

### BAU (Business-As-Usual) Flags

Preserve existing forecast behavior:

| Flag | Description | Default |
|------|-------------|---------|
| `VITE_FINZ_NEW_FORECAST_LAYOUT` | Legacy layout flag (also activates V2 via fallback) | `false` |
| `VITE_FINZ_SHOW_KEYTRENDS` | Shows key trends in BAU | `true` |
| `VITE_FINZ_HIDE_KEY_TRENDS` | Hides key trends section | `false` |
| `VITE_FINZ_HIDE_PROJECT_SUMMARY` | Hides project summary section | `false` |
| `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS` | Hides real/actual annual KPIs | `false` |

## Usage Scenarios

### Scenario 1: Enable with New Flag (Recommended)
```bash
# .env.local or deployment environment
VITE_FINZ_USE_FORECAST_V2=true
VITE_FINZ_NEW_FORECAST_LAYOUT=false  # or omit
```

**Result**: Forecast V2 enabled ✅

### Scenario 2: Enable with Legacy Flag (Backward Compatible)
```bash
# .env.local or deployment environment
VITE_FINZ_USE_FORECAST_V2=false  # or omit
VITE_FINZ_NEW_FORECAST_LAYOUT=true
```

**Result**: Forecast V2 enabled ✅

### Scenario 3: Both Flags True
```bash
VITE_FINZ_USE_FORECAST_V2=true
VITE_FINZ_NEW_FORECAST_LAYOUT=true
```

**Result**: Forecast V2 enabled ✅ (redundant but safe)

### Scenario 4: Both Flags False (Default)
```bash
VITE_FINZ_USE_FORECAST_V2=false
VITE_FINZ_NEW_FORECAST_LAYOUT=false
```

**Result**: Forecast V2 disabled ❌

## Deployment Configuration

### GitHub Actions (deploy-ui.yml)

The deployment workflow includes both flags:

```yaml
env:
  VITE_FINZ_USE_FORECAST_V2: ${{ vars.VITE_FINZ_USE_FORECAST_V2 || 'false' }}
  VITE_FINZ_NEW_FORECAST_LAYOUT: ${{ vars.VITE_FINZ_NEW_FORECAST_LAYOUT || 'false' }}
```

### Setting Repository Variables

1. Go to repository Settings → Secrets and variables → Actions → Variables
2. Add new variable:
   - Name: `VITE_FINZ_USE_FORECAST_V2`
   - Value: `true` (to enable) or `false` (to disable)

## What Gets Enabled

When Forecast V2 is enabled:

### Navigation Changes
- **Shows**: "Resumen Ejecutivo (SDMT)" menu item in SDMT section
- **Visible to**: SDMT, SDM_FIN, EXEC_RO roles
- **Hidden from**: PMO, VENDOR roles (via permission checks)

### Route Changes
- **Enabled**: `/sdmt/cost/forecast-v2` route
- **Component**: `SDMTForecastV2` (5-position modular dashboard)
- **Protected**: Same permission gating as other SDMT routes

### Features Available
1. **Executive Summary Card** - High-level KPI tiles
2. **Payroll Monthly Budget** - Budget management (collapsed by default)
3. **Forecast Monthly Grid** - Detailed forecast data
4. **Matriz Executive Bar** - Quick actions and summary
5. **Charts Panel V2** - Trend visualization

## Migration Guide

### For New Deployments
Use the new flag for clarity:
```bash
VITE_FINZ_USE_FORECAST_V2=true
```

### For Existing Deployments
Your existing configuration continues to work:
```bash
VITE_FINZ_NEW_FORECAST_LAYOUT=true  # Still works!
```

### Migration Path
1. Add `VITE_FINZ_USE_FORECAST_V2=true` to your environment
2. Optionally remove `VITE_FINZ_NEW_FORECAST_LAYOUT` (not required)
3. Deploy and verify
4. Update documentation to reference the new flag

## Testing

### Unit Tests
```bash
pnpm test:unit  # Includes feature flag logic tests
```

7 tests verify the flag logic:
- ✅ VITE_FINZ_USE_FORECAST_V2 (preferred) enables the flag
- ✅ VITE_FINZ_NEW_FORECAST_LAYOUT (legacy) enables the flag
- ✅ Both flags work independently
- ✅ Flag disabled when both are false/undefined

### Smoke Test
```bash
bash scripts/smoke-checks/check-forecast-v2.sh
```

Verifies:
- ✅ Route returns HTTP 200
- ✅ HTML structure is valid
- ✅ Assets are loaded

### Manual Verification
1. **Local Dev**: Set flag in `.env.local` and run `pnpm dev`
2. **Navigate**: Go to SDMT section
3. **Verify**: "Resumen Ejecutivo (SDMT)" appears in navigation
4. **Click**: Should load `/sdmt/cost/forecast-v2`
5. **Check**: Page renders without errors

## Troubleshooting

### Flag Not Working

**Problem**: Set flag to `true` but V2 not visible

**Checklist**:
1. ✅ Check spelling: `VITE_FINZ_USE_FORECAST_V2` (not `ENABLED`)
2. ✅ Value is string `'true'` not boolean `true`
3. ✅ Restart dev server after changing `.env.local`
4. ✅ Clear browser cache
5. ✅ Check browser console for `[FeatureFlags]` log (dev mode only)

### Navigation Item Not Showing

**Problem**: Route works but nav item missing

**Possible Causes**:
1. ❌ Role doesn't have access (check `visibleFor` in nav config)
2. ❌ Different flag check in Navigation vs App
3. ❌ Premium feature flag blocking (check `hasPremiumFinanzasFeatures`)

**Solution**: Both files now use `FEATURE_FLAGS.USE_FORECAST_V2` consistently

### Build Fails

**Problem**: Build fails with feature flag error

**Check**:
```bash
# Build requires VITE_API_BASE_URL
VITE_API_BASE_URL=https://your-api.com/dev pnpm run build
```

## Related Documentation

- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) - All feature flags reference
- [QA_MANUAL_VERIFICATION_FORECAST_V2.md](./QA_MANUAL_VERIFICATION_FORECAST_V2.md) - QA checklist
- [FORECAST_DASHBOARD_LAYOUT.md](./FORECAST_DASHBOARD_LAYOUT.md) - V2 architecture

## Development Notes

### Console Logging (Dev Mode Only)

In development, feature flags are logged:
```javascript
[FeatureFlags] Loaded configuration: { USE_FORECAST_V2: true, ... }
```

### Type Safety

The flag is strongly typed as `const`:
```typescript
export const FEATURE_FLAGS = {
  USE_FORECAST_V2: /* ... */,
} as const;
```

This prevents typos and provides autocomplete in IDEs.

## Migration History

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-29 | Added `VITE_FINZ_USE_FORECAST_V2` | Clearer semantic naming |
| Previous | Used `VITE_FINZ_NEW_FORECAST_LAYOUT` | Initial implementation |

## Support

For issues or questions:
1. Check this documentation
2. Review [FEATURE_FLAGS.md](./FEATURE_FLAGS.md)
3. Check browser console for errors
4. Verify build succeeds: `pnpm run build`
