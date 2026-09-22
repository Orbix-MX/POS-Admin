---
title: Orbix Apps Moviles y Desktop
type: system
owner: Requiere validación
updated: 2026-08-22

tags: [sistema, orbix-erp, movil, desktop]
---

# Orbix Apps Móviles y Desktop

## Responsabilidad

> El punto de venta **en producción hoy es web**: [[Orbix POS Web]] (`apps/pos-web`, desde
> 2026-08-19). Las piezas de este documento siguen siendo las que faltan por terminar.

Clientes adicionales de [[Orbix ERP API]] más allá del Web: punto de venta físico (tablet),
uso móvil y una app de escritorio. Ninguno define reglas de negocio propias. A diferencia de
los demás documentos de `Systems/`, aquí se agrupan varias piezas porque **ninguna está
completamente implementada todavía** — ver estado de cada una abajo.

## Nomenclatura

"Orbix App" es nombre base de producto/marca para la app principal de onboarding (cliente
móvil que da de alta la empresa), independiente del paquete técnico que lo implemente en
cada momento. Hoy ese rol lo cumple `@orbix/mobile` (ver Módulos).

`@orbix/app` tiene nombre de producto propio: **Orbix Comandera**. Es scaffold separado, sin
flujo propio implementado todavía.

## Tecnologías

| Pieza | Elección | Estado |
|---|---|---|
| Orbix POS App | Flutter (tablet-first) | Pre-arquitectura: scaffold + pantalla maqueta |
| Orbix Comandera (`@orbix/app`) | Expo / React Native | Scaffold con dependencias instaladas, sin flujo propio |
| Orbix Mobile (`@orbix/mobile`) | Expo / React Native (NativeWind) | En desarrollo activo: auth + wizard de alta de empresa + CRUD de productos/inventario funcionales |
| Orbix Desktop | Indeterminado | Solo hay un build compilado en el repo |

## Repositorio

- `orbix-admin/apps/pos` — POS Flutter.
- `orbix-admin/apps/mobile/orbix-app` (`@orbix/app`) — scaffold Expo original, sin flujo propio.
- `orbix-admin/apps/mobile/orbix-mobile` (`@orbix/mobile`) — app Expo activa, ver sección propia
  abajo.
- `orbix-admin/apps/desktop` — solo `dist/` (HTML/assets compilados) y un `.env` con
  `VITE_API_URL`; sin código fuente visible.
- `orbix-admin/packages/orbix_design_system` — design system Flutter, consumido hoy por el POS.

## Estructura

**Orbix POS App** (`apps/pos/lib/`): `app/`, `business/` (modelos transversales: tenant,
branch, money, currency, user, permission), `core/` (arquitectura objetivo: network con Dio,
auth, security/permisos, events, router con go_router, storage, config, analytics, hardware),
`features/{auth,pos,settings}`, `shared/`, `modules/` (vacío). El diseño objetivo completo
está en `apps/pos/docs/ARCHITECTURE_AUDIT.md` (2026-07-08): feature-first, Riverpod, Dio,
go_router, decisiones ya congeladas pero sin implementar.

**Orbix Comandera** (`@orbix/app`, scaffold): Expo Router, TanStack Query, `expo-sqlite`,
`expo-secure-store`, `@react-native-community/netinfo` — sugiere soporte offline planeado.
Consume `@orbix/types`.

**Orbix Mobile** (`@orbix/mobile`, activo): Expo Router + NativeWind + TanStack Query + MMKV.
Repositorios en `src/repositories/*` envuelven el cliente HTTP (`src/services/api/`); varios
todavía lanzan `NotImplementedError` para endpoints que el backend no expone (ver
`BACKEND-GAPS.md` en el repo). Tiene un flujo de auth completo (login/registro/JWT) y un
wizard de 4 pasos (`src/app/(wizard)/`, estado en `WizardProvider` + MMKV con TTL de 7 días)
que da de alta la empresa del usuario — detalle de negocio en
[[Administracion Multi-tenant (Orbix)]].

Tras el wizard, `(app)/` tiene un drawer lateral (`src/components/navigation/app-drawer.tsx`)
con el menú de módulos — hoy "Inventario", "Ventas" (POS), "Clientes" y "Configuración" están
conectados a pantallas reales, el resto son placeholders visuales pendientes. La app corre en
modo inmersivo en Android (status bar y nav bar ocultos vía un config plugin propio en
`plugins/withImmersiveMode.js`, necesario porque `expo-status-bar`'s `hidden` es un no-op bajo
edge-to-edge/Android 15).

## Módulos

- **Alta de empresa (self-service)** — solo en `@orbix/mobile`. Ver
  [[Administracion Multi-tenant (Orbix)]] para el flujo y las reglas.
- **Productos e inventario** — solo en `@orbix/mobile` (`src/app/(app)/products/`,
  `src/features/products/`). Alta, edición, borrado y listado de productos contra
  `/products` y `/categories` de [[Orbix ERP API]]; funciona para las cuatro verticales
  de negocio (`Product.type` — SIMPLE/SERVICE/RECIPE/COMBO — decide qué campos aplican,
  RECIPE solo se ofrece si el tenant tiene `enableRecipes`, restaurant-only). El picker de
  categoría permite crear una categoría nueva sin salir del formulario de producto
  (se asigna al producto en cuanto se crea). Edición/borrado de recetas o ítems de combo
  no está implementado en esta app todavía (la API sí lo soporta). Acceso gateado por
  permisos reales (`products:view`/`products:create`), no solo por presencia del ítem en
  el menú.
- **Ventas (POS)** — solo en `@orbix/mobile` (`src/app/(app)/pos/`, `src/features/pos/`).
  Abre/cierra caja (`CashSession`), carrito de productos con búsqueda, cobro en
  efectivo/tarjeta con cálculo de cambio — mismo flujo atómico de orden + consumo de
  inventario + movimiento de caja que ya usaba Web. Ver
  [[Cuentas por Cobrar y Pagar (Orbix)]] para el detalle del ciclo de caja. Gateado por
  `orders:create`.
- **Configuración** — solo en `@orbix/mobile` (`src/app/(app)/settings/`,
  `src/features/settings/`). Jerárquica: categorías → detalle, con maestro-detalle real en
  tablet (`useIsTablet`, 768px) en vez de las mismas filas estiradas. Solo dos categorías
  tienen panel construido — **General** (apariencia, moneda, casas decimales, pantalla de
  inicio, orden del catálogo en POS) y **Datos de la tienda** (nombre, logo, teléfono,
  dirección) — el resto de la lista (Productos, Caja, Pagos, Impuestos, Impresión,
  **Usuarios y permisos**, Integraciones, Acerca de) son filas reales con ícono y
  descripción pero inertes ("Próx."): no hay pantalla detrás todavía. El patrón de
  componentes (`SettingsRow`/`SettingsSection`/`SettingsOptionRow`, todos en el ODS) está
  pensado para que esas categorías —incluida la configuración de usuario— se completen
  reusándolo. Ver [[Patron de pantalla de configuracion (Orbix Mobile)]] para el detalle
  de cómo construir una nueva.
- El resto de piezas (POS Flutter, `@orbix/app`, Desktop) no tiene módulos de negocio
  más allá del scaffold. Ver [[Roadmap]].

## Dependencias

- [[Orbix ERP API]] — API de destino para las tres piezas Expo/Flutter/Desktop; conectada y
  en uso desde `@orbix/mobile` (auth + `POST /tenants/onboarding`), aún no conectada en el POS.
- `packages/orbix_design_system` — usado por el POS.
- `packages/types` (`@orbix/types`) — usado por las apps Expo.

## Integraciones

Ninguna implementada todavía en el POS Flutter (sin networking real). `@orbix/mobile` sí
tiene integración real contra [[Orbix ERP API]] (auth, alta de empresa, productos/categorías,
caja y ventas); el
resto de sus llamadas (Google Sign-In, SMS OTP, catálogo de tipos de negocio remoto) esperan
endpoints que el backend aún no expone. El Desktop no tiene código fuente en el repo para
evaluar.

## Riesgos y deuda

- **Orbix POS App**: sin routing, networking, auth ni persistencia reales — solo datos
  hardcodeados en una pantalla. Riesgo señalado explícitamente en la propia auditoría:
  acoplamiento cruzado entre verticales si se construye sin la estructura feature-first
  propuesta.
- **Orbix Comandera**: sin `CLAUDE.md`/`AGENTS.md` propio más allá de una referencia a la
  documentación oficial de Expo v54 (que cambió de versión recientemente).
- **Orbix Desktop**: estado indeterminado — **Requiere validación** si es un wrapper
  Electron/Tauri del Web o un artefacto externo al ciclo de este repo.
