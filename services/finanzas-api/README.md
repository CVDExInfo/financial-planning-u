# Finanzas SD API

Finanzas API expone los endpoints de proyectos, rubros, line items, conciliación de facturas y carga de documentos usados por la UI de Finanzas SD (rutas `/finanzas/**`). Está implementada con AWS SAM y Lambda en us-east-2.

## Ejecutar localmente
```bash
npm ci
sam build
sam local start-api --env-vars env.dev.json
```

## Contratos y referencias
- Contratos de endpoints: consulte `docs/finanzas/api-contracts.md`.
- Arquitectura y tablas: consulte `docs/finanzas/architecture.md`.

## Notas de autenticación
- Usa Cognito JWT con grupos `PMO`, `FIN`, `SDMT`, `EXEC_RO`.
- Asegure las variables de entorno de pool/cliente en `template.yaml` o `env.*.json` antes de levantar localmente.
