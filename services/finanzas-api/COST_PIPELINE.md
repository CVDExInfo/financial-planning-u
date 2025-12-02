# SDMT Cost Data Flow (Catalog → Allocations → Forecast)

When the SDMT Cost Catalog adds a line item, the UI calls `POST /projects/{projectId}/rubros` with a payload that includes the rubro id plus optional cost metadata such as `qty`, `unitCost`, `recurring`, and `duration` (e.g., `"M1-M12"`).

The rubros handler now:
- Persists the attachment in the **rubros** table under `pk=PROJECT#{projectId}`, `sk=RUBRO#{rubroId}` with `qty`, `unit_cost`, `currency`, `recurring/one_time`, `start_month/end_month`, and `total_cost`.
- Mirrors those costs into the **allocations** table as monthly planned/forecast rows (`pk=PROJECT#{projectId}`, `sk=ALLOC#{rubroId}#M{month}`) so that forecast aggregation sees non-zero values immediately.

Read paths:
- `GET /projects/{projectId}/rubros` and `GET /line-items?project_id=...` return the enriched rubro attachment (qty, unit_cost, total_cost, schedule) so the Catalog and dropdowns can compute totals.
- `GET /plan/forecast` prefers allocations; if none exist yet, it falls back to deriving monthly amounts from rubro attachments so charts never drop to zero when a project only has catalog data.
