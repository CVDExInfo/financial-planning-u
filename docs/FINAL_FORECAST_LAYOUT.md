# FINAL_FORECAST_LAYOUT.md — Diseño final esperado (Especificación)

**Propósito**
Documento de referencia que define el *diseño final* esperado para la pantalla **Gestión de Pronóstico** (`/finanzas/sdmt/cost/forecast`). Use esta guía para QA, desarrollo (Copilot) y UI/UX. Incluye el **orden canónico** exacto de vistas (top → bottom), componentes con rutas de archivo, banderas (`VITE_FINZ_*`) que controlan visibilidad, comportamientos interactivos, reglas de accesibilidad y pruebas de aceptación.

> **Nota:** Los textos de UI deben estar en **español**. Todos los nombres de componentes se muestran con su ruta de archivo sugerida para implementación.

---

## 1. Orden canónico (IMPRESCINDIBLE)

**El orden abajo es el único correcto cuando `VITE_FINZ_NEW_FORECAST_LAYOUT` está habilitado.** Debe respetarse exactamente (de arriba → abajo):

1. **Resumen Ejecutivo — Cartera Completa** (siempre visible)

   * **Componente:** `src/features/sdmt/cost/Forecast/components/ForecastSummaryBar.tsx` (o `ForecastKpiCards.tsx`)
   * **Contenido:** Presupuesto Total, Pronóstico Total, Real Total, % Consumo, Variación.
   * **Visibilidad:** Siempre visible en modo `TODOS`. No es colapsable. No debe ocultarse por flags (salvo que se considere un cambio futuro explícito).

2. **Cuadrícula de Pronóstico (12 Meses)** — *Canonical 12m grid*

   * **Componente:** `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx`
   * **Requerimientos clave:**

     * **Única instancia en toda la página.** Eliminar cualquier tabla duplicada (ej. la secundaria alrededor de la línea ~3180).
     * **No colapsada por defecto** al entrar en la página — `defaultOpen = true`.
     * Soporta edición inline, filtros y los modos de vista (breakdown).

3. **Matriz del Mes — Vista Ejecutiva** (compacta, filtros)

   * **Componente:** `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`
   * **Contenido:** KPIs del mes seleccionado (Presupuesto M1, Pronóstico, Real, % Consumo, Varianza).
   * **Regla visual:** filtros y botones compactos y balanceados (controles `h-8`, `text-sm`, `gap-3`).
   * **Visibilidad:** siempre visible (no colapsado).

4. **Resumen de Portafolio** — *solo* **Desglose por proyecto** (Summary Grid)

   * **Componente:** `src/features/sdmt/cost/Forecast/PortfolioSummaryView.tsx`
   * **Requisitos:**

     * Mostrar únicamente el **Desglose Mensual vs Presupuesto M1-M12 Grid**  
     * **No** debe incluir tiles KPI duplicadas (esas sólo en `ForecastSummaryBar`). → ocultar totalmente esta sección.
     * `defaultOpen` en NEW layout: colapsado por defecto (pero accesible).
     * `VITE_FINZ_HIDE_PROJECT_SUMMARY === 'FALSE'` → Mostrar únicamente el **Desglose Mensual vs Presupuesto M1-M12 Grid** 

5. **Simulador de Presupuesto** (colapsable — cerrado por defecto)

   * **Componente:** `src/features/sdmt/cost/Forecast/BudgetSimulatorCard.tsx`
   * **Visibilidad:** collapsed por defecto.

6. **Gráficos de Tendencias** (colapsable)

   * **Componente:** `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`
   * **Contenido:**

     * Líneas: Planned, Forecast, Actual (y Budget si aplica).
     * **Bar** series: `Proyectos (M/M)` con eje Y **derecho**, barras delgadas y translucidas.
     * Tabs: `Tendencia Mensual` / `Por Rubro` / `Acumulado`.
   * **Regla visual:** barras finas (`barSize` ≈ 10–14), `fillOpacity` baja, etiquetas legibles y no crowding. Collapsible control disponible.

7. **Monitoreo mensual de proyectos vs. presupuesto** (expanded; puede usar la misma tabla canónica)

   * **Componente:** `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx`
   * **Requisitos:**

     * Soporta **Vista**: `Por Proyecto` | `Rubros por proyecto` + filtros (buscar, tipo costo, periodo).
     * **Debe** abrir **expandido** al entrar (`defaultOpen = true` o estado `expanded` inicial).
     * Renderizado para `Por Proyecto`: encabezados por proyecto, toggles expand/collapse con filas de rubros anidadas.
     * Persistencia del modo de vista en `sessionStorage`.

> **Regla crítica:** La **Cuadrícula (2)** y el **Monitoreo (7)** están íntimamente relacionados: **debe existir una sola tabla canónica 12m** (usar `ForecastRubrosTable` para ambas necesidades), y el Monitoreo siempre debe aparecer por encima del Resumen de Portafolio.

---

## 2. Tabla de flags (ES) — visibilidad y efectos

| Flag                                               | Nombre (ES)                   |         Componente / Vista | Comportamiento                                                                |                        Default |
| -------------------------------------------------- | ----------------------------- | -------------------------: | ----------------------------------------------------------------------------- | -----------------------------: |
| `VITE_FINZ_NEW_FORECAST_LAYOUT`                    | Nuevo Layout Pronóstico       |             `SDMTForecast` | Activa el layout ejecutivo nuevo. **No** debe esconder la grid 12m.           | `true`/`false` (según rollout) |
| `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS`                  | Ocultar KPIs Anuales Reales   |         `ForecastKpis.tsx` | Si `true`, oculta las tarjetas KPI anuales en vista TODOS (no en simulación). |                        `false` |
| `VITE_FINZ_HIDE_PROJECT_SUMMARY`                   | Ocultar Resumen de Portafolio | `PortfolioSummaryView.tsx` | Si `true`, oculta el resumen de portafolio (NO el Monitoreo).                 |                        `false` |
| `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED` | Mostrar Desglose transpuesto  | `PortfolioSummaryView.tsx` | Fuerza transponer meses como columnas en la tabla mensual (si aplica).        |                        `false` |
| `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST`           | Ocultar lista expandible      | `PortfolioSummaryView.tsx` | Si `true`, oculta la lista expandible de proyectos.                           |                        `false` |
| `VITE_FINZ_HIDE_RUNWAY_METRICS`                    | Ocultar Runway                | `PortfolioSummaryView.tsx` | Si `true`, oculta el bloque Runway & Control Presupuestario.                  |                        `false` |
| `VITE_FINZ_SHOW_KEYTRENDS`                         | Mostrar Key Trends            |             `SDMTForecast` | Controla TopVarianceProjectsTable/KeyTrends visibility.                       |                         `true` |

**Nota técnica:** *Vite env vars se leen en build-time (`import.meta.env`). Cambios en flags requieren rebuild para reflejarse en el cliente.*

---

## 3. Comportamientos interactivos y técnicos (detallado)

### 3.1 Estado y persistencia — `breakdownMode`

* **State key:** `forecastBreakdownMode`
* **Persistencia:** `sessionStorage.setItem('forecastBreakdownMode', value)`
* **Inicialización (ejemplo):**

```ts
const [breakdownMode, setBreakdownMode] = useState<'project'|'rubros'>(() => {
  const s = sessionStorage.getItem('forecastBreakdownMode');
  return s === 'rubros' ? 'rubros' : 'project';
});
const handleBreakdownModeChange = (mode:'project'|'rubros') => {
  setBreakdownMode(mode);
  sessionStorage.setItem('forecastBreakdownMode', mode);
};
```

### 3.2 Monitoreo / Cuadrícula

* **Renders:**

  * `project` → group by project with collapsible header + nested rubro rows.
  * `rubros` → classic rubros-by-category table.
* **Default:** expanded on page entry.
* **Performance:** use `useMemo` to compute `projectRubros` maps and `projectsPerMonth`.

### 3.3 Charts — `Proyectos (M/M)`

* **Data shape:** `[{ month: 1, projects: 18 }, ...]`
* **ComposedChart config:** Left axis currency lines, right axis integer projects. `Bar` series: `barSize=10–14`, `fill="rgba(...,0.14)"`, `LabelList` for non-zero months. Tooltip format: `Mes {monthLabel} — Proyectos: {projects}`.

### 3.4 Defensive flags & logging

* Example guard in KPI component:

```ts
const HIDE_REAL_ANNUAL_KPIS = import.meta.env.VITE_FINZ_HIDE_REAL_ANNUAL_KPIS === 'true';
if (HIDE_REAL_ANNUAL_KPIS) return null;
```

* Add `console.debug` on mount in dev for `import.meta.env` to aid QA.

### 3.5 Accessibility (a11y)

* All selects/buttons: `aria-label`.
* Collapsible triggers: `aria-expanded`.
* Project headers keyboard-expandable.
* Charts: include `sr-only` textual summaries.

### 3.6 Responsiveness

* Desktop (≥1024px): full 12-month view with horizontal scroll & sticky left column.
* Tablet (≥768px & <1024px): compact month columns, show M1..M6 by default with scroll.
* Mobile (<768px): stacked rows, collapsible per project/category.

---

## 4. Guías visuales y tokens

* **Buttons:** `h-8 text-sm px-3`.
* **Selects:** `h-8 w-[170px] text-sm`.
* **Search:** `h-8 text-sm w-[340px]`.
* **Badges:** `text-xs px-2 py-0.5`.
* **Card header padding:** `py-3 px-4`.
* **Month cell min-width:** `min-w-[140px]`.
* **Left column min-width:** `min-w-[300px]`.
* **Gaps:** controls `gap-3`, sections `gap-4`.
* **Chart palette:** Project bar color `#6366F1` (semi-transparent); lines use existing theme colors.

---

## 5. Acceptance tests & QA checklist

### Unit tests

* `renders Monitoreo 12m when data present`
* `ForecastRubrosTable is rendered once (no duplicates)`
* `breakdownMode project renders project headers`
* `ForecastChartsPanel renders Projects bar right axis`
* `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true hides KPI cards`

### Manual smoke checklist

1. `pnpm dev` → Visit `/finanzas/sdmt/cost/forecast` (TODOS).
2. Confirm page order EXACTA:
   `Resumen Ejecutivo` → `Cuadrícula 12m` → `Matriz del Mes` → `Resumen de Portafolio` → `Simulador` → `Gráficos` → `Monitoreo (expandido)`.
3. `Cuadrícula 12m` visible by default (no click). Only one instance on page.
4. Toggle `Vista` → `Por Proyecto` → project headers show nested rubros. Persist on reload.
5. Charts: Bars thin and labelled, tooltip shows `Mes X — Proyectos: N`.
6. Set `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS=true` (rebuild) → KPIs hidden.
7. Confirm accessibility (tab to expand project headers, aria labels present).

---

## 6. Snippets (copy/paste)

### projectsPerMonth (useMemo)

```ts
const projectsPerMonth = useMemo(() => {
  return monthsForCharts.map(month => {
    const s = new Set<string>();
    forecastData.forEach(cell => {
      if (cell.month === month && ((cell.planned||0)+(cell.forecast||0)+(cell.actual||0) > 0)) {
        if (cell.projectId) s.add(String(cell.projectId));
      }
    });
    return { month, projects: s.size };
  });
}, [forecastData, monthsForCharts]);
```

### chart merge (add Projects)

```ts
chartData.forEach(point => {
  const matching = projectsPerMonth.find(p => p.month === point.month);
  point.Projects = matching ? matching.projects : 0;
});
```

### breakdownMode init + handler

```ts
const [breakdownMode, setBreakdownMode] = useState<'project'|'rubros'>(() =>
  sessionStorage.getItem('forecastBreakdownMode') === 'rubros' ? 'rubros' : 'project'
);
const handleBreakdownModeChange = (m:'project'|'rubros') => {
  setBreakdownMode(m);
  sessionStorage.setItem('forecastBreakdownMode', m);
};
```

---

## 7. PR pre-merge checklist

* [ ] `pnpm lint` OK
* [ ] Unit tests OK (`pnpm test:unit`)
* [ ] Build OK (`pnpm build`)
* [ ] `docs/FINAL_FORECAST_LAYOUT.md` added/updated (this file)
* [ ] `docs/FEATURE_FLAGS.md` updated (Spanish names + components)
* [ ] Manual smoke tests passed (see checklist)

---

## 8. Notas finales

*Este documento es la especificación autoritativa.* Si el equipo discute una excepción, anotar el caso y actualizar el doc. Si el `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS` u otras banderas cambian de valor en producción, recuerde que deben estar presentes **en tiempo de build** para que el cliente las respete.

---

**Acción solicitada:** Crear el archivo `docs/FINAL_FORECAST_LAYOUT.md` con este contenido y mantenerlo sincronizado con `docs/FEATURE_FLAGS.md`.
