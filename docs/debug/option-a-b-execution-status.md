# Option A/B execution status (2025-12-14)

Attempted to execute the requested rubros normalization (Option A) and canonical project cleanup (Option B) steps. The process was blocked at the prerequisite backup step because AWS credentials are not available in the current environment. Without credentials, no DynamoDB backups or migrations were run.

Actions attempted:
- Verified AWS CLI availability and tried to create an on-demand backup for `finz_rubros` using the default region `us-east-2`.
- AWS CLI returned `Unable to locate credentials` and stopped before any backups or migrations could proceed.

Next steps required to complete Option A/B:
1. Configure valid AWS credentials for the intended non-prod stage (e.g., `dev`) in this environment.
2. Re-run the backup loop for all tables (`finz_rubros`, `finz_projects`, `finz_allocations`, `finz_payroll_actuals`, `finz_adjustments`).
3. Execute the rubros migration dry-run (`npx tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts --dry-run ...`), review/resolve unmapped rubros, then apply the migration once the report is clean.
4. Optionally run the canonical cleanup script in non-prod with `CONFIRM_CLEANUP=YES` after confirming backups.
5. Capture the resulting logs under `docs/debug/` as originally requested.

No database records were altered. Once credentials are available, the above steps can be rerun safely starting from backups.
