---
title: Orbix POS Web
type: system
owner: Requiere validación
updated: 2026-08-21
tags: [sistema, orbix-erp, frontend, pos, caja]
---

# Orbix POS Web

## Responsabilidad

Terminal de punto de venta de Orbix como **aplicación web independiente**: cobrar rápido en
mostrador, con teclado y escáner, en una pantalla diseñada para el turno de un cajero. No
es el Admin Web en modo kiosco ni un módulo suyo: es un paquete aparte
(`@orbix/pos-web`) que **reutiliza la infraestructura de [[Orbix ERP Web]]** en vez de
duplicarla.

No define reglas de negocio propias. Impuestos, folios, afectación de inventario y
movimientos de caja los calcula [[Orbix ERP API]]; el POS solo replica la aritmética para la
**vista previa** del carrito, y los importes que muestra tras cobrar salen siempre de la
orden que devolvió el servidor.

Existe desde 2026-08-19. Convive con la app móvil `@orbix/mobile`, que tiene su propio POS
para tablet/teléfono — ver [[Orbix Apps Moviles y Desktop]].

## Tecnologías

| Área | Elección |
|---|---|
| Plataforma | React 19 + TypeScript + Vite |
| Estilos | Tokens CSS del *Orbix Design System*, **sin Tailwind** |
| Estado | Zustand — `useAuthStore` reexportado del Admin Web + stores propios de carrito y caja |
| HTTP | El `api-client.ts` del Admin Web, sin cliente propio |

## Repositorio

`orbix-admin/apps/pos-web`, puerto **5174** (el Admin Web usa el 5173). Arranca con
`pnpm dev:pos` desde la raíz (levanta API + POS) o
`pnpm --filter=@orbix/pos-web dev`.

## Estructura

```
apps/pos-web/src/
  app/          providers (arranque, estado de red) y router con guards
                (auth → sucursal → caja abierta)
  components/   ui/ (ports TS del design system) · shared/ (Brand, Icon, StateBlock)
  hooks/        use-catalog, use-customers, use-checkout, use-debounced
  modules/      auth · session · cash · pos · checkout · ticket · shell
  services/     orbix.ts (barrel de reexports del backend) · order-totals.ts (preview)
  stores/       session-store (reexport) · cart-store · cash-store
  styles/       global.css + ds/ (tokens copiados del Design System)
```

## Cómo reutiliza el Admin Web

Tres reglas duras, documentadas en su `CLAUDE.md`:

1. **Sin servicios propios.** Toda llamada al backend entra por `src/services/orbix.ts`, un
   barrel que reexporta `web/src/services/**` vía el alias `@web`. Si falta una función se
   añade el reexport; nunca un `api.get(...)` directo ni un `PosXService` que envuelva lo
   que ya existe.
2. **Sin autenticación paralela.** Token, selección de tenant y sucursal, capabilities y
   permisos son los de `useAuthStore` del Admin Web.
3. **Es exclusivamente frontend.** No se toca `api/`. Lo que el diseño pide y el backend no
   expone se anota en `apps/pos-web/BACKEND-GAPS.md` y se deja pendiente, en vez de
   inventar un endpoint.

Los alias importan: `~/*` → `src/*` (código propio) y **`@/*` → `../../web/src/*`** — `@`
apunta al Admin Web, no a `src/`, porque los archivos de `web/src` se importan entre sí con
ese prefijo. Romperlo rompe todo el reuso.

## Flujo implementado

```
/login → /seleccionar → /caja/apertura → /pos → cobro → /ticket/:orderId
```

| Pantalla | Endpoints principales |
|---|---|
| Login | `POST /auth/login`, `PATCH /auth/select-tenant/:slug`, `GET /auth/me`, `GET /auth/me/capabilities` |
| Selección | `GET /branches`, `PATCH /auth/select-branch/:id`, `GET /cash-sessions/active` |
| Caja | `POST /cash-sessions` y el resto del ciclo — ver [[Caja y cortes (Orbix)]] |
| POS | `GET /products`, `GET /categories`, `GET /customers`, `POST /customers`, `GET /tenants/current/settings` |
| Cobro | `POST /orders` |
| Ticket | `GET /orders/:id`, `POST /printer-configs/receipt-data`, `GET /tenants/current/info` |

Atajos de teclado: **F2** busca, **F4** cobra, **Enter** en el buscador agrega la
coincidencia única (comportamiento de escáner de código de barras), **Enter** confirma el
cobro, **Esc** cancela.

El módulo `cash/` incluye el selector de caja física (`CashRegisterPicker`) y el diálogo de
autorización por PIN (`AuthorizePinDialog`) — reglas de negocio en
[[Caja y cortes (Orbix)]]. La terminal recuerda su `cashRegisterId` en `localStorage`.

Pendientes, con placeholder que remite al Admin Web: Inicio, Tickets (historial, detalle,
devoluciones), Productos, Clientes y Reportes.

## Dependencias

- [[Orbix ERP API]] — backend único; mismo `VITE_API_URL` que el Admin Web.
- [[Orbix ERP Web]] — dependencia **de código fuente**, no solo de contrato: servicios,
  stores y cliente HTTP se importan de `web/src` en caliente.

## Riesgos y deuda

- **Acoplamiento al Admin Web por ruta relativa.** El POS compila contra `../../web/src`;
  un refactor en `web/` que mueva servicios o cambie firmas rompe el build del POS sin que
  nada en `web/` lo advierta. No hay contrato intermedio (un paquete compartido) que lo
  aísle.
- **Doble copia de React en el monorepo** (19.1.0 hoisteada en la raíz, 19.2.6 en `web/` y
  aquí). `vite.config.ts` fija una sola instancia con alias absolutos de `react`/`react-dom`
  más `resolve.dedupe`; quitarlos revive el *Invalid hook call*. Cualquier dependencia nueva
  que traiga React hay que verificarla.
- **Dos sistemas de estilo en el mismo repo**: el Admin Web usa Tailwind 4, el POS usa
  tokens CSS del design system. Un componente no se puede mover de uno a otro sin
  reescribir su capa visual.
- `BACKEND-GAPS.md` **quedó parcialmente desfasado**: sus huecos 1 (selección de caja) y 2
  (autorización por PIN) se cerraron el 2026-08-20 con el trabajo de cajas múltiples, pero
  el documento no lo refleja. **Requiere validación** el estado real de los otros seis.

Relacionado: [[Ventas y Punto de Venta (Orbix)]], [[Caja y cortes (Orbix)]],
[[Orbix ERP Web]], [[Orbix Apps Moviles y Desktop]].
