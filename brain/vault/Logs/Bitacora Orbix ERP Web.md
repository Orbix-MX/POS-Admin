---
title: Bitacora Orbix ERP Web
type: log
owner: Requiere validación
updated: 2026-08-21
tags: [bitacora, orbix-erp]
---

# Bitácora — Orbix ERP Web

> Bitácora, **no documentación**. Aquí se anota lo que pasó; cuando algo se vuelve
> conocimiento estable, se mueve al documento que le corresponde (`Domain/`, `Systems/`,
> `Decisions/`).

## 2026-08-19 — El punto de venta sale del Admin Web

**Qué pasó:** Nació `apps/pos-web` (`@orbix/pos-web`), terminal de venta como aplicación
propia en el puerto 5174.

**Hallazgo / causa:** El POS no comparte ni el ritmo ni el lenguaje visual del back-office
(teclado, escáner, una sola pantalla por turno), pero sí toda su capa de datos. Separarlo
como paquete y **reutilizar `web/src` por alias** evitó duplicar servicios, stores y cliente
HTTP.

El precio es un acoplamiento por ruta relativa: el POS compila contra `../../web/src`, así
que un refactor en el Admin Web puede romperlo sin que nada en `web/` lo advierta. Aparte,
obligó a fijar una sola instancia de React en `vite.config.ts` — el monorepo tenía 19.1.0
hoisteada en la raíz y 19.2.6 en `web/`, y la mezcla mataba la página con *Invalid hook
call*.

**Qué se hizo:** Documentado en [[Orbix POS Web]]. El 2026-08-20 se le añadieron el selector
de caja física y el diálogo de autorización por PIN.

**Pendiente:** Inicio, Tickets, Productos, Clientes y Reportes siguen como placeholder que
remite al Admin Web. Dos sistemas de estilo conviven en el repo (Tailwind en `web/`, tokens
CSS en el POS): un componente no se mueve de uno a otro sin reescribir su capa visual.

## 2026-08-12 — Tienda en línea con secciones dinámicas

**Qué pasó:** El tenant puede publicar un storefront (Astro) cuya home se arma con secciones
ordenables, y recibir pedidos por WhatsApp.

**Hallazgo / causa:** El pedido de WhatsApp **no** es una `Order`: no hay cobro ni caja y
puede no concretarse. Se modeló aparte y el stock solo baja al marcarlo `DELIVERED`.

**Qué se hizo:** Documentado en [[Tienda en Linea (Orbix)]] y [[Orbix Tienda en Linea]].

## 2026-08-06 — Vault reescrito con contenido real de Orbix ERP Web

**Qué pasó:** Se documentó [[Orbix ERP Web]] por primera vez en este vault, a partir de
`web/CLAUDE.md` y la estructura real de `web/src`.

**Hallazgo / causa:** El proyecto usa Zustand, no Redux — corrección respecto a una
suposición inicial durante el análisis. También se confirmó una dependencia circular
conocida entre `api-client.ts` y `auth-service.ts`, documentada explícitamente por el propio
equipo en `web/CLAUDE.md`.

**Qué se hizo:** Se listaron las 28+ páginas del Web y el patrón service→hook→page en
[[Orbix ERP Web]] y en [[Patrones]].

**Pendiente:** Nada identificado más allá de lo ya registrado en [[Roadmap]].
