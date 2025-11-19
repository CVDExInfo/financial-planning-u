# Finanzas SD API Map

Generated from API `m3g6am67aj` (stage `dev`) on 2025-11-19 15:46 UTC.

| Method | Path | Lambda (integration) | Security |
| --- | --- | --- | --- |
| GET | /adjustments | `finanzas-sd-api-dev-AdjustmentsFn-gbjpgzr8WSEs` | CognitoJwt |
| POST | /adjustments | `finanzas-sd-api-dev-AdjustmentsFn-gbjpgzr8WSEs` | CognitoJwt |
| GET | /alerts | `finanzas-sd-api-dev-AlertsFn-CeoGnMfpbM6R` | CognitoJwt |
| GET | /allocation-rules | `finanzas-sd-api-dev-AllocationRulesGet-wwFS2QkQHg1Q` | CognitoJwt |
| POST | /baseline | `finanzas-sd-api-dev-BaselineFn-vmAkCcZuRCbt` | CognitoJwt |
| GET | /baseline/{baseline_id} | `finanzas-sd-api-dev-BaselineFn-vmAkCcZuRCbt` | CognitoJwt |
| GET | /catalog/rubros | `finanzas-sd-api-dev-CatalogFn-uigAsFMcg0uO` | None |
| POST | /close-month | `finanzas-sd-api-dev-CloseMonthFn-Z7KxJt6kU04V` | CognitoJwt |
| PUT | /handoff/{handoffId} | `finanzas-sd-api-dev-HandoffFn-d4vq1mjPNpze` | CognitoJwt |
| GET | /health | `finanzas-sd-api-dev-HealthFn-aZmlh3nlvqNA` | None |
| POST | /payroll/ingest | `finanzas-sd-api-dev-PayrollFn-jUdxSEgPHceA` | CognitoJwt |
| GET | /plan/forecast | `finanzas-sd-api-dev-ForecastFn-uLapRXmhP6PP` | None |
| GET | /prefacturas | `finanzas-sd-api-dev-PrefacturasFn-gRlRkUNaYe80` | CognitoJwt |
| POST | /prefacturas | `finanzas-sd-api-dev-PrefacturasFn-gRlRkUNaYe80` | CognitoJwt |
| GET | /projects | `finanzas-sd-api-dev-ProjectsFn-WJzowRSnvW4Y` | CognitoJwt |
| POST | /projects | `finanzas-sd-api-dev-ProjectsFn-WJzowRSnvW4Y` | CognitoJwt |
| PUT | /projects/{id}/allocations:bulk | `finanzas-sd-api-dev-AllocationsFn-QsTTVsVnmn7o` | CognitoJwt |
| GET | /projects/{id}/plan | `finanzas-sd-api-dev-PlanFn-3J5NDi5jj2LM` | CognitoJwt |
| GET | /projects/{projectId}/billing | `finanzas-sd-api-dev-BillingFn-ENYd4jdU0ilX` | CognitoJwt |
| GET | /projects/{projectId}/handoff | `finanzas-sd-api-dev-HandoffFn-d4vq1mjPNpze` | CognitoJwt |
| POST | /projects/{projectId}/handoff | `finanzas-sd-api-dev-HandoffFn-d4vq1mjPNpze` | CognitoJwt |
| GET | /projects/{projectId}/rubros | `finanzas-sd-api-dev-RubrosFn-17CzMCYNd5bX` | CognitoJwt |
| POST | /projects/{projectId}/rubros | `finanzas-sd-api-dev-RubrosFn-17CzMCYNd5bX` | CognitoJwt |
| DELETE | /projects/{projectId}/rubros/{rubroId} | `finanzas-sd-api-dev-RubrosFn-17CzMCYNd5bX` | CognitoJwt |
| GET | /providers | `finanzas-sd-api-dev-ProvidersFn-4bP995P1ZfIu` | CognitoJwt |
| POST | /providers | `finanzas-sd-api-dev-ProvidersFn-4bP995P1ZfIu` | CognitoJwt |
| POST | /uploads/docs | `finanzas-sd-api-dev-UploadDocumentFunction-4G31Sjd5VION` | CognitoJwt |

Security legend: `CognitoJwt` = Cognito authorizer enforced; `None` = route marked as public in OAS.