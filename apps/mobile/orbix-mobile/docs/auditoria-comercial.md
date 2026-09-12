# Orbix Mobile — Auditoría comercial

**Fecha:** 2026-09-08 · **Rama:** `orbix-admin/dev` · **Alcance:** app móvil, no la API
**Stack:** Expo SDK 54 · React Native 0.81.5 · Expo Router 6
**Revisado:** 162 archivos, 19 151 líneas de `src/`, configuración nativa, y contraste contra la
superficie real de la API de Orbix ERP.

> Verificado contra código, no contra pantallas. Ninguna funcionalidad se marca "completa" por
> tener pantalla, ruta o endpoint: se exige el ciclo entero (UI, estado, validación, API,
> persistencia, errores, permisos, loading, vacío, éxito, navegación).
>
> **No se modificó código durante la auditoría.**

---

## 1. Resumen ejecutivo

### Respuesta a la pregunta de fondo

**No.** Si Orbix Mobile se publicara hoy, un negocio real podría registrarse, dar de alta su
empresa, crear productos y cobrar una venta — pero **no podría cerrar su caja, no podría ver
cuánto vendió hoy, no podría reponer inventario, no podría cobrar a crédito y no podría operar
un segundo día sin acumular inconsistencias**. Además, la app no puede publicarse tal cual: le
faltan requisitos duros de tienda (eliminación de cuenta, política de privacidad, tráfico en
claro habilitado, proyecto iOS inexistente).

### Estado actual

Orbix Mobile es una app **bien construida y de alcance corto**. La arquitectura, el sistema de
diseño, la gestión de sesión y el manejo de errores están por encima de lo que se ve
habitualmente en un producto de esta etapa. Lo que hay implementado funciona de verdad contra la
API real y está documentado con honestidad — el propio repositorio marca sus huecos en
`BACKEND-GAPS.md` y con chips «Próx.» en la UI, sin simular nada.

El problema no es la calidad: es la **cobertura**. La app expone cinco destinos vivos (Inicio,
Ventas, Inventario, Clientes, Configuración) sobre una API que ya tiene módulos de `reports`,
`receivables`, `payables`, `purchases`, `suppliers`, `coupons`, `employees` e importación masiva
de productos. El móvil consume aproximadamente **el 15 % de lo que el backend ya ofrece**.

### Fortalezas reales

- **Arquitectura por capas sin fugas.** `app/ → features/ → repositories/ → services/api`.
  Ninguna pantalla toca axios. DTO y modelo de dominio separados.
- **Sesión y tokens correctos.** Tokens en keychain (`expo-secure-store`,
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), un solo refresh compartido entre requests en vuelo,
  rotación respetada. Flujo de dos pasos tenant→branch implementado.
- **Permisos no inventados.** `usePermissions()` lee la unión que calcula el `PermissionsGuard`
  del servidor; nada hardcodeado; `SUPER_ADMIN` se salta igual que en el backend.
- **Design system consistente.** Cero colores literales, tema claro/oscuro, branding por tenant,
  i18n con paridad exacta es/en/pt (483 claves en cada uno), estados vacíos y skeletons reales.
- **Honestidad de producto.** Los módulos no construidos se marcan «Próx.» y no se maquetan con
  datos falsos. Es la decisión correcta y hay que preservarla.

### Debilidades

- **El ciclo del día no cierra.** Se abre caja, se cobra — y no hay corte, ni arqueo, ni retiro,
  ni gasto, ni historial de ventas, ni devolución. Todo eso existe en la API y no está cableado.
- **Multi-sucursal deja la app inutilizable.** Un tenant con dos o más sucursales no tiene
  selector: el POS se queda en skeleton indefinidamente.
- **Techo duro de 100 registros.** Productos y clientes se piden con `limit: 100` sin paginación.
- **Sin offline de escritura.** Sin internet, ninguna venta se registra.
- **Sin red de seguridad de ingeniería.** Cero tests, cero crash reporting, cero analytics, sin
  ErrorBoundary, sin OTA updates.

### Riesgos principales

1. **Rechazo de tienda** por falta de eliminación de cuenta y política de privacidad, y por
   `usesCleartextTraffic: true`.
2. **Venta duplicada** por reintento tras timeout: `POST /orders` se envía sin clave de
   idempotencia.
3. **Descuadre de caja** por operar días consecutivos sin corte ni movimientos manuales.
4. **Abandono en el día 1**: el producto recién creado nace en `DRAFT` y el POS filtra por
   `ACTIVE`. El usuario crea su primer producto y no aparece para vender.

### Conclusión

Orbix Mobile es hoy un **prototipo avanzado con calidad de producción en lo que cubre**. La
distancia hasta un MVP comercial no está en reescribir nada: está en *cablear* lo que la API ya
expone y en cerrar los requisitos de tienda. La mayoría de los gaps de esta auditoría son de
complejidad **baja o media**.

---

## 2. Score comercial

## **46 / 100 — No listo para comercialización** (rango <50)

| Categoría | Score | Por qué |
|---|---:|---|
| **Producto** | 8 / 25 | Cubre alta de negocio, catálogo, clientes y una venta simple. No cubre caja completa, reportes, inventario operativo, CxC, compras, gastos ni multi-sucursal. Un negocio no puede operar su día completo. El journey se rompe en «cierre de caja». |
| **UX / UI** | 11 / 15 | Lo mejor de la app. Design system coherente, tema claro/oscuro, i18n con paridad total, skeletons, estados vacíos con copy útil, reduce-motion, ripples nativos, bottom sheets. Pierde por: trampa del estado `DRAFT`, sin banner global de offline, modo inmersivo que oculta reloj y batería en toda la app, POS de 2 columnas fijas también en tablet, y bloqueo a portrait. |
| **Funcionalidad** | 7 / 20 | Profundidad decente en lo implementado (variantes, imágenes, MFA, Google, wizard). Amplitud insuficiente: los módulos del drawer que importan para operar están como «Próx.» o ausentes, y 8 de 11 categorías de Configuración son inertes. Varios flujos terminan en callejón (venta creada → no consultable). |
| **Seguridad** | 9 / 15 | Tokens y refresh bien resueltos; permisos espejo del servidor; claves de query con `tenantId`; sin secretos ni `console.log`. Penaliza: `usesCleartextTraffic: true`, MMKV sin cifrar guardando caché con PII de clientes, sin idempotencia en `POST /orders`, sin `branchId` en las claves de caché, sin eliminación de cuenta. |
| **Performance** | 5 / 10 | Hermes + React Compiler + MMKV síncrono son buenas bases. Pero `limit: 100` sin paginación en las dos listas principales, filtrado de categorías en cliente sobre esa página, `FlatList` en vez de `FlashList` donde importa, y una rejilla de POS que carga 100 tarjetas con imagen de golpe. |
| **Arquitectura** | 4 / 5 | Capas limpias, sin dependencias inversas, un solo cliente HTTP, DTO↔modelo separados, decisiones documentadas en el propio código. Único descuento serio: **cero tests**. |
| **Store readiness** | 2 / 10 | No existe proyecto iOS. Sin eliminación de cuenta, sin política de privacidad ni términos en la app, sin crash reporting, sin metadatos ni capturas, permisos declarados que la app no usa. |

Escala: 90-100 comercialmente listo · 80-89 casi listo · 70-79 MVP funcional pero incompleto ·
50-69 prototipo avanzado · **<50 no listo para comercialización**.

---

## 3. Estado actual de funcionalidades

Leyenda de estado: `Completa` · `Parcial` · `Placeholder` · `No impl.` · `NO VERIFICADO`

| Módulo | Funcionalidad | Estado | Evidencia | Prio |
|---|---|---|---|---|
| Arranque | Splash animado + carga de fuentes | Completa | `src/app/index.tsx`, `src/app/_layout.tsx` | — |
| Arranque | Carrusel de bienvenida (3 slides) | Completa | `src/features/onboarding/slides.ts` | — |
| Auth | Registro email/contraseña | Completa | `src/features/auth/schemas.ts`, `auth-repository.ts` | — |
| Auth | Login | Completa | `src/services/auth/auth-service.ts:login` | — |
| Auth | Refresh token rotado, un solo vuelo | Completa | `src/services/api/http-client.ts:70-90` | — |
| Auth | MFA TOTP (challenge, setup, disable) | Completa | `src/features/settings/use-mfa.ts`, `(auth)/mfa-challenge.tsx` | — |
| Auth | Google Sign-In (PKCE) | Parcial | `use-google-auth.ts` — funciona; se apaga si no hay client IDs | P2 |
| Auth | Recuperar contraseña | Parcial | `(auth)/forgot-password.tsx:3` — el reset ocurre en la web, fuera de la app | P1 |
| Auth | Aceptación de términos / privacidad en alta | No impl. | sin coincidencias en `sign-up.tsx` ni `schemas.ts` | **P0** |
| Onboarding | Wizard: datos de empresa, país, moneda | Completa | `(wizard)/company-info.tsx` | — |
| Onboarding | Tipo de negocio (10 verticales) | Parcial | catálogo local en `constants/business-types.ts`; `GET /catalogs/business-types` no existe | P3 |
| Onboarding | Verificación de teléfono por OTP | Placeholder | `onboarding-repository.ts:32` lanza `NotImplementedError`; UI completa, se puede saltar | P2 |
| Onboarding | Creación de empresa (tenant + sucursal + Owner) | Completa | `POST /tenants/onboarding`, `(wizard)/success.tsx` | — |
| Onboarding | Checklist inicial / datos de ejemplo / tutorial | No impl. | tras el wizard se cae en Inicio con KPIs en cero | P1 |
| POS | Rejilla de productos + búsqueda + chips | Parcial | `(app)/pos/index.tsx:198` `limit: 100`; chips filtran en cliente sobre esa página | **P0** |
| POS | Carrito (+/−, totales, IVA estimado) | Parcial | `pos-totals.ts:1-10` — el IVA por defecto del tenant no llega al cliente, el preview subestima | P1 |
| POS | Cobro efectivo / tarjeta / transferencia | Parcial | `checkout-sheet.tsx` — un solo método; sin pago mixto, sin USD, sin crédito | P1 |
| POS | Creación de orden | Parcial | `dto/pos.dto.ts:52` — sin `customerId`, `variantId`, `discount`, `couponCode`, que la API sí acepta | **P0** |
| POS | Comprobante | Parcial | solo email (`POST /orders/:id/send-receipt`). Sin WhatsApp, PDF ni impresión | P1 |
| POS | Cancelación, devolución, venta suspendida | No impl. | API tiene `/cancel`, `/return`, `/refund`; el móvil no los llama | P1 |
| Caja | Apertura con fondo MXN + USD + tipo de cambio | Completa | `pos/index.tsx:68-175` `OpenCashSessionPanel` | — |
| Caja | Cierre / corte / arqueo | No impl. | API: `PATCH /cash-sessions/:id/close`, `/start-count`, `/active/count` | **P0** |
| Caja | Retiros, ingresos, gastos, movimientos manuales | No impl. | API: `POST /cash-sessions/active/movement`, `/withdraw` | **P0** |
| Caja | Selección de caja física (`CashRegister`) | No impl. | se abre sin `cashRegisterId`; con varias cajas por sucursal el comportamiento es indefinido | P1 |
| Productos | Alta/edición en wizard de 5 pasos | Completa | `features/products/product-form.tsx` | — |
| Productos | Variantes con nombre, SKU y código propios | Parcial | editables en el formulario, pero **no vendibles**: el carrito solo lleva `productId` | **P0** |
| Productos | Imagen (cámara/galería, WebP en R2) | Completa | `products-repository.ts:uploadImage` | — |
| Productos | Ajuste de existencias después del alta | No impl. | `product-schemas.ts:155` — `stock` se excluye del PATCH; `PATCH /products/:id/stock` nunca se llama | **P0** |
| Productos | Escaneo de código de barras | No impl. | sin `expo-camera` ni permiso `CAMERA`; el código es un campo de texto | **P0** |
| Productos | Importación masiva CSV | No impl. | API: `POST /products/import` + `GET /products/import/template` | P1 |
| Clientes | Alta, edición, búsqueda, listado | Completa | `(app)/customers/*`, `use-customer-mutations.ts` | — |
| Clientes | Configurar crédito (límite y días) | Parcial | `customer-form.tsx:143` — se configura, pero nada lo usa después | P1 |
| Clientes | Historial de compras, saldo, abonos | No impl. | API: `modules/core/receivables` con `/stats` y `/:id/payments` | P1 |
| Inicio | 6 KPIs de `GET /dashboard/stats` | Parcial | `dto/dashboard.dto.ts` — cifras acumuladas de siempre, sin filtro de fecha | **P0** |
| Inicio | Gráficos, comparativos, top productos | No impl. | API: `/reports/sales/daily`, `/products/top`, `/profit/monthly`… | P1 |
| Configuración | General (idioma, tema, pantalla de inicio, orden POS) | Completa | `panels/general-panel.tsx` | — |
| Configuración | Datos de la tienda (logo, nombre, teléfono, dirección) | Completa | `panels/store-panel.tsx` | — |
| Configuración | Productos, Caja, Pagos, Impuestos, Impresión, Usuarios, Integraciones, Acerca de | Placeholder | `features/settings/categories.ts:69-77` — 8 de 11 con `status: 'soon'` | P1 |
| Navegación | Tab bar + drawer con filtro por permisos | Completa | `(app)/_layout.tsx`, `app-drawer.tsx` | — |
| Navegación | Empleados, Reportes, Caja en el drawer | Placeholder | `app-drawer.tsx:62-69` — filas con chip «Próx.», sin ruta | P1 |
| Navegación | Selector de sucursal | No impl. | `route-guard.tsx:104` auto-selecciona solo si hay una; `useBranches()` está definido y nunca se usa | **P0** |
| Plataforma | Push notifications | No impl. | plugin `expo-notifications` declarado en `app.json`, cero código que lo use | P2 |
| Plataforma | Crash reporting / analytics | No impl. | sin Sentry, Crashlytics ni equivalente | **P0** |
| Plataforma | Actualizaciones OTA | No impl. | `expo.modules.updates.ENABLED = false` | P2 |

---

## 4. Funcionalidades internas

| Funcionalidad | Estado | Detalle verificado | Prio |
|---|---|---|---|
| Autenticación | Completa | Email/contraseña + Google PKCE + MFA TOTP con códigos de respaldo. Flujo de dos pasos tenant→branch respetado. | — |
| Autorización | Completa | Permisos del servidor, no hardcodeados. Tabs y drawer se ocultan por permiso; `products/new` defiende el deep-link con `Redirect`. | — |
| Tenants | Parcial | Selector de empresa existe (`select-tenant.tsx`), auto-selección si hay una sola. Sin crear/abandonar empresa fuera del wizard inicial. | P2 |
| Sucursales | No impl. | **Ningún selector.** Con >1 sucursal la sesión se queda sin `branchId` y el POS nunca sale del skeleton. | **P0** |
| Usuarios y roles | No impl. | Se consumen los permisos, no se administran. API tiene `roles`, `users`, `invitations`, `employees`. | P1 |
| Configuración del negocio | Parcial | Nombre, teléfono, dirección, logo y decimales. Sin moneda editable, sin impuestos, sin datos fiscales. | P1 |
| Planes / suscripción / límites | No impl. | El plan solo se muestra como etiqueta. `maxUsers`/`overUserLimit` llegan en `/auth/me/capabilities` y `TenantCapabilities` los descarta. | P1 |
| Feature flags por vertical | Parcial | `capabilities.businessFeatures.enableRecipes` habilita el tipo RECIPE. Es el único consumo real. | P3 |
| Manejo de sesión | Completa | Restore en frío desde caché MMKV, tolerante a red caída; 401 → un refresh compartido; logout limpia tokens + caché de queries. | — |
| Manejo de errores | Completa | `ApiError` con 10 tipos normalizados; retry solo en errores reintentables; mensajes traducidos. | — |
| ErrorBoundary de UI | No impl. | Un fallo de render en producción deja pantalla en blanco sin recuperación ni reporte. | P1 |
| Recuperación de contraseña | Parcial | La app pide el email; el reset se completa en la web. Sale de la app. | P1 |
| Eliminación de cuenta | No impl. | Requisito duro de ambas tiendas para apps con registro. | **P0** |
| Preferencias por dispositivo | Completa | Idioma, tema, pantalla de inicio, orden del POS. Persistidas en MMKV. | — |
| Conectividad | Parcial | NetInfo → `onlineManager` de React Query, corto-circuito en el interceptor. Solo un panel muestra el aviso; no hay banner global. | P1 |
| Cache y persistencia | Completa | React Query persistido a MMKV, `maxAge` 1 día, buster de versión. Claves con `tenantId`. | — |
| Sincronización offline de escrituras | No impl. | Sin cola, sin reintento diferido, sin resolución de conflictos. | P1 |
| Idempotencia de operaciones | No impl. | `POST /orders` sin clave. Timeout + reintento del usuario = venta duplicada. | **P0** |
| Telemetría / analytics | No impl. | Sin instrumentación de embudo. Imposible saber dónde abandona un usuario nuevo. | P1 |
| Crash reporting | No impl. | Sin visibilidad de fallos en producción. | **P0** |
| Soporte en app | No impl. | Categoría «Acerca de» marcada `soon`. Sin contacto, sin versión visible, sin enlaces legales. | **P0** |
| Control de versiones / update forzado | No impl. | Sin OTA y sin comprobación de versión mínima contra la API. | P2 |
| Auditoría de acciones | NO VERIFICADO | La API la registra por servicio; el móvil no muestra ni consulta bitácora. | P4 |
| Backups | NO VERIFICADO | Responsabilidad del backend; fuera del alcance móvil. | — |

---

## 5. Funcionalidades externas

| Funcionalidad | Estado | ¿Existe en la API? | Prio |
|---|---|---|---|
| Dashboard / resumen | Parcial | Sí — `/dashboard/stats` y 8 endpoints en `/reports` | **P0** |
| POS / venta rápida | Parcial | Sí — `POST /orders` con descuento, cupón, cliente y variante | **P0** |
| Historial de ventas / tickets | No impl. | Sí — `GET /orders`, `GET /orders/:id`, `/orders/stats` | **P0** |
| Devoluciones y cancelaciones | No impl. | Sí — `/cancel`, `/return`, `/refund` | P1 |
| Productos | Completa | Sí | — |
| Variantes | Parcial | Sí — `variantId` se persiste en `OrderItem` | **P0** |
| Categorías | Parcial | Sí — se listan y se pueden crear; sin pantalla de gestión | P2 |
| Inventario (entradas, salidas, ajustes) | No impl. | Sí — `PATCH /products/:id/stock` y por variante | **P0** |
| Movimientos / kardex | No impl. | Parcial — el motor existe; 5 TODOs «Fase 2» en `inventory.engine.ts` | P2 |
| Conteos físicos | No impl. | No — TODO «Fase 2» en el backend | P3 |
| Alertas de stock bajo | Parcial | Sí — `GET /products/low-stock`; el móvil solo muestra el conteo en un KPI | P1 |
| Transferencias entre sucursales | No impl. | No — TODO «Fase 2» | P4 |
| Compras / órdenes de compra | No impl. | Sí — `modules/retail/purchases` | P2 |
| Proveedores | No impl. | Sí — `modules/retail/suppliers` | P2 |
| Clientes | Completa | Sí | — |
| Cuentas por cobrar (fiado) | No impl. | Sí — `modules/core/receivables` con abonos | P1 |
| Cuentas por pagar | No impl. | Sí — `modules/core/payables` | P2 |
| Caja (corte, arqueo, retiros) | Parcial | Sí — solo la apertura está cableada | **P0** |
| Gastos | No impl. | Sí — vía `POST /cash-sessions/active/movement` y `/reports/expenses/monthly` | **P0** |
| Cotizaciones | No impl. | Sí — `modules/retail/service-quotes` | P4 |
| Apartados | No impl. | NO VERIFICADO en la API | P4 |
| Reportes exportables (PDF/CSV) | No impl. | Parcial — hay endpoints de datos, no de exportación | P2 |
| Catálogo público / tienda en línea | No impl. | Sí — `modules/core/store` y `store-orders` (WhatsApp) | P3 |
| Recetas e insumos (restaurante) | No impl. | Sí — `PUT /products/:id/recipe`, `/combo-items` | P3 |
| Comanda / KDS | No impl. | Sí — `modules/restaurant` completo | P3 |
| Cupones y promociones | No impl. | Sí — `modules/retail/coupons`, `couponCode` en la orden | P2 |
| Impresión de ticket (Bluetooth) | No impl. | Parcial — `modules/core/printer-configs` existe | P2 |

---

## 6. Gaps críticos

Sin resolver esto, no hay app comercial. No es opinión de alcance: son roturas del ciclo
operativo o requisitos de publicación.

### C1 · Multi-sucursal deja la app colgada

`route-guard.tsx:104-114` auto-selecciona sucursal solo cuando hay exactamente una. Con dos o
más, el comentario dice que «la pantalla de POS la resuelve explícitamente» — pero
`pos/index.tsx:392` calcula `showLoading = !hasBranch || isLoadingSession` y nunca muestra un
selector. **El POS queda en skeleton para siempre.** El hook `useBranches()` existe y no lo llama
nadie.

### C2 · La jornada no se puede cerrar

Se abre caja y se cobra. No hay corte, arqueo, retiro, ingreso ni gasto. La API expone
`PATCH /cash-sessions/:id/close`, `/start-count`, `/active/count`, `/active/movement`,
`/active/withdraw`. Operar dos días seguidos deja una sesión abierta indefinidamente y el
efectivo sin conciliar.

### C3 · El primer producto no se puede vender

`EMPTY_PRODUCT_FORM.status = DRAFT` (`product-schemas.ts:78`) y el POS filtra `status: 'ACTIVE'`
(`pos/index.tsx:199`). El campo de estado vive en el paso 5 de 5 del wizard de alta. Un usuario
nuevo crea su producto, va a vender y no está. Es el fallo de onboarding más caro que tiene la
app y se arregla cambiando un valor por defecto.

### C4 · El inventario no se puede mover

`toUpdateRequest` excluye `stock` a propósito (`product-schemas.ts:150-160`) porque la API lo
rechaza en el PATCH, y `PATCH /products/:id/stock` —que sí registra movimiento— no se llama
desde ningún sitio. Existencias solo se fijan al crear el producto: **no hay forma de recibir
mercancía desde el móvil.**

### C5 · Techo de 100 registros

`products/index.tsx:50`, `customers/index.tsx:42` y `pos/index.tsx:198` piden `limit: 100` sin
paginación ni scroll infinito. A partir del producto 101 el catálogo es invisible salvo por
búsqueda servidor. Además los chips de categoría cuentan sobre esa página, así que muestran
cifras falsas.

### C6 · Venta duplicada por reintento

`POST /orders` viaja sin clave de idempotencia y el timeout es de 15 s. Una orden que el servidor
procesó pero cuya respuesta se perdió deja al cajero pulsando otra vez. Con `OrdersService.create`
consumiendo inventario y moviendo caja atómicamente, la duplicación es doblemente cara.

### C7 · Requisitos duros de tienda ausentes

- **Eliminación de cuenta** — no existe. Ambas tiendas la exigen para apps con registro.
- **Política de privacidad y términos** — sin enlace en la app ni aceptación en el alta.
- **Contacto de soporte** — la categoría «Acerca de» está inerte.
- **`usesCleartextTraffic: true`** en `app.json` — se propaga a todo build de release.
- **No existe proyecto iOS.** Nunca se ha ejecutado prebuild de iOS; la app jamás ha corrido en
  un dispositivo Apple.

### C8 · Cero visibilidad en producción

Sin crash reporting, sin analytics, sin `ErrorBoundary` y sin OTA. Un fallo de render deja
pantalla en blanco, nadie se entera, y arreglarlo exige una release de tienda completa.

### C9 · Cero tests

Ni un `*.test.*`, ni `jest.config`, ni dependencia de testing en `package.json`. Con 19 000 líneas
y lógica de dinero (`pos-totals.ts`, `toCreateRequest`, `parsePhone`), es una apuesta.

---

## 7. Gaps importantes

No bloquean el lanzamiento, pero condenan la retención si no se cierran poco después.

| # | Gap | Consecuencia | Prio |
|---|---|---|---|
| I1 | Sin historial de ventas | Una venta cobrada desaparece de la vista. No hay forma de consultar, reimprimir ni corregir. Rompe la confianza en el primer error. | P1 |
| I2 | Sin escaneo de código de barras | Vender por búsqueda de texto es tres veces más lento. Expectativa mínima de mercado en retail. | P1 |
| I3 | Sin venta a crédito ni abonos | El fiado es la mecánica central del comercio pequeño en LatAm. Se configura el crédito del cliente y no sirve para nada. | P1 |
| I4 | Sin cliente en la venta | La API acepta `customerId`; sin él no hay historial por cliente, ni CxC, ni segmentación. | P1 |
| I5 | Sin descuento en la venta | La API acepta `discount` por línea y `couponCode`. Negociar precio en mostrador es cotidiano. | P1 |
| I6 | Sin gastos | «Cuánto gané» es incontestable sin registrar salidas. Es la mitad del libro de Treinta. | P1 |
| I7 | KPIs sin dimensión temporal | `totalRevenue` es acumulado histórico. No responde «cuánto vendí hoy», que es la pregunta que abre la app cada mañana. | P1 |
| I8 | Sin importación CSV | Quien migra de Excel tiene que teclear 400 productos en un teléfono. Barrera de entrada más alta del producto. | P1 |
| I9 | Carrito no persistido | `useState` puro. Cerrar la app o recibir una llamada larga pierde la venta en curso. | P1 |
| I10 | Sin banner global de offline | Solo un panel de Configuración avisa. En el POS, sin señal, el usuario descubre el problema al cobrar. | P1 |
| I11 | Moneda cae a MXN sin `tenant:view` | Un usuario POS sin ese permiso ve pesos mexicanos aunque el negocio sea colombiano. Bloquea la expansión regional. | P1 |
| I12 | IVA del preview subestimado | `tenant.settings.defaultTaxRate` no llega al cliente; un producto sin tasa propia aporta 0 al preview y el total del servidor sale mayor. El cliente ve un número y paga otro. | P1 |
| I13 | Sin gestión de usuarios/empleados | El dueño no puede dar de alta a su vendedor sin entrar al panel web. | P1 |
| I14 | Sin límites de plan en la UX | `overUserLimit` llega del servidor y se descarta. El usuario topa contra un 4xx sin explicación ni ruta de upgrade. | P1 |
| I15 | `branchId` ausente de las claves de caché | Precio y existencia son por sucursal. Al cambiar de sucursal se muestran datos de la anterior hasta que expire el `staleTime`. | P1 |
| I16 | Reset de contraseña fuera de la app | Rompe la promesa de «todo desde el móvil» justo en el momento de mayor fricción. | P1 |
| I17 | Sin comprobante por WhatsApp | Solo email. En LatAm el ticket se manda por WhatsApp; el email de un cliente de mostrador casi nunca se tiene. | P1 |
| I18 | Modo inmersivo global | `withImmersiveMode.js` oculta barra de estado y navegación en toda la app. Esconde hora, batería y notificaciones. Tiene sentido en modo POS, no en Configuración. | P2 |
| I19 | Tablet sin tratamiento | `useIsTablet()` solo lo usa Configuración. El POS mantiene 2 columnas en una pantalla de 10", y Android está bloqueado a portrait. | P2 |
| I20 | 8 de 11 categorías de Configuración inertes | Honesto, pero el usuario percibe un producto a medio hacer cada vez que entra. | P2 |

---

## 8. Comparativa Orbix vs Treinta

Treinta es el referente de «libro de negocio» para el comercio pequeño en LatAm: ventas y gastos,
fiado, inventario ligero, catálogo compartible y reportes, con onboarding de minutos. La
comparación evalúa *expectativa de mercado*, no paridad de funciones.

> **Las capacidades exactas de la versión actual de Treinta REQUIEREN VALIDACIÓN** contra su app
> publicada; lo que sigue se apoya en su propuesta pública y estable.

| Área | Orbix Mobile | Treinta | Gap | Clasificación |
|---|---|---|---|---|
| Onboarding | Wizard de 4 pasos, sólido, sin checklist ni datos de ejemplo | Registro por teléfono, primera venta en minutos | Medio | `MUST HAVE` |
| Ventas | Cobro simple, sin cliente ni descuento | Registro rápido de venta con cliente y fiado | Alto | `MUST HAVE` |
| POS | Rejilla + carrito + 3 métodos de pago | Más libro de caja que POS de mostrador | *Orbix por delante* | `ORBIX DIFFERENTIATOR` |
| Productos | Alta rica: tipo, impuestos, imagen, comparativo | Alta mínima: nombre, precio, costo, stock | *Orbix por delante* | `ORBIX DIFFERENTIATOR` |
| Variantes | Editables, no vendibles | Soporte limitado | Medio | `MUST HAVE` |
| SKU | Sí, a nivel producto y variante | Básico | *Orbix por delante* | `ORBIX DIFFERENTIATOR` |
| Barcode | Campo de texto, sin escáner | Escáner con cámara | Alto | `MUST HAVE` |
| Inventario | Solo al crear el producto | Entradas y salidas desde la app | Alto | `MUST HAVE` |
| Conteos | No | No / limitado | Bajo | `NO PRIORITY` |
| Stock bajo | Solo un contador en el KPI | Alertas accionables | Medio | `SHOULD HAVE` |
| Compras | No | Registro de compras a proveedor | Medio | `SHOULD HAVE` |
| Proveedores | No | Sí, con deuda asociada | Medio | `SHOULD HAVE` |
| Clientes | CRUD completo con crédito configurable | Clientes con deuda | Bajo | `SHOULD HAVE` |
| CxC / fiado | No | **Función central del producto** | Alto | `MUST HAVE` |
| Caja | Solo apertura | Libro de caja diario | Alto | `MUST HAVE` |
| Gastos | No | **Mitad del producto** | Alto | `MUST HAVE` |
| Reportes | 6 KPIs acumulados | Ventas, ganancia y gastos por periodo, con gráficas | Alto | `MUST HAVE` |
| Comprobantes | Email | Compartir por WhatsApp | Alto | `MUST HAVE` |
| Catálogo | No (existe en la API para web) | Sí, enlace de catálogo | Medio | `SHOULD HAVE` |
| Recetas | No en móvil (sí en API) | No | *Orbix por delante* | `ORBIX DIFFERENTIATOR` |
| Multiusuario | Modelo RBAC completo, sin administración en app | Limitado | Medio | `SHOULD HAVE` |
| Multi-sucursal | Modelo completo, **roto en la app** | No es su fuerte | Alto (bug) | `MUST HAVE` |
| Notificaciones | No | Sí | Medio | `SHOULD HAVE` |
| Offline | Solo lectura desde caché | Opera sin conexión | Alto | `MUST HAVE` |
| Web | ERP web completo + POS web | Portal más ligero | *Orbix muy por delante* | `ORBIX DIFFERENTIATOR` |
| Suscripciones | Planes en el backend, nada en la app | Freemium con Pro | Alto | `MUST HAVE` |
| Soporte | No hay canal en la app | Chat integrado | Alto | `MUST HAVE` |

**Lectura.** Orbix es **más profundo** donde ya llegó (catálogo, variantes, impuestos, RBAC,
multi-tenant, verticales) y **más superficial** en lo que Treinta resolvió primero: el dinero del
día. Un tendero no compara arquitecturas — compara si la app le dice cuánto vendió, cuánto gastó
y quién le debe. Hoy Orbix no responde ninguna de las tres.

---

## 9. Oportunidades para superar a Treinta

### El argumento en una frase

> **«Treinta es la libreta de tu negocio. Orbix es el sistema con el que tu negocio crece — y
> sigue siendo igual de simple el primer día.»**

### Cinco ventajas defendibles

1. **Techo de crecimiento.** Treinta te acompaña hasta que necesitas una segunda sucursal, roles
   reales o compras. Orbix ya tiene ese backend construido: multi-tenant por columna, RBAC
   granular, sucursales, cajas físicas por puesto, planes. Un cliente que crece no tiene que
   migrar. Esa es la venta empresarial, no la de descarga.
2. **Verticales de verdad, no una app genérica.** `BusinessVertical` + `businessFeatures` ya
   permiten que un restaurante vea recetas, insumos, comanda y KDS, y una tienda no. Nadie más en
   este segmento entrega un POS de restaurante y uno de retail desde la misma descarga.
3. **POS de mostrador real.** Treinta registra ventas; Orbix ya tiene rejilla, carrito, sesión de
   caja con doble divisa y tipo de cambio fijado por sesión, y autorización por PIN de supervisor
   en el backend. Con corte y devoluciones cableadas, Orbix pasa de «libreta» a «terminal».
4. **Continuidad móvil ↔ tablet ↔ web.** El dueño cierra caja en el teléfono, el cajero cobra en
   la tablet, la contadora revisa en el ERP web. Mismo dato, misma sesión, sin exportar nada.
5. **Offline con integridad.** Ya hay motor de idempotencia en el ecosistema y una arquitectura de
   repositorios que aísla el transporte. Una cola de ventas offline bien hecha —con clave de
   idempotencia, no con «reintentar y rezar»— es un diferenciador demostrable en demo: modo avión,
   tres ventas, se restaura la señal, cero duplicados.

### Dónde NO competir

No pelear por el catálogo compartible ni por la red social de negocios. Es donde Treinta tiene
ventaja de escala y donde Orbix gastaría meses para empatar en algo que no es su tesis.

---

## 10. Módulos recomendados

Propuesta con una diferencia respecto a la estructura por dominio: **separar el módulo JORNADA**.
Lo que hoy está roto no es «caja» ni «ventas» por separado, es el ciclo abrir → operar → cerrar.
Tratarlo como un módulo con dueño evita que el corte vuelva a quedar a medias.

### Núcleo

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Identidad** | Entrar, salir, recuperar y eliminar la cuenta | Todos | — | P0 | Baja | Alto | Parcial |
| **Contexto** | Empresa y sucursal activas, y cambiarlas | Dueño, gerente | Identidad | P0 | Baja | Alto | Parcial |
| **Equipo** | Invitar personas, asignar rol, PIN de supervisor | Dueño | Contexto | P1 | Media | Alto | Falta |
| **Plan** | Estado, límites, upgrade, bloqueos suaves | Dueño | Contexto | P1 | Media | Alto | Falta |
| **Ajustes** | Negocio, moneda, impuestos, impresión | Dueño | Contexto | P1 | Baja | Medio | Parcial |

### Jornada — el ciclo del día

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Apertura** | Elegir caja, declarar fondo | Cajero | Contexto | P0 | Baja | Alto | Parcial |
| **Venta** | Cobrar rápido: escáner, variantes, cliente, descuento, pago mixto | Cajero | Apertura, Catálogo | P0 | Media | Alto | Parcial |
| **Movimientos** | Gastos, retiros, ingresos durante el turno | Cajero, dueño | Apertura | P0 | Baja | Alto | Falta |
| **Tickets** | Historial, detalle, reenvío, cancelación, devolución | Cajero, dueño | Venta | P0 | Media | Alto | Falta |
| **Corte** | Arqueo, diferencias, cierre firmado | Cajero, supervisor | Apertura, Movimientos | P0 | Media | Alto | Falta |

### Catálogo e inventario

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Catálogo** | Productos, variantes, categorías, imágenes | Dueño | Contexto | P0 | Baja | Alto | Listo |
| **Existencias** | Ajustes con motivo, entradas, alertas de stock bajo | Dueño, almacén | Catálogo | P0 | Media | Alto | Falta |
| **Importación** | CSV de productos y clientes con plantilla | Dueño nuevo | Catálogo | P1 | Media | Alto | Falta |
| **Abasto** | Proveedores, compras, recepción | Dueño | Existencias | P2 | Alta | Medio | Falta |

### Dinero

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Fiado (CxC)** | Venta a crédito, saldo, abonos, liquidación | Dueño | Venta, Clientes | P1 | Media | Alto | Falta |
| **Deudas (CxP)** | Lo que debe a proveedores | Dueño | Abasto | P2 | Media | Medio | Falta |
| **Pulso** | Hoy / semana / mes: ventas, ganancia, gastos, top productos | Dueño | Jornada | P0 | Media | Alto | Parcial |

### Relación

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Clientes** | Directorio, historial, crédito | Dueño, cajero | Contexto | P1 | Baja | Medio | Parcial |
| **Comprobante** | WhatsApp, email, PDF, impresora Bluetooth | Cajero | Venta | P1 | Media | Alto | Parcial |
| **Avisos** | Push: stock bajo, caja abierta, cobro vencido | Dueño | Plataforma | P2 | Media | Medio | Falta |

### Restaurante (vertical)

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Comanda** | Mesas, pedidos, cuentas | Mesero | Jornada | P3 | Alta | Alto en su nicho | Falta |
| **Cocina (KDS)** | Cola de preparación | Cocina | Comanda | P3 | Alta | Medio | Falta |
| **Recetas** | Insumos, escandallo, descuento por venta | Dueño | Catálogo | P3 | Media | Alto en su nicho | Falta |

### Plataforma (transversal)

| Módulo | Objetivo | Usuario | Depende de | Prio | Complej. | Impacto | Estado |
|---|---|---|---|---|---|---|---|
| **Resiliencia** | Offline, cola idempotente, ErrorBoundary, OTA | Todos | — | P0 | Alta | Alto | Parcial |
| **Observabilidad** | Crash reporting, analytics de embudo | Equipo | — | P0 | Baja | Alto | Falta |
| **Cumplimiento** | Privacidad, términos, borrado de cuenta, soporte | Todos | — | P0 | Baja | Bloqueante | Falta |

---

## 11. Roadmap

Cinco fases. La regla que las ordena: **nada entra en una fase si su valor depende de algo de una
fase posterior.**

### Fase 0 — Hardening `P0`

**Objetivo:** que lo que ya existe deje de romperse. Ninguna funcionalidad nueva.
**Complejidad global:** baja.

- Selector de sucursal + `branchId` en las claves de caché (desbloquea C1 e I15).
- Producto nuevo nace `ACTIVE`, o selector de estado en el paso 1 (C3).
- Paginación real en productos y clientes; `FlashList` en las dos listas y en la rejilla del POS (C5).
- Clave de idempotencia en `POST /orders`; el reintento devuelve la misma orden (C6).
- Carrito persistido en MMKV, con purga al cambiar de tenant o sucursal (I9).
- Banner global de sin conexión (I10).
- `ErrorBoundary` raíz + Sentry (o equivalente) con release y usuario anonimizado (C8).
- Quitar `usesCleartextTraffic`, bloquear `RECORD_AUDIO` y revisar permisos generados.
- Suite de tests mínima sobre dinero: `pos-totals`, `toCreateRequest`, `toUpdateRequest`,
  `parsePhone`, mapeo de `ApiError` (C9).

### Fase 1 — MVP comercial `P0`

**Objetivo:** que un negocio real pueda operar su día completo y la app pueda publicarse.
**Depende de:** Fase 0. **Complejidad:** media.

- **Cierre de jornada**: corte, arqueo, diferencias, autorización por PIN (C2).
- **Movimientos de caja**: gasto, retiro, ingreso, con motivo (I6).
- **Tickets**: listado, detalle, reenvío de comprobante, cancelación (I1).
- **Ajuste de existencias** con motivo, desde el detalle del producto (C4).
- **Pulso del día**: ventas de hoy / semana / mes desde `/reports/sales/daily`, ganancia, gastos,
  top 5 productos (I7).
- **Cumplimiento**: eliminación de cuenta, privacidad, términos, soporte, versión visible (C7).
- **Proyecto iOS**: prebuild, permisos con textos en español, primera build de TestFlight (C7).
- Reset de contraseña completo dentro de la app vía deep link (I16).
- Moneda del tenant en `SelectTenantResponseDto` para no depender de `tenant:view` (I11).

### Fase 2 — Competitivo `P1`

**Objetivo:** empatar con la expectativa de mercado y quitar las barreras de adopción.
**Depende de:** Fase 1. **Complejidad:** media.

- **Escáner de código de barras** en POS y en el alta de producto (I2).
- **Fiado**: venta a crédito, saldo del cliente, abonos, liquidación (I3, I4).
- **Descuento y cupón** en la venta (I5).
- **Variantes vendibles**: selector en el POS, `variantId` en la orden.
- **Devoluciones** totales y parciales (I1).
- **Importación CSV** de productos y clientes con la plantilla que ya expone la API (I8).
- **Comprobante por WhatsApp** y PDF (I17).
- **Equipo**: invitar usuario, asignar rol, PIN de supervisor (I13).
- **Plan y límites**: estado, aviso al topar, ruta de upgrade sin destruir datos (I14).
- Pago mixto y soporte de USD en el cobro, coherente con el tipo de cambio de la sesión.

### Fase 3 — Diferenciación `P3`

**Objetivo:** pasar de «alternativa» a «mejor opción». **Complejidad:** alta.

- **Ventas offline con cola idempotente**: modo avión, cero duplicados, resolución de conflictos
  de stock explícita.
- **Vertical restaurante**: comanda, KDS, recetas e insumos — mercado que Treinta no atiende.
- **Modo terminal** para tablet: landscape, rejilla adaptativa, modo inmersivo *solo aquí*, login
  por PIN de empleado.
- **Impresión Bluetooth** de ticket, sobre `printer-configs`.
- **Avisos push**: stock bajo, caja abierta al cierre del día, cobro vencido.
- **Accesibilidad**: ejecutar las fases 0-3 del plan ya escrito en `docs/accessibility-plan.md`.

### Fase 4 — Escala `P4`

**Objetivo:** sostener miles de tenants y catálogos grandes. **Complejidad:** alta.

- Catálogo local con búsqueda incremental para 10 000+ SKUs (SQLite o índice en MMKV).
- Abasto: proveedores, compras, recepción parcial, CxP.
- Transferencias entre sucursales y conteos físicos (requieren cerrar los TODOs «Fase 2» de
  `inventory.engine.ts`).
- OTA updates con canal de release y rollback.
- Reportes exportables (PDF/CSV) y programados.

---

## 12. App Store readiness

> **La app nunca se ha compilado para iOS.** No existe carpeta `ios/` y no hay evidencia de un
> prebuild de Apple. Todo lo que sigue está *sin ejecutar*, no sin verificar.

| | Ítem | Prio |
|---|---|---|
| `~` | Bundle Identifier — `com.orbix.mobile` declarado en `app.json` | Declarado |
| `~` | Versión y build — `1.0.0`; `appVersionSource: remote` con `autoIncrement` en EAS | Declarado |
| ` ` | Proyecto iOS generado (`expo prebuild -p ios`) | **P0** |
| ` ` | Certificados y provisioning profiles | **P0** |
| ` ` | Cuenta de Apple Developer y App Store Connect | **P0** |
| `~` | Info.plist — solo `ITSAppUsesNonExemptEncryption: false`. Los textos de permiso de fotos/cámara los aporta el plugin de `expo-image-picker` **en inglés genérico**; hay que fijarlos en español | P1 |
| ` ` | Privacy manifest (`PrivacyInfo.xcprivacy`) y declaraciones de required-reason APIs — `REQUIERE VALIDACIÓN ACTUAL CONTRA POLÍTICAS DE STORE` | **P0** |
| ` ` | Eliminación de cuenta desde la app | **P0** |
| ` ` | Política de privacidad accesible desde la app y desde la ficha | **P0** |
| ` ` | Términos y condiciones + aceptación en el alta | **P0** |
| ` ` | Contacto de soporte visible | **P0** |
| ` ` | Capturas por tamaño de dispositivo, icono 1024, descripción, palabras clave | **P0** |
| `~` | Launch screen — `expo-splash-screen` configurado; falta validar en simulador real | P1 |
| `~` | Soporte de tablet — `supportsTablet: true`, pero solo Configuración tiene layout de tablet. Apple revisa el iPad si se declara | P1 |
| ` ` | Cuenta de demostración para el revisor (la app exige registro y empresa) | **P0** |
| ` ` | Declaración de recopilación de datos (App Privacy) | **P0** |
| ` ` | Crash reporting antes de publicar | **P0** |
| `x` | Sin compras dentro de la app hoy — no aplica *restore purchases*. Cuando se cobre suscripción desde iOS, `REQUIERE VALIDACIÓN ACTUAL CONTRA POLÍTICAS DE STORE` qué puede quedar fuera de IAP | — |

---

## 13. Google Play readiness

Aquí el estado es mejor: hay builds de release compiladas localmente y documentadas en
`docs/build-android-release.md`. Pero no publicables tal cual.

| | Ítem | Prio |
|---|---|---|
| `x` | `applicationId` / `package` — `com.orbix.mobile` | OK |
| `~` | `versionCode 1` / `versionName 1.0.0`; EAS los gestiona con `appVersionSource: remote` | P2 |
| ` ` | **Firma de release.** `android/app/build.gradle` apunta el `release` al `debug.keystore`, y la guía de build lo da por bueno. Play rechaza un AAB firmado con la clave de debug. Generar keystore de producción (o delegar en EAS credentials) | **P0** |
| `x` | App Bundle en el perfil de producción de EAS (`buildType: app-bundle`) | OK |
| `x` | R8 y shrink de recursos activos en release | OK |
| `~` | `proguard-rules.pro` solo cubre Reanimated. Verificar MMKV, Nitro Modules y Hermes en un release real | P1 |
| ` ` | **`usesCleartextTraffic="true"`** en el manifest, vía `expo-build-properties`. Permite HTTP en producción y hay que declararlo en Data Safety | **P0** |
| ` ` | **Permisos que la app no usa**: `RECORD_AUDIO` (lo mete el plugin de image-picker), `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`. `SYSTEM_ALERT_WINDOW` exige declaración de política | **P0** |
| ` ` | Falta `POST_NOTIFICATIONS` si se activan push (Android 13+); hoy el plugin está declarado y no hay código | P2 |
| ` ` | Falta `CAMERA` — necesario para el escáner de códigos | P1 |
| `x` | `targetSdk 36` / `minSdk 24` — al día | OK |
| `x` | `allowBackup="false"` + reglas de extracción de datos para SecureStore | OK |
| `x` | Adaptive icon con fondo `#0A0E1A` | OK |
| `x` | Deep links `orbix://` y `com.orbix.mobile://` registrados | OK |
| ` ` | Sin App Links verificados por dominio (necesarios para el reset de contraseña por email) | P1 |
| ` ` | Data Safety form, política de privacidad, eliminación de cuenta (también por web, según la política de borrado de datos) — `REQUIERE VALIDACIÓN ACTUAL CONTRA POLÍTICAS DE STORE` | **P0** |
| ` ` | Ficha de Play: capturas, gráfico destacado, descripción, categoría, clasificación de contenido | **P0** |
| ` ` | Crash reporting (Play Console da ANR/crashes, pero sin symbols de JS no sirve para Hermes) | **P0** |
| `~` | Reproducibilidad del build: la guía advierte que `android/` se regenera y «hay varios ajustes manuales que se pierden». Todo ajuste debe vivir en un config plugin | P1 |

---

## 14. Seguridad

### Lo que está bien resuelto

- Tokens en keychain con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; keychain corrupto se trata como «sin
  sesión» en vez de bloquear la app.
- Un solo refresh en vuelo compartido por todas las requests: la API rota el refresh token en cada
  uso y refrescar en paralelo los invalidaría entre sí.
- Rutas públicas nunca llevan Bearer ni disparan refresh, y hay guarda contra bucle refresh↔retry.
- Permisos leídos del servidor, con defensa de deep-link en `products/new`.
- Claves de query con `tenantId`: la caché de un tenant no se mezcla con la de otro.
- Sin secretos en el repositorio, sin `console.log`, `.env` ignorado por git.
- Validación con Zod espejo de los `class-validator` del servidor, y errores mapeados a campo.

### Hallazgos

| # | Hallazgo | Severidad | Detalle |
|---|---|---|---|
| S1 | Tráfico en claro habilitado | **Crítica** | `usesCleartextTraffic: true` en `app.json`. Un build de producción acepta HTTP: MITM en Wi-Fi de local comercial. Existe por comodidad de desarrollo (LAN `192.168.x.x:3002`); debe quedar solo en el perfil de desarrollo. |
| S2 | Sin eliminación de cuenta | **Crítica** | Requisito de tienda y de privacidad. No hay flujo ni endpoint consumido. |
| S3 | Sin idempotencia en operaciones de dinero | **Crítica** | `POST /orders`, `POST /cash-sessions` y los futuros abonos son reintentables sin clave. Riesgo de doble cargo e inventario descontado dos veces. |
| S4 | Caché con PII sin cifrar | Alta | MMKV se instancia sin `encryptionKey` y guarda la caché persistida de React Query — que incluye email, teléfono y ciudad de clientes, y el catálogo completo. `allowBackup=false` mitiga en Android; en un dispositivo con root o jailbreak, se lee en claro. |
| S5 | `branchId` fuera de las claves de caché | Alta | Precio y existencia son por sucursal. Al cambiar de sucursal la app puede pintar datos de la anterior. No es fuga entre tenants, sí entre contextos del mismo tenant. |
| S6 | Permisos declarados que la app no usa | Alta | `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, almacenamiento externo. Amplían superficie y complican la revisión de Play. |
| S7 | Contraseña mínima de 6 caracteres | Media | Espeja al backend, así que corregirlo exige tocar ambos. Para una app que da acceso a caja y ventas es bajo. |
| S8 | Sin biometría | Media | Un teléfono de mostrador queda con sesión abierta todo el día. Falta re-autenticación para acciones sensibles (corte, cancelación). |
| S9 | Sin protección de capturas ni portapapeles | Baja | Aceptable para un POS. Anotar si en algún momento se muestran datos fiscales o de tarjeta. |
| S10 | Certificate pinning ausente | Baja | Razonable para esta etapa. Prioritario solo si S1 no se corrige. |
| S11 | Deep links sin verificación de dominio | Media | Los esquemas `orbix://` los puede reclamar otra app. Importante antes de cablear el reset de contraseña por enlace. |
| S12 | Aislamiento multi-tenant | Sin hallazgos | El tenant viaja en el JWT y el servidor lo resuelve desde `AsyncLocalStorage`; el cliente nunca lo manda en el body. No se detectaron IDOR ni IDs manipulables desde el móvil. |

---

## 15. Performance

### ¿Aguanta 5 000 / 10 000 / 50 000 productos?

**No aguanta ni 200.** No por lentitud, por diseño: `limit: 100` sin paginación significa que los
productos 101 en adelante *no existen* para la app salvo que se busquen por nombre. El problema
aparece antes que cualquier cuello de botella de rendimiento.

| # | Hallazgo | Impacto | Prio |
|---|---|---|---|
| P1 | Sin paginación ni scroll infinito en productos, clientes y POS | Catálogo invisible más allá de 100 registros | **P0** |
| P2 | `FlatList` donde debería ir `FlashList` | `@shopify/flash-list` está instalado y solo se usa en la lista de empresas (1-3 filas). Las listas grandes usan `FlatList` | P1 |
| P3 | Chips de categoría cuentan sobre la página cargada | Cifras incorrectas y filtrado en cliente en vez de en servidor | P1 |
| P4 | Rejilla del POS carga 100 tarjetas con imagen remota de golpe | Pico de memoria y de red al abrir la pantalla más usada | P1 |
| P5 | Orden del catálogo en cliente (`[...products].sort`) | Menor, pero se agrava con la paginación pendiente | P2 |
| P6 | Caché persistida sin poda | `gcTime` de 1 día sobre MMKV; con catálogos grandes el blob crece sin techo y se serializa con `throttleTime: 1000` | P2 |
| P7 | Arranque en frío | Bien resuelto: sesión y tema leídos síncronamente de MMKV, splash retenido hasta que la fuente carga, fallback si falla | OK |
| P8 | Renders | React Compiler activo, `memo` en tarjetas y filas, `useCallback` consistente. No se detectaron re-renders evidentes | OK |
| P9 | Memory leaks | Suscripciones de `networkStatus` y `currencyFormatStore` devuelven *unsubscribe*. Sin hallazgos — `NO VERIFICADO` sin profiling en dispositivo | NV |

---

## 16. UX / UI

**Veredicto: sí parece una app móvil comercial, no una web adaptada.** Gestos nativos, bottom
sheets, ripples, transiciones con Reanimated, tab bar propia, teclados correctos por campo, safe
areas respetadas. Es el área más fuerte del producto.

| # | Problema | Dónde | Prio |
|---|---|---|---|
| U1 | Producto nuevo nace `DRAFT` y el POS solo muestra `ACTIVE`. El campo está en el paso 5 de 5 | `product-schemas.ts`, `pos/index.tsx` | **P0** |
| U2 | Sin sucursal, el POS muestra skeleton sin explicación ni salida | `pos/index.tsx:392` | **P0** |
| U3 | Tras el wizard se aterriza en Inicio con seis ceros y ninguna indicación de qué hacer | `(app)/index.tsx` | P1 |
| U4 | Sin conexión, el usuario se entera al pulsar «Cobrar» | global | P1 |
| U5 | Modo inmersivo en toda la app oculta reloj, batería y notificaciones | `plugins/withImmersiveMode.js` | P2 |
| U6 | POS a 2 columnas fijas también en tablet; Android bloqueado a portrait | `pos/index.tsx`, `AndroidManifest` | P2 |
| U7 | El total del preview puede ser menor que el cobrado, por el IVA por defecto del tenant | `pos-totals.ts` | P1 |
| U8 | Sin deshacer en acciones destructivas (eliminar producto, quitar variante). Hay confirmación, no reversión | `product-form.tsx` | P2 |
| U9 | Incrementar cantidad no respeta el stock disponible; solo se bloquea agregar cuando ya está en cero | `pos/index.tsx:increment` | P1 |
| U10 | Drawer y Configuración con muchas filas «Próx.» — honesto, pero da sensación de producto incompleto | `app-drawer.tsx`, `categories.ts` | P2 |

### Accesibilidad

Existe `docs/accessibility-plan.md`, con fases concretas y honesto sobre lo que falta. Base ya
presente: `allowFontScaling`, `useReducedMotion` en cuatro componentes, botones ≥44 dp con
`hitSlop`, `accessibilityRole`/`State`/`Label` en tab bar, botones y tarjetas de producto.

| Pendiente | Severidad |
|---|---|
| Auditoría de contraste WCAG AA de `theme/tokens.ts`. Sospechosos: `mutedForeground` y `onDarkMuted: rgba(255,255,255,.55)` sobre gradientes | Alta |
| Barrido de 44 dp fuera del design system: chips del POS, iconos de acción en filas, dots del stepper | Alta |
| Labels de lector de pantalla en iconos sin texto y badges de estado | Media |
| Orden de foco verificado con TalkBack y VoiceOver reales | Media |
| Escala de fuente propia, independiente del ajuste del SO, y modo de alto contraste | Media |
| Regla de lint que exija `accessibilityLabel` en `Pressable` sin texto | Baja |

---

## 17. Arquitectura

### Lo que hay que conservar

- **Flujo de datos en una dirección**: `app/ → features/ → repositories/ → services/api`. Ninguna
  pantalla importa axios. Es lo que hace que cablear módulos nuevos sea barato.
- **DTO ≠ modelo.** Los `Decimal` de Prisma llegan como string y se normalizan en el repositorio,
  no en la UI.
- **Un solo `ApiError`** con 10 tipos y una regla de reintento (`isRetryable`) que la caché respeta.
- **Singletons síncronos** (`authTokenStore`, `networkStatus`, `currencyFormatStore`) suscribibles
  con `useSyncExternalStore`, para estado que muchas hojas leen en cada render.
- **Los comentarios explican el porqué**, no el qué, y varios documentan bugs reales ya
  corregidos. Es documentación viva de alta calidad.

### Problemas

| # | Problema | Recomendación | Prio |
|---|---|---|---|
| A1 | Cero tests | Empezar por lo que calcula dinero y por los mapeos DTO↔modelo. No perseguir cobertura: perseguir los cuatro archivos donde un error cuesta dinero. | **P0** |
| A2 | Claves de query escritas a mano en cinco sitios | `query-keys.ts` solo cubre auth, catalogs y tenant. Productos, clientes, categorías, sucursales y cash-sessions declaran arrays inline. Centralizarlas antes de crecer, o la invalidación se romperá en silencio. | P1 |
| A3 | Sin capa de sincronización | Una cola offline no se añade a posteriori sin tocarlo todo. Definir ahora dónde vive (entre `features` y `repositories`) aunque se implemente en Fase 3. | P1 |
| A4 | Ajustes nativos manuales que se pierden en cada prebuild | Lo dice la propia guía de build. Todo debe estar en un config plugin; si no, no es reproducible en CI. | P1 |
| A5 | `apps/mobile/orbix-app` sigue en disco | El README dice que se eliminó en `cec732b`; la carpeta existe y el workspace la incluye con `apps/**`. Confirmar y borrar, o documentar por qué sigue. | P2 |
| A6 | `expo-notifications` declarado sin uso | Añade un plugin, permisos y peso de bundle a cambio de nada. Quitarlo hasta que haya push. | P2 |
| A7 | 10 logs de build (`run_release*.log`, ~500 KB) en la raíz del paquete | Deberían estar en `.debug-captures/`, que ya está ignorado. | P3 |
| A8 | Deriva entre el móvil y los contratos de la API | `BACKEND-GAPS.md` ya tiene un punto resuelto sin actualizar. El mismo patrón se documenta en el vault para `pos-web`. Sin tipos compartidos, la deriva es estructural. | P2 |

---

## 18. Riesgos técnicos

1. **La deuda de tests se vuelve impagable.** Cada módulo nuevo que se cablee sin test hace más
   caro empezar. El momento de establecer el hábito es el primer módulo de Fase 1, no el décimo.
2. **La cola offline se pospone hasta que sea imposible.** Reintento idempotente, resolución de
   conflictos de stock y orden de operaciones son decisiones que atraviesan repositorios, caché y
   UI. Añadirla en Fase 3 sobre veinte módulos cuesta cinco veces más que sobre cinco.
3. **Deriva de contratos con la API.** Los DTO del móvil son copias a mano. Un campo que cambia en
   NestJS no rompe el typecheck del móvil: rompe en producción. Un `packages/types` compartido o
   generación desde Swagger lo cierra.
4. **Builds no reproducibles.** Mientras existan «ajustes manuales» tras el prebuild, no hay CI de
   release fiable ni respuesta rápida a un incidente.
5. **El techo de 100 se normaliza.** Es tan invisible en desarrollo (con datos de prueba) como
   devastador en producción. Cada pantalla nueva que se copie del patrón actual lo hereda.
6. **Fragmentación de clientes.** Hay POS web, ERP web, comandera Expo, POS Flutter en scaffold y
   esta app. El vault ya registra como pendiente decidir el futuro del POS Flutter. Cinco clientes
   contra una API sin SDK compartido multiplica la deriva por cinco.
7. **Modelo de variantes a medias.** ADR-0030 pone el código de barras en la unidad vendible; la
   app deja la variante editable pero no vendible. Mientras dure, el inventario por variante no
   cuadra con lo que se vende.

---

## 19. Riesgos comerciales

Ordenados por cuándo abandona el usuario.

| Momento | Qué pasa | Probabilidad |
|---|---|---|
| **Minuto 5** | Crea su primer producto, va a Ventas y no aparece — nació `DRAFT`. Concluye que la app no sirve. | Muy alta |
| **Minuto 10** | Tiene 300 productos en Excel. No hay importación. Teclear 300 fichas en un teléfono no va a pasar. | Muy alta |
| **Minuto 15** | Busca el escáner de códigos. No hay. Vender por búsqueda de texto es más lento que su libreta. | Alta |
| **Hora 1** | Cliente pide fiado. No se puede. Vuelve al cuaderno para eso — y el cuaderno se queda. | Alta |
| **Fin del día 1** | Quiere cerrar caja y ver cuánto vendió. No hay corte ni ventas del día. El momento de mayor intención de uso no tiene respuesta. | Muy alta |
| **Día 2** | Llega mercancía. No puede darle entrada. El inventario deja de reflejar la realidad y, a partir de ahí, la app miente. | Muy alta |
| **Día 3** | Se cae el internet en horario pico. No puede cobrar. Un POS que se detiene con la señal no se adopta. | Alta |
| **Semana 2** | Quiere dar de alta a su vendedor. Hay que entrar al panel web desde una computadora. | Media |
| **Mes 2** | Abre segunda sucursal. La app se queda en blanco en el POS. Pérdida del cliente justo cuando iba a pagar más. | Alta |
| **Transversal** | Un fallo no se detecta porque no hay crash reporting, y arreglarlo tarda una revisión de tienda completa porque no hay OTA. | Muy alta |

---

## 20. NO implementar todavía

Sección obligatoria y probablemente la más valiosa. Todo lo de abajo suena razonable y **debe
dejarse fuera** hasta validar el producto. La API ya soporta varias de ellas — que exista en el
backend no es razón para cablearlas.

| Funcionalidad | Por qué NO ahora | Cuándo reconsiderar |
|---|---|---|
| **Compras y órdenes de compra completas** | Un negocio de una sola persona no formaliza órdenes de compra: recibe mercancía y ya. Lo que necesita es una *entrada de inventario*, que cuesta una décima parte. | Cuando haya clientes con >3 empleados pidiendo trazabilidad de proveedor. |
| **Cuentas por pagar** | Depende de compras. Sin ellas es un registro manual de deudas que nadie mantiene. | Después de Abasto. |
| **Conteos físicos y transferencias entre sucursales** | Requieren cerrar 5 TODOs «Fase 2» en `inventory.engine.ts` del backend. Alta complejidad, aplican a un porcentaje pequeño de tenants. | Cuando multi-sucursal esté no solo arreglado sino en uso real. |
| **Cotizaciones y órdenes de trabajo** | Es la vertical de servicios, un producto distinto con su propio ciclo. Mete complejidad en el POS sin beneficiar a retail ni a restaurante. | Cuando la vertical de servicios sea una apuesta explícita. |
| **Tienda en línea / catálogo compartible** | El vault ya registra que el ciclo de pedido depende de mover estados a mano y que nada reserva stock. Llevarlo al móvil hereda ese problema y compite con la fortaleza de Treinta. | Cuando el flujo de pedido esté cerrado en el backend. |
| **IA / asistente / predicciones** | No hay datos suficientes de un tenant nuevo, y no resuelve ninguno de los diez momentos de abandono de la sección 19. Es una funcionalidad de demo, no de retención. | Cuando haya tenants con 6+ meses de historial. |
| **Personalización profunda de branding por tenant** | La infraestructura de temas ya existe y funciona; falta un endpoint. Pero ningún tendero eligió un POS por poder cambiar el color. | Como argumento de plan alto, no de MVP. |
| **Dictado por voz** | Fase 4 del propio plan de accesibilidad, y el más caro: módulo nativo, rebuild, permisos de micrófono. Los teclados del SO ya lo ofrecen gratis. | Nunca como prioridad propia. |
| **Modo oscuro «premium» y rediseños** | El sistema de temas ya está y es bueno. Cada hora ahí es una hora que no se gasta en el corte de caja. | Cuando el ciclo del día esté completo. |
| **Suscripción con compra dentro de la app (IAP)** | Añade comisión de tienda, gestión de recibos, restauración de compras y reglas de plataforma. Cobrar por web mientras se valida el producto es más simple y barato — `REQUIERE VALIDACIÓN ACTUAL CONTRA POLÍTICAS DE STORE` qué puede quedar fuera de IAP. | Cuando la conversión web esté medida y el volumen justifique la comisión. |
| **Comanda y KDS** | Diferenciador real, pero es un producto entero. Antes hay que probar que el POS de retail retiene. | Fase 3, y solo si hay demanda concreta de restaurantes. |
| **Un cuarto cliente móvil** | Ya hay POS web, ERP web, comandera y POS Flutter en scaffold. El vault registra la decisión pendiente sobre el POS Flutter. Resolver eso antes de sumar superficie. | Nunca sin retirar otro cliente primero. |

---

## 21. Top 20 — acciones recomendadas

En orden de ejecución. Las diez primeras cambian el veredicto de «no listo» a «MVP funcional».

### 1. `[P0]` Producto nuevo nace ACTIVE

- **Problema:** `EMPTY_PRODUCT_FORM.status = DRAFT` y el POS filtra `ACTIVE`: el primer producto de todo usuario nuevo es invendible.
- **Solución:** cambiar el valor por defecto y mover el selector de estado al paso 1 con etiqueta «A la venta / Borrador».
- **Impacto:** muy alto — elimina el abandono del minuto 5.
- **Complejidad:** baja (una línea más un movimiento de campo).
- **Dependencias:** ninguna.

### 2. `[P0]` Selector de sucursal

- **Problema:** con más de una sucursal el POS queda en skeleton para siempre. `useBranches()` existe y nadie lo llama.
- **Solución:** pantalla de selección tras elegir empresa + cambio desde el drawer; incluir `branchId` en las claves de caché de productos, categorías y caja.
- **Impacto:** muy alto — desbloquea al cliente que más paga.
- **Complejidad:** baja-media.
- **Dependencias:** ninguna; reutiliza `selectBranch` del `authService`.

### 3. `[P0]` Paginación real y FlashList

- **Problema:** `limit: 100` sin paginar en productos, clientes y POS.
- **Solución:** `useInfiniteQuery` con `onEndReached`, filtro de categoría en servidor, y `FlashList` en las tres listas.
- **Impacto:** muy alto — hoy el producto es inviable para un catálogo real.
- **Complejidad:** media.
- **Dependencias:** la API ya devuelve `meta` de paginación.

### 4. `[P0]` Idempotencia en operaciones de dinero

- **Problema:** timeout de 15 s + reintento del cajero = venta duplicada con inventario y caja movidos dos veces.
- **Solución:** generar UUID por intento de venta, enviarlo como cabecera, y que la API devuelva la orden existente en lugar de crear otra.
- **Impacto:** muy alto — es el error más caro que puede cometer un POS.
- **Complejidad:** media (exige trabajo en la API).
- **Dependencias:** backend. Prerrequisito de la cola offline.

### 5. `[P0]` Cierre de caja: corte y arqueo

- **Problema:** se abre caja y nunca se cierra. Sin corte no hay control de efectivo ni jornada que termine.
- **Solución:** cablear `PATCH /cash-sessions/:id/close`, `/start-count` y `/active/count`, con diferencias y PIN de supervisor.
- **Impacto:** muy alto — sin esto no hay POS.
- **Complejidad:** media.
- **Dependencias:** ninguna; la API está completa.

### 6. `[P0]` Movimientos de caja: gastos y retiros

- **Problema:** no se puede registrar un gasto. «Cuánto gané» queda sin respuesta y el corte no cuadra.
- **Solución:** hoja de acción rápida sobre `POST /cash-sessions/active/movement` y `/active/withdraw`, con categorías de gasto.
- **Impacto:** muy alto — es media propuesta de valor de Treinta.
- **Complejidad:** baja.
- **Dependencias:** apertura de caja (ya existe).

### 7. `[P0]` Ajuste de existencias

- **Problema:** el stock solo se fija al crear el producto. No hay forma de dar entrada a mercancía.
- **Solución:** acción «Ajustar existencia» en el detalle, con motivo, sobre `PATCH /products/:id/stock` y su equivalente por variante.
- **Impacto:** muy alto — sin esto el inventario diverge desde el día 2.
- **Complejidad:** baja.
- **Dependencias:** ninguna.

### 8. `[P0]` Pulso del día en Inicio

- **Problema:** los KPIs son acumulados históricos. La app no responde «cuánto vendí hoy».
- **Solución:** selector hoy / semana / mes sobre `/reports/sales/daily`, `/profit/monthly`, `/expenses/monthly`, `/products/top`, con una gráfica y comparativo contra el periodo anterior.
- **Impacto:** muy alto — es la pantalla que abre el dueño cada mañana.
- **Complejidad:** media.
- **Dependencias:** ninguna; ocho endpoints ya existen.

### 9. `[P0]` Historial de ventas y detalle del ticket

- **Problema:** una venta cobrada desaparece. No se puede consultar, reenviar ni corregir.
- **Solución:** listado con `GET /orders`, detalle con líneas y pagos, reenvío de comprobante y cancelación.
- **Impacto:** alto — es lo primero que se busca tras el primer error.
- **Complejidad:** media.
- **Dependencias:** ninguna.

### 10. `[P0]` Paquete de cumplimiento de tienda

- **Problema:** sin eliminación de cuenta, privacidad, términos ni soporte, ninguna tienda aprueba la app.
- **Solución:** activar la categoría «Acerca de»: versión, soporte, enlaces legales, eliminar cuenta con confirmación y explicación de qué se borra. Casilla de aceptación en el alta.
- **Impacto:** bloqueante — sin esto no hay publicación.
- **Complejidad:** baja en la app; media contando redacción legal y endpoint de borrado.
- **Dependencias:** backend (borrado) y contenido legal.

### 11. `[P0]` Quitar el tráfico en claro y limpiar permisos

- **Problema:** `usesCleartextTraffic: true` en todo build; `RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW` declarados sin usarse.
- **Solución:** restringirlo al perfil de desarrollo (o a un dominio de dev), bloquear `RECORD_AUDIO` con la opción del plugin de image-picker y auditar el manifest del release.
- **Impacto:** alto — seguridad real y menos fricción en la revisión de Play.
- **Complejidad:** baja.
- **Dependencias:** ninguna.

### 12. `[P0]` Crash reporting y ErrorBoundary

- **Problema:** cero visibilidad en producción; un fallo de render deja pantalla en blanco.
- **Solución:** Sentry (o equivalente) con source maps de Hermes, release y usuario anonimizado, más `ErrorBoundary` raíz con pantalla de recuperación.
- **Impacto:** alto — condición para publicar responsablemente.
- **Complejidad:** baja.
- **Dependencias:** ninguna.

### 13. `[P0]` Levantar el proyecto iOS

- **Problema:** la app nunca ha corrido en un dispositivo Apple.
- **Solución:** `prebuild -p ios`, textos de permiso en español, credenciales en EAS, primera build de TestFlight y barrido de pantallas críticas.
- **Impacto:** alto — la mitad del mercado objetivo.
- **Complejidad:** media, con riesgo de sorpresas: modo inmersivo, edge-to-edge y MMKV son los sospechosos.
- **Dependencias:** cuenta de Apple Developer.

### 14. `[P1]` Firma de release de Android

- **Problema:** el build local firma el release con `debug.keystore` y la guía lo documenta como correcto.
- **Solución:** keystore de producción gestionado por EAS credentials, guía actualizada, y todo ajuste nativo movido a config plugins para que el prebuild sea reproducible.
- **Impacto:** bloqueante para Play.
- **Complejidad:** baja.
- **Dependencias:** cuenta de Play Console.

### 15. `[P1]` Escáner de código de barras

- **Problema:** el código es un campo de texto. Vender buscando por nombre es más lento que la libreta.
- **Solución:** `expo-camera` con escaneo en el POS y en el alta de producto; resolver contra SKU y contra código de variante.
- **Impacto:** alto — expectativa mínima de mercado en retail.
- **Complejidad:** media (módulo nativo y permiso `CAMERA`).
- **Dependencias:** requiere que las variantes sean vendibles (#17).

### 16. `[P1]` Fiado: crédito y abonos

- **Problema:** el crédito del cliente se configura y no lo usa nada. Es la mecánica central del comercio pequeño en LatAm.
- **Solución:** cliente en la venta, método CRÉDITO, saldo en la ficha del cliente, abonos sobre `POST /receivables/:id/payments` y aviso de vencimiento.
- **Impacto:** alto — es paridad obligatoria con Treinta.
- **Complejidad:** media.
- **Dependencias:** cliente en la orden.

### 17. `[P1]` Variantes vendibles

- **Problema:** se pueden crear «Talla M» o «600 ml» y no se pueden vender: el carrito solo lleva `productId`.
- **Solución:** hoja de selección de presentación al tocar un producto con variantes; `variantId`, precio y existencia de la variante en la línea de la orden.
- **Impacto:** alto — sin esto el inventario por variante no cuadra con lo vendido.
- **Complejidad:** media.
- **Dependencias:** la API ya persiste `variantId` en `OrderItem`.

### 18. `[P1]` Importación CSV de productos y clientes

- **Problema:** migrar desde Excel exige teclear cientos de fichas en un teléfono.
- **Solución:** descargar plantilla (`GET /products/import/template`), elegir archivo, previsualizar, importar con reporte de errores por fila.
- **Impacto:** alto — es la barrera de entrada más alta que tiene el producto.
- **Complejidad:** media.
- **Dependencias:** ninguna en productos; clientes puede requerir endpoint nuevo.

### 19. `[P1]` Comprobante por WhatsApp y PDF

- **Problema:** solo email. Un cliente de mostrador casi nunca da su correo.
- **Solución:** compartir por el share sheet del SO con texto y enlace o PDF del ticket; mantener el email como opción.
- **Impacto:** alto — expectativa cultural en el mercado objetivo.
- **Complejidad:** baja-media.
- **Dependencias:** ticket con URL pública o generación local de PDF.

### 20. `[P1]` Tests de lo que calcula dinero

- **Problema:** cero tests sobre 19 000 líneas, incluida toda la aritmética de la venta.
- **Solución:** Jest + testing-library. Empezar por `pos-totals`, `toCreateRequest`/`toUpdateRequest`, `parsePhone`/`composePhone`, `toApiError` y los mapeos `toDomain`. Hacerlos requisito de merge.
- **Impacto:** alto a medio plazo — sin esto cada módulo nuevo es más caro que el anterior.
- **Complejidad:** baja para empezar.
- **Dependencias:** ninguna.

---

## Las dos preguntas

### «¿Podría un negocio real descargarla hoy y operar sin ayuda del desarrollador?»

**No**, y no principalmente por calidad. Podría registrarse, dar de alta su empresa, crear
productos con imagen y variantes, dar de alta clientes, abrir caja y cobrar una venta en
efectivo — todo eso funciona de verdad contra la API. Pero **se detiene en el primer producto**
(nace en borrador y no aparece para vender), **no puede reponer inventario**, **no puede cerrar
su caja**, **no puede ver cuánto vendió hoy** y **no puede consultar una venta ya hecha**. Con más
de una sucursal, ni siquiera llega a la primera venta. Y antes de todo eso, la app no puede
publicarse: le faltan eliminación de cuenta, política de privacidad y un proyecto iOS.

### «¿Qué necesita para competir con Treinta?»

Cerrar el ciclo del dinero del día —corte, gastos, ventas de hoy, historial de tickets, fiado— y
quitar las tres barreras de entrada: importación desde Excel, escáner de códigos y comprobante
por WhatsApp. Nada de eso exige inventar arquitectura: **la API ya expone prácticamente todo lo
que hace falta**, y la app está construida de forma que cablear un módulo nuevo es barato. La
distancia es de ejecución, no de diseño.

Y una advertencia sobre el orden: la tentación natural será añadir compras, proveedores,
cotizaciones y comanda porque el backend ya los tiene. **Sería el error más caro posible.** El
tendero que abandona en el minuto cinco no lo hace por falta de módulos, sino porque su primer
producto no apareció en la pantalla de venta.
