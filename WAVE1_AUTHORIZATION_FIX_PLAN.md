# Wave 1 Authorization Fix Plan

This plan sequences the work required to unblock the Finanzas SD module by aligning API Gateway, Cognito JWT auth, and AWS Verified Permissions (Cedar) coverage.

## 1. Pre-flight Validation (Day 0)
- **Owners:** Backend @valencia94, Security @fin-iam
- Confirm the current OpenAPI spec (`OAS30_m3g6am67aj_dev_with_apig_ext.json`) is the latest deployed interface.
- Snapshot existing Cedar store objects (`aws verifiedpermissions list-policies`) for rollback.
- Export CloudWatch metrics for the 11 endpoints currently returning 403s to measure improvement post-release.

## 2. Policy + Schema Updates (Day 1)
1. **Upload new Cedar policy**
   - File: `tmp/cedar-policy-updated.json`
   - Command:
     ```bash
     aws verifiedpermissions update-policy \
       --policy-store-id P3wQ5UBQ9YvLb4NaXmSTMG \
       --policy-id hhKNjToeFMfEtGyLuUjg6 \
       --definition file://tmp/cedar-policy-updated.json
     ```
   - Verify via `aws verifiedpermissions get-policy`.
2. **Schema check (no change)**
   - Confirm existing entity/action definitions already include `finanzassd::Action` typed actions; no schema deploy needed.

## 3. API Gateway & Lambda Consistency (Day 2)
- **Owner:** Backend
- Ensure every OAS route maps to a deployed Lambda (baseline, billing, rubros, prefacturas, uploads). For any missing handler, either remove from OAS or implement stub returning 501.
- Redeploy the HTTP API stage (`sam deploy` or `aws apigatewayv2 update-stage`) so that Lambda integrations reference the latest code.
- For endpoints the frontend should stop calling (e.g., `/projects/{id}/invoices` legacy paths), remove references from FE configs or provide 301/410 responses.

## 4. Frontend Alignment (Day 3)
- **Owner:** Frontend
- Update FE constants to use canonical OAS paths (e.g., `/projects/{id}/plan` vs `/projects/{projectId}/plan`) so future policy diffs remain deterministic.
- Remove dead calls: `/projects/{projectId}/line-items`, `/projects/{projectId}/catalog/rubros`, `/invoices/{id}/status` until backend support exists.
- Ship a small release toggling feature flags once backend confirms policy is live.

## 5. Verification & Monitoring (Day 4)
- Run smoke tests covering: baseline create/read, billing plan fetch, rubros CRUD, prefacturas upload, file presign.
- Confirm CloudWatch metrics show auth successes for previously failing routes.
- Add automated regression: nightly job comparing OAS routes to Cedar actions using the script built this week.

## 6. Communication & Rollback
- Notify Finance stakeholders that Wave 1 auth fixes are live; include list of unblocked workflows.
- If issues arise, revert policy via stored snapshot and redeploy previous Lambda bundle.

## Tracking
- Jira tickets: FINZ-281 (Cedar update), FINZ-284 (API redeploy), FINZ-287 (FE cleanup)
- Target completion: Week of Nov 24, 2025.
