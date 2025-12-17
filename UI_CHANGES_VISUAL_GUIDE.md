# SDMT Changes UI Visual Guide

This document describes the visual changes and new UI elements added to the SDMT Changes flow.

## 1. Change Creation Button State

### Before (No Baseline)
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Alert                                             │
│ Este proyecto no tiene una línea base aceptada.    │
│ Debes aceptar una línea base antes de registrar    │
│ cambios.                                            │
└─────────────────────────────────────────────────────┘

[+ Nueva Solicitud de Cambio] ← DISABLED (grayed out)
```

### After (With Baseline)
```
[+ Nueva Solicitud de Cambio] ← ENABLED (clickable)
```

## 2. Create Change Modal - New Sections

### Section A: Baseline Field (Read-Only)
```
┌─────────────────────────────────────────────────────┐
│ Línea Base                                          │
│ ┌─────────────────────────────────────────────────┐│
│ │ base_c8e6829c5b91                      [LOCKED] ││ ← Read-only, auto-filled
│ └─────────────────────────────────────────────────┘│
│ ℹ️ Vinculado automáticamente a la línea base       │
│    aceptada del proyecto.                          │
└─────────────────────────────────────────────────────┘
```

### Section B: Time Distribution (New)
```
┌─────────────────────────────────────────────────────┐
│ ┌─ Distribución Temporal del Impacto ─────────────┐│
│ │                                                  ││
│ │ Aplicar desde (Mes)  Duración (meses)  Modo     ││
│ │ ┌────┐              ┌────┐            ○ One-time││
│ │ │ 13 │              │ 10 │            ● Spread  ││
│ │ └────┘              └────┘                      ││
│ │ Mes inicial         Número de meses             ││
│ │ (1-60)                                           ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Section C: New Rubro Toggle (New)
```
┌─────────────────────────────────────────────────────┐
│ ┌─ New Rubro Section ─────────────────────────────┐│
│ │                                                  ││
│ │ Este cambio requiere un rubro nuevo    [OFF] ◀─ Toggle││
│ │                                                  ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘

When toggled ON:
┌─────────────────────────────────────────────────────┐
│ ┌─ New Rubro Section ─────────────────────────────┐│
│ │                                                  ││
│ │ Este cambio requiere un rubro nuevo    [ON] ◀─ Toggle││
│ │                                                  ││
│ │ ℹ️ Especifica los detalles del nuevo rubro que  ││
│ │    se creará al aprobar este cambio.            ││
│ │                                                  ││
│ │ Nombre del Nuevo Rubro    Tipo de Gasto        ││
│ │ ┌───────────────────────┐ ┌────────────────┐   ││
│ │ │ Consultoría seguridad │ │ OPEX ▼         │   ││
│ │ └───────────────────────┘ └────────────────┘   ││
│ │                                                  ││
│ │ Descripción Operativa                           ││
│ │ ┌──────────────────────────────────────────────┐││
│ │ │ Auditoría de seguridad externa para         │││
│ │ │ validar cumplimiento normativo...           │││
│ │ └──────────────────────────────────────────────┘││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Section D: Rubros Afectados
```
When new rubro toggle is OFF:
┌─────────────────────────────────────────────────────┐
│ Rubros afectados                         3 selected │
│ ┌─────────────────────────────────────────────────┐│
│ │ Rubro — OPEX / Staff — Dev Backend      [▼]    ││ ← Enabled
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ [Rubro — OPEX] [Rubro — CAPEX] [Rubro — Service]  │
└─────────────────────────────────────────────────────┘

When new rubro toggle is ON:
┌─────────────────────────────────────────────────────┐
│ Rubros afectados                                    │
│ ┌─────────────────────────────────────────────────┐│
│ │ Deshabilitado: usando nuevo rubro      [▼]     ││ ← Disabled
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Section E: Impact Summary Preview (New)
```
┌─────────────────────────────────────────────────────┐
│ ┌─ Resumen de Impacto ────────────────────────────┐│
│ │                                                  ││
│ │ Línea Base:        base_c8e6829c5b91            ││
│ │ Rubros Afectados:  3 rubros                     ││
│ │ Distribución:      +500,000 USD distribuidos    ││
│ │                    en 10 meses desde el mes 13  ││
│ │                                                  ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘

OR when using new rubro:
┌─────────────────────────────────────────────────────┐
│ ┌─ Resumen de Impacto ────────────────────────────┐│
│ │                                                  ││
│ │ Línea Base:        base_c8e6829c5b91            ││
│ │ Rubros Afectados:  Nuevo: Consultoría seguridad││
│ │ Distribución:      +500,000 USD en el mes 13    ││
│ │                                                  ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 3. Approval Workflow - New Display Sections

### Time Distribution Info Box
```
┌─────────────────────────────────────────────────────┐
│ Time Distribution                                   │
│ ┌─────────────────────────────────────────────────┐│
│ │ Start Month: 13  Duration: 10 months            ││
│ │ Mode: Spread evenly                             ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### New Line Item Request Info Box (Amber)
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ New Line Item Request                            │
│ ┌─────────────────────────────────────────────────┐│
│ │ Name:        Consultoría de seguridad           ││
│ │ Type:        OPEX                               ││
│ │ Description: Auditoría de seguridad externa     ││
│ │              para validar cumplimiento...       ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 4. Toast Notification After Approval

```
┌─────────────────────────────────────────────────────┐
│ ✓ Cambio aprobado                                   │
│   Pronóstico actualizado para 2 rubros              │
│                                                     │
│                          [Ver Pronóstico] ←──────────Click to navigate
└─────────────────────────────────────────────────────┘
```

## 5. Forecast View (Future Enhancement)

### Forecast Cell with Change Indicator (TODO - Backend Required)
```
Current:
┌──────────────┐
│ P: $50,000   │
│ F: $55,000   │
│ A: $53,000   │
│ +$5,000      │
└──────────────┘

Future (when backend provides change_request_id):
┌──────────────┐
│ P: $50,000   │
│ F: $55,000   │
│ A: $53,000   │
│ +$5,000      │
│ [Change #123]│ ← New badge linking to change
└──────────────┘
```

## Form Validation Examples

### Valid State
All fields green, submit button enabled:
```
[Crear solicitud de cambio] ← ENABLED, primary color
```

### Invalid State Examples

**Missing Duration:**
```
Duración (meses)
┌────┐
│    │ ← Empty
└────┘
⚠️ La duración debe ser al menos 1 mes.
```

**Exceeds Project Period:**
```
Start: 55, Duration: 10, Project Period: 60
⚠️ La duración excede el período del proyecto (60 meses).
```

**New Rubro Name Missing:**
```
Nombre del Nuevo Rubro
┌────────────┐
│            │ ← Empty
└────────────┘
⚠️ El nombre del nuevo rubro es obligatorio.
```

**No Baseline:**
```
Línea Base
┌─────────────────┐
│ Sin línea base  │ ← Grayed out
└─────────────────┘
⚠️ Este proyecto no tiene una línea base aceptada.
⚠️ Debes aceptar una línea base antes de crear cambios.

[Crear solicitud de cambio] ← DISABLED
```

## Color Scheme

- **Primary Blue**: Interactive elements, enabled states
- **Muted Gray**: Read-only fields, disabled states
- **Amber/Orange**: New rubro request sections (distinctive)
- **Red**: Errors, validation messages
- **Green**: Success states
- **Border Light**: Section separators

## Responsive Behavior

- **Desktop (md+)**: 2-3 column grid layouts
- **Mobile**: Single column, stacked layout
- All sections maintain proper spacing and readability
