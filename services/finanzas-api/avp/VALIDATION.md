# AVP Policy Store Validation (P3wQ5UBQ9YvLb4NaXmSTMG)

This folder now mirrors the live Amazon Verified Permissions policy store and the Cedar policy identified as `hhKNjToeFMfEtGyLuUjg6`.

## Schema alignment
- `schema.cedar` reflects the policy store namespace `finanzassd` with `User`, `UserGroup`, and `Application` entities.
- Actions are defined 1:1 with API Gateway routes, matching the schema JSON in the active store.
- The `User in UserGroup` relationship ensures Cognito group membership is represented for RBAC decisions.

## Policy `hhKNjToeFMfEtGyLuUjg6`
- Captured in `policies.cedar` with a direct `permit` for Cognito group `us-east-2_FyHLtOhiY|FIN` against the `finanzas-sd-api-dev` application resource.
- Action coverage matches the live policy, including forecast, baseline, prefacturas, billing, rubros, allocations, invoices, and health endpoints.

## How to apply
1. Deploy the policy store schema to `P3wQ5UBQ9YvLb4NaXmSTMG` (or import directly via the AVP console).
2. Ensure the policy with ID `hhKNjToeFMfEtGyLuUjg6` is present and enabled; if missing, apply `policies.cedar` as a static policy with that ID.
3. Validate Cognito tokens include `cognito:groups` with `FIN` membership so principals resolve to `finanzassd::UserGroup::"us-east-2_FyHLtOhiY|FIN"`.
