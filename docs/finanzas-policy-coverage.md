# Finanzas SD Policy Coverage

Comparison of API Gateway contract vs. Verified Permissions policy `hhKNjToeFMfEtGyLuUjg6` (generated 2025-11-19 15:46 UTC).

| Method | Path | Security | Cedar Action? | Notes |
| --- | --- | --- | --- | --- |
| GET | /adjustments | CognitoJwt | ✅ | Covered |
| POST | /adjustments | CognitoJwt | ✅ | Covered |
| GET | /alerts | CognitoJwt | ✅ | Covered |
| GET | /allocation-rules | CognitoJwt | ✅ | Covered |
| POST | /baseline | CognitoJwt | ❌ | Missing Cedar action |
| GET | /baseline/{baseline_id} | CognitoJwt | ❌ | Missing Cedar action |
| GET | /catalog/rubros | None | ✅ | Public route; Cedar bypass; Policy not required |
| POST | /close-month | CognitoJwt | ✅ | Covered |
| PUT | /handoff/{handoffId} | CognitoJwt | ❌ | Missing Cedar action |
| GET | /health | None | ✅ | Public route; Cedar bypass; Policy not required |
| POST | /payroll/ingest | CognitoJwt | ✅ | Covered |
| GET | /plan/forecast | None | ❌ | Public route; Cedar bypass |
| GET | /prefacturas | CognitoJwt | ❌ | Missing Cedar action |
| POST | /prefacturas | CognitoJwt | ❌ | Missing Cedar action |
| GET | /projects | CognitoJwt | ✅ | Covered |
| POST | /projects | CognitoJwt | ✅ | Covered |
| PUT | /projects/{id}/allocations:bulk | CognitoJwt | ✅ | Covered |
| GET | /projects/{id}/plan | CognitoJwt | ✅ | Covered |
| GET | /projects/{projectId}/billing | CognitoJwt | ❌ | Missing Cedar action |
| GET | /projects/{projectId}/handoff | CognitoJwt | ❌ | Missing Cedar action |
| POST | /projects/{projectId}/handoff | CognitoJwt | ❌ | Missing Cedar action |
| GET | /projects/{projectId}/rubros | CognitoJwt | ❌ | Missing Cedar action |
| POST | /projects/{projectId}/rubros | CognitoJwt | ❌ | Missing Cedar action |
| DELETE | /projects/{projectId}/rubros/{rubroId} | CognitoJwt | ❌ | Missing Cedar action |
| GET | /providers | CognitoJwt | ✅ | Covered |
| POST | /providers | CognitoJwt | ✅ | Covered |
| POST | /uploads/docs | CognitoJwt | ❌ | Missing Cedar action |

## Missing Cedar coverage (secured routes)
- post /baseline
- get /baseline/{baseline_id}
- put /handoff/{handoffId}
- get /prefacturas
- post /prefacturas
- get /projects/{projectId}/billing
- get /projects/{projectId}/handoff
- post /projects/{projectId}/handoff
- get /projects/{projectId}/rubros
- post /projects/{projectId}/rubros
- delete /projects/{projectId}/rubros/{rubroId}
- post /uploads/docs

## Policy actions with no matching API route
- get /prefacturas/webhook
- get /projects/{id}/rubros
- post /prefacturas/webhook
- post /projects/{id}/handoff
- post /projects/{id}/rubros