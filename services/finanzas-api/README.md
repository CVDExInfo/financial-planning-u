# Finanzas SD API

Finanzas API expone los endpoints de proyectos, rubros, line items, conciliación de facturas y carga de documentos usados por la UI de Finanzas SD (rutas `/finanzas/**`). Está implementada con AWS SAM y Lambda en us-east-2.

## Ejecutar localmente
```bash
npm ci
sam build
sam local start-api --env-vars env.dev.json
```

## Ejecutar pruebas
- Las pruebas de Jest se ejecutan en modo CommonJS usando `ts-jest` para evitar problemas de `exports is not defined` en entornos ESM.
- Comando recomendado: `npm test` (internamente ejecuta `jest --runInBand`).
- Para volver a probar el modo ESM en el futuro, cambie el preset en `jest.config.cjs` a `ts-jest/presets/default-esm` y habilite `useESM: true` en el transform, luego ejecute Jest con `node --experimental-vm-modules`.

## Contratos y referencias
- Contratos de endpoints: consulte `docs/finanzas/api-contracts.md`.
- Arquitectura y tablas: consulte `docs/finanzas/architecture.md`.

## Notas de autenticación
- Usa Cognito JWT con grupos `PMO`, `FIN`, `SDMT`, `EXEC_RO`.
- Asegure las variables de entorno de pool/cliente en `template.yaml` o `env.*.json` antes de levantar localmente.
