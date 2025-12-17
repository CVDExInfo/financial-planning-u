# SDMT Forecast ↔ Facturas Reconciliation Navigation Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SDMT Forecast View                           │
│                                                                 │
│  Project: Example Project                                      │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Forecast Grid - 12 Month View                          │   │
│  │                                                         │   │
│  │  Rubro         M1    M2    M3    ...                   │   │
│  │  ───────────────────────────────────────────────       │   │
│  │  Labor         P: $10K F: $10K A: $9K [🔗]            │   │
│  │                                      ↑                  │   │
│  │                               ExternalLink Icon         │   │
│  │                            (Always Visible Now)         │   │
│  │                                                         │   │
│  │  Cloud Infra   P: $5K  F: $5K  A: $0  [🔗]            │   │
│  │                                      ↑                  │   │
│  │                               Click to Add Factura      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ User clicks 🔗 icon
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  Navigation with Parameters:     │
        │  ?line_item=XXX                  │
        │  &month=Y                        │
        │  &returnUrl=/sdmt/cost/forecast  │
        └──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Facturas Reconciliation View                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Filtered View:                                          │   │
│  │ Filtrado: Labor - Month 2                               │   │
│  │ [X Limpiar Filtro] [← Volver a Pronóstico]            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ SCENARIO A: Factura Exists (actual > 0)                │   │
│  │                                                         │   │
│  │ Invoices Table shows existing factura:                 │   │
│  │ ┌────────────────────────────────────────────────┐    │   │
│  │ │ Rubro  Month  Amount  Status  File    Actions  │    │   │
│  │ │ Labor   M2   $9,000  Matched invoice.pdf [🔗]  │    │   │
│  │ └────────────────────────────────────────────────┘    │   │
│  │                                                         │   │
│  │ User can:                                               │   │
│  │ • View details                                          │   │
│  │ • Request correction                                    │   │
│  │ • Click "Volver a Pronóstico" to return                │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ SCENARIO B: No Factura (actual = 0)                    │   │
│  │                                                         │   │
│  │ Upload Dialog Opens Automatically:                      │   │
│  │ ┌──────────────────────────────────────────────┐      │   │
│  │ │ Subir Factura                                 │      │   │
│  │ │                                               │      │   │
│  │ │ Rubro: [Cloud Infra] ◄ Pre-selected         │      │   │
│  │ │ Mes Inicio: [2] ◄ Pre-selected               │      │   │
│  │ │ Mes Fin: [2] ◄ Pre-selected                  │      │   │
│  │ │ Monto: [ _____ ]                             │      │   │
│  │ │ Vendor: [ _____ ]                            │      │   │
│  │ │ Invoice Date: [ _____ ]                      │      │   │
│  │ │ File: [ Upload ]                             │      │   │
│  │ │                                               │      │   │
│  │ │        [Cancelar]  [Subir Factura]          │      │   │
│  │ └──────────────────────────────────────────────┘      │   │
│  │                                                         │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ User saves OR cancels
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  Navigation Back:                    │
        │  /sdmt/cost/forecast?_refresh=123456 │
        │                                      │
        │  • Invoice cache invalidated         │
        │  • _refresh param triggers reload    │
        └──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                SDMT Forecast View (Refreshed)                   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Forecast Grid - Data Reloaded                          │   │
│  │                                                         │   │
│  │  Rubro         M1    M2    M3    ...                   │   │
│  │  ───────────────────────────────────────────────       │   │
│  │  Labor         P: $10K F: $10K A: $9K [🔗]            │   │
│  │                (unchanged - already had data)           │   │
│  │                                                         │   │
│  │  Cloud Infra   P: $5K  F: $5K  A: $5K [🔗]            │   │
│  │                            ↑                            │   │
│  │                    NOW SHOWS NEW ACTUAL!               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## State Transitions

```
┌──────────────────┐
│  Forecast View   │
│  (Icon Visible)  │
└────────┬─────────┘
         │
         ├─ Click icon with actual > 0
         │  → Reconciliation (View/Edit Mode)
         │  → Tooltip: "View/Edit Factura"
         │
         └─ Click icon with actual = 0
            → Reconciliation (Create Mode)
            → Tooltip: "Add Factura / Enter Actuals"
            → Upload dialog opens automatically

┌────────────────────────┐
│  Reconciliation View   │
│  (Filtered + Dialog)   │
└───────┬────────────────┘
        │
        ├─ Save new factura
        │  → Navigate to returnUrl + _refresh
        │  → Forecast reloads data
        │  → New actuals visible
        │
        ├─ Cancel upload
        │  → Navigate to returnUrl (if present)
        │  → OR close dialog
        │  → No data changes
        │
        └─ Click "Volver a Pronóstico"
           → Navigate to returnUrl
           → Return to original context
```

## Component Communication

```
┌─────────────────────────────────────────────────┐
│            URL Parameters (State)               │
│                                                 │
│  Forecast → Reconciliation:                    │
│  • line_item: identifies the rubro             │
│  • month: identifies the period                │
│  • returnUrl: Forecast page URL                │
│                                                 │
│  Reconciliation → Forecast:                    │
│  • returnUrl params (preserved)                │
│  • _refresh: timestamp to trigger reload       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Data Refresh Mechanism                  │
│                                                 │
│  1. User saves factura in Reconciliation       │
│  2. invalidateInvoices() clears cache          │
│  3. Navigate with _refresh parameter           │
│  4. Forecast detects _refresh in URL           │
│  5. loadForecastData() fetches fresh data      │
│  6. getProjectInvoices() gets updated list     │
│  7. Actuals merged into forecast cells         │
│  8. Grid re-renders with new values            │
└─────────────────────────────────────────────────┘
```

## Key Implementation Details

### Forecast Component (SDMTForecast.tsx)

**Icon Display Logic (Line 909)**:
```typescript
// BEFORE: Only shows when actual > 0
{cell.actual > 0 && (
  <Button onClick={() => navigateToReconciliation(...)} />
)}

// AFTER: Always shows
<Button 
  onClick={() => navigateToReconciliation(...)}
  title={cell.actual > 0 ? 'View/Edit Factura' : 'Add Factura / Enter Actuals'}
/>
```

**Navigation with returnUrl (Lines 342-353)**:
```typescript
const navigateToReconciliation = (line_item_id: string, month?: number) => {
  const params = new URLSearchParams();
  params.set('line_item', line_item_id);
  if (month) params.set('month', month.toString());
  
  // NEW: Add returnUrl
  const currentPath = location.pathname + location.search;
  params.set('returnUrl', currentPath);
  
  navigate(`/sdmt/cost/reconciliation?${params.toString()}`);
};
```

**Refresh Detection (Lines 85-91)**:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(location.search);
  const refreshParam = urlParams.get('_refresh');
  if (refreshParam && selectedProjectId) {
    console.log('🔄 Forecast: Refreshing after reconciliation');
    loadForecastData();
  }
}, [location.search]);
```

### Reconciliation Component (SDMTReconciliation.tsx)

**ReturnUrl Extraction (Line 229)**:
```typescript
const returnUrl = urlParams.get("returnUrl");
```

**Pre-fill Form Data (Lines 231-241)**:
```typescript
useEffect(() => {
  if (filterLineItem) {
    setUploadFormData((prev) => ({
      ...prev,
      line_item_id: filterLineItem,
      month: filterMonth ? parseInt(filterMonth, 10) || 1 : 1,
      start_month: filterMonth ? parseInt(filterMonth, 10) || 1 : 1,  // NEW
      end_month: filterMonth ? parseInt(filterMonth, 10) || 1 : 1,    // NEW
    }));
    setShowUploadForm(true);
  }
}, [filterLineItem, filterMonth]);
```

**Navigate Back After Save (Lines 521-535)**:
```typescript
await Promise.all(uploadPromises);
toast.success("Factura y documento subidos exitosamente");

setShowUploadForm(false);
setUploadFormData(createInitialUploadForm());
await invalidateInvoices();

// NEW: Navigate back with refresh
if (returnUrl) {
  const separator = returnUrl.includes('?') ? '&' : '?';
  navigate(`${returnUrl}${separator}_refresh=${Date.now()}`);
}
```

**Back Button (Lines 783-789)**:
```typescript
{returnUrl && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate(returnUrl)}
    className="gap-1"
  >
    <ArrowLeft size={14} /> Volver a Pronóstico
  </Button>
)}
```
