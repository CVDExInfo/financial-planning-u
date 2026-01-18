# Forecast Dashboard Layout - Vista de Cartera Completa (TODOS)

## Documento de Referencia Visual y Técnica

Este documento describe el orden final y la estructura de componentes en la página **Gestión de Pronóstico** cuando se visualiza en modo **TODOS (Todos los proyectos)** / Portfolio View.

---

## 📐 Estructura Visual del Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ #1 - RESUMEN EJECUTIVO - CARTERA COMPLETA                          │
│      (ForecastSummaryBar)                                           │
│      ────────────────────────────────────────────────────────       │
│      [Always Visible] KPIs: Budget | Forecast | Actual | % Consumo │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #2 - CUADRÍCULA DE PRONÓSTICO (12 MESES)                     [▼]   │
│      (ForecastRubrosTable)                                          │
│      ────────────────────────────────────────────────────────       │
│      [defaultOpen={true}] Tabla de Rubros por Categoría/Proyecto   │
│      Columnas: M1 | M2 | M3 | ... | M12                            │
│      Filtros: Por Categoría | Por Proyecto | Mano de Obra | Todo   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #3 - MATRIZ DEL MES — VISTA EJECUTIVA                              │
│      (MonthlySnapshotGrid)                                          │
│      ────────────────────────────────────────────────────────       │
│      [Always Visible] Vista del mes actual con desglose por proyecto│
│      Filtros: Tipo de costo | Período | Agrupar por                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #4 - RESUMEN DE PORTAFOLIO                                    [▼]   │
│      (PortfolioSummaryView)                                         │
│      ────────────────────────────────────────────────────────       │
│      [defaultOpen={true}, Collapsible]                              │
│      • Desglose Mensual (transposable vía flag)                     │
│      • Lista Expandible de Proyectos (hideable vía flag)            │
│      • Runway Metrics (hideable vía flag)                           │
│      Respeta: VITE_FINZ_HIDE_PROJECT_SUMMARY                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #5 - SIMULADOR DE PRESUPUESTO                                 [▶]   │
│      (BudgetSimulatorCard)                                          │
│      ────────────────────────────────────────────────────────       │
│      [defaultOpen={false}, Collapsible]                             │
│      Editor de presupuesto anual con distribución mensual           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #6 - GRÁFICOS DE TENDENCIAS                                   [▶]   │
│      (ForecastChartsPanel)                                          │
│      ────────────────────────────────────────────────────────       │
│      [defaultOpen={false}, Collapsible]                             │
│      • Tendencia Mensual (líneas + barras de proyectos M/M)         │
│      • Por Rubro (gráfico de barras)                                │
│      • Acumulado (gráfico de área)                                  │
│      Incluye: Proyectos M/M como serie de barras (eje Y secundario) │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #7 - MONITOREO MENSUAL DE PROYECTOS VS. PRESUPUESTO          [▼]   │
│      (Monitoreo Block - Second ForecastRubrosTable instance)        │
│      ────────────────────────────────────────────────────────       │
│      [defaultOpen={true}, Collapsible]                              │
│      Selector Vista: [Proyectos] | Rubros por proyecto              │
│      Tabla detallada con filtros y agrupación                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Leyenda:**
- `[▼]` = Expandido por defecto (defaultOpen={true})
- `[▶]` = Colapsado por defecto (defaultOpen={false})
- `[Always Visible]` = Siempre visible, no colapsable

---

## 🗂️ Mapeo de Componentes a Archivos

### Posición #1: Resumen Ejecutivo - Cartera Completa
**Nombre en español:** Resumen Ejecutivo - Cartera Completa  
**Componente:** `ForecastSummaryBar`  
**Archivo:** `src/features/sdmt/cost/Forecast/components/ForecastSummaryBar.tsx`  
**Estado:** Always visible (no collapsible)  
**Props clave:**
- `totalBudget`, `totalForecast`, `totalActual`
- `consumedPercent`, `varianceBudget`
- `useMonthlyBudget`, `monthlyBudgetSum`, `budgetAllIn`

**Renderizado en:** `SDMTForecast.tsx` línea ~2515
```typescript
{isPortfolioView && summaryBarKpis && (
  <ForecastSummaryBar {...summaryBarKpis} />
)}
```

---

### Posición #2: Cuadrícula de Pronóstico (12 Meses)
**Nombre en español:** Cuadrícula de Pronóstico (12 Meses)  
**Componente:** `ForecastRubrosTable` (instancia canónica)  
**Archivo:** `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx`  
**Estado:** Collapsible, `defaultOpen={true}`  
**Props clave:**
- `categoryTotals`, `categoryRubros`
- `projectTotals`, `projectRubros`
- `portfolioTotals`, `monthlyBudgets`
- `defaultFilter="labor"`

**Renderizado en:** `SDMTForecast.tsx` línea ~2540 (dentro de portfolio wrapper)
```typescript
<Collapsible defaultOpen={true}>
  <Card>
    <CardHeader>
      <CardTitle>Cuadrícula de Pronóstico (12 Meses)</CardTitle>
    </CardHeader>
    <CollapsibleContent>
      <ForecastRubrosTable ... />
    </CollapsibleContent>
  </Card>
</Collapsible>
```

**Nota importante:** Esta es la **única instancia** de la cuadrícula de 12 meses. El bloque duplicado fue eliminado.

---

### Posición #3: Matriz del Mes — Vista Ejecutiva
**Nombre en español:** Matriz del Mes — Vista Ejecutiva  
**Componente:** `MonthlySnapshotGrid`  
**Archivo:** `src/features/sdmt/cost/Forecast/components/MonthlySnapshotGrid.tsx`  
**Estado:** Always visible (not wrapped in Collapsible)  
**Props clave:**
- `forecastData`, `lineItems`
- `monthlyBudgets`, `useMonthlyBudget`
- `getCurrentMonthIndex`
- `onScrollToDetail`, `onNavigateToReconciliation`, `onNavigateToCostCatalog`

**Renderizado en:** `SDMTForecast.tsx` línea ~2600
```typescript
{isPortfolioView && (
  <MonthlySnapshotGrid
    forecastData={forecastData}
    lineItems={portfolioLineItems}
    ...
  />
)}
```

**Condición de visibilidad:**
```typescript
(forecastData.length > 0 || portfolioLineItems.length > 0)
```

---

### Posición #4: Resumen de Portafolio
**Nombre en español:** Resumen de Portafolio  
**Componente:** `PortfolioSummaryView`  
**Archivo:** `src/features/sdmt/cost/Forecast/PortfolioSummaryView.tsx`  
**Estado:** Collapsible, `defaultOpen={true}`  
**Feature Flag:** `VITE_FINZ_HIDE_PROJECT_SUMMARY` (si `true`, toda la sección se oculta)  
**Props clave:**
- `forecastData`, `lineItems`
- `monthlyBudgetAllocations`, `runwayMetrics`
- `selectedPeriod`, `allProjects`

**Sub-flags internos:**
- `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED`
- `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST`
- `VITE_FINZ_HIDE_RUNWAY_METRICS`

**Renderizado en:** `SDMTForecast.tsx` línea ~2670
```typescript
{!HIDE_PROJECT_SUMMARY && !loading && (
  <Collapsible defaultOpen={true}>
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Portafolio</CardTitle>
      </CardHeader>
      <CollapsibleContent>
        <PortfolioSummaryView ... />
      </CollapsibleContent>
    </Card>
  </Collapsible>
)}
```

---

### Posición #5: Simulador de Presupuesto
**Nombre en español:** Simulador de Presupuesto  
**Componente:** `BudgetSimulatorCard` (inline rendering)  
**Archivo:** Código inline en `SDMTForecast.tsx`  
**Estado:** Collapsible, `defaultOpen={false}`  
**Descripción:** Editor de presupuesto anual con distribución mensual y visualización de consumo.

**Renderizado en:** `SDMTForecast.tsx` línea ~2740
```typescript
<Collapsible defaultOpen={false}>
  <Card className="border-2 border-primary/20">
    <CardHeader>
      <CardTitle>Simulador de Presupuesto</CardTitle>
    </CardHeader>
    <CollapsibleContent>
      {/* Annual Budget Editor */}
      {/* Monthly Distribution */}
      {/* Consumption Visualization */}
    </CollapsibleContent>
  </Card>
</Collapsible>
```

---

### Posición #6: Gráficos de Tendencias
**Nombre en español:** Gráficos de Tendencias  
**Componente:** `ForecastChartsPanel`  
**Archivo:** `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`  
**Estado:** Collapsible, `defaultOpen={false}`  
**Props clave:**
- `portfolioTotals`
- `categoryTotals`
- `formatCurrency`
- `projectsPerMonth` (NUEVO - serie de barras M/M)

**Renderizado en:** `SDMTForecast.tsx` línea ~2900
```typescript
<Collapsible defaultOpen={false}>
  <Card>
    <CardHeader>
      <CardTitle>Gráficos de Tendencias</CardTitle>
    </CardHeader>
    <CollapsibleContent>
      <ForecastChartsPanel
        portfolioTotals={portfolioTotalsForCharts}
        categoryTotals={categoryTotals}
        projectsPerMonth={projectsPerMonth}
        formatCurrency={formatCurrency}
      />
    </CollapsibleContent>
  </Card>
</Collapsible>
```

**Características:**
- Dual-axis chart con ComposedChart (recharts)
- Líneas: Forecast, Actual, Budget (eje Y izquierdo)
- Barras: Proyectos M/M (eje Y derecho, color naranja)
- Tooltip personalizado: "Mes N — Proyectos: X"

---

### Posición #7: Monitoreo Mensual de Proyectos vs. Presupuesto
**Nombre en español:** Monitoreo mensual de proyectos vs. presupuesto  
**Componente:** `ForecastRubrosTable` (segunda instancia - vista Monitoreo)  
**Archivo:** `src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx` (mismo componente, diferentes props)  
**Estado:** Collapsible, `defaultOpen={true}`  
**Características especiales:**
- Selector de Vista: "Proyectos" vs "Rubros por proyecto"
- Filtros avanzados
- Agrupación por proyecto con rubros anidados

**Renderizado en:** `SDMTForecast.tsx` línea ~2980
```typescript
<Collapsible defaultOpen={true}>
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Monitoreo mensual de proyectos vs. presupuesto</CardTitle>
        <div className="flex items-center gap-2">
          {/* Vista selector: Por Proyecto / Rubros por proyecto */}
          <BreakdownModeSelector ... />
        </div>
      </div>
    </CardHeader>
    <CollapsibleContent>
      <ForecastRubrosTable
        categoryTotals={categoryTotals}
        categoryRubros={categoryRubros}
        projectTotals={projectTotals}
        projectRubros={projectRubros}
        ...
      />
    </CollapsibleContent>
  </Card>
</Collapsible>
```

**Diferencias con #2:**
- Posición diferente en el layout
- Puede tener diferentes filtros por defecto
- Se enfoca en vista de Monitoreo vs. Vista de Cuadrícula

---

## 🎛️ Feature Flags que Afectan el Layout

| Flag | Componente Afectado | Comportamiento |
|------|---------------------|----------------|
| `VITE_FINZ_NEW_FORECAST_LAYOUT` | Layout completo | `true` = nuevo layout (actual), `false` = layout antiguo |
| `VITE_FINZ_HIDE_PROJECT_SUMMARY` | #4 - PortfolioSummaryView | `true` = oculta toda la sección #4 |
| `VITE_FINZ_HIDE_REAL_ANNUAL_KPIS` | KPI cards (no en lista) | `true` = oculta KPIs anuales |
| `VITE_FINZ_SHOW_KEYTRENDS` | Key Trends (no en lista) | `true` = muestra tablas de tendencias clave |
| `VITE_FINZ_HIDE_KEY_TRENDS` | Key Trends (no en lista) | `true` = fuerza ocultar (precedencia sobre SHOW) |
| `VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED` | #4 - tabla interna | `true` = tabla transpuesta (meses como columnas) |
| `VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST` | #4 - lista interna | `true` = oculta lista expandible de proyectos |
| `VITE_FINZ_HIDE_RUNWAY_METRICS` | #4 - runway section | `true` = oculta métricas de runway |

**Nota:** El nuevo layout (`VITE_FINZ_NEW_FORECAST_LAYOUT='true'`) es ahora el estándar. El código de OLD LAYOUT fue eliminado en commit 1e7a41d.

---

## 📋 Condiciones de Renderizado

### General
Todos los componentes #1-#7 solo se renderizan cuando:
```typescript
isPortfolioView === true
```

### Específicas por Componente

**#1 - ForecastSummaryBar:**
```typescript
isPortfolioView && summaryBarKpis
```

**#2 - Cuadrícula de Pronóstico:**
```typescript
isPortfolioView && !loading && (forecastData.length > 0 || portfolioLineItems.length > 0)
```

**#3 - MonthlySnapshotGrid:**
```typescript
isPortfolioView && (forecastData.length > 0 || portfolioLineItems.length > 0)
```

**#4 - PortfolioSummaryView:**
```typescript
!HIDE_PROJECT_SUMMARY && !loading && isPortfolioView
```

**#5 - Simulador de Presupuesto:**
```typescript
isPortfolioView && budgetSimulation.enabled && budgetTotal > 0
```

**#6 - ForecastChartsPanel:**
```typescript
isPortfolioView && portfolioTotalsForCharts
```

**#7 - Monitoreo:**
```typescript
isPortfolioView && (forecastData.length > 0 || portfolioLineItems.length > 0)
```

---

## 🔧 Cambios Técnicos Implementados

### Commit 1e7a41d - Reordering
- **Eliminado:** OLD LAYOUT sections (~200 líneas)
- **Consolidado:** Todos los componentes de portfolio en una sola sección
- **Reordenado:** Componentes según estructura #1-#7
- **Agregado:** Collapsible wrapper para ForecastChartsPanel
- **Restaurado:** Título "Resumen de Portafolio" en posición #4

### Commit 5d60da5 - Projects Chart
- **Agregado:** Computación de `projectsPerMonth` usando `Map<number, Set<string>>`
- **Agregado:** Dual-axis ComposedChart en ForecastChartsPanel
- **Agregado:** Bar series para proyectos M/M con eje Y secundario
- **Agregado:** Custom tooltip con formato "Mes N — Proyectos: X"

### Commit b2cbfb8 - Grid Visibility
- **Actualizado:** Predicados de renderizado para incluir `portfolioLineItems.length > 0`
- **Agregado:** Debug logging para feature flags en modo desarrollo

### Commit 4b27109 - OLD Layout Fix
- **Actualizado:** Condiciones de renderizado en OLD LAYOUT paths (antes de eliminación)

---

## 📊 Diagrama de Flujo de Datos

```
SDMTForecast.tsx (línea ~195)
    │
    ├─ Compute projectsPerMonth (useMemo)
    │  └─ Input: forecastData
    │  └─ Output: Array<{month, count}>
    │
    ├─ Compute categoryTotals (useMemo)
    ├─ Compute projectTotals (useMemo)
    ├─ Compute portfolioTotalsForCharts (useMemo)
    │
    └─ Render Pipeline (isPortfolioView):
       │
       ├─> #1: ForecastSummaryBar
       │         └─ Props: summaryBarKpis
       │
       ├─> #2: ForecastRubrosTable (Cuadrícula)
       │         └─ Props: categoryTotals, categoryRubros,
       │                   projectTotals, projectRubros
       │
       ├─> #3: MonthlySnapshotGrid
       │         └─ Props: forecastData, portfolioLineItems
       │
       ├─> #4: PortfolioSummaryView
       │         └─ Props: forecastData, lineItems,
       │                   monthlyBudgetAllocations, runwayMetrics
       │         └─ Internal flags: ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED,
       │                            HIDE_EXPANDABLE_PROJECT_LIST,
       │                            HIDE_RUNWAY_METRICS
       │
       ├─> #5: BudgetSimulatorCard (inline)
       │         └─ State: budgetSimulation
       │
       ├─> #6: ForecastChartsPanel
       │         └─ Props: portfolioTotalsForCharts,
       │                   categoryTotals,
       │                   projectsPerMonth ← NUEVO
       │
       └─> #7: ForecastRubrosTable (Monitoreo)
                 └─ Props: same as #2, different context
                 └─ Feature: breakdownMode selector
```

---

## 🎨 Convenciones de Nombrado (Español ↔ Técnico)

| Nombre en Español | Nombre Técnico (Código) | Archivo |
|-------------------|-------------------------|---------|
| Resumen Ejecutivo - Cartera Completa | `ForecastSummaryBar` | `components/ForecastSummaryBar.tsx` |
| Cuadrícula de Pronóstico (12 Meses) | `ForecastRubrosTable` | `components/ForecastRubrosTable.tsx` |
| Matriz del Mes — Vista Ejecutiva | `MonthlySnapshotGrid` | `components/MonthlySnapshotGrid.tsx` |
| Resumen de Portafolio | `PortfolioSummaryView` | `PortfolioSummaryView.tsx` |
| Simulador de Presupuesto | `BudgetSimulatorCard` | Inline en `SDMTForecast.tsx` |
| Gráficos de Tendencias | `ForecastChartsPanel` | `components/ForecastChartsPanel.tsx` |
| Monitoreo mensual de proyectos vs. presupuesto | `ForecastRubrosTable` (2nd instance) | `components/ForecastRubrosTable.tsx` |
| Proyectos M/M (gráfico de barras) | `projectsPerMonth` series | Computed in `SDMTForecast.tsx` |
| Por Categoría | `viewMode: 'category'` | Internal state in `ForecastRubrosTable` |
| Por Proyecto | `viewMode: 'project'` | Internal state in `ForecastRubrosTable` |
| Rubros por Categoría | Category-based grouping | `categoryTotals`, `categoryRubros` |
| Rubros por Proyecto | Project-based grouping | `projectTotals`, `projectRubros` |

---

## ✅ Checklist de Verificación Visual

Al revisar el dashboard en modo TODOS/Portfolio, verifica:

- [ ] **#1** - Resumen Ejecutivo visible en la parte superior
- [ ] **#2** - Cuadrícula de Pronóstico (12 Meses) **expandida** por defecto
- [ ] **#3** - Matriz del Mes siempre visible (no colapsable)
- [ ] **#4** - Resumen de Portafolio **expandido** por defecto, título correcto
- [ ] **#5** - Simulador de Presupuesto **colapsado** por defecto
- [ ] **#6** - Gráficos de Tendencias **colapsado** por defecto
- [ ] **#6** - Gráfico de Tendencia Mensual incluye barras naranjas (Proyectos M/M)
- [ ] **#6** - Tooltip muestra "Mes N — Proyectos: X" al pasar sobre barras
- [ ] **#7** - Monitoreo mensual **expandido** por defecto
- [ ] **#7** - Selector "Vista" presente con opciones "Proyectos" / "Rubros por proyecto"
- [ ] **GENERAL** - Solo UNA instancia de cuadrícula de 12 meses (no duplicados)
- [ ] **GENERAL** - Orden correcto: 1 → 2 → 3 → 4 → 5 → 6 → 7
- [ ] **FLAGS** - `VITE_FINZ_HIDE_PROJECT_SUMMARY=true` oculta componente #4
- [ ] **FLAGS** - Console muestra debug log con valores de flags (modo dev)

---

## 📝 Notas de Implementación

### Eliminación del OLD LAYOUT
El código que manejaba `!NEW_FORECAST_LAYOUT_ENABLED` fue eliminado completamente en commit 1e7a41d porque:
1. `VITE_FINZ_NEW_FORECAST_LAYOUT` ahora defaults a `'true'` en deploy-ui.yml
2. El nuevo layout es la experiencia estándar
3. Mantener ambos paths generaba duplicación y bugs

### Predicados de Visibilidad Mejorados
Todos los grids ahora verifican:
```typescript
(forecastData.length > 0 || portfolioLineItems.length > 0)
```

Esto evita que los grids desaparezcan cuando `forecastData` está vacío pero `portfolioLineItems` tiene datos.

### Proyectos M/M - Cálculo
```typescript
const projectsPerMonth = useMemo(() => {
  const monthlyProjects = new Map<number, Set<string>>();
  
  forecastData.forEach((cell) => {
    const month = cell.month;
    const projectId = cell.projectId;
    
    if (!month || !projectId || month < 1 || month > 12) return;
    
    if (!monthlyProjects.has(month)) {
      monthlyProjects.set(month, new Set());
    }
    monthlyProjects.get(month)!.add(projectId);
  });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const count = monthlyProjects.get(month)?.size || 0;
    return { month, count };
  });
}, [isPortfolioView, forecastData]);
```

**Ventajas:**
- Usa `Set` para eliminar duplicados automáticamente
- Un proyecto con múltiples líneas en el mismo mes cuenta solo una vez
- Genera array de 12 meses con ceros para meses sin proyectos

---

## 🔗 Referencias

- **Feature Flags:** `docs/FEATURE_FLAGS.md`
- **Workflow:** `.github/workflows/deploy-ui.yml`
- **Environment:** `.env.example`
- **Main Component:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`
- **Charts Component:** `src/features/sdmt/cost/Forecast/components/ForecastChartsPanel.tsx`
- **Tests:** `src/features/sdmt/cost/Forecast/__tests__/ForecastChartsPanel.test.ts`

---

## 📅 Historial de Cambios

| Fecha | Commit | Cambio |
|-------|--------|--------|
| 2026-01-17 | 1e7a41d | Reordenamiento completo de componentes (#1-#7) |
| 2026-01-17 | 244ffcb | Code review feedback - imports alfabetizados, constantes extraídas |
| 2026-01-17 | a69f555 | Tests unitarios para ForecastChartsPanel |
| 2026-01-17 | 5d60da5 | Proyectos M/M chart, duplicates removed, título corregido |
| 2026-01-17 | 4b27109 | Grid visibility fix - OLD layout paths |
| 2026-01-17 | b2cbfb8 | Grid visibility fix - NEW layout, debug logging |

---

**Documento creado:** 2026-01-17  
**Última actualización:** 2026-01-17  
**Versión:** 1.0  
**Autor:** GitHub Copilot (automated documentation)
