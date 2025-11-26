# Finanzas "K" Navigation ReferenceError

## What happened
In production bundles, the Finanzas navigation entry points failed with a runtime error:

```
ReferenceError: Cannot access 'k' before initialization
```

The stack trace pointed at the compiled navigation bundle. The minifier reduced one of our derived navigation flags to `k` and emitted code that referenced it before initialization, triggering the temporal dead zone (TDZ) error.

## Root cause
Within `src/components/Navigation.tsx`, `isFinanzasNavContext` was declared before `isPmoContext` even though it referenced that value. While this order is technically valid in source form, the production build’s minification step reordered variables, causing the generated `k` binding (`isPmoContext`) to be read before it was initialized. That produced the TDZ ReferenceError during runtime navigation checks.

## Fix applied
We now declare `isPmoContext` first and clearly document the dependency ordering so the bundler cannot emit pre-initialization reads. This prevents the TDZ condition that surfaced as the `k` ReferenceError.

## How to prevent regressions
- Keep dependent derived flags declared after their prerequisites in `Navigation.tsx`.
- When touching navigation context calculations, preserve the documented ordering or consolidate them inside a single `useMemo` to avoid minifier reordering.
- If a similar TDZ error appears again in production, inspect derived flags in `Navigation.tsx` to ensure none are referenced before declaration after build-time transformations.
