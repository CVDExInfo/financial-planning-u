# DashboardV2 Migration Guide

## Overview

DashboardV2 is a complete re-architecture of the forecast dashboard with:
- **Single-call aggregation** via portfolio forecast endpoint
- **Virtualized grid** supporting 10K+ rows × 60 months
- **Optimistic updates** with conflict resolution
- **Feature-flagged rollout** with zero-downtime migration

## Feature Flags

### Environment Variables

```bash
# Enable DashboardV2 (default: false)
VITE_DASHBOARD_V2_ENABLED=false

# Enable edit capabilities (default: false)
VITE_DASHBOARD_V2_EDIT=false

# Force read-only mode (default: false)
VITE_DASHBOARD_V2_READONLY=false
```

### Rollout Strategy

1. **Phase 1: Staging (Week 1)**
   - Deploy with `VITE_DASHBOARD_V2_ENABLED=true` and `VITE_DASHBOARD_V2_EDIT=false`
   - Run automated contract and E2E tests
   - Manual QA by PMO team (read-only mode)

2. **Phase 2: Internal Canary (Week 2)**
   - Enable for 5 PMO users
   - Monitor metrics for 48-72 hours
   - Collect feedback on UX and performance

3. **Phase 3: Edit Mode (Week 3)**
   - Enable `VITE_DASHBOARD_V2_EDIT=true` for PMO role
   - Monitor bulk upsert metrics and conflict rates
   - Verify audit logs

4. **Phase 4: Gradual Ramp (Week 4-5)**
   - Increase user group to 25%, then 50%, then 75%
   - Monitor error rates and p95 latency
   - Zero critical alerts required to proceed

5. **Phase 5: Full Cutover (Week 6)**
   - Enable for all users
   - Keep legacy `SDMTForecast` available via fallback flag
   - Monitor for 2 weeks before deprecating legacy

## Architecture

### Data Flow

```
┌─────────────────┐
│   DashboardV2   │
│                 │
│  ┌───────────┐  │
│  │  TopBar   │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │ Executive │  │
│  │  Summary  │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Monthly  │  │
│  │  Budget   │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │ Forecast  │  │
│  │   Grid    │  │ ◄─── react-window (virtualized)
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Charts   │  │
│  └───────────┘  │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ useDashboardData │
│   (React Query)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      ┌─────────────────────┐
│ finanzasClient   │─────►│ GET /portfolio/     │
│                  │      │     forecast        │
│                  │      │                     │
│ (with mock       │      │ POST /portfolio/    │
│  fallback)       │◄─────│     bulk-upsert-    │
└──────────────────┘      │     forecast        │
                          └─────────────────────┘
```

### Component Hierarchy

```
DashboardV2
├── TopBar
│   ├── ViewModeSelector (portfolio | project)
│   ├── PeriodSelector (12 | 24 | 36 | 60 months)
│   ├── YearSelector
│   └── ActionButtons (Save, Export)
├── ExecutiveSummary (Position #1)
│   └── KPI Cards (Planned, Forecast, Actual, Variance, Runway)
├── MonthlyBudgetPanel (Position #2, collapsible)
│   ├── AnnualBudgetInput
│   └── MonthlyBudgetGrid (12 months)
├── ForecastGridWrapper (Position #3)
│   └── ForecastGrid
│       ├── StickyHeaderRow
│       ├── VirtualizedRows (react-window)
│       └── EditableCell (with optimistic updates)
├── MonthlySnapshotGrid (Position #4)
│   └── ExecutiveMatrix
└── ForecastChartsPanel (Position #5)
    ├── TrendChart (LineChart)
    └── VarianceChart (StackedColumns)
```

## API Contract

See `openapi/portfolio-forecast.yaml` for full specification.

### Key Endpoints

#### GET /portfolio/forecast

```
GET /portfolio/forecast?year=2024&months=12
```

Response:
```json
{
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "year": 2024,
    "months": 12,
    "currency": "USD"
  },
  "summary": {
    "totalPlanned": 1000000,
    "totalActual": 850000,
    "totalForecast": 950000,
    "variance": -50000,
    "variancePercent": -5.0
  },
  "rubros": [...],
  "projects": [...]
}
```

#### POST /portfolio/bulk-upsert-forecast

```json
{
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "projectId": "proj-123",
      "canonicalRubroId": "MOD-ING",
      "monthIndex": 0,
      "value": 50000,
      "valueType": "forecast",
      "expected_last_updated": "2024-01-15T10:25:00Z"
    }
  ]
}
```

## Testing Strategy

### Unit Tests
- `src/lib/forecast/__tests__/` - Forecast calculation logic
- `src/lib/rubros/__tests__/` - Rubro normalization logic
- Target: 80% coverage

### Integration Tests
- `tests/integration/useDashboardData.spec.ts` - Data hook with MSW mocks
- Verify totals parity with server

### Contract Tests
- `tests/contract/` - OpenAPI schema validation
- Run against staging API

### E2E Tests
- `tests/e2e/dashboard.spec.ts` - Full user workflows
- Scenarios: load, navigate, edit, save, verify

### Performance Tests
- `perf/k6/portfolio_load.js` - Load testing
- Targets: p95 < 800ms (API), TTFB < 2s (UI)

## Monitoring & Alerts

### CloudWatch Metrics

- `GetPortfolioForecastErrors` - High error rate alert (>5 in 5min)
- `GetPortfolioForecastLatency` - p95 latency alert (>800ms)
- `BulkUpsertErrors` - High error rate alert (>10 in 5min)
- `DataAgeMinutes` - Stale data alert (>10 minutes)

### Custom Metrics

- Bulk upsert conflict rate (conflicts / total items)
- Dashboard load time (TTFB + render)
- Grid virtualization performance (FPS during scroll)

## Rollback Plan

### Immediate Rollback

If critical issues detected:

1. Set `VITE_DASHBOARD_V2_ENABLED=false` in environment
2. Redeploy UI bundle
3. Users automatically route to legacy `SDMTForecast`

### Partial Rollback

If issues affect specific users:

1. Use feature flag targeting by user role
2. Keep DashboardV2 enabled for PMO
3. Disable for other roles until fix deployed

## Data Integrity Guardrails

### Canonical Rubro Enforcement

- All rubro IDs **must** use canonical taxonomy
- Server validates and rejects non-canonical IDs
- UI adapter normalizes legacy IDs on display

### Optimistic Concurrency

- All writes include `expected_last_updated` timestamp
- Server returns 409 Conflict on mismatch
- UI prompts user to refresh and retry

### Idempotency

- All bulk upsert requests include unique `idempotencyKey`
- Server deduplicates repeat requests (24h TTL)
- Safe to retry on network failures

### Audit Logs

- All writes create audit records
- Include: user, timestamp, old_value, new_value, SHA
- Queryable via admin API

## Performance Optimization

### Grid Virtualization

- Horizontal virtualization: only render visible columns
- Vertical virtualization: only render visible rows
- Target: 60 FPS scrolling on 10K rows × 60 months

### Data Caching

- React Query cache: 30s stale time, 5min GC time
- No refetch on window focus
- Manual invalidation after mutations

### Bundle Size

- Lazy-load DashboardV2 components
- Code-split ForecastGrid from main bundle
- Target: <50KB gzipped for dashboard bundle

## Security Considerations

### Authorization

- Backend validates user has project access
- Read-only users cannot call bulk-upsert endpoint
- PMO/Admin roles required for edits

### Input Validation

- Server validates all numeric inputs (cents)
- Reject values outside reasonable bounds
- Sanitize all string inputs

### Rate Limiting

- Bulk upsert: max 1000 items per request
- API rate limit: 100 req/min per user
- Backoff on 429 Too Many Requests

## Troubleshooting

### Dashboard won't load

1. Check feature flag: `VITE_DASHBOARD_V2_ENABLED=true`
2. Check network: GET /portfolio/forecast returns 200
3. Check console: look for auth errors or network failures
4. Fallback: disable flag to use legacy dashboard

### Edits not saving

1. Check feature flag: `VITE_DASHBOARD_V2_EDIT=true`
2. Check user role: must have PMO/Admin privileges
3. Check for conflicts: look for 409 responses in network tab
4. Try refresh: get latest `last_updated` timestamps

### Performance issues

1. Check dataset size: reduce `months` parameter
2. Check virtualization: ensure react-window is active
3. Check network: look for slow API responses (>800ms)
4. Enable performance profiling in Chrome DevTools

## References

- [OpenAPI Spec](../openapi/portfolio-forecast.yaml)
- [SAM Template](../infra/template-portfolio-forecast.yaml)
- [Hooks Documentation](../src/hooks/README.md)
- [Component Library](../src/components/dashboard-v2/README.md)
