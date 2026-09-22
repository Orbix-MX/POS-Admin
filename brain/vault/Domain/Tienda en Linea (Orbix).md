---
title: Tienda en Linea (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-21
tags: [dominio, orbix-erp, ecommerce, tienda, whatsapp]
---

# Tienda en Línea (Orbix ERP)

## Objetivo

Que un tenant publique su catálogo hacia afuera y reciba pedidos **sin montar una pasarela
de pago**: el cliente arma su carrito en el storefront y lo envía por WhatsApp. El pedido
queda registrado en Orbix y el administrador lo avanza a mano según lo que de verdad ocurre.

## Un sitio por tenant, armado por secciones

`TenantSite` es **1:1 con el tenant** (`tenantId` es la PK) y apunta a un `Template`. No hay
cambio de plantilla ni segundo sitio todavía: crear otro `TenantSite` para el mismo tenant
no aplica.

El contenido son `TenantSiteSection`: tipo (`SiteSectionType`), orden, `isActive` y un
`content Json` libre. El orden es único por tenant (`@@unique([tenantId, sortOrder])`), así
que reordenar secciones es una permuta, no un `sortOrder` cualquiera.

## El pedido por WhatsApp no es una `Order`

`StoreWhatsappOrder` es un modelo aparte, **no** la `Order` del POS
([[Ventas y Punto de Venta (Orbix)]]). La razón es que un mensaje de WhatsApp no es una
venta: no hay cobro, no hay caja y puede no concretarse nunca.

- **Folio propio**: `WA-0001`, `WA-0002`… secuencial por tenant, con
  `@@unique([tenantId, orderNumber])` como red — si dos pedidos chocan, se reintenta.
- **Las líneas son snapshot**, no referencia viva: `StoreWhatsappOrderItem` guarda su propio
  `name`, `price`, `quantity` y `subtotal`. Editar o borrar el producto después no reescribe
  el pedido. `productId` es nullable y queda en `SET NULL`.
- El pedido nace `PENDING` y solo sale del sitio por transiciones explícitas
  (`PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → DELIVERED | CANCELLED`). `DELIVERED` y
  `CANCELLED` son **terminales**.

## El stock se descuenta al entregar, no al pedir

Un carrito enviado por WhatsApp no compromete inventario. **El stock solo baja —y el pedido
solo cuenta como ingreso— al llegar a `DELIVERED`**, y lo hace por el mismo
`InventoryConsumptionEngine` que el POS y el restaurante: un pedido de tienda descuenta
recetas y combos igual que cualquier otro canal. Ver [[Inventario y Compras (Orbix)]].

La consecuencia práctica es que **la tienda puede vender lo que ya no hay**: entre el
mensaje y la entrega nada reserva el stock. Es una decisión, no un descuido — reservar
inventario por un mensaje de WhatsApp sin pago congelaría existencias por pedidos que no se
concretan.

## Endpoints

Storefront (**públicos**, sin sesión — `@Public()` en `store.controller.ts`):
`GET /store/branding`, `GET /store/site`, `GET /store/categories`, `GET /store/products`,
`POST /store/orders`.

Back-office (autenticado): `GET /store-orders`, `GET /store-orders/:id`,
`PATCH /store-orders/:id/status`.

## Qué se publica

El catálogo de la tienda es el mismo de [[Modelo de producto por vertical (Orbix)]],
filtrado por el flag `Product.isEcommerce`. Las categorías llevan imagen propia y los
productos exponen sus `ProductFeature` (ficha de especificaciones) en la tienda.

## Sistemas que participan

- [[Orbix ERP API]] — módulos `core/store` (storefront público) y `core/store-orders`
  (gestión del pedido).
- [[Orbix Tienda en Linea]] — los storefronts Astro.
- [[Orbix ERP Web]] — administración de secciones del sitio y de los pedidos recibidos.

## Relaciones con otros procesos

- → [[Inventario y Compras (Orbix)]] — el `DELIVERED` descuenta stock.
- → [[Ventas y Punto de Venta (Orbix)]] — canal hermano; **no** comparten modelo de orden.
- → [[Administracion Multi-tenant (Orbix)]] — un sitio por tenant.

## Riesgos y deuda

- **Sin pago en línea.** Todo el ciclo depende de que alguien mueva el status a mano.
- **Sin reserva de stock** entre el pedido y la entrega (ver arriba).
- El storefront resuelve su tenant **por el `Origin` de la petición** (de ahí que la home
  sea SSR). Detalle en [[Orbix Tienda en Linea]].
