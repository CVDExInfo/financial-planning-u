# Data Architecture (ERD)

```mermaid
erDiagram
  PROJECTS ||--o{ PROJECT_RUBROS : contains
  PROJECTS ||--o{ ALLOCATIONS : allocates
  PROJECTS ||--o{ PAYROLL_ACTUALS : payroll
  PROJECTS ||--o{ ADJUSTMENTS : adjusts
  PROJECTS ||--o{ MOVEMENTS : movements
  PROJECTS ||--o{ ALERTS : triggers

  RUBROS ||--o{ PROJECT_RUBROS : referencedBy
  RUBROS ||--o{ ALLOCATIONS : baseFor
  RUBROS ||--o{ ADJUSTMENTS : mayImpact

  RUBROS_TAXONOMIA ||--o{ RUBROS : classifies

  PROVIDERS ||--o{ MOVEMENTS : vendorFor

  PROJECTS {
    string pk
    string sk
    string project_id
    string name
    number mod_total
  }
  RUBROS {
    string pk
    string sk
    string rubro_id
    string nombre
    string linea_codigo
  }
  RUBROS_TAXONOMIA {
    string pk
    string sk
    string linea_codigo
    string categoria_codigo
  }
  ALLOCATIONS {
    string pk
    string sk
    string project_id
    string rubro_id
    string mes
    number monto_planeado
  }
  PAYROLL_ACTUALS {
    string pk
    string sk
    string mes
    number nomina_total
  }
  ADJUSTMENTS {
    string pk
    string sk
    string tipo
    number monto
  }
  MOVEMENTS {
    string pk
    string sk
    string tipo
    number monto
  }
  ALERTS {
    string pk
    string sk
    string severity
    string type
  }
  PROVIDERS {
    string pk
    string sk
    string provider_id
    string nombre
  }
```

Key Conventions:

- Composite primary keys: `pk` and `sk` for all tables.
- Rubros taxonomy uses pk=LINEA#{code}, sk=CATEGORIA#{category}.
- Rubros items use pk=RUBRO#{id}, sk=DEF.
