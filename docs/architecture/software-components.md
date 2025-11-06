# Software Components Overview

```mermaid
graph TD
  subgraph Frontend (React + Vite)
    NAV[Navigation]
    APP[App Router /finanzas]
    CATALOG[Rubros Catalog View]
    RULES[Allocation Rules Preview]
    AUTH[AuthProvider / RoleProvider]
  end

  subgraph Backend (AWS SAM)
    APIGW[API Gateway HTTP API]
    HEALTH[Lambda /health]
    CATALOG_H[Lambda /catalog/rubros]
    RUBROS_GET[Lambda /rubros GET]
    RULES_GET[Lambda /allocation-rules GET]
  end

  subgraph Data (DynamoDB)
    RUBROS_TBL[(Rubros Table)]
    TAXONOMIA_TBL[(Rubros Taxonomia Table)]
  end

  subgraph CI_CD (GitHub Actions)
    DEPLOY_API[deploy-api.yml]
    DEPLOY_UI[deploy-ui.yml]
    PIPELINE_R1[r1-dev-pipeline.yml]
    CONTRACT_TESTS[api-contract-tests.yml]
  end

  NAV --> APP
  APP --> CATALOG
  APP --> RULES
  APP --> AUTH

  CATALOG -->|GET /catalog/rubros| APIGW
  RULES -->|GET /allocation-rules| APIGW
  AUTH -->|JWT| APIGW

  APIGW --> HEALTH
  APIGW --> CATALOG_H
  APIGW --> RUBROS_GET
  APIGW --> RULES_GET

  CATALOG_H --> RUBROS_TBL
  RUBROS_GET --> RUBROS_TBL
  RULES_GET --> TAXONOMIA_TBL

  PIPELINE_R1 --> DEPLOY_API
  PIPELINE_R1 --> DEPLOY_UI
  PIPELINE_R1 --> CONTRACT_TESTS

  DEPLOY_API -->|Seed Scripts| RUBROS_TBL
  DEPLOY_API -->|Seed Scripts| TAXONOMIA_TBL
```

Notable Conventions:

- Feature flag `VITE_FINZ_ENABLED` gates Finanzas routes and navigation items.
- Catalog endpoint `/catalog/rubros` is public; allocation rules require Cognito JWT (default authorizer).
- Seed scripts live under `scripts/ts-seeds/` and write composite pk/sk keys.
- CI pipeline aggregates smoke test evidence into `$GITHUB_STEP_SUMMARY` and updates `docs/DEPLOYMENT_SUMMARY.md`.
