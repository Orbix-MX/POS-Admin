---
title: Restaurante (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-06
tags: [negocio, orbix-erp, restaurante]
---

# Restaurante (Orbix)

## ¿Qué es?

El flujo específico de la vertical restaurante: gestión de mesas, comandas y cocina (KDS).
Solo se activa para tenants con la feature `TABLES`/`KITCHEN` habilitada.

## Objetivo

Coordinar sala y cocina en tiempo real: qué mesa pidió qué, qué se le manda a cocina y en
qué ronda, y cuándo la comanda está lista para cobrarse.

## Flujo

```
Configuración de DiningArea y RestaurantTable (layout del comedor)
  → apertura de DiningOrder en una mesa → DiningOrderItem (renglones del pedido)
  → envío a cocina: KitchenRound (agrupa items enviados en un momento dado)
  → cocina marca la ronda como lista → mesero entrega
  → cierre de la comanda → se convierte en Order/Payment (ver Ventas y Punto de Venta)
```

## Reglas de negocio encontradas

- Una mesa (`RestaurantTable`) pertenece a un `DiningArea`, ambos scoped a `Branch`.
- Los items de una comanda se agrupan en `KitchenRound` al enviarse a cocina — no se envían
  uno por uno, sino por tanda.
- El cierre de una `DiningOrder` reutiliza el mismo modelo `Order`/`Payment` que retail (ver
  [[Ventas y Punto de Venta (Orbix)]]), con `OrderOrigin = RESTAURANT_COMANDA`.
- **Requiere validación** el detalle de estados de `KitchenRound` (cuántos estados hay entre
  "enviada" y "lista") y si existe reasignación de mesas a mitad de comanda.

## Conceptos importantes

| Concepto | Significado |
|---|---|
| DiningArea / RestaurantTable | Layout físico del comedor |
| DiningOrder / DiningOrderItem | Comanda abierta en una mesa y sus renglones |
| KitchenRound | Tanda de items enviados a cocina (KDS) |

## Sistemas que participan

- [[Orbix ERP API]] — módulo `restaurant/`.
- [[Orbix ERP Web]] — páginas `comanda`/`comanda-login`, `kitchen`, `dining-areas`,
  `restaurant-tables`, `caja-restaurante`.

## Relaciones con otros procesos

- → [[Ventas y Punto de Venta (Orbix)]] — toda comanda cerrada se convierte en `Order`.
- ← [[Inventario y Compras (Orbix)]] — las recetas de cocina consumen insumos.
