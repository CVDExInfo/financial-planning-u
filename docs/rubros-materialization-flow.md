# Rubros Materialization Flow (Baseline → SDMT)

## End-to-end flow
1. **PMO Baseline Creation** (`/baseline`)
   - Prefactura baseline is written to `finz_prefacturas` with:
     - `pk = BASELINE#{baselineId}`, `sk = METADATA`
     - `payload.labor_estimates[]` and `payload.non_labor_estimates[]`
2. **Materialization trigger** (SDMT “Materializar Ahora” / admin backfill)
   - Calls `materializeRubrosFromBaseline({ projectId, baselineId })`.
   - Loads the baseline payload from `finz_prefacturas` and generates rubros.
3. **Rubros persistence** (`finz_rubros`)
   - Each rubro is written with:
     - `pk = PROJECT#{projectId}`
     - `sk = RUBRO#{baselineId}#<type>#<stableLineItemId>`
     - `metadata.baseline_id = baselineId`
     - `linea_codigo` and `metadata.linea_codigo` for taxonomy mapping
4. **SDMT consumption**
   - Catalog/Forecast/Recon read rubros via `/projects/{projectId}/rubros`
   - Summary endpoint aggregates via `/projects/{projectId}/rubros-summary`

## Expected rubro schema (finz_rubros)
```json
{
  "pk": "PROJECT#P-123",
  "sk": "RUBRO#base_abc#labor#ingeniero-delivery-1",
  "rubroId": "base_abc#labor#ingeniero-delivery-1",
  "baselineId": "base_abc",
  "projectId": "P-123",
  "linea_codigo": "MOD-LEAD",
  "nombre": "Ingeniero Delivery",
  "descripcion": "Ingeniero Delivery (lead)",
  "category": "Labor",
  "qty": 1,
  "unit_cost": 1200000,
  "currency": "USD",
  "recurring": true,
  "one_time": false,
  "start_month": 1,
  "end_month": 12,
  "total_cost": 14400000,
  "metadata": {
    "baseline_id": "base_abc",
    "project_id": "P-123",
    "linea_codigo": "MOD-LEAD"
  }
}
```

## Troubleshooting checklist
- **Rubros written = 0**
  - Confirm `payload.labor_estimates` or `payload.non_labor_estimates` exist in `finz_prefacturas`.
  - Ensure `materializeRubrosFromBaseline` logs warnings for `UNMAPPED` taxonomy IDs.
- **Catalog shows empty**
  - Verify `/projects/{projectId}/rubros` returns entries with `metadata.baseline_id` matching the active baseline.
- **Rubros summary fails**
  - Confirm `/projects/{projectId}/rubros-summary` is deployed and returns CORS headers.
- **Forecast fallback shows error**
  - Check fallback logs and ensure allocations/rubros include a valid `projectId`.
- **Missing taxonomy mapping**
  - Validate `finz_rubros_taxonomia` includes the category/description combination.
  - Items without a match will be tagged with `linea_codigo = UNMAPPED`.
