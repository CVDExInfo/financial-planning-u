# Finanzas SD – Sequence diagrams / Diagramas de secuencia

## Project intake to SDMT handoff
![Finanzas SD – Handoff sequence](diagrams/finanzas-sequence-handoff.svg)

- Flujo: PMO crea proyecto → define baseline → asocia rubros → genera handoff para SDMT.

## Invoice reconciliation with evidence
![Finanzas SD – Invoice reconciliation](diagrams/finanzas-sequence-recon.svg)

- Flujo: Finanzas registra factura → adjunta evidencia → reconcilia contra forecast → actualiza estado.

## Notes / Notas
- Todos los pasos requieren JWT con grupo habilitado; fallas de auth responden 401/403.
- La UI usa loaders optimistas, pero la confirmación depende de la respuesta de API.
