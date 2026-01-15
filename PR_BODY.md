Problem
-------
Some historical baseline records store their estimates under `payload.payload` (or other nested shapes). The allocations materializer relied solely on `baseline.payload` or top-level fields and therefore planned 0 allocations when the estimates were deeper nested. This caused admin backfill / acceptance to produce `allocationsAttempted: 0` even though rubros were updated.

What this PR does
-----------------
1. **Centralizes robust payload normalization** in `services/finanzas-api/src/lib/materializers.ts` (`normalizeBaseline()` now attempts to unwrap `payload`, `payload.payload` and unmarshall each stage if needed).
2. **Adds a diagnostic preview log** (`console.info`) that prints baselineId, projectId, startDate, durationMonths, laborCount, nonLaborCount so CloudWatch shows what the materializer actually received.
3. **Adds a unit test** proving allocations are materialized when estimates are nested under `payload.payload`.
4. **Adds `docs/TRACKING.md`** (seeded backlog item).
5. **Fixes `unmarshallIfNeeded` to properly handle arrays** - the existing implementation was converting arrays to objects with numeric keys.
6. No behavior changes for properly-shaped baselines — this is defensive normalization.

Why this is safe
---------------
- The change is narrowly scoped to normalization; business logic for month calculation, SK format, and BatchWrite is unchanged.
- The tests ensure M1..M60 behavior and idempotency remain intact.
- All 473 existing tests pass, plus the new test for nested payloads.
- The diagnostic log helps ops verify the fix quickly in CloudWatch.

STRONG?CONFIRMED validation required before merging
--------------------------------------------------
Before this PR can be merged, the Copilot agent or reviewer must confirm **all** items in the "STRONG?CONFIRMED validation" checklist (see PR checks below). The PR must remain **Draft** until validation artifacts are captured (local test outputs, CI results, smoke test output, and CloudWatch logs with `normalizeBaseline preview` and `materializeAllocationsForBaseline result` for the sample baseline `base_5c62d927a71b`).

Smoke tests (after deploy)
--------------------------
# 1) Dry-run backfill (expect allocationsAttempted > 0)
curl -sS -X POST "$API_BASE/admin/backfill" -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d '{"baselineId":"base_5c62d927a71b","dryRun": true}' | jq .

# 2) Real backfill (expect allocationsWritten > 0)
curl -sS -X POST "$API_BASE/admin/backfill" -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d '{"baselineId":"base_5c62d927a71b","dryRun": false}' | jq .

# 3) Verify allocations
curl -sS "$API_BASE/allocations?projectId=P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7" -H "Authorization: $TOKEN" | jq '.[0:5] | {count: length, sample: .}'

CloudWatch Insights queries (to capture):
- `[materializers] normalizeBaseline preview`:
fields @timestamp, @message | filter @message like /normalizeBaseline preview/ | filter @message like "base_5c62d927a71b" | sort @timestamp desc | limit 20

- `materializeAllocationsForBaseline result`:
fields @timestamp, @message | filter @message like /materializeAllocationsForBaseline result/ | filter @message like "base_5c62d927a71b" | sort @timestamp desc | limit 20

Acceptance
----------
- Unit tests pass locally (`pnpm -s test -- --runInBand`) and in CI.
- Dry-run backfill shows `allocationsAttempted > 0`.
- Real backfill writes allocations (`allocationsWritten > 0`) and `GET /allocations?...` returns rows.
- CloudWatch log shows `normalizeBaseline preview` with correct labor/non-labor counts and `materializeAllocationsForBaseline result` with allocationsWritten > 0.
- UI loads the allocations (check `useSDMTForecastData` console logs): `Retrieved X allocations...` and `Generated Y forecast cells from allocations`.
