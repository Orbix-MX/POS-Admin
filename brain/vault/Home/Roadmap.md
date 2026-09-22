---
title: Roadmap
type: home
owner: Requiere validación
updated: 2026-08-21
tags: [orbix, roadmap]
---

# Roadmap

Huecos y trabajo pendiente conocido en cada producto, tal como se observa en código y
documentación al 2026-08-21. No es un compromiso de fechas: es un mapa de qué falta.

## Orbix ERP

- **Inventario por variante — fase *contract* pendiente.** La fase expand está entregada
  (2026-08-18), pero `OrderItem` y `StoreWhatsappOrderItem` **aún no guardan `variantId`**:
  se sabe qué producto se vendió, no qué variante. Falta también retirar `Product.stock` y
  añadir `sku`/`barcode`/`status` a la variante. Ver
  [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]].
- **Orbix POS Web** (`apps/pos-web`) — el flujo de venta está completo y conectado, pero
  Inicio, Tickets (historial, detalle, devoluciones), Productos, Clientes y Reportes son
  placeholders que remiten al Admin Web. Su `BACKEND-GAPS.md` lista ocho huecos entre el
  diseño y el backend; dos ya se cerraron sin que el documento se actualizara.
- **Tienda en línea sin pago en línea.** Todo el ciclo del pedido depende de que alguien
  mueva el status a mano, y nada reserva stock entre el mensaje de WhatsApp y la entrega
  (ver [[Tienda en Linea (Orbix)]]).

- **`inventory.engine.ts`** — 5 TODOs marcados "Phase 2": producción, transferencias entre
  sucursales, mermas, inventario inicial, conteos físicos.
- **Orbix POS App (Flutter)** — solo scaffold de `flutter create` + una pantalla maqueta con
  datos hardcodeados. Sin routing, networking, auth, persistencia ni tests. Existe una
  auditoría arquitectónica (`apps/pos/docs/ARCHITECTURE_AUDIT.md`, 2026-07-08) con el diseño
  objetivo aprobado (Riverpod + Dio + go_router) pendiente de implementar.
- **Orbix Comandera** (`@orbix/app`, Expo) — scaffold con dependencias instaladas (TanStack
  Query, SQLite, secure-store) pero sin flujo propio implementado. No confundir con
  `@orbix/mobile`, que sí tiene auth + wizard de alta + productos/inventario funcionales
  (ver [[Orbix Apps Moviles y Desktop]]).
- **Orbix Mobile** (`@orbix/mobile`) — edición de recetas (ingredientes) y de ítems de combo
  no está implementada en la app todavía, aunque la API ya lo soporta
  (`PUT /products/:id/recipe`, `PUT /products/:id/combo-items`).
- **Orbix Desktop** — solo hay un build compilado (`dist/`) en el repo; no hay código fuente
  visible. Estado indeterminado — **Requiere validación**.
- **Dependencia circular** entre `api-client.ts` y `auth-service.ts` en el Web — funciona
  pero es frágil.
- **`erp-store.ts`** (Zustand) — contiene placeholders sin terminar.
- **`RolesGuard` y `RequirePlanGuard`** — implementados pero no registrados globalmente
  todavía.
- **Auditoría manual** (`createdById`/`updatedById`) — Prisma 7 quitó el middleware `$use`
  que antes la automatizaba; hoy cada servicio debe setearla a mano.

## Decisiones pendientes de documentar (ningún ADR las registra)

- Estrategia final para `apps/desktop` (wrapper del Web vs. app nativa independiente).
- Futuro del **POS Flutter** (`apps/pos`) ahora que el punto de venta real es
  [[Orbix POS Web]]: seguir con la arquitectura aprobada en su auditoría, o retirarlo.
- Si `apps/root-garden` (sitio de un cliente) debe vivir en el repo del producto, y si
  `e-commerce-singlepage` es una plantilla seleccionable o un experimento.
