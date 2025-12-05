# Finanzas SD – Overview

## Propósito y alcance
Finanzas SD gestiona costos, rubros y conciliación para proyectos de servicio Ikusi/CVDEx. Conecta al PMO Colombia y al equipo SDMT para que los proyectos tengan presupuesto trazable, catálogos de rubros consistentes y facturas conciliadas contra el forecast.

## Cómo encaja con PMO y SDMT
- **PMO** registra proyectos y rubros base desde Finanzas, asegurando datos de costos y moneda antes del handoff.
- **Finanzas SD** mantiene el catálogo de rubros, asigna line items y recibe documentos de soporte (facturas, prefacturas, evidencias).
- **SDMT** consume los proyectos y rubros aprobados para planeación y control operativo.

### Flujo resumido (texto)
```
PMO -> Finanzas (proyectos, rubros) -> SDMT (catálogo y forecast) -> Finanzas (conciliación de facturas)
```

## Arquitectura de alto nivel
- **Frontend**: Finanzas UI (ruta `/finanzas/**`) con módulos Home, Projects, Rubros Catalog, SDMT Catalog y Reconciliation.
- **Backend**: Finanzas API (carpeta `services/finanzas-api`) expuesta vía API Gateway `finanzas-sd-api` (dev/stg/prod).
- **Autenticación**: Cognito con grupos comunes (`EXEC_RO`, `PMO`, `SDMT`, `FIN`, `AUDIT`) aplicados en UI y API.
- **Almacenamiento**:
  - DynamoDB: tablas de proyectos, rubros, allocation rules, line items, docs y facturas/prefacturas.
  - S3: bucket `ukusi-ui-finanzas-prod` para UI estática y carga de documentos.
- **Orquestación**: Lambdas por dominio (projects, rubros, line-items, reconciliation/invoices, upload-docs) conectadas por API Gateway.

## Valor para PMO Colombia (lenguaje sencillo)
Finanzas SD permite que el PMO lleve trazabilidad completa de los costos del proyecto: registra el proyecto una sola vez, usa rubros estandarizados del catálogo SDMT y luego concilia facturas contra el forecast antes de enviarlas a SDMT. Esto reduce reprocesos, evita diferencias de moneda y da visibilidad temprana a Finanzas y a la dirección ejecutiva.
