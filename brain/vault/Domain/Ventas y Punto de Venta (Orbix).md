---
title: Ventas y Punto de Venta (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-21
tags: [negocio, orbix-erp, ventas]
---

# Ventas y Punto de Venta (Orbix)

## ¿Qué es?

El proceso de venta al cliente final, unificado para retail (mostrador) y restaurante
(comanda), con soporte de cupones, pagos divididos y devoluciones.

## Objetivo

Registrar una venta con su origen (mostrador, comanda, delivery, kiosco, online), cobrarla y
dejar rastro contable/de inventario consistente sin importar el canal.

## Flujo

```
Selección de productos/servicios → aplicación de cupón (opcional) → checkout
  → Order + OrderItem (con OrderOrigin) → Payment (uno o varios, split payments)
  → movimiento de caja (CashMovement) → si aplica, movimiento de inventario
  → devolución posterior: OrderRefund + OrderRefundItem
```

## Reglas de negocio encontradas

- `Order` es el modelo **unificado** de venta: retail (`RETAIL_POS`) y restaurante
  (`RESTAURANT_COMANDA`) comparten la misma entidad, distinguidos por `OrderOrigin`
  (también existen `DELIVERY`, `KIOSK`, `ONLINE`).
- Los pagos soportan división (split payments): una orden puede tener más de un `Payment`.
- Una `ServiceQuote` (cotización de servicio) puede convertirse en `Order`.
- Toda venta que mueve efectivo genera un `CashMovement`, que es el mismo mecanismo que usan
  CxP/CxC para sus movimientos — ver [[Cuentas por Cobrar y Pagar (Orbix)]].
- Cupones (`Coupon`) se aplican a nivel orden — **requiere validación** el detalle de reglas
  de acumulación/exclusión entre cupones.

## Conceptos importantes

| Concepto | Significado |
|---|---|
| Order / OrderItem | Venta y sus renglones, unificados entre canales |
| OrderOrigin | Canal de la venta (mostrador, comanda, delivery, kiosco, online) |
| Payment | Cobro asociado a una orden; puede haber varios por orden |
| OrderRefund | Devolución total o parcial de una orden |

## Sistemas que participan

- [[Orbix ERP API]] — módulos `retail/checkout`, `retail/orders`, `restaurant/dining-orders`.
- [[Orbix ERP Web]] — páginas `ventas`, `pos`, `comanda`.
- [[Orbix POS Web]] — terminal de venta web dedicada (`apps/pos-web`), en uso desde
  2026-08-19: es hoy el cliente de mostrador real, no el POS Flutter.
- [[Orbix Apps Moviles y Desktop]] — Orbix POS App, destino final de este flujo (sin
  conectar todavía).

## Relaciones con otros procesos

- ← [[Inventario y Compras (Orbix)]] — el stock vendido sale del inventario.
- ← [[Servicios y Ordenes de Trabajo (Orbix)]] — una cotización de servicio puede
  convertirse en orden.
- → [[Cuentas por Cobrar y Pagar (Orbix)]] — toda venta cobrada genera movimiento de caja.
- → [[Caja y cortes (Orbix)]] — una sesión por caja física; varias cajas abiertas por sucursal.
- → [[Restaurante (Orbix)]] — cuando el origen es una comanda.
- ∥ [[Tienda en Linea (Orbix)]] — canal hermano de venta; **no** comparte el modelo de
  orden: un pedido por WhatsApp es un `StoreWhatsappOrder`, no una `Order`.
