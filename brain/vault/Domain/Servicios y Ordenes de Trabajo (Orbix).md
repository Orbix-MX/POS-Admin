---
title: Servicios y Ordenes de Trabajo (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-06
tags: [negocio, orbix-erp, servicios, taller]
---

# Servicios y Órdenes de Trabajo (Orbix)

## ¿Qué es?

El flujo de la vertical de servicios/taller: cotizar un servicio, convertirlo en trabajo
asignado a uno o más empleados, y facturarlo.

## Objetivo

Dar seguimiento a un trabajo desde la cotización hasta su cobro, con trazabilidad de quién
lo ejecutó.

## Flujo

```
Cliente solicita un Service → ServiceQuote (cotización) → ServiceQuoteItem (renglones)
  → cliente aprueba → conversión a Order (ver Ventas) y/o WorkOrder (si requiere ejecución)
  → WorkOrderAssignment (empleado(s) asignados) → WorkOrderQuote (si el trabajo genera
    una cotización adicional, p. ej. refacciones no previstas)
  → cierre del trabajo → cobro
```

## Reglas de negocio encontradas

- `ServiceQuote` es convertible a `Order` — mismo mecanismo que el resto de ventas (ver
  [[Ventas y Punto de Venta (Orbix)]]).
- `WorkOrder` admite más de un empleado asignado (`WorkOrderAssignment`), no es 1:1.
- `WorkOrderQuote` permite generar una cotización adicional durante la ejecución de un
  trabajo (por ejemplo, refacciones no contempladas en la cotización original) —
  **requiere validación** el flujo exacto de aprobación de esta cotización adicional.

## Conceptos importantes

| Concepto | Significado |
|---|---|
| Service | Catálogo de servicios ofrecidos |
| ServiceQuote | Cotización de uno o más servicios, convertible a orden |
| WorkOrder | Trabajo asignado a ejecutar, con uno o más empleados |

## Sistemas que participan

- [[Orbix ERP API]] — módulos `retail/services`, `retail/service-quotes`,
  `retail/work-orders`.
- [[Orbix ERP Web]] — páginas `servicios`, `cotizaciones`, `ordenes-trabajo`.

## Relaciones con otros procesos

- → [[Ventas y Punto de Venta (Orbix)]] — una cotización aprobada se convierte en orden.
- ← [[Administracion Multi-tenant (Orbix)]] — los empleados asignables vienen del módulo de
  RRHH/usuarios del tenant.
