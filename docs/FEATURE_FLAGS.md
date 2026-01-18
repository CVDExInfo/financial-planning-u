# Feature Flags Documentation

This document describes the environment-based feature flags used in the Finanzas application.

## Forecast Feature Flags

### Layout Flags

#### `VITE_FINZ_NEW_FORECAST_LAYOUT`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Description:** Enables the new forecast page layout with compact KPI summary and repositioned monthly snapshot grid.
- **Impact:** 
  - When `true`: Shows new layout with Cuadrícula de Pronóstico at top
  - When `false`: Shows legacy layout

---

### Visibility Flags

#### `VITE_FINZ_SHOW_KEYTRENDS`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Description:** Opt-in flag to show Key Trends executive cards (Top Variance Projects & Rubros tables) in portfolio/TODOS view.
- **Impact:** 
  - When `true`: Shows Key Trends cards (if all other conditions met)
  - When `false`: Hides Key Trends cards
- **Conditions Required:** 
  - Must be in portfolio view (`isPortfolioView`)
  - Not loading
  - Has forecast data
  - Has budget for variance calculations
  - `HIDE_KEY_TRENDS` must not be `true`

#### `VITE_FINZ_HIDE_KEY_TRENDS`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Description:** Override flag that hides Key Trends even when `SHOW_KEY_TRENDS` is `true`. **HIDE takes precedence.**
- **Impact:** 
  - When `true`: Forces Key Trends to be hidden regardless of `SHOW_KEY_TRENDS`
  - When `false`: Allows `SHOW_KEY_TRENDS` to control visibility
- **Use Case:** Emergency toggle to hide Key Trends in production without changing `SHOW_KEY_TRENDS`

#### `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Description:** Hides the Real Annual Budget KPIs grid (4 cards showing budget, variance, consumption percentages) in TODOS/Portfolio view.
- **Impact:** 
  - When `true`: Hides the annual budget KPI cards in portfolio view
  - When `false`: Shows the KPI cards (default behavior)
- **Scope:** Only affects portfolio view; single-project view is unaffected

#### `VITE_FINZ_HIDE_PROJECT_SUMMARY`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Description:** Hides the "Resumen de todos los proyectos" collapsible section in TODOS mode. The forecast grid ("Desglose mensual vs presupuesto") remains visible.
- **Impact:** 
  - When `true`: Hides project summary section
  - When `false`: Shows project summary section (default)
- **Note:** Does not affect the monthly forecast grid

#### `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Purpose:** When `true` and in TODOS/portfolio mode, the Portfolio Summary renders the Monthly Breakdown Table **transposed** (months as columns). In this mode, the Expandable Project List and Runway Metrics Summary are also hidden by default.
- **Impact:**
  - When `true`: Monthly breakdown table shows months as columns (M1, M2, ..., M12) with line items as rows
  - When `false`: Shows default table orientation
- **Scope:** Only affects portfolio view; single-project view is unaffected

#### `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Purpose:** When `true`, hides the expandable list of projects in the Portfolio Summary in TODOS/portfolio mode.
- **Impact:**
  - When `true`: Expandable project list is hidden
  - When `false`: Shows expandable project list (default behavior)
- **Scope:** Only affects portfolio view; single-project view is unaffected

#### `VITE_FINZ_HIDE_RUNWAY_METRICS`
- **Type:** Boolean (`'true'` / `'false'`)
- **Default:** `false`
- **Purpose:** When `true`, hides the Runway Metrics Summary in the Portfolio Summary in TODOS/portfolio mode.
- **Impact:**
  - When `true`: Runway metrics section is hidden
  - When `false`: Shows runway metrics (default behavior)
- **Scope:** Only affects portfolio view; single-project view is unaffected

---

## Tabla de flags y vistas impactadas (Español)

| Flag | Nombre (Español) | Vista / Componente afectado | Comportamiento | Default |
|------|------------------|-----------------------------|----------------|---------|
| `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS` | Ocultar KPIs Anuales Reales | `ForecastKpis.tsx` / Resumen Ejecutivo | Si `true`, devuelve `null` y oculta las 4 tarjetas de KPIs anuales en vista TODOS/Portfolio. | `false` |
| `VITE_FINZ_HIDE_PROJECT_SUMMARY` | Ocultar Resumen de Portafolio | `PortfolioSummaryView.tsx` | Si `true`, oculta completamente la sección "Resumen de Portafolio". Solo muestra el "Desglose" cuando se requiere. | `false` |
| `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED` | Mostrar Desglose Mensual (Transpuesto) | `PortfolioSummaryView.tsx` - Cuadrícula mensual | Si `true`, fuerza la tabla de Desglose Mensual a mostrarse transpuesta (meses como columnas). | `false` |
| `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST` | Ocultar Lista Expandible de Proyectos | `PortfolioSummaryView.tsx` | Si `true`, no muestra la lista expandible de proyectos dentro del resumen de portafolio. | `false` |
| `VITE_FINZ_HIDE_RUNWAY_METRICS` | Ocultar Runway / Control Presupuestario | `PortfolioSummaryView.tsx` | Si `true`, oculta el resumen de Runway & Control Presupuestario en Resumen de Portafolio. | `false` |
| `VITE_FINZ_NEW_FORECAST_LAYOUT` | Nuevo Layout de Pronóstico | `SDMTForecast.tsx` / layout | Controla la reorganización compacta de la página (no afecta visibilidad por sí solo). Default: `false`. | `false` |
| `VITE_FINZ_SHOW_KEYTRENDS` | Mostrar Tendencias Clave | `SDMTForecast.tsx` / Key Trends | Si `true`, muestra las tablas de Tendencias Clave (Top Variance Projects & Rubros). Default: `false`. | `false` |
| `VITE_FINZ_HIDE_KEY_TRENDS` | Ocultar Tendencias Clave | `SDMTForecast.tsx` / Key Trends | Si `true`, oculta las Tendencias Clave incluso si `SHOW_KEY_TRENDS` es `true`. Default: `false`. | `false` |

### Ejemplos de uso

```bash
# Ejemplo 1: Ocultar KPIs anuales reales
VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true

# Ejemplo 2: Vista compacta - solo tabla transpuesta
VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED=true
VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST=true
VITE_FINZ_HIDE_RUNWAY_METRICS=true

# Ejemplo 3: Vista mínima ejecutiva
VITE_FINZ_NEW_FORECAST_LAYOUT=true
VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true
VITE_FINZ_HIDE_PROJECT_SUMMARY=true
```

---

## Testing Feature Flags Locally

### Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and set the flags you want to test:
   ```bash
   # Example: Enable Key Trends
   VITE_FINZ_SHOW_KEYTRENDS=true
   VITE_FINZ_HIDE_KEY_TRENDS=false
   ```

3. Start the dev server:
   ```bash
   pnpm dev
   ```

4. Navigate to the Forecast page in TODOS/Portfolio view to see the changes.

### Test Scenarios

#### Scenario 1: Show Key Trends (Default Behavior)
```bash
VITE_FINZ_SHOW_KEYTRENDS=true
VITE_FINZ_HIDE_KEY_TRENDS=false
```
**Expected:** Key Trends tables visible in portfolio view

#### Scenario 2: Hide Key Trends (Override)
```bash
VITE_FINZ_SHOW_KEYTRENDS=true
VITE_FINZ_HIDE_KEY_TRENDS=true
```
**Expected:** Key Trends tables hidden (HIDE wins)

#### Scenario 3: Hide Annual Budget KPIs
```bash
VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true
```
**Expected:** Real Annual Budget KPIs (4-card grid) hidden in portfolio view

#### Scenario 4: Hide Project Summary
```bash
VITE_FINZ_HIDE_PROJECT_SUMMARY=true
```
**Expected:** "Resumen de todos los proyectos" section hidden, but forecast grid still visible

#### Scenario 5: All Flags Enabled (Minimal UI)
```bash
VITE_FINZ_SHOW_KEYTRENDS=false
VITE_FINZ_HIDE_KEY_TRENDS=true
VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true
VITE_FINZ_HIDE_PROJECT_SUMMARY=true
```
**Expected:** Minimal portfolio view with only essential grids

#### Scenario 6: Transposed Monthly Breakdown
```bash
VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED=true
```
**Expected:** Monthly breakdown table shows months as columns (M1-M12) in portfolio view

#### Scenario 7: Hide Expandable Project List
```bash
VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST=true
```
**Expected:** Expandable project list is hidden in portfolio summary

#### Scenario 8: Hide Runway Metrics
```bash
VITE_FINZ_HIDE_RUNWAY_METRICS=true
```
**Expected:** Runway metrics summary is hidden in portfolio view

---

## CI/CD Configuration

For CI/CD pipelines, these flags should be set as repository variables or in GitHub Actions secrets:

```yaml
# .github/workflows/deploy.yml
env:
  VITE_FINZ_SHOW_KEYTRENDS: ${{ vars.VITE_FINZ_SHOW_KEYTRENDS || 'false' }}
  VITE_FINZ_HIDE_KEY_TRENDS: ${{ vars.VITE_FINZ_HIDE_KEY_TRENDS || 'false' }}
  VITE_FINZ_HIDE_REAL_ANNUAL_KPIS: ${{ vars.VITE_FINZ_HIDE_REAL_ANNUAL_KPIS || 'false' }}
  VITE_FINZ_HIDE_PROJECT_SUMMARY: ${{ vars.VITE_FINZ_HIDE_PROJECT_SUMMARY || 'false' }}
  VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED: ${{ vars.VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED || 'false' }}
  VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST: ${{ vars.VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST || 'false' }}
  VITE_FINZ_HIDE_RUNWAY_METRICS: ${{ vars.VITE_FINZ_HIDE_RUNWAY_METRICS || 'false' }}
```

---

## Implementation Notes

### Precedence Rules

1. `HIDE_KEY_TRENDS` takes precedence over `SHOW_KEY_TRENDS`
2. All visibility flags are AND-ed with other runtime conditions (loading state, data availability, etc.)
3. Portfolio-only flags (`HIDE_REAL_ANNUAL_KPIS`, `HIDE_PROJECT_SUMMARY`, `ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED`, `HIDE_EXPANDABLE_PROJECT_LIST`, `HIDE_RUNWAY_METRICS`) do not affect single-project view
4. When `ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED` is `true`, it implies hiding expandable project list and runway metrics unless explicitly overridden

### Backward Compatibility

All flags default to `false`, ensuring existing behavior is preserved. The flags are additive and do not break existing deployments.

### Code Location

Feature flag constants are defined in:
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` (lines 169-181)

---

## Related Documentation

- [.env.example](.env.example) - All available environment variables
- [FINANZAS_CONFIGURATION.md](FINANZAS_CONFIGURATION.md) - General Finanzas configuration
- [README.md](../README.md) - Project setup and installation
