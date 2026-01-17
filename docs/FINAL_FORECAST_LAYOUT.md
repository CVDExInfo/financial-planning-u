# FINAL_FORECAST_LAYOUT.md — Diseño final esperado (Especificación)

**Propósito:**
Documento de referencia que define el *diseño final* esperado para la pantalla **Gestión de Pronóstico** (`/finanzas/sdmt/cost/forecast`). Use esta guía para QA, desarrollo (Copilot) y UI/UX. Incluye orden de vistas, nombres en español, banderas (`VITE_FINZ_*`) que controlan la visibilidad, comportamientos interactivos, reglas de accesibilidad y pruebas de aceptación.

> **Nota:** Todos los nombres de componentes se muestran con su ruta de archivo sugerida para implementación. Los textos de la UI deben estar en **español** tal como se indica.

---

## 1. Estructura de la página (orden CANÓNICO — de arriba hacia abajo)

1. **Header global (page level)**

   * `h1`: `Gestión de Pronóstico`
   * Filtros globales situados en la barra superior (selector de Proyecto, selector de Periodo).
   * Componente: `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` — área superior.

2. **Resumen Ejecutivo — Cartera Completa** (SIEMPRE visible, top)

   * Componente: `src/features/sdmt/cost/Forecast/components/ForecastSummaryBar.tsx`
   * Contenido: Presupuesto Total, Pronóstico Total, Real Total, % Consumo, Variación.
   * Flags: **no** controla visibilidad; siempre arriba en modo **TODOS**.
   * `defaultOpen`: n/a (no colapsable).

3. **Matriz del Mes — Vista Ejecutiva** (siempre visible)

   * Componente: `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`
   * Contenido: KPI compacta del mes seleccionado (Presupuesto, Pronóstico, Real, % Consumo, Varianza).
   * `defaultOpen`: visible (no colapsado).
   * Permite: filtro tipo de costo (Labor/No Labor/Todos), búsqueda, selector de periodo.
   * **Regla visual:** balancear tamaños de filtros/botones (ver sección 5).

4. **Cuadrícula de Pronóstico (12 Meses)** — **Monitoreo mensual de proyectos vs. presupuesto** (CANÓNICA)

   * **Título**: `Monitoreo mensual de proyectos vs. presupuesto` (texto exacto)
   * Componente: `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx` **(una sola instancia)**
   * `defaultOpen`: **true** (expandido al entrar en la página).
   * Soporta: `Vista` → `Por Proyecto` / `Rubros por proyecto` (breakdownMode), filtros, edición inline.
   * **Importante:** Debe existir **una sola** tabla 12m en página. Cualquier tabla duplicada (p.ej. instancia secundaria hacia ~línea 3180) debe eliminarse o quedar permanentemente oculta.

5. **Resumen de Portafolio** (antes “Resumen de todos los proyectos”) — *solo este bloque*

   * Componente: `src/features/sdmt/cost/Forecast/PortfolioSummaryView.tsx`
   * `defaultOpen`: collapsed por defecto en NEW layout (pero accesible).
   * Flag: `VITE_FINZ_HIDE_PROJECT_SUMMARY === 'true'` → ocultar completamente.
   * **Regla crítica:** No debe reemplazar el Monitoreo. El Monitoreo (cuadrícula 12m) va **encima** de esta sección.
   * **Defecto actual a corregir:** se está ocultando el bloque incorrecto (se oculta el desglose deseado y se muestra detalle no deseado).

6. **Simulador de Presupuesto** (colapsable)

   * Componente: `src/features/sdmt/cost/Forecast/BudgetSimulatorCard.tsx`
   * `defaultOpen`: collapsed.

7. **Gráficos de Tendencias** (colapsable)

   * Componente: `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`
   * `defaultOpen`: collapsed (debe existir trigger de colapsar/expandir).
   * Contenidos:

     * Líneas: Planned, Forecast, Actual (y Budget cuando aplique).
     * **Barras:** `Proyectos (M/M)` — número de proyectos activos por mes (barra, eje Y derecho).
     * Tabs: `Tendencia Mensual` / `Por Rubro` / `Acumulado`.

---

## 2. Wireframe (visual rápido)

```
+--------------------------------------------------------------+
| Header: Gestión de Pronóstico  [Proyecto] [Periodo]          |
+--------------------------------------------------------------+
| Resumen Ejecutivo - Cartera Completa (ForecastSummaryBar)     |
+--------------------------------------------------------------+
| Matriz del Mes — Vista Ejecutiva (MonthlySnapshotGrid)        |
+--------------------------------------------------------------+
| Monitoreo mensual de proyectos vs. presupuesto (EXPANDIDO)    |
| [ Vista: Por Proyecto | Rubros por proyecto ] [Filtros...]    |
| +----------------------------------------------------------+ |
| | Cuadrícula de Pronóstico 12 Meses (ForecastRubrosTable)   | |
| +----------------------------------------------------------+ |
+--------------------------------------------------------------+
| Resumen de Portafolio (colapsable / ocultable por flag)       |
+--------------------------------------------------------------+
| Simulador de Presupuesto (colapsable)                         |
+--------------------------------------------------------------+
| Gráficos de Tendencias (colapsable)                           |
|  - Lines: Planned/Forecast/Actual (+ Budget si aplica)        |
|  - Bar: Proyectos (M/M) [eje derecho]                         |
+--------------------------------------------------------------+
```

> **Regla:** El **Monitoreo** debe quedar encima del **Resumen de Portafolio**.

---

## 3. Tabla de flags (español) — visibilidad y alcance

| Flag                                               | Nombre (ES)                   | Componente / Vista afectada | Comportamiento                                                           | Default |
| -------------------------------------------------- | ----------------------------- | --------------------------- | ------------------------------------------------------------------------ | ------- |
| `VITE_FINZ_NEW_FORECAST_LAYOUT`                    | Nuevo Layout Pronóstico       | `SDMTForecast`              | Activa layout ejecutivo. **No puede esconder** la grid 12m canónica.     | `false` |
| `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS`                  | Ocultar KPIs Anuales Reales   | `ForecastKpis.tsx`          | Si `true`, oculta KPIs anuales reales (tarjetas).                        | `false` |
| `VITE_FINZ_HIDE_PROJECT_SUMMARY`                   | Ocultar Resumen de Portafolio | `PortfolioSummaryView.tsx`  | Si `true`, oculta solo Resumen de Portafolio (NO el Monitoreo).          | `false` |
| `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED` | Mostrar Desglose transpuesto  | `PortfolioSummaryView.tsx`  | Si `true`, fuerza tabla mensual a transponer meses como columnas.        | `false` |
| `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST`           | Ocultar lista expandible      | `PortfolioSummaryView.tsx`  | Si `true`, oculta lista expandible dentro del resumen.                   | `false` |
| `VITE_FINZ_HIDE_RUNWAY_METRICS`                    | Ocultar Runway                | `PortfolioSummaryView.tsx`  | Si `true`, oculta bloque Runway & Control Presupuestario.                | `false` |
| `VITE_FINZ_SHOW_KEYTRENDS`                         | Mostrar Key Trends            | `SDMTForecast`              | Controla si TopVarianceProjectsTable/TopVarianceRubrosTable se muestran. | `true`  |

> **Importante:** Vite env vars se leen en build-time (`import.meta.env`). Cambios en flags requieren rebuild.

---

## 4. Comportamientos interactivos y técnicos (detallado)

### 4.1. Monitoreo / Cuadrícula (12 meses)

* **Vista (breakdownMode):** `Por Proyecto` | `Rubros por proyecto`

  * `state key`: `forecastBreakdownMode`
  * **Persistencia:** `sessionStorage.setItem('forecastBreakdownMode', value)`
  * **Inicialización:**

```ts
const [breakdownMode, setBreakdownMode] = useState<'project'|'rubros'>(() => {
  const s = sessionStorage.getItem('forecastBreakdownMode');
  return s === 'rubros' ? 'rubros' : 'project';
});
```

* **Al cambiar:** actualizar estado, persistir, re-renderizar grid según modo.
* **Rubros por proyecto:** renderizar encabezados por proyecto con toggle + filas de rubros anidadas.
* **defaultOpen:** Monitoreo debe entrar **expandido**.
* **Prohibido:** “coming soon”/placeholder para filtros ya visibles — debe funcionar o no mostrarse.

### 4.2. Charts — Barras `Proyectos (M/M)`

* **Forma de datos (projectsPerMonth):**

```ts
[{ month: 1, projects: 18 }, { month: 2, projects: 17 }, ...]
```

* **Cálculo sugerido:**

```ts
const projectsPerMonth = months.map(m => {
  const set = new Set();
  forecastData.forEach(cell => {
    if (cell.month === m && (cell.planned || cell.forecast || cell.actual)) {
      if (cell.projectId) set.add(cell.projectId);
    }
  });
  return { month: m, projects: set.size };
});
```

* **Config:** `ComposedChart` (Recharts)

  * Líneas en eje izquierdo
  * Barra `Projects` en eje derecho
  * Tooltip: `Mes {X} — Proyectos: {N}`
  * Leyenda: `Proyectos (M/M)`

### 4.3. Flags — guards defensivos

* Ejemplo:

```ts
if (import.meta.env.VITE_FINZ_HIDE_PROJECT_SUMMARY === 'true') return null;
```

* Agregar `console.debug` on-mount para QA (solo en dev).

### 4.4. Accesibilidad

* `aria-label` en selects y triggers.
* Encabezados de proyecto expandibles por teclado (`aria-expanded`).
* Charts: resumen textual `sr-only`.

### 4.5. Responsivo

* Desktop: tabla 12m con `overflow-x` y columna izquierda sticky.
* Tablet: columnas más compactas + scroll.
* Mobile: listas colapsables + charts full-width.

---

## 5. Guías visuales (espaciado / tamaños)

* Botones: `h-8 text-sm`, `gap-2`.
* Selects: `className="h-8 w-[180px] text-sm"`.
* Badges: `text-xs px-2 py-0.5`.
* Card headers: `py-3 px-4`.
* Celdas: `min-w-[140px]` meses; columna izquierda `min-w-[300px]`.
* Gaps: `gap-2` controles, `gap-3` secciones.

---

## 6. Acceptance tests & QA checklist

### Unit tests

1. Render

   * `should render Monitoreo (12m) when data exists`
   * `should render ForecastRubrosTable once`
2. Breakdown

   * `project mode shows project headers + nested rubros`
3. Charts

   * `renders Bar named "Proyectos (M/M)"`
4. Flags

   * `HIDE_PROJECT_SUMMARY hides only PortfolioSummaryView`
   * `HIDE_REAL_ANNUAL_KPIS hides KPI cards`

### Smoke manual

1. Abrir `/finanzas/sdmt/cost/forecast` en TODOS.
2. Verificar orden: Resumen Ejecutivo → Matriz Mes → Monitoreo (expandido) → Resumen Portafolio → Simulador → Gráficos (colapsable).
3. Cambiar `Vista` → `Rubros por proyecto` sin “coming soon”.
4. Charts: líneas + barra Proyectos por mes.

---

## 7. PR Checklist (pre-merge)

* [ ] Lint ok (`pnpm lint`).
* [ ] Tests ok (`pnpm test:unit`).
* [ ] Build ok (`pnpm build`).
* [ ] Doc agregado: `docs/FINAL_FORECAST_LAYOUT.md`.
* [ ] Doc actualizado: `docs/FEATURE_FLAGS.md` (incluye nombres ES y vista impactada).
* [ ] Smoke test ok.

---

## 8. Appendix — snippets

### 1) `projectsPerMonth` (useMemo)

```ts
const projectsPerMonth = useMemo(() => {
  if (!isPortfolioView) return monthsForCharts.map(m => ({ month: m, projects: 0 }));
  return monthsForCharts.map(month => {
    const s = new Set<string>();
    forecastData.forEach(cell => {
      if (cell.month === month && ((cell.planned||0) + (cell.forecast||0) + (cell.actual||0) > 0)) {
        if (cell.projectId) s.add(String(cell.projectId));
      }
    });
    return { month, projects: s.size };
  });
}, [isPortfolioView, forecastData, monthsForCharts]);
```

### 2) `breakdownMode` init + handler

```ts
const [breakdownMode, setBreakdownMode] = useState<'project'|'rubros'>(() => {
  const s = sessionStorage.getItem('forecastBreakdownMode');
  return s === 'rubros' ? 'rubros' : 'project';
});
const handleBreakdownModeChange = (m:'project'|'rubros') => {
  setBreakdownMode(m);
  sessionStorage.setItem('forecastBreakdownMode', m);
};
```

### 3) Merge chart data (add Projects)

```ts
chartData.forEach(point => {
  const matching = projectsPerMonth.find(p => p.month === point.month);
  point.Projects = matching ? matching.projects : 0;
});
```

---

## 9. Notas finales

* Este spec es prescriptivo y es la referencia autoritativa.
* Si el NEW layout está activo, la tabla canónica 12m debe existir (o MonthlySnapshot debe representar el mismo contenido sin perder datos).
* Después de cambios, ejecutar unit + smoke antes de merge.

---

**Acción requerida:** Generar el archivo `docs/FINAL_FORECAST_LAYOUT.md` con este contenido y mantenerlo actualizado junto con `docs/FEATURE_FLAGS.md`.
