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

### Posición #7A: ForecastRubrosAdapter — Compatibilidad y Migración Incremental
**Nombre en español:** Adaptador de Rubros (Capa de Compatibilidad)  
**Componente:** `ForecastRubrosAdapter`  
**Archivo:** `src/features/sdmt/cost/Forecast/components/ForecastRubrosAdapter.tsx`  
**Estado:** Feature-flagged (controlled by `VITE_ENABLE_RUBROS_ADAPTER`)  
**Propósito:** Compatibility layer para migración incremental de tabla legacy a `ForecastRubrosTable`

**Feature Flag:** `VITE_ENABLE_RUBROS_ADAPTER`
- `true` = Usa `ForecastRubrosAdapter` (delega a `ForecastRubrosTable`)
- `false` = Usa tabla legacy inline en `SDMTForecast.tsx`

**Arquitectura:**
```typescript
ForecastRubrosAdapter (Wrapper)
  └─> ForecastRubrosTable (Core Rendering)
  
Props Flow:
  SDMTForecast → ForecastRubrosAdapter → ForecastRubrosTable
```

**Props clave:**
- **Data:** `categoryTotals`, `categoryRubros`, `projectTotals`, `projectRubros`, `portfolioTotals`, `monthlyBudgets`
- **Callbacks:** `onSaveMonthlyBudget`, `onReconcile`, `onExport`
- **Control externo:** `externalViewMode`, `onViewModeChange` (controlled mode)
- **Materialización:** `materializationPending`, `materializationFailed`, `onRetryMaterialization`
- **Formato:** `formatCurrency`, `canEditBudget`

**Renderizado en:** `SDMTForecast.tsx` línea ~3851
```typescript
{FEATURE_FLAGS.ENABLE_RUBROS_ADAPTER ? (
  <ForecastRubrosAdapter
    categoryTotals={categoryTotals}
    categoryRubros={categoryRubros}
    projectTotals={projectTotals}
    projectRubros={projectRubros}
    portfolioTotals={portfolioTotalsForCharts}
    monthlyBudgets={monthlyBudgets}
    baselineDetail={baselineDetail}
    selectedPeriod={selectedPeriod}
    externalViewMode={breakdownMode === 'project' ? 'project' : 'category'}
    onViewModeChange={(v) => handleBreakdownModeChange(v === 'project' ? 'project' : 'rubros')}
    onSaveMonthlyBudget={handleSaveMonthlyBudget}
    formatCurrency={formatCurrency}
    canEditBudget={canEditBudget}
  />
) : (
  // Legacy inline table rendering
)}
```

**Características principales:**
1. **API pública idéntica:** Acepta las mismas props que la tabla legacy
2. **Delegación:** Delega renderizado core a `ForecastRubrosTable`
3. **Shims:** Implementa shims para características legacy no en `ForecastRubrosTable`
4. **Modo controlado:** Soporte para `externalViewMode` (sincroniza con `breakdownMode` de SDMTForecast)
5. **Callbacks preservados:** `onSaveMonthlyBudget`, `onReconcile`, `onExport`

**Comportamientos legacy preservados:**
- ✅ Control externo de viewMode (breakdownMode → externalViewMode)
- ✅ Edición inline de presupuesto mensual
- ✅ Formateo de moneda customizable
- ✅ Permisos de edición (`canEditBudget`)
- 🚧 Acciones de reconciliación (callback definido, UI pendiente)
- 🚧 Exportaciones (callback definido, UI pendiente)
- 🚧 Links a catálogo de rubros (pendiente)
- 🚧 Popovers de historial de cambios (pendiente)
- 🚧 Telemetría para rubros no emparejados (pendiente)

**TODOs pendientes en el adapter:**
```typescript
// TODO: Add materialization banner if baseline not materialized
// TODO: Add reconciliation modals (call onReconcile)
// TODO: Add export actions (call onExport)
// TODO: Add catalog links (link to canonical rubros catalog)
// TODO: Add change history popovers (show change request IDs)
// TODO: Add telemetry for unmatched rubros (log warnings)
```

**Plan de migración:**
1. **Fase 1 (Actual):** Feature flag `false` por defecto → Legacy table
2. **Fase 2:** Feature flag `true` en dev/staging → Testing con adapter
3. **Fase 3:** Feature flag `true` en producción → Adapter en vivo
4. **Fase 4:** Implementar TODOs pendientes → Feature parity completa
5. **Fase 5:** Eliminar código legacy → Adapter se convierte en default
6. **Fase 6:** Eliminar adapter wrapper → `ForecastRubrosTable` se usa directamente

**Testing:**
- ✅ Tests de paridad: `ForecastRubrosAdapter.legacyParity.spec.tsx`
- ✅ Tests de modo controlado: `ForecastRubrosTable.controlledView.spec.tsx`
- ✅ Tests de vista de proyecto: `ForecastRubrosTable.projectView.test.ts`
- ✅ Tests de proyecto único: `ForecastRubrosTable.singleProject.spec.tsx`
- ✅ Tests TDZ: `ForecastRubrosTable.tdz.test.ts`
- ✅ Tests de varianza: `ForecastRubrosTable.variance.test.ts`
- ✅ Tests de filtros: `ForecastRubrosTable.filter.test.tsx`
- ✅ Tests de normalización: `ForecastRubrosTable.filterNormalization.test.ts`

---

## 🎛️ Feature Flags que Afectan el Layout

| Flag | Componente Afectado | Comportamiento |
|------|---------------------|----------------|
| `VITE_FINZ_NEW_FORECAST_LAYOUT` | Layout completo | `true` = nuevo layout (actual), `false` = layout antiguo |
| `VITE_ENABLE_RUBROS_ADAPTER` | **#7A - ForecastRubrosAdapter** | **`true` = usa adapter (delega a ForecastRubrosTable), `false` = tabla legacy** |
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
- [ ] **#7A** - `VITE_ENABLE_RUBROS_ADAPTER=true` usa ForecastRubrosAdapter
- [ ] **#7A** - `VITE_ENABLE_RUBROS_ADAPTER=false` usa tabla legacy
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
| 2026-01-17 | TBD | **ForecastRubrosAdapter implementation and incremental migration support** |

---

## 🧪 QA Testing Guide - ForecastRubrosAdapter

### Prerequisites
1. Access to Finanzas module with forecast data
2. Console access for development mode logging
3. Ability to modify environment variables or `.env.development`

### Test Scenarios

#### Scenario 1: Feature Flag Toggle
**Objetivo:** Verificar que el feature flag controla correctamente qué componente se renderiza

**Steps:**
1. Set `VITE_ENABLE_RUBROS_ADAPTER=false` in `.env.development`
2. Reload app and navigate to Forecast (TODOS view)
3. Verify legacy table renders (check console for "[ForecastRubrosAdapter]" logs - should NOT appear)
4. Note the UI appearance and functionality
5. Set `VITE_ENABLE_RUBROS_ADAPTER=true`
6. Reload app and navigate to Forecast (TODOS view)
7. Verify adapter renders (check console for "[ForecastRubrosAdapter] Rendering with:" log)
8. Verify ForecastRubrosTable delegates rendering (check console for "[ForecastRubrosTable]" logs)

**Expected:**
- ✅ Flag `false` → Legacy table renders, NO adapter logs
- ✅ Flag `true` → Adapter renders, delegate logs appear
- ✅ No errors in console
- ✅ Data displays correctly in both modes

#### Scenario 2: ViewMode Synchronization (Controlled Mode)
**Objetivo:** Verificar que el modo controlado sincroniza viewMode entre SDMTForecast y el adapter

**Steps:**
1. Enable adapter: `VITE_ENABLE_RUBROS_ADAPTER=true`
2. Navigate to Forecast (TODOS view)
3. Open console and filter for "[ForecastRubrosAdapter]"
4. Click "Vista" selector in Monitoreo section
5. Select "Proyectos"
6. Observe console log: `controlledMode: true, externalViewMode: 'project'`
7. Verify table switches to project view
8. Select "Rubros por proyecto"
9. Observe console log: `externalViewMode: 'category'`
10. Verify table switches to category view

**Expected:**
- ✅ `externalViewMode` syncs with `breakdownMode` from SDMTForecast
- ✅ Table view updates immediately when selector changes
- ✅ No flicker or re-mount of table component
- ✅ Console shows `controlledMode: true`

#### Scenario 3: Budget Editing
**Objetivo:** Verificar que la edición de presupuestos funciona con el adapter

**Steps:**
1. Enable adapter: `VITE_ENABLE_RUBROS_ADAPTER=true`
2. Navigate to Forecast (TODOS view)
3. Ensure user has budget editing permissions (`canEditBudget=true`)
4. Click edit button on monthly budget row
5. Modify budget value for a month
6. Save changes
7. Verify `handleSaveMonthlyBudget` callback is invoked
8. Verify budget updates in UI

**Expected:**
- ✅ Budget edit UI appears
- ✅ Changes can be made and saved
- ✅ `onSaveMonthlyBudget` callback fires
- ✅ UI reflects updated budget values
- ✅ No console errors

#### Scenario 4: Data Parity (Legacy vs Adapter)
**Objetivo:** Verificar que adapter muestra los mismos datos que la tabla legacy

**Steps:**
1. Set `VITE_ENABLE_RUBROS_ADAPTER=false`
2. Navigate to Forecast (TODOS view)
3. Take screenshot of table data
4. Note total values for categories/projects
5. Export data if possible (mental note or screenshot)
6. Set `VITE_ENABLE_RUBROS_ADAPTER=true`
7. Reload and navigate to Forecast (TODOS view)
8. Compare table data with legacy
9. Verify totals match
10. Verify cell values match

**Expected:**
- ✅ All category totals match (12 months)
- ✅ All project totals match (if in project view)
- ✅ Portfolio totals match
- ✅ Budget values match
- ✅ Variance calculations match
- ✅ No data loss or corruption

#### Scenario 5: Materialization States
**Objetivo:** Verificar que adapter muestra indicadores de materialización

**Steps:**
1. Enable adapter: `VITE_ENABLE_RUBROS_ADAPTER=true`
2. Navigate to Forecast for a project with pending materialization
3. Verify warning banner appears (in dev mode)
4. Check console for materialization state logs
5. If retry button available, click it
6. Verify `onRetryMaterialization` callback fires

**Expected:**
- ✅ Dev mode shows amber banner when `materializationPending=true`
- ✅ Banner shows "Baseline materialization pending..." message
- ✅ Retry button appears when `onRetryMaterialization` provided
- ✅ Clicking retry invokes callback
- ✅ Production mode does NOT show dev banner (check separately)

#### Scenario 6: Filter and Grouping
**Objetivo:** Verificar que filtros y agrupaciones funcionan correctamente

**Steps:**
1. Enable adapter: `VITE_ENABLE_RUBROS_ADAPTER=true`
2. Navigate to Forecast (TODOS view)
3. Verify default filter is "Mano de Obra" (`defaultFilter="labor"`)
4. Change filter to "Todos"
5. Verify all rubros display
6. Change to "Por Categoría"
7. Verify grouped by category
8. Change to "Por Proyecto"
9. Verify grouped by project

**Expected:**
- ✅ Default filter applies on mount
- ✅ Filter changes work correctly
- ✅ Grouping switches smoothly
- ✅ No data loss when switching views
- ✅ Totals recalculate correctly

#### Scenario 7: Currency Formatting
**Objetivo:** Verificar que el formateo de moneda funciona

**Steps:**
1. Enable adapter: `VITE_ENABLE_RUBROS_ADAPTER=true`
2. Navigate to Forecast (TODOS view)
3. Verify currency values display with locale formatting (es-MX, USD)
4. Check format: "$X,XXX" (no decimals, comma separators)
5. Verify negative values display correctly (if any)

**Expected:**
- ✅ Default formatter: `es-MX` locale, USD currency
- ✅ No decimal places
- ✅ Comma thousands separators
- ✅ Dollar sign prefix
- ✅ Custom `formatCurrency` prop respected if provided

### Regression Testing

#### Critical Paths to Test
- [ ] Portfolio view (TODOS) loads without errors
- [ ] Single project view still works (adapter not used in single project)
- [ ] Budget editing flow (create, update, delete monthly budgets)
- [ ] Navigation to Reconciliation works
- [ ] Navigation to Cost Catalog works
- [ ] Export functionality (Excel/PDF) - when implemented
- [ ] Responsive layout on mobile/tablet
- [ ] Dark mode compatibility (if supported)

#### Performance Checks
- [ ] Initial render time < 2s for 100 projects
- [ ] ViewMode switch < 200ms
- [ ] Filter change < 200ms
- [ ] No memory leaks on repeated mount/unmount
- [ ] Console shows no unnecessary re-renders

### Known Limitations (TODOs)
- ⚠️ Reconciliation modals NOT yet implemented (callback defined)
- ⚠️ Export actions NOT yet implemented (callback defined)
- ⚠️ Catalog links NOT yet implemented
- ⚠️ Change history popovers NOT yet implemented
- ⚠️ Telemetry for unmatched rubros NOT yet implemented
- ⚠️ Materialization banner only in dev mode (prod UI pending)

### Reporting Issues
When reporting bugs, include:
1. Feature flag value: `VITE_ENABLE_RUBROS_ADAPTER=true/false`
2. Browser and version
3. Console logs (filter for "[ForecastRubrosAdapter]")
4. Screenshots of unexpected behavior
5. Steps to reproduce
6. Expected vs actual behavior

---

**Documento creado:** 2026-01-17  
**Última actualización:** 2026-01-17 (Adapter documentation added)  
**Versión:** 1.1  
**Autor:** GitHub Copilot (automated documentation)
