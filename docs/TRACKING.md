# Pending Enhancements & Defects — SDMT / Finanzas

**Purpose:** lightweight repository backlog for pending enhancements and defects.

Owner: Diego / AIGOR
Triage cadence: Weekly (recommend Monday mornings CST)
Priority: P0 (Critical) / P1 (High) / P2 (Medium) / P3 (Low)

| ID | Title | Type | Reporter | Created | Priority | Status | Summary / Notes | Related PR / Issue |
|----|-------|------|----------|---------|----------|--------|-----------------|--------------------|
| T-001 | Backfill produced `allocationsAttempted=0` (payload nesting) | Defect | Diego | 2026-01-15 | P0 | Resolved (PR #874) | Rubros updated but allocations not created because `baseline.payload` nesting varied. Fix: `backfill` now unwraps payload/payload.payload. | PR #874 |
| T-002 | Preview log: count nested `payload.payload.labor_estimates` | Enhancement | Diego | 2026-01-15 | P3 | Open | One-line improvement to preview log to also count `payload.payload.labor_estimates` and `payload.payload.non_labor_estimates`. Low risk. | This PR |
| T-003 | Materializer: centralize payload normalization | Enhancement | AIGOR | 2026-01-15 | P2 | Open | Normalize baseline payload shapes in `materializers.ts` to avoid duplication across callers. Avoid further backfill/accept/hand-off regressions. | This PR |
| T-004 | Backfill automation for historical baselines missing allocations | Enhancement | Diego | 2026-01-15 | P1 | Open | Tooling: backfill all baselines missing allocations with batching + telemetry + ops guard. | TBD |
| T-005 | UI: show "allocations missing" data health warning | Enhancement | Diego | 2026-01-15 | P1 | Open | Add visible warning in Forecast UI when rubros exist but allocations are missing and materialization hasn't happened. | TBD |
