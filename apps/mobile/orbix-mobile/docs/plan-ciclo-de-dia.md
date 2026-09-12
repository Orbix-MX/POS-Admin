# Plan de implementación — Ciclo del día

**Fecha:** 2026-09-11 · **Alcance:** `@orbix/mobile`
**Origen:** bloque 1 de [`faltantes-app-comercial.md`](faltantes-app-comercial.md)
**Contexto:** [`auditoria-comercial.md`](auditoria-comercial.md)

Convertir Orbix Mobile de «puede cobrar una venta» a «puede operar una jornada completa»:
abrir → vender → registrar movimientos → arquear → cortar → consultar lo que pasó.

Contratos verificados contra `api/src/modules/core/cash-sessions`, `api/src/modules/retail/orders`,
`api/src/modules/retail/products` y `api/src/modules/core/reports` el 2026-09-11.

> **Estado: las siete fases están implementadas** (2026-09-11). Verificación por fase al final de
> cada una; resumen en §5 bis. Falta la validación manual en dispositivo contra la API real
> (§9) — las 112 pruebas cubren lógica pura, no el recorrido completo.

---

## 1. Hallazgos de la verificación previa

Dos cosas salieron distintas de lo que suponía la auditoría. Ambas cambian el plan.

### 1.1 `/reports/*` no es accesible para los tenants que la app crea

`ReportsController` lleva `@RequireModule('reportes')`, y en
`packages/types/src/index.ts` el módulo `REPORTES` pertenece al tier **PRO**:

```
FREE     → DASHBOARD, VENTAS, INVENTARIO, CLIENTES, CAJA, USUARIOS, ROLES, CONFIGURACION…
STARTER  → INSUMOS
PRO      → COMPRAS, PROVEEDORES, EMPLEADOS, REPORTES, BRANCHES, …
PLUS     → CXC, CXP
```

El wizard de alta de la app crea todo tenant en **plan FREE fijo**
(`TenantsService.onboard`). Por tanto **todo usuario que se da de alta desde el móvil recibe
403 en cada endpoint de `/reports`**.

Consecuencias:

- El «Pulso del día» **no puede** construirse sobre `/reports/sales/daily` como decía la
  auditoría. Hay que cambiar la fuente.
- `BRANCHES` también es PRO: multi-sucursal es de pago, lo que rebaja la urgencia del selector
  de sucursal (sigue siendo un bug, pero no afecta al usuario FREE).
- `CXC` es PLUS: el fiado no es MVP para el tenant gratuito.

### 1.2 La sesión de caja ya devuelve todo lo que el «Pulso del día» necesita

`GET /cash-sessions/active` **ya incluye un `summary` calculado en el servidor**
(`CashSessionsService.buildSummary`) que el repositorio móvil hoy descarta por completo:

```ts
summary: {
  openingAmount, openingAmountUsd,
  expectedCash, expectedCashUsd,
  movementsCount,
  totals: {
    sales:      { cash, cashUsd, card, transfer, total },
    cxc:        { … },
    supplier:   { … },
    income:     { cash, cashUsd, total },
    expense:    { cash, cashUsd, total },
    withdrawal: { cash, cashUsd, total },
    refund:     { cash, cashUsd, card, transfer, total },
  },
}
```

El módulo `CAJA` es **FREE** y `CashSessionsController` **no** está gateado por módulo, solo por
permisos. Es decir: las cifras del día ya están disponibles, gratis, ya calculadas, y solo hay
que dejar de tirarlas a la basura en `pos-repository.ts`.

### 1.3 Decisión que sale de lo anterior

> **Las cifras del día salen de la sesión de caja, no de `/reports`.**
> `/reports/*` se usa solo como capa histórica adicional, y únicamente cuando el plan lo
> permita. El histórico multi-día para tenants FREE sale de `GET /orders` con filtros de fecha
> (cambio pequeño en el backend, necesario de todos modos para el historial de tickets).

### 1.4 Otros hallazgos menores

| Hallazgo | Impacto en el plan |
|---|---|
| `CashSessionStatus` tiene **4** estados: `ABIERTA`, `EN_ARQUEO`, `PENDIENTE_REVISION`, `CERRADA`. El móvil tipa solo `'ABIERTA' \| 'CERRADA'` | El tipo del móvil está mal. Una sesión en arqueo se castea a un valor imposible. Corregir en Fase 0 |
| `PATCH /products/:id/stock` recibe un **delta**, no un absoluto | La UI de ajuste pide «cuánto entra / cuánto sale», no «cuánto hay» |
| `updateStock` es solo para `type: SIMPLE` y exige `trackInventory` | Los productos con presentaciones usan `PATCH /products/:id/variants/:variantId/stock` |
| `close` puede devolver `status: PENDIENTE_REVISION` en vez de `CERRADA` si la diferencia supera `settings.cashDifferenceThreshold` | La pantalla de corte necesita un tercer resultado además de éxito/error |
| `startCount`, `resume`, `createCount` y `close` van sin `@RequirePermissions`: resuelven la autorización por dentro, con permiso propio **o** `authorizerPin` | El móvil **no** debe ocultar estos botones por permiso. Debe intentarlo y, ante `AUTHORIZATION_REQUIRED`, pedir el PIN |
| `GET /orders` incluye `items.product` completo en el listado | Payload pesado para una lista móvil. Pedir `slim` al backend o paginar corto |
| `QueryOrdersDto` **no** tiene filtros de fecha ni `branchId` | Bloquea el historial por día y el pulso. Cambio de backend requerido |
| `dailySales` agrupa por **día UTC** | Para un tenant en UTC−6 las ventas después de las 18:00 caen en el día siguiente. Otra razón para no apoyarse en `/reports` |
| `withdrawCash` valida contra el efectivo disponible y rechaza retirar de más | La UI debe mostrar el disponible antes de pedir el monto |
| `withdrawForSupplies` exige `authEmail` + `authPassword` de un admin, no PIN | Fuera de alcance de este plan: es compra de insumos, no retiro simple |

---

## 2. Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| D1 | **Caja es una sección propia**, no una pestaña dentro del POS | El corte lo hace el dueño o el supervisor, en un momento distinto al de vender. Mezclarlo con la rejilla de productos obliga a salir del flujo de cobro |
| D2 | El `summary` del servidor es **la única fuente de verdad** de las cifras del día | El cliente no recalcula dinero. Mismo criterio que ya aplica `pos-totals.ts` con el total de la orden |
| D3 | **No ocultar acciones respaldadas por PIN** | El backend las resuelve por permiso propio *o* PIN de supervisor. Ocultarlas por `can()` rompe justamente el caso para el que existe el PIN |
| D4 | Una hoja única de **autorización por PIN**, reutilizable | La piden `startCount`, `resume`, `createCount` y `close`. Un solo componente, disparado por el error del servidor |
| D5 | `cashRegisterId` se recuerda **por dispositivo** en MMKV | La caja pertenece al puesto, no a la persona (regla del dominio). Mismo patrón que el POS web con `localStorage` |
| D6 | Separar `cash-repository.ts` y `orders-repository.ts` de `pos-repository.ts` | `pos-repository` mezcla hoy sucursales, cajas y órdenes. Con este plan triplica de tamaño |
| D7 | Centralizar las claves de query nuevas en `query-keys.ts` | Hoy caja y productos declaran arrays inline. Con invalidaciones cruzadas (una venta invalida el summary de la caja) escribirlas a mano se rompe en silencio |
| D8 | `branchId` entra en toda clave de caché de este plan | Caja, tickets y existencias son por sucursal |
| D9 | El Pulso vive en **Inicio**, no en una pantalla nueva | Es la pregunta que abre la app. Una sección aparte la esconde |
| D10 | Degradar con elegancia cuando falte el módulo o el plan | Un 403 de `/reports` no es un error: es «tu plan no lo incluye». Debe leerse así |

---

## 3. Prerrequisitos

| | Prerrequisito | Bloquea | Notas |
|---|---|---|---|
| ☑ | Filtros `dateFrom` / `dateTo` / `branchId` en `QueryOrdersDto` | Fase 4, Fase 6 | **Hecho** 2026-09-11, con 8 pruebas |
| ☐ | Variante ligera de `GET /orders` sin `items.product` | Fase 4 | Backend, opcional pero recomendable |
| ☐ | Exponer `settings.cashDifferenceThreshold` en algún endpoint alcanzable | Fase 3 (mejora) | Permite avisar *antes* de cerrar; sin él el aviso llega en la respuesta |
| ☐ | Selector de sucursal en la app | Multi-sucursal (PRO) | No bloquea el tenant FREE, que tiene una sola sucursal. Ver `faltantes-app-comercial.md` §5 |

Ninguno bloquea las Fases 0-3, que son las de más valor.

---

## 4. Estructura de archivos

### Nuevos

```
src/dto/
  cash.dto.ts                       contratos de /cash-sessions
  orders.dto.ts                     contratos de /orders (se saca de pos.dto.ts)

src/repositories/
  cash-repository.ts                sesiones, movimientos, arqueos, cajas físicas
  orders-repository.ts              listado, detalle, cancelar, devolver, reembolsar

src/features/cash/
  use-cash-session.ts               sesión activa + summary + capacidad
  use-cash-registers.ts             cajas físicas de la sucursal
  use-cash-movements.ts             ingreso / egreso / retiro
  use-cash-count.ts                 arqueo: start, count, resume
  use-cash-close.ts                 corte
  cash-schemas.ts                   Zod de los formularios de caja
  session-summary-card.tsx          tarjeta de estado de la sesión
  movement-sheet.tsx                hoja de gasto / ingreso / retiro
  denominations-input.tsx           desglose por denominación (opcional en arqueo)
  authorizer-pin-sheet.tsx          hoja de PIN de supervisor (D4)
  cash-register-picker.tsx          selector de caja física

src/features/orders/
  use-orders.ts                     listado paginado + detalle
  use-order-mutations.ts            cancelar, devolver, reembolsar, reenviar ticket
  order-row.tsx                     fila del historial
  order-status-pill.tsx             estado + estado de pago
  refund-sheet.tsx                  devolución total / parcial por línea

src/features/inventory/
  use-stock-adjustment.ts           ajuste de producto y de variante
  stock-adjust-sheet.tsx            hoja de ajuste con motivo

src/features/dashboard/
  use-day-pulse.ts                  cifras del día desde el summary de caja

src/app/(app)/caja/
  _layout.tsx
  index.tsx                         estado de la sesión + acciones del turno
  arqueo.tsx                        conteo físico
  corte.tsx                         cierre
  historial.tsx                     sesiones anteriores
  [id].tsx                          detalle de una sesión cerrada

src/app/(app)/tickets/
  _layout.tsx
  index.tsx                         historial de ventas
  [id].tsx                          detalle del ticket
```

### Modificados

```
src/repositories/pos-repository.ts      queda solo con `branchesRepository`
src/features/pos/use-pos.ts             reexporta desde features/cash; invalida el summary tras vender
src/app/(app)/pos/index.tsx             usa el summary; enlaza a Caja
src/app/(app)/index.tsx                 Pulso del día
src/app/(app)/products/[id].tsx         acción «Ajustar existencia»
src/components/navigation/app-drawer.tsx  activa «Caja» y «Ventas → Tickets»
src/services/query/query-keys.ts        claves de cash, orders, products, branches
src/constants/storage-keys.ts           `cashRegisterId` por dispositivo
src/i18n/locales/{es,en,pt}.ts          paridad obligatoria de claves
```

---

## 5. Fases

Cada fase deja algo usable. El orden respeta dependencias reales, no comodidad.

---

### Fase 0 — Cimientos de datos ✅

**Objetivo:** que el móvil represente correctamente el modelo de caja que el servidor ya tiene.
Sin pantalla nueva.
**Tamaño:** S · **Dependencias:** ninguna · **Estado:** completada 2026-09-11

- [x] `src/dto/cash.dto.ts` con los contratos verificados (§6.1).
- [x] `src/dto/orders.dto.ts` con los contratos de `/orders` (§6.2).
- [x] Corregir `CashSessionStatus` a los **cuatro** estados. Hoy el móvil tipa dos y castea el
      resto a un valor imposible. Añadidos también `CashMovementType`, `CashCountType`,
      `OrderStatus`, `PaymentStatus` y `OrderOrigin` a `types/api.ts`.
- [x] `CashSession` del dominio gana `summary`, `cashRegisterId`, `status` completo,
      `expectedAmount`, `difference`, `closedAt`.
- [x] `src/repositories/cash-repository.ts`: mover `cashSessionsRepository` desde
      `pos-repository.ts` y añadir los métodos nuevos. Tres repositorios:
      `cashSessionsRepository`, `cashMovementsRepository`, `cashRegistersRepository`.
- [x] `src/repositories/orders-repository.ts`: mover `ordersRepository` y añadir `list`,
      `getById`, `cancel`, `returnSale`, `refund`.
- [x] `pos.dto.ts` queda solo con `BranchDto`; lo de órdenes se va a `orders.dto.ts`.
- [x] `query-keys.ts`: añadir los espacios `cash`, `orders`, `products`, `branches`,
      `categories`, `customers` y `dashboard`, todos con `tenantId` **y** `branchId`.
      **Ya no queda ninguna clave inline en el proyecto.**
- [x] `StorageKeys.cashRegisterId`.
- [x] Mapear `ApiError` → mensaje para los errores nuevos del dominio de caja.
- [x] `features/cash/use-cash-session.ts` con la sesión activa, el detalle, las cajas físicas,
      la capacidad del plan y la apertura.
- [x] Infraestructura de pruebas (Jest + jest-expo), la primera del proyecto.

#### Hallazgo durante la implementación: `ApiError` perdía el código de dominio

`resolveCashAuthorizer` lanza `ForbiddenException({ code, message, permission })` y Nest
serializa ese objeto tal cual, pero `ApiError` solo conservaba `message` — que además viene
traducido. Sin el `code`, "pide el PIN de un supervisor" era indistinguible de un 403
cualquiera y la hoja del PIN **nunca se habría abierto**.

`ApiError` gana un campo `code` y `toApiError` lo propaga. Los predicados
`isAuthorizationRequired` / `isAuthorizationInvalid` ramifican sobre él, no sobre el texto.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 39/39 ✅
(16 del mapeo de caja, 13 del de órdenes, 10 de la normalización de errores).

---

### Fase 1 — Estado de la caja visible ✅

**Objetivo:** que el operador vea en qué estado está su turno. Cero cambios de backend.
**Tamaño:** S · **Dependencias:** Fase 0 · **Estado:** completada 2026-09-11

- [x] `session-summary-card.tsx`: fondo inicial, ventas por método, ingresos, gastos, retiros,
      devoluciones, **efectivo esperado** en MXN y USD, número de movimientos y quién abrió.
      Las filas de ingresos/gastos/retiros/devoluciones solo aparecen cuando hay importe.
- [x] `StatusPill` con los cuatro estados y su color: verde abierta, azul arqueo, **ámbar**
      pendiente de revisión (no rojo: la caja no falló, espera firma), gris cerrada.
- [x] Sección `(app)/caja/index.tsx`, declarada con `href: null` — se llega desde el drawer.
      Cinco pestañas ya son el máximo legible a este ancho.
- [x] Activar la fila **Caja** del drawer, gateada por `cash:view`.
- [x] En el POS, sustituir la etiqueta estática «Caja abierta» por el efectivo esperado, que
      además es un acceso directo a Caja.
- [x] Invalidar `cash.active` tras cada venta creada (hecho en Fase 0 junto al resto de
      invalidaciones cruzadas).
- [x] Estado vacío honesto cuando no hay sesión: `OpenCashSessionPanel`, extraído de
      `pos/index.tsx` a `features/cash/` para que POS y Caja compartan uno solo.
- [x] `FrozenNotice` para `EN_ARQUEO` y `PENDIENTE_REVISION`: la caja existe pero no admite
      movimientos, y dice qué hacer en cada caso.
- [x] Pantalla propia para el usuario sin `cash:view` — la consulta va deshabilitada, así que
      sin esto se quedaba en un skeleton eterno.

#### Incidente durante la implementación: reemplazo de i18n mal anclado

Un `str.index('  cash: {')` para insertar el bloque nuevo casó con `      cash: {` de
`settings.categories` —que lo contiene como subcadena— y se llevó por delante **355 líneas de
los tres locales a la vez**. `tsc` siguió en verde: al ser `es` el esquema de referencia,
borrar una rama de ahí la borra del tipo y los otros dos idiomas se adaptan sin protestar.

Revertido con git y rehecho con anclas `^  errors: \{$` (regex multilínea, unicidad afirmada
antes de sustituir) más una comprobación de que el número de claves **sube**.

Y se añadió `src/i18n/locales/parity.spec.ts`, que es el guardarraíl que faltaba: compara las
rutas hoja de los tres idiomas, exige una cota mínima de volumen y verifica que existan las
claves del ciclo del día. Probado contra el fallo real: borrar `cash.frozen` lo detecta.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 46/46 ✅ ·
paridad de locales 511/511/511 ✅ · rutas tipadas regeneradas (`caja` presente) ✅ ·
`expo install --check` ✅ (se corrigió `jest-expo` a `~54.0.18`, la versión del SDK).

---

### Fase 2 — Movimientos del turno ✅

**Objetivo:** registrar gastos, ingresos y retiros. Es lo más barato y lo que más falta.
**Tamaño:** M · **Dependencias:** Fase 1 · **Estado:** completada 2026-09-11

- [x] `movement-sheet.tsx` con tres modos: **Gasto**, **Ingreso**, **Retiro**.
  - Gasto e ingreso → `POST /cash-sessions/active/movement` (`type: EXPENSE | INCOME`).
  - Retiro → `POST /cash-sessions/active/withdraw` (motivo **obligatorio**).
- [x] Conceptos frecuentes como atajo de escritura sobre `reason` — texto libre, no una tabla
      de categorías que luego haya que mantener.
- [x] Selector de divisa MXN/USD, visible solo si la sesión tiene fondo en USD.
- [x] Antes de un retiro, el efectivo disponible de esa divisa, y el botón deshabilitado si el
      importe lo supera.
- [x] `movements-list.tsx`: movimientos del turno agrupados por tipo, con hora, motivo y signo.
- [x] `cash-actions.tsx`: los botones del turno, cada uno con su permiso.
- [x] Invalidación: cualquier movimiento refresca todo el subárbol `cash`.
- [x] Permisos: gasto/ingreso `cash:manage`; retiro `pos.cash:withdraw`. Ambos son
      `@RequirePermissions` reales, así que ocultar por `can()` es correcto aquí — a diferencia
      del arqueo y el corte (D3).
- [x] Acciones deshabilitadas cuando la sesión no está `ABIERTA`: el servidor rechaza mover
      dinero en `EN_ARQUEO` o `PENDIENTE_REVISION`, y el viaje solo puede fallar.
- [x] `cash-schemas.ts` con Zod, incluida la coma decimal de los teclados es-MX y pt-BR.

#### Hallazgo: `Number('')` es `0`, no `NaN`

La primera versión de `parseAmount` devolvía `0` para un campo vacío, y con eso "todavía no he
escrito nada" y "quiero mover cero pesos" pasaban a ser el mismo valor — justo la distinción
que necesita la comprobación contra el disponible. Lo detectó el test antes de llegar a la UI.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 65/65 ✅
(19 nuevos sobre importes, motivo obligatorio y la cota del retiro) · paridad 550/550/550 ✅.

---

### Fase 3 — Arqueo y corte ✅

**Objetivo:** cerrar la jornada. Es el núcleo del plan.
**Tamaño:** L · **Dependencias:** Fase 2 · **Estado:** completada 2026-09-11

#### 3a · Autorización por PIN

- [x] `pin-auth-machine.ts`: la regla de "qué pasa ahora" como **reducer puro**. Decidir si
      hay que pedir el PIN, volver a pedirlo o rendirse no es lógica de React — es la regla del
      dominio, y es donde están los errores caros.
- [x] `use-pin-authorization.ts`: la cáscara de React sobre ese reducer.
- [x] `authorizer-pin-sheet.tsx`: 4-12 dígitos, `secureTextEntry`, reintento, y **un solo
      mensaje** de error — distinguir "PIN inexistente" de "PIN sin permiso" dejaría sondear qué
      PINes existen desde la terminal, igual que evita el servidor.
- [x] Patrón de uso: intentar sin PIN; ante `AUTHORIZATION_REQUIRED`, abrir la hoja y reintentar
      lo mismo con `authorizerPin`. Nunca al revés, y nunca ocultando el botón (D3).

#### 3b · Arqueo

- [x] `(app)/caja/arqueo.tsx`.
- [x] `start-count` congela la caja, con confirmación previa que dice que el POS dejará de cobrar.
- [x] `count-form.tsx`: monto MXN, monto USD y **desglose por denominación opcional**. El monto
      manda; el desglose suma, avisa si no cuadra y ofrece volcarse al campo — nunca bloquea.
- [x] Esperado, contado y diferencia con signo y color, en vivo mientras se teclea.
- [x] `resume` para volver a operar.
- [x] Salir con la caja congelada pide confirmación: un arqueo abandonado deja la caja parada (R1).
- [x] Arqueos previos del turno, desde `GET /cash-sessions/:id/counts`.

#### 3c · Corte

- [x] `(app)/caja/corte.tsx`, en tres pasos: resumen → conteo → resultado.
- [x] **Tres resultados, no dos:** `CERRADA` (turno terminado), `PENDIENTE_REVISION` (la caja
      sigue congelada esperando a alguien con `pos.cash:authorize` — el turno **no** está
      cerrado, y se dice con un icono y un copy distintos), y error (vuelta al conteo).
- [x] `differenceReason` se pide siempre que haya diferencia: el umbral vive en
      `Tenant.settings` y no llega al cliente, así que preguntar es más simple que adivinar y
      nunca molesta a quien cuadra.
- [x] Resumen final con esperado, contado, diferencia y motivo.

#### 3d · Historial de sesiones

- [x] `(app)/caja/historial.tsx` sobre `GET /cash-sessions`, con **`useInfiniteQuery` de verdad**
      — el techo fijo de 100 de productos y clientes no se repite aquí.
- [x] `(app)/caja/[id].tsx` con el mismo `summary`, el arqueo del cierre y los movimientos.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 82/82 ✅
(17 nuevos sobre el reducer del PIN y la suma del desglose) · paridad 598/598/598 ✅ ·
rutas tipadas regeneradas ✅ · `expo install --check` ✅.

#### Incidente: el renderizador de pruebas de React no funciona en este proyecto

`@testing-library/react-native` devuelve un objeto vacío desde `renderHook`, y `render` tampoco
monta nada: `react-test-renderer` exige `react@^19.2` y el proyecto va en `19.1.0` (la versión
que fija Expo SDK 54). No es algo que este plan deba arreglar.

En vez de forzarlo, la lógica del PIN se extrajo a un reducer puro
(`pin-auth-machine.ts`) que se prueba entero sin renderizar nada — **mejor diseño de todos
modos**: la regla es del dominio, no de React. Ambas librerías se desinstalaron para no dejar
dependencias que no funcionan.

Consecuencia para el resto del plan: las pruebas siguen siendo de lógica pura (mapeos, esquemas,
reglas). No hay pruebas de componente, y no las habrá hasta que Expo y React se alineen.

### Fase 4 — Tickets ✅

**Objetivo:** que una venta cobrada siga existiendo.
**Tamaño:** L · **Dependencias:** Fase 0 · **Estado:** completada 2026-09-11

- [x] **Backend B1**: `dateFrom`, `dateTo` y `branchId` en `QueryOrdersDto`, aplicados en
      `findAll` como `[gte, lt)` — desde inclusivo, hasta exclusivo, para que dos periodos
      consecutivos no cuenten dos veces la venta del límite. Sin `branchId` un tenant con varias
      sucursales veía las ventas de todas mezcladas. 8 pruebas nuevas en la API.
- [x] `(app)/tickets/index.tsx` con `useInfiniteQuery` y páginas de 20. **No** se copió el
      `limit: 100` de productos y clientes.
- [x] Filtros hoy / esta semana / este mes, calculados **en el dispositivo**
      (`date-ranges.ts`): el servidor compara en UTC y no sabe en qué huso vive el negocio.
- [x] Fila con folio, hora, cliente, método y total. Una venta anulada lleva el importe tachado:
      sigue en el historial, pero ya no es dinero que entró.
- [x] `order-status-pill.tsx`: `status` y `paymentStatus` son dos ejes distintos, y solo se
      pinta el que aporta algo — una venta CONFIRMED + PAID no lleva etiqueta, que en cada fila
      sería ruido.
- [x] `(app)/tickets/[id].tsx`: líneas, subtotal, descuento, impuesto, total, pagos con su
      cambio, y devoluciones previas.
- [x] Reenviar comprobante, reutilizando `useSendReceipt`.
- [x] **Cancelar** y **devolver entera**, ambas con motivo obligatorio y confirmación. Para eso
      `OrbixModal` ganó `confirmDisabled`: el motivo se teclea dentro del propio diálogo.
- [x] **Devolución parcial** por líneas, acotada por (vendido − ya devuelto) — el mismo tope que
      aplica el servidor. El importe se prorratea con el `total` de la línea, no con el precio de
      catálogo: devolver el precio de lista de algo vendido con descuento sacaría del cajón más
      de lo que entró.
- [x] Las tres invalidan **también** el subárbol de caja: el servidor revierte el movimiento en
      la misma transacción, y dejar el esperado viejo descuadraría el corte.
- [x] Fila **Tickets** en el drawer, gateada por `orders:view`.

#### Hallazgo: el esquema tipado de i18n rechaza claves compuestas desde `string`

`t(\`orders.badge.${key}\`)` no compila si `key` es `string`. Dos arreglos, los dos mejores que
el cast que pedían a gritos:

- `orderBadge` devuelve una **union cerrada** (`OrderBadgeKey`), que es lo que deja al esquema
  comprobar la clave en tiempo de compilación.
- `Payment.paymentMethod` es una columna `String` libre en el servidor y no se puede tipar:
  `payment-method.ts` acota a los métodos conocidos y, para cualquier otro, muestra el valor
  crudo — más útil que un "desconocido" que esconde lo que el negocio sí registró.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 112/112 ✅ (móvil) ·
`jest` 53/53 ✅ (API, sin regresiones) · paridad 672/672/672 ✅.

### Fase 5 — Ajuste de existencias ✅

**Objetivo:** poder recibir mercancía. Pequeño y aislado.
**Tamaño:** S · **Dependencias:** Fase 0 · **Estado:** completada 2026-09-11

- [x] `stock-adjust-sheet.tsx` desde el detalle del producto.
- [x] **El campo es un delta, no un absoluto.** La UI pregunta «entra / sale» + cantidad y
      muestra siempre el resultado (`actual → nuevo`): pedir el total obligaría a restar
      mentalmente, que es donde se cuelan los errores al recibir mercancía a las siete de la
      mañana.
- [x] Sin presentaciones → `PATCH /products/:id/stock`. Con ellas → selector de variante y
      `PATCH /products/:id/variants/:variantId/stock`, la única forma de mover una presentación
      concreta tras crearla.
- [x] `stockAdjustmentBlocker` explica *por qué* no se puede antes de dejar teclear: el servidor
      rechaza los no-`SIMPLE` y los que no llevan inventario, y el 400 no dice nada útil.
- [x] Salida mayor que la existencia, bloqueada en el cliente.
- [x] Invalida detalle, listados y la rejilla del POS.

#### Hallazgo: los dos endpoints de stock devuelven formas distintas

`PATCH /products/:id/stock` devuelve la fila pelada del producto (sin imágenes, sin variantes,
sin categoría), mientras que `/variants/:id/stock` devuelve el `findOne` completo. Escribir la
primera en la caché del detalle **borraría la foto y las presentaciones de la pantalla**, así que
el hook invalida en vez de guardar la respuesta.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · 7 pruebas nuevas sobre las
reglas de bloqueo.

### Fase 6 — Pulso del día ✅

**Objetivo:** responder «cuánto vendí hoy» al abrir la app.
**Tamaño:** M · **Dependencias:** Fases 1-4 · **Estado:** completada 2026-09-11

- [x] `use-day-pulse.ts` con las fuentes en el orden que el plan fijó:
  1. **El turno abierto** — el `summary` de `GET /cash-sessions/active`. Gratis, exacto, ya
     calculado en el servidor, y disponible en plan FREE.
  2. **El conteo del periodo** — `GET /orders` con el rango y `limit: 1`: no trae ventas, solo
     `meta.total`. Una petición mínima que funciona en cualquier plan.
  3. **Los reportes** — solo cuando el plan los incluye.
- [x] Inicio reordenado: **vendido hoy**, **ventas de hoy**, **efectivo en caja** y **gastos de
      hoy** arriba; los acumulados del negocio debajo. Nadie abre la app para ver cuántos
      productos tiene dados de alta.
- [x] Efectivo y gastos solo aparecen con un turno abierto: sin caja no son cero, es que no hay
      turno del que hablar — y en su lugar va el acceso a abrirla.
- [x] Acceso directo a Caja desde la cabecera del bloque.

#### Decisión: el importe por periodo no se suma en el cliente

Sumar las ventas del mes desde `GET /orders` exigiría traer cientos de órdenes —cada una con sus
productos completos embebidos— para calcular un número que el servidor da en una consulta. No se
hace.

Mientras `/reports` siga siendo de tier PRO, el importe por periodo se queda en los planes que lo
incluyen. **Eso es una decisión de producto, no un límite técnico** — es el cambio B5, y sigue
abierto.

**Verificado:** `tsc --noEmit` ✅ · `eslint --max-warnings 0` ✅ · `jest` 112/112 ✅ ·
paridad 672/672/672 ✅.

---

## 5 ter. Correcciones tras la primera prueba en dispositivo

### Arquear con la caja congelada devolvía «no hay caja abierta» (backend)

**Síntoma:** congelar la caja, teclear el efectivo contado y pulsar «Registrar arqueo»
respondía *"No hay sesión de caja activa. Abre la caja antes de registrar un arqueo"* — con la
caja abierta delante. El conteo no se podía terminar.

**Causa:** `createCount` resolvía la sesión con `requireOpenSession`, que filtra
`status: 'ABIERTA'`. Pero `start-count` acababa de dejarla en `EN_ARQUEO`. **La operación para
la que existe congelar la caja era justo la que la caja congelada rechazaba.**

**Arreglo:** `requireCountableSession` en `common/helpers/cash-session.helper.ts`, que acepta
`ABIERTA` **y** `EN_ARQUEO`. Los dos estados son legítimos para contar:

- `ABIERTA` — arqueo de control sin parar la venta (cambio de turno);
- `EN_ARQUEO` — el conteo formal, con el efectivo congelado.

Mover dinero sigue exigiendo `ABIERTA`: un gasto o un retiro durante el arqueo invalidaría el
recuento que se está haciendo. Eso se prueba explícitamente.

**Por qué no lo cazaron las pruebas:** `cashSessionsService` sí tenía cobertura del ciclo de
estados —incluido que el corte funciona desde `EN_ARQUEO`— pero **ninguna probaba `createCount`
con la caja congelada**. Y el mock del harness comparaba `where.status === 'ABIERTA'` sin
distinguir la forma `{ in: [...] }`, así que habría dado por bueno un arreglo incorrecto.

Ambas cosas corregidas: el mock ahora evalúa las dos formas del filtro, y hay cinco pruebas
nuevas. Verificado que **fallan contra el código anterior** (2 de 5) y pasan con el arreglo.

**Verificado:** `tsc --noEmit` ✅ · `jest` **703/703** en toda la API ✅ (sin regresiones) ·
móvil 112/112 ✅.

---

## 5 bis. Estado final

| Fase | Estado | Backend |
|---|---|---|
| 0 · Cimientos | ✅ | — |
| 1 · Estado visible | ✅ | — |
| 2 · Movimientos | ✅ | — |
| 3 · Arqueo y corte | ✅ | — |
| 4 · Tickets | ✅ | B1 hecho |
| 5 · Existencias | ✅ | — |
| 6 · Pulso del día | ✅ | — |

**Pendiente de decidir (no bloquea nada de lo entregado):**

- **B2** — variante ligera de `GET /orders` sin `items.product`. Hoy se compensa con páginas de
  20; hará falta cuando el historial se use en tiendas con mucho volumen.
- **B3** — exponer `settings.cashDifferenceThreshold`. Sin él, el motivo de la diferencia se pide
  siempre que haya descuadre, que es más simple y nunca molesta a quien cuadra.
- **B4** — idempotencia en `cancel` / `return` / `refund`.
- **B5** — si el Pulso del día debe ser valor gratuito, mover `REPORTES` a FREE o crear un
  endpoint de resumen diario sin gate.

**Deuda conocida, heredada del entorno:** `@testing-library/react-native` no funciona con
`react@19.1.0` (la versión que fija Expo SDK 54), así que no hay pruebas de componente. Toda la
lógica con riesgo se extrajo a módulos puros y se prueba ahí.

---

## 6. Contratos verificados

### 6.1 Caja

| Método | Ruta | Permiso | Cuerpo | Nota |
|---|---|---|---|---|
| GET | `/cash-sessions/active?branchId&cashRegisterId` | `cash:view` | — | Devuelve `{}` si no hay sesión. **Incluye `summary`** |
| POST | `/cash-sessions` | `pos.cash:open` | `{ exchangeRateUsdMxn, openingAmount, openingAmountUsd?, notes?, branchId?, cashRegisterId? }` | `exchangeRateUsdMxn` ≥ 0.01 siempre |
| POST | `/cash-sessions/active/movement` | `cash:manage` | `{ type: 'INCOME'\|'EXPENSE', amount, currency?, reason?, notes? }` | `amount` ≥ 0.01 |
| POST | `/cash-sessions/active/withdraw` | `pos.cash:withdraw` | `{ amount, currency?, reason }` | `reason` obligatorio. Valida contra disponible |
| PATCH | `/cash-sessions/:id/start-count` | — (PIN) | `{ authorizerPin? }` | `ABIERTA → EN_ARQUEO` |
| PATCH | `/cash-sessions/:id/resume` | — (PIN) | `{ authorizerPin? }` | `EN_ARQUEO → ABIERTA` |
| POST | `/cash-sessions/active/count` | — (PIN) | `{ type?, countedMxn, countedUsd?, denominations?, reason?, authorizerPin? }` | `type` por defecto `PARCIAL` |
| GET | `/cash-sessions/:id/counts` | `cash:view` | — | Arqueos de la sesión |
| PATCH | `/cash-sessions/:id/close` | — (PIN) | `{ cashCounted, cashCountedUsd?, differenceReason?, notes?, authorizerPin? }` | Puede devolver `PENDIENTE_REVISION` |
| GET | `/cash-sessions?status&branchId&page&limit` | `cash:view` | — | Paginado |
| GET | `/cash-sessions/:id` | `cash:view` | — | Incluye `summary` |
| GET | `/cash-sessions/registers` | `cash:view` | — | Cajas de la sucursal + sesión viva |
| GET | `/cash-sessions/registers/capacity` | `cash:view` | — | Tope del plan |
| POST | `/cash-sessions/registers` | `cash:manage` | `{ name, branchId? }` | |
| PATCH | `/cash-sessions/registers/:id` | `cash:manage` | `{ name?, isActive? }` | No desactiva con sesión viva |

Las cuatro rutas «— (PIN)» **no** llevan `@RequirePermissions`: resuelven la autorización dentro
del servicio con el permiso propio del usuario o el PIN de un empleado que lo tenga.

`CashMovementType`: `SALE`, `CXC_PAYMENT`, `SUPPLIER_PAYMENT`, `INCOME`, `EXPENSE`,
`WITHDRAWAL`, `REFUND`.
`CashSessionStatus`: `ABIERTA`, `EN_ARQUEO`, `PENDIENTE_REVISION`, `CERRADA`.

### 6.2 Órdenes

| Método | Ruta | Permiso | Cuerpo |
|---|---|---|---|
| GET | `/orders?customerId&status&orderOrigin&page&limit` | `orders:view` | — |
| GET | `/orders/:id` | `orders:view` | — |
| POST | `/orders/:id/cancel` | `orders:edit` | `{ reason }` |
| POST | `/orders/:id/return` | `orders:edit` | `{ reason }` |
| POST | `/orders/:id/refund` | `refunds:create` | `{ amount?, refundMethod, reason, currency?, items?: [{ orderItemId, quantity }], notes? }` |
| POST | `/orders/:id/send-receipt` | `orders:view` | `{ email }` |

`items` presente → restaura inventario de esas líneas. Ausente → reembolso solo de dinero.

### 6.3 Existencias

| Método | Ruta | Permiso | Cuerpo | Nota |
|---|---|---|---|---|
| PATCH | `/products/:id/stock` | `products:edit` | `{ quantity }` | **Delta.** Solo `SIMPLE` con `trackInventory` |
| PATCH | `/products/:id/variants/:variantId/stock` | `products:edit` | `{ quantity }` | **Delta**, sobre la sucursal del token |

### 6.4 Reportes — solo plan PRO o superior

Todos con `@RequireModule('reportes')` + `reports:view`, granularidad **mensual** (`year`,
`month`), devolviendo `WidgetResponse<T>`:

`/reports/sales/monthly` · `/reports/sales/daily` · `/reports/orders/monthly` ·
`/reports/profit/monthly` · `/reports/expenses/monthly` · `/reports/products/top` ·
`/reports/customers/new` · `/reports/quotes/monthly`

---

## 7. Cambios requeridos en el backend

| # | Cambio | Bloquea | Tamaño |
|---|---|---|---|
| ~~B1~~ | ~~`dateFrom`, `dateTo` y `branchId` en `QueryOrdersDto`~~ — **hecho** | Fases 4 y 6 | S |
| B2 | Variante ligera de `GET /orders` (sin `items.product`), por flag o por proyección | Fase 4 (performance) | S |
| B3 | Exponer `settings.cashDifferenceThreshold` en un endpoint que el POS alcance | Fase 3, mejora | S |
| B4 | Clave de idempotencia en `POST /orders/:id/cancel`, `/return`, `/refund` | Fase 4, robustez | M |
| B5 | Considerar mover `REPORTES` a FREE, o crear un endpoint de resumen diario sin gate | Fase 6, decisión de producto | — |

**B5 es una decisión de negocio, no técnica.** El plan funciona sin ella usando el `summary` de
caja y `GET /orders`; pero si el Pulso del día se considera parte del valor gratuito, hay que
decidirlo explícitamente en vez de dejar que el gate de plan lo resuelva por omisión.

---

## 8. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Congelar la caja y no reanudarla.** Un arqueo abandonado deja `EN_ARQUEO` y el POS deja de vender | Advertir antes de congelar; ofrecer «Reanudar» desde el POS y desde el drawer cuando el estado lo sea; no salir de arqueo sin confirmar |
| R2 | **`PENDIENTE_REVISION` interpretado como cerrado.** El operador se va creyendo que cortó | Copy explícito, estado visible en Caja e Inicio, y un aviso persistente hasta que se resuelva |
| R3 | **Doble movimiento por reintento.** Sin idempotencia, un gasto enviado dos veces se registra dos veces | Deshabilitar el botón durante el vuelo, no reintentar automáticamente (las mutaciones ya van con `retry: false`), y confirmar contra la lista antes de reenviar |
| R4 | **Desglose por denominación incoherente** con el monto capturado | El monto manda; el desglose solo suma y avisa si no coincide. Nunca bloquear por eso |
| R5 | **Varias cajas por sucursal sin `cashRegisterId`.** `getActive` devuelve la del propio usuario o ninguna: dos cajeros pueden confundirse | Guardar `cashRegisterId` por dispositivo (D5) y mostrar siempre qué caja se está operando |
| R6 | **Listado de órdenes pesado.** `GET /orders` trae productos completos | B2, y mientras tanto páginas de 20 |
| R7 | **Días en UTC.** Cualquier corte por fecha del servidor desfasa a un tenant en UTC−6 | Apoyarse en el `summary` de la sesión para «hoy»; al usar fechas, mandar rangos explícitos en hora local convertidos a UTC |
| R8 | **Paridad de i18n.** Este plan añade ~120 claves × 3 idiomas | Añadirlas en el mismo commit en los tres archivos; el typecheck de `i18next.d.ts` lo cubre parcialmente |
| R9 | **`pos-repository` partido a medias.** Refactor y funcionalidad en el mismo PR | Fase 0 va en su propio PR, sin pantallas nuevas |
| R10 | **403 de plan mostrados como error** | Mapear `Module 'x' not enabled` a un estado de «no incluido en tu plan», no a un error |

---

## 9. Criterios de aceptación

> **Estado:** la funcionalidad está construida y verificada por `tsc`, `eslint` y 112 pruebas de
> lógica. Este escenario es la validación **manual en dispositivo**, que sigue pendiente: las
> pruebas cubren mapeos, aritmética y reglas, no el recorrido completo contra la API real.

Escenario completo, ejecutado en dispositivo, tenant FREE, una sucursal:

- [ ] Abrir caja con fondo de $500 MXN. Caja muestra esperado $500.
- [ ] Tres ventas: $120 efectivo, $250 tarjeta, $80 efectivo. Esperado = $700; ventas = $450 con
      $200 en efectivo y $250 en tarjeta.
- [ ] Gasto de $150 en efectivo con motivo. Esperado = $550.
- [ ] Retiro de $300. Esperado = $250. Intentar retirar $400 se rechaza antes de enviar.
- [ ] Arqueo parcial contando $250. Diferencia $0. Reanudar y seguir vendiendo.
- [ ] Historial de tickets: las tres ventas aparecen con folio, hora y método correctos.
- [ ] Abrir un ticket, reenviar comprobante, cancelarlo. Esperado baja en consecuencia.
- [ ] Ajustar existencia de un producto: +10. Stock sube, movimiento registrado, visible en POS.
- [ ] Cortar contando lo esperado. Sesión `CERRADA`, resumen cuadrado.
- [ ] Repetir el corte con una diferencia grande: queda `PENDIENTE_REVISION` y la app lo dice.
- [ ] Con un usuario sin `pos.cash:close`: el botón de corte **sigue visible**, pide PIN, y el
      PIN de un supervisor lo completa.
- [ ] Inicio muestra vendido, efectivo, gastos y tickets del día, sin ningún 403 visible.
- [ ] Sin conexión, ninguna de estas pantallas se queda en spinner: todas dicen que no hay red.

---

## 10. Tests

Primera suite del proyecto (hoy no hay ninguna). Alcance deliberadamente corto: solo donde un
error cuesta dinero.

- [ ] Configurar Jest + `@testing-library/react-native` + `jest-expo`.
- [ ] `cash-repository`: mapeo DTO→dominio del `summary`, incluidos los cuatro estados y los
      campos `Decimal` que llegan como string.
- [ ] Cálculo del efectivo esperado en el cliente **contra** el del servidor, con un caso fijo:
      deben coincidir (si no coinciden, el cliente está recalculando y no debería).
- [ ] `cash-schemas`: montos, divisa, motivo obligatorio en retiro, PIN 4-12.
- [ ] Suma del desglose por denominación.
- [ ] `orders-repository`: mapeo de una orden con devoluciones parciales previas.
- [ ] Delta de ajuste de existencias: entrada, salida, y salida mayor al stock.
- [ ] `toUserMessage` para los errores nuevos de caja.

---

## 11. Fuera de alcance

No entra en este plan, aunque roce:

- Fiado / CxC — módulo **PLUS**, ver `faltantes-app-comercial.md` §4.
- Compras, proveedores y CxP — módulos **PRO**, y ver `auditoria-comercial.md` §20.
- Retiro para compra de insumos (`withdrawForSupplies`) — exige credenciales de admin y toca el
  módulo de insumos.
- Impresión Bluetooth del corte — Fase 3 del roadmap general.
- Cola offline de movimientos de caja — depende de la idempotencia global.
- Selector de sucursal — pieza propia, no bloquea al tenant FREE.
- Alta y gestión de cajas físicas desde Configuración — solo se consume `GET /registers`; el ABM
  entra con el módulo de Configuración → Caja.

---

## 12. Resumen de esfuerzo

| Fase | Tamaño | Backend | Valor |
|---|---|---|---|
| 0 · Cimientos | S | No | Habilitador |
| 1 · Estado visible | S | No | Alto |
| 2 · Movimientos | M | No | Muy alto |
| 3 · Arqueo y corte | L | No | Muy alto |
| 4 · Tickets | L | Sí (B1, B2) | Muy alto |
| 5 · Existencias | S | No | Muy alto |
| 6 · Pulso del día | M | Sí (B1) | Muy alto |

**Las fases 0, 1, 2, 3 y 5 no requieren ni una línea de backend.** Son la mayor parte del valor
del ciclo del día y pueden arrancar hoy.
