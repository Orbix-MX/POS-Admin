---
title: ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-06
tags: [adr, orbix-erp]
---

# ADR-0023 — `Order` unificado para retail y restaurante, distinguido por `OrderOrigin` (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · `retail/orders`, `restaurant/dining-orders` · **Fecha:** Requiere
validación

## Contexto

Retail (venta de mostrador) y restaurante (comanda de mesa) son flujos de captura distintos,
pero ambos terminan siendo una venta que debe cobrarse, afectar inventario y generar
movimiento de caja de la misma forma.

## Decisión

Un único modelo `Order`/`OrderItem` sirve a ambos flujos, distinguido por el campo
`OrderOrigin` (`RETAIL_POS`, `RESTAURANT_COMANDA`, `DELIVERY`, `KIOSK`, `ONLINE`). Una
`DiningOrder` (comanda) se cierra convirtiéndose en un `Order` con
`OrderOrigin = RESTAURANT_COMANDA`.

## Evidencia

`api/prisma/schema.prisma` (`Order`, `OrderOrigin`), changelog del README raíz de
`orbix-admin` (menciona explícitamente la "unificación de ventas retail/restaurante" como
entrega reciente).

## Consecuencias

**Positivas**
- Cobro, split payments, devoluciones, reportes y movimientos de caja funcionan igual sin
  importar el canal de venta — una sola implementación, no una por vertical.
- Agregar un canal nuevo (por ejemplo, `ONLINE`) no requiere un modelo de venta paralelo.

**Negativas**
- `Order` acumula campos/relaciones que solo tienen sentido para algunos orígenes,
  aumentando su superficie.
- Cualquier cambio al modelo `Order` afecta potencialmente a todos los canales de venta a
  la vez — mayor superficie de regresión por cambio.

## Notas

Fue una migración explícita (no el diseño original): el changelog del proyecto la registra
como entrega reciente, lo que sugiere que en algún momento anterior existieron modelos
separados. El detalle de esa migración **requiere validación**.
