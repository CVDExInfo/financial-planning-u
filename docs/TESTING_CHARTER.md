# Finanzas SD – Testing Charter

1. Every change that can affect behavior (API, DynamoDB, Lambda, UI data flow, calculations) **must**:
   - Have at least one **explicit test script** (CLI, Newman, Jest, Playwright, etc.).
   - Be executed against the **tester credential** defined in env (Cognito test user).

2. **No fabricated results**:
   - AI assistants (Copilot, GPT-5, Claude, etc.) are allowed to propose commands and test scripts, but **must not claim** they ran tests or that tests passed.
   - Any “passing results” recorded in docs (Evidence Pack) must be:
     - Copy–pasted from local terminal output, or
     - Copy–pasted from GitHub Actions logs.
   - Assistants must phrase results as “expected outcome” unless real logs are shown.

3. Evidence requirements:
   - For each module touched (Catalog, Forecast, Reconciliation, Changes, Handoff, Projects list, etc.), there must be:
     - A `tests/finanzas/<module>/run-<module>-tests.sh` script, and
     - Corresponding entries in `docs/EVIDENCE_FINZ.md` with command lines + selected output.
