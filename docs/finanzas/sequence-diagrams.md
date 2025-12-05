# Finanzas SD – Sequence diagrams / Diagramas de secuencia

## Project intake to SDMT handoff
- Flujo: PMO crea proyecto → define baseline → asocia rubros → genera handoff para SDMT.
- Ver `diagrams/finanzas-sequence-handoff.svg` para pasos y validaciones.

## Invoice reconciliation with evidence
- Flujo: Finanzas registra factura → adjunta evidencia → reconcilia contra forecast → actualiza estado.
- Ver `diagrams/finanzas-sequence-recon.svg` para detalles de llamadas y accesos a DynamoDB/S3.

## Notes / Notas
- Todos los pasos requieren JWT con grupo habilitado; fallas de auth responden 401/403.
- La UI usa loaders optimistas, pero la confirmación depende de la respuesta de API.
