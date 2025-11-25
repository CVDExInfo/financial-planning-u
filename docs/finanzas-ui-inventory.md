# Finanzas UI inventory

## Route canonicalization
- `/` → `FinanzasHome` (home landing in Spanish when Finanzas is enabled; falls back to legacy HomePage otherwise).
- `/projects` → `ProjectsManager` (Finanzas project workspace; redirects home if Finanzas is disabled).
- `/catalog/rubros` → `RubrosCatalog` (canon for Rubros catalog in Spanish; redirects home if Finanzas is disabled).
- `/rules` → `AllocationRulesPreview` (Finanzas allocation rules; redirects home if Finanzas is disabled).
- `/adjustments` → `AdjustmentsManager` (Finanzas budget adjustments; redirects home if Finanzas is disabled).
- `/providers` → `ProvidersManager` (Finanzas providers/vendor console; redirects home if Finanzas is disabled).
