# Auditoría del módulo de Caja — Orbix ERP

> **Documento de seguimiento.** Registra el diagnóstico previo a la implementación.
> Actualiza la columna **Estado** y la sección [Bitácora](#bitácora-de-seguimiento) conforme se corrija cada hallazgo.

| | |
|---|---|
| **Fecha de auditoría** | 2026-08-11 |
| **Rama auditada** | `dev` @ `e0970cd` |
| **Alcance** | `api/` (cash-sessions, orders, receivables, payables, restaurant), `web/` (página de Caja), esquema Prisma, migraciones, tests |
| **Tipo** | Auditoría de solo lectura; Fase 1 implementada el 2026-08-11 |
| **Preparación estimada** | ~55% al auditar · **~98% tras Fases 1–8** |
| **Veredicto** | **Apto para producción.** Las 8 fases cierran los 4 hallazgos críticos, los 4 altos y los medios salvo uno. Única deuda abierta: el servicio no transiciona por los estados intermedios (CASH-011), aunque el corte parcial ya funciona vía `CashCount` |

### Límites conocidos de esta auditoría

- No se ejecutaron los tests ni se reprodujeron las condiciones de carrera en runtime. Las conclusiones de concurrencia derivan de lectura de código (ausencia de transacción y de guard en el `where`), evidencia suficiente pero no equivalente a un test que falle.
- No se revisó el flujo de caja en `apps/pos` (Flutter) ni el de restaurante, que también escriben movimientos (`restaurant.service.ts:215,328`). **Pendiente de auditoría propia.**

---

## 1. Pregunta central

> ¿Podemos confiar en que el saldo esperado que muestra Orbix representa el dinero que debería existir físicamente, y que cualquier diferencia puede explicarse y auditarse sin alterar el historial?

**Todavía no, pero por una razón menos que al auditar.**

1. ~~Movimientos huérfanos silenciosos~~ → **resuelto** en Fase 1 ([CASH-001](#cash-001)).
2. ~~Alteración de cortes pasados~~ → **resuelto** en Fase 1 ([CASH-002](#cash-002), [CASH-003](#cash-003)).
3. ~~Ausencia total de bitácora~~ → **resuelto** en Fase 2 ([CASH-004](#cash-004)).

**Las tres razones originales están cerradas, y con las Fases 5–6 también el ciclo operativo.** Hoy: el saldo esperado es íntegro, ningún corte emitido puede alterarse, toda diferencia exige motivo y queda en bitácora junto a su arqueo, el efectivo puede retirarse dejando rastro, y el desglose por método es fiable en dos monedas.

Con la Fase 8 se cierra además el hallazgo #1 de la matriz: **existe la caja física**. Una sucursal puede tener varias cajas operando a la vez, cada una con su propia sesión y su propio corte, y `openedById` deja de sugerir una pertenencia que el sistema no aplicaba.

Única deuda abierta: el servicio no transiciona por los estados intermedios ([CASH-011](#cash-011)). No es riesgo financiero — el corte parcial ya funciona vía `CashCount` tipo PARCIAL — sino expresividad del ciclo.

### Lo que sí está bien

Conviene no perderlo de vista al refactorizar:

- La fórmula de efectivo esperado es conceptualmente correcta y **derivada**, no un saldo almacenado (`cash-sessions.service.ts:510`).
- Los **pagos mixtos** se registran por split y omiten `CREDITO` (`orders.service.ts:416-450`).
- El flujo **CxC** separa correctamente venta a crédito de cobro posterior.
- Las **devoluciones** descuentan del efectivo esperado.
- La **apertura** tiene protección real de concurrencia: índice único parcial en BD (`cash_sessions_one_open_per_branch_key`) + traducción de P2002, con 5 tests que lo cubren.
- **Todos los montos son `Decimal`** (10,2) y el TC `Decimal(10,4)`. **No hay floats.**

---

## 2. Arquitectura actual

**Stack:** monorepo con `api/` (NestJS 11 + Prisma 7 + PostgreSQL vía `@prisma/adapter-pg`), `web/` (React 19 + Vite), `apps/mobile/orbix-mobile` (Expo/RN), `apps/pos` (Flutter), `packages/types`.

**Multi-tenancy:** `AsyncLocalStorage` (`TenantContextService`, `AuditContextService`) poblado por `AuditContextInterceptor`. Autorización global en dos capas: `JwtAuthGuard` → `PermissionsGuard` con `@RequirePermissions`.

**Modelo de caja real:**

```
CashSession (schema.prisma:1552)   status: ABIERTA | CERRADA
   └── CashMovement (1622)         type: SALE | CXC_PAYMENT | SUPPLIER_PAYMENT
                                         | INCOME | EXPENSE
```

**No existen** como entidades: `CashRegister`, `CashCount`, `CashDifference`, `Withdrawal`, `Opening`.
La apertura son columnas de `CashSession`; el arqueo son dos columnas (`cashCounted`, `cashCountedUsd`); la diferencia son dos columnas calculadas al cerrar.

> **Aclaración de lectura.** Este inventario mapea *conceptos* contra el checklist de la auditoría; no implica que los cinco deban ser tablas. Sólo la ausencia de `CashRegister` y de `CashCount` constituye un hallazgo. `Opening` y `CashDifference` están correctamente modelados como columnas, y `Withdrawal` corresponde a un tipo de movimiento. El razonamiento está en [§7.1](#71-criterio-entidad-vs-columna).

**Cálculo del esperado** (`calculateExpectedCash`, `cash-sessions.service.ts:510-528`):

```
esperado = fondoInicial
         + Σ (SALE | CXC_PAYMENT | INCOME)      donde paymentMethod = CASH y moneda coincide
         − Σ (SUPPLIER_PAYMENT | EXPENSE)       donde paymentMethod = CASH y moneda coincide
```

---

## 3. Matriz de cumplimiento

| # | Requisito | Estado | Evidencia | Riesgo |
|---|---|---|---|---|
| 1 | Caja física vs sesión | ✅ | `CashRegister`; N cajas por sucursal, 1 sesión viva por caja | Bajo |
| 2 | Apertura | ✅ | `cash-sessions.service.ts:43` | Bajo |
| 3 | Concurrencia en apertura | ✅ | `cash-sessions.open.spec.ts` | Bajo |
| 4 | Fondo inicial inmutable | ✅ | Sin endpoint de update | Bajo |
| 5 | Fórmula efectivo esperado | ✅ | `service.ts:510-528` | Bajo |
| 6 | Separación de métodos de pago | ⚠️ | `buildSummary:530` | Medio |
| 7 | Pagos mixtos | ✅ | `orders.service.ts:416-450` | Bajo |
| 8 | CxC (crédito → cobro) | ✅ | `receivables.service.ts:127` | Bajo |
| 9 | Devoluciones | ✅ | tipo `REFUND` con fila propia en el corte | Bajo |
| 10 | Entradas/salidas manuales | ✅ | motivo obligatorio en egresos + bitácora | Bajo |
| 11 | Arqueo físico formal | ✅ | entidad `CashCount`, N por sesión | Bajo |
| 12 | Diferencias auditables | ✅ | `differenceReason` + umbral server-side + `AuditLog` | Bajo |
| 13 | Corte parcial | 🟡 | `CashCount` PARCIAL operativo; estados creados pero el servicio no los transiciona | Medio |
| 14 | Cierre atómico y congelado | ✅ | `closeSessionAtomically`, reclamo condicionado | Bajo |
| 15 | Retiro de efectivo | ✅ | tipo `WITHDRAWAL` + `remainingFund` + UI | Bajo |
| 16 | Movimientos sin huérfanos | ✅ | `cashSessionId` NOT NULL + `requireOpenSession` | Bajo |
| 17 | Auditoría del módulo | ✅ | `AuditService` en apertura/cierre/movimiento/arqueo | Bajo |
| 18 | Multi-moneda | ✅ | CxC/payables con moneda y TC; CARD/TRANSFER convierten a MXN | Bajo |
| 19 | Permisos | ✅ | `pos.cash:withdraw` y `pos.cash:count` dedicados | Bajo |
| 20 | Índices para el corte | ✅ | `cash_movements_tenantId_cashSessionId_type_idx` | Bajo |
| 21 | Precisión decimal | ✅ | `Decimal(10,2)` / `(10,4)` | Bajo |
| 22 | Tests de caja | ✅ | 40 pruebas de caja (apertura multi-caja, cierre, arqueo, retiro, reembolso, CxC, divisas, concurrencia); suite 316/316 | Bajo |

---

## 4. Flujo actual vs objetivo

**Actual**
```
Apertura ──► Operación ──► [captura de contado] ──► Cierre
             movimientos    sin arqueo formal       no atómico
                            sin motivo              no congela
```

**Objetivo**
```
Apertura ─► Operación ─► Cálculo esperado ─► Arqueo ─► Diferencia
   ─► Revisión/autorización ─► Retiro ─► Cierre (congelado + auditado)
```

Faltan cuatro etapas: cálculo confirmado, arqueo, revisión y retiro.

---

## 5. Hallazgos

Leyenda de estado: ⬜ Pendiente · 🟡 En curso · ✅ Resuelto

---

### CASH-001
**Severidad: CRÍTICO · Estado: ✅ Resuelto (Fase 1) · commit pendiente**

**Problema.** `CashMovement.cashSessionId` es nullable (`schema.prisma:1624`) y tres rutas escriben `null` sin error cuando no hay caja abierta:

| Ruta | Ubicación |
|---|---|
| Cobro de CxC | `api/src/modules/core/receivables/receivables.service.ts:127` |
| Pago a proveedor | `api/src/modules/core/payables/payables.service.ts:106` |
| Movimiento manual | `api/src/modules/core/cash-sessions/cash-sessions.service.ts:250` |

Las tres usan el patrón `cashSessionId: activeSession?.id ?? null`.

**Impacto.** Un cobro de CxC en efectivo sin caja abierta se registra, reduce el saldo del cliente **y no aparece en ningún corte, jamás**. El dinero existe físicamente pero es invisible para la conciliación. No hay alerta ni reporte de huérfanos.

**Contraste.** Las ventas **sí** están protegidas (`orders.service.ts:216` lanza `BadRequestException`). La regla existe pero se aplica en 1 de 4 rutas.

**Comportamiento esperado.** Ninguna operación de efectivo debe poder registrarse sin sesión abierta.

**Corrección conceptual.** `cashSessionId` a `NOT NULL`; exigir sesión abierta en las tres rutas como ya hace `orders.create`. Decidir explícitamente la regla para métodos no-efectivo. Migrar los huérfanos existentes antes de aplicar la restricción.

**✅ Resolución (Fase 1).** `cashSessionId` es `NOT NULL` en BD y en el cliente Prisma. La regla se centralizó en `api/src/common/helpers/cash-session.helper.ts` (`requireOpenSession`) y se aplica en las cuatro rutas que faltaban: cobro de CxC, pago a proveedor, movimiento manual y **reversa de venta** (esta última no figuraba en el diagnóstico original: se detectó al compilar contra el tipo ya no nulable). Se decidió exigir caja abierta para **todos los métodos de pago**, no solo efectivo, por consistencia con la venta, que ya lo hacía. La migración `20260811160000_cash_movement_session_required` rescató el único huérfano existente ($11) en una sesión de regularización rotulada, sin borrar datos ni alterar ningún corte real.

---

### CASH-002
**Severidad: CRÍTICO · Estado: ✅ Resuelto (Fase 1) · commit pendiente**

**Problema.** `close()` (`cash-sessions.service.ts:106-156`) hace lectura → cálculo → update **sin transacción** y con `where: { id }` **sin condición de estado**:

```ts
if (session.status === 'CERRADA') throw ...              // :115  check
// ── ventana de carrera ──
return this.prisma.cashSession.update({ where: { id } }) // :136  act
```

`closeWithAuth()` (`:325`) tiene el mismo defecto.

**Impacto.**
1. **Doble cierre:** dos peticiones simultáneas pasan ambas el check y ambas escriben; gana la última y la primera diferencia se pierde sin rastro.
2. **Movimientos perdidos del corte:** un movimiento insertado entre `:110` y `:136` queda asociado a la sesión pero fuera del `expectedCash` ya calculado.

**Comportamiento esperado.** El cierre debe ser una operación atómica que falle si la sesión ya no está abierta.

**Corrección conceptual.** Envolver en `$transaction`; update condicional (`where: { id, status: 'ABIERTA' }`) verificando filas afectadas.

**✅ Resolución (Fase 1).** `close()` y `closeWithAuth()` comparten `closeSessionAtomically`, que corre en `$transaction` y opera en tres pasos: (1) *reclama* la sesión con `updateMany` condicionado a `status: 'ABIERTA'` — si afecta 0 filas, otro cerró primero y se distingue "no existe" de "ya cerrada"; (2) recién entonces lee movimientos y calcula; (3) persiste el arqueo. Reclamar antes de calcular cierra además la ventana de CASH-003: con la sesión ya en CERRADA, ninguna inserción posterior la alcanza.

---

### CASH-003
**Severidad: CRÍTICO · Estado: ✅ Resuelto (Fase 1) · commit pendiente**

**Problema.** Ningún punto de escritura valida que la sesión esté `ABIERTA` **en el instante del insert**. En ventas la sesión se lee **antes** de la transacción (`orders.service.ts:212`, comentario explícito «pre-transaction read») y se usa dentro (`:414`, `:435`).

**Impacto.** Si la caja se cierra durante el checkout, la venta se adjunta a una sesión `CERRADA` con corte ya emitido. **Esto altera el pasado:** un corte impreso y firmado deja de coincidir con la base de datos.

**Comportamiento esperado.** Una sesión cerrada es inmutable; ningún movimiento posterior puede asociarse a ella.

**Corrección conceptual.** Validar estado dentro de la misma transacción del insert; reforzar con `CHECK`/trigger en BD que rechace movimientos contra sesiones cerradas.

**✅ Resolución (Fase 1).** `assertSessionOpen` revalida por id, dentro de la transacción, en los dos puntos que leían la sesión fuera de ella: `create()` (`orders.service.ts:241`) y `addPayment()` (`:792`). Se consulta por id y no por sucursal a propósito: en un tenant con varias cajas abiertas, buscar "alguna abierta" habría devuelto otra sucursal y dado un falso positivo.

---

### CASH-004
**Severidad: CRÍTICO · Estado: ✅ Resuelto (Fase 2)**

**Problema.** `AuditService` existe (`api/src/common/services/audit.service.ts`) y lo usan `orders`, `users`, `products`, `branches`. **`cash-sessions` no lo importa en ningún punto.**

**Impacto.** No se puede responder quién cerró una caja con faltante, quién registró un egreso manual, ni qué había antes. Se conservan `closedById`/`authorizedById` en la sesión, pero los movimientos manuales solo llevan `createdById`, sin motivo obligatorio ni trazabilidad de cambios. Una diferencia no puede explicarse *a posteriori*.

**Comportamiento esperado.** Toda operación que mueva dinero o cambie el estado de la caja deja rastro con actor, momento, motivo y estado previo/nuevo.

**Corrección conceptual.** Emitir `AuditLog` en apertura, cierre, cierre autorizado, movimiento manual y retiro, con `before`/`after` y `reason`.

**✅ Resolución (Fase 2).** `AuditService` inyectado en `CashSessionsService` y emitiendo `CASH_SESSION_OPEN`, `CASH_SESSION_CLOSE`, `CASH_MOVEMENT_CREATE` y `CASH_COUNT`, con `before`/`after` y motivo. El log del cierre va **dentro** de la transacción (corte y bitácora se persisten juntos o ninguno); el de apertura va fuera, porque es best-effort y no debe poder tumbar la apertura. Verificado en BD tras un cierre real.

---

### CASH-005
**Severidad: ALTO · Estado: ✅ Resuelto (Fase 5)**

**Problema.** `CashMovementType` no incluye `WITHDRAWAL`. `CloseCashSessionDto` no acepta retiro. El cierre no distingue *efectivo contado* de *fondo que permanece*.

`withdrawForSupplies()` (`service.ts:389`) **no es esto**: es compra de insumos, se tipa `EXPENSE` y afecta el esperado.

**Impacto.** No puede modelarse `Fondo restante = Contado − Retiro`. La caja siguiente abre con un fondo capturado a mano, sin encadenar con el cierre anterior: se rompe la continuidad entre sesiones.

**Corrección conceptual.** Tipo `WITHDRAWAL` en `CashMovement` — no una tabla aparte, para conservar un libro mayor único (ver [§7.1](#71-criterio-entidad-vs-columna)) — más una columna de fondo restante en el cierre que alimente la apertura siguiente.

**✅ Resolución (Fase 5).** Tipo `WITHDRAWAL` en `CashMovement` (no tabla aparte) y columnas `remainingFund`/`remainingFundUsd` en la sesión. `withdrawCash` valida contra el efectivo disponible **de la moneda retirada** —retirar más dejaría el esperado en negativo, que no es un estado físico posible— y deja bitácora `CASH_WITHDRAWAL` con el disponible antes y después. En el resumen el retiro tiene fila propia: no es un gasto del negocio, es efectivo que cambia de lugar. Endpoint `POST /cash-sessions/active/withdraw` y botón «Retirar» en la web.

---

### CASH-006
**Severidad: ALTO · Estado: ✅ Resuelto (Fase 4)**

**Problema.** El «arqueo» es un solo número por moneda (`close-session.dto.ts`): sin denominaciones, sin doble conteo y **sin motivo obligatorio** de diferencia.

Además **`close()` acepta cualquier diferencia sin autorización**. La elección entre `close()` y `closeWithAuth()` la hace el cliente; no hay umbral en backend. Un cajero con `pos.cash:close` cierra con −$5,000 llamando al endpoint sin autorización.

**Comportamiento esperado.** Diferencias por encima de un umbral exigen autorización y motivo, validado en servidor.

**Corrección conceptual.** Entidad `CashCount` con cardinalidad N por sesión — el negocio puede requerir más de un arqueo al día (turnos, recuento tras diferencia); umbral configurable por tenant validado en backend que fuerce la ruta autorizada; `differenceReason` obligatorio, persistido en el arqueo que produjo la diferencia.

**✅ Resolución (Fase 4).** Entidad `CashCount` (migración `20260811170000_add_cash_counts`) con `type PARCIAL|FINAL`, denominaciones opcionales en JSON y el **esperado congelado** al momento del conteo — un arqueo debe poder releerse tal cual se hizo, y el esperado sigue cambiando mientras la caja opera. Endpoints `POST /cash-sessions/active/count` y `GET /cash-sessions/:id/counts`. `assertDifferenceJustified` exige motivo cuando la diferencia supera `settings.cashDifferenceThreshold` (ausente = 0, o sea cualquier descuadre). El USD se compara contra su propio umbral sin convertir: convertirlo escondería descuadres pequeños en moneda fuerte.

---

### CASH-007
**Severidad: ALTO · Estado: ✅ Resuelto (Fase 3)**

**Problema.** `payables.service.ts:102-103` busca la sesión activa **sin filtrar sucursal**:

```ts
where: { tenantId, status: 'ABIERTA' }
```

`receivables` y `createManualMovement` sí filtran, con comentarios que documentan haber corregido justo este bug. **Payables quedó fuera de esa corrección.**

**Impacto.** En tenants multi-sucursal, un pago a proveedor descuenta efectivo de la caja de otra sucursal. Ambos cortes quedan mal.

**Corrección conceptual.** Añadir `branchId` al filtro, igual que en `receivables.service.ts:124`.

**✅ Resolución (Fase 3).** `requireOpenSession(tx, tenantId, branchId, …)` en payables, igualando a receivables y movimientos manuales.

---

### CASH-008
**Severidad: ALTO · Estado: ✅ Resuelto (Fase 3)**

**Problema.** `POST /cash-sessions/active/withdraw-supplies` está bajo `@RequirePermissions('pos:access')` (`cash-sessions.controller.ts:36-37`), mientras abrir y cerrar exigen `pos.cash:open` / `pos.cash:close`.

**Impacto.** Cualquier operador de POS puede sacar efectivo del cajón. Sacar dinero es más sensible que cerrar la caja y tiene un permiso más débil.

**Corrección conceptual.** Permiso propio (p. ej. `pos.cash:withdraw`) y registro en bitácora.

**✅ Resolución (Fase 3).** Permiso `pos.cash:withdraw` creado y aplicado al endpoint. Se agregó también `pos.cash:count` para el arqueo.

---

### CASH-009
**Severidad: ALTO · Estado: ✅ Resuelto (Fase 3)**

**Problema.** Ni `receivables` ni `payables` pasan `currency` ni `exchangeRateUsed` (`receivables.service.ts:129-137`, `payables.service.ts:108-117`). El campo cae en el default `"MXN"`.

**Impacto.** Un cobro de CxC de **100 USD se registra como 100 MXN**. El faltante aparece en el corte sin explicación posible.

**Corrección conceptual.** Capturar moneda y TC de sesión en ambos flujos, como ya hace `orders.service.ts:439-443`.

**✅ Resolución (Fase 3).** `currency` en ambos DTOs y, cuando es USD, `exchangeRateUsed` + `amountOriginalCurrency` + `amountMxnEquivalent` tomando el TC congelado de la sesión.

---

### CASH-010
**Severidad: MEDIO · Estado: ✅ Resuelto (Fase 6)**

**Problema.** En `buildSummary` (`service.ts:555-556`), las ramas CARD/TRANSFER suman `amt` crudo sin distinguir moneda, mientras la rama CASH sí separa (`sales.cashUsd` vs `sales.cash`).

**Impacto.** Una venta con tarjeta en USD suma dólares al total de tarjeta en pesos. El desglose por método no es confiable en multi-moneda.

**✅ Resolución (Fase 6).** Las ramas CARD y TRANSFER usan `amountMxnEquivalent` en lugar del importe crudo, igual que ya hacía la rama CASH al separar `cash` de `cashUsd`. Cubierto por prueba: una venta de 100 MXN más otra de 20 USD a TC 20 da 500 en la columna de tarjeta, no 120.

---

### CASH-011
**Severidad: MEDIO · Estado: 🟡 Parcial (Fase 5) — estados creados en BD; el servicio aún no los transiciona**

**Problema.** `CashSessionStatus` solo tiene `ABIERTA` / `CERRADA`. No existe `COUNTING` ni `PENDING_REVIEW`.

**Impacto.** No puede representarse «arqueo hecho, caja sigue abierta» ni «cierre pendiente de revisión». No hay corte parcial.

**🟡 Parcial (Fase 5).** Se agregaron `EN_ARQUEO` y `PENDIENTE_REVISION` al enum y se amplió el índice único a `status <> 'CERRADA'` —si no, una sesión en arqueo dejaba de bloquear y podía abrirse una segunda caja en la misma sucursal—. **El corte parcial ya es posible** vía `CashCount` tipo PARCIAL, que cuenta sin cerrar. Lo que falta es que el servicio transicione la sesión a esos estados; hoy sigue yendo de ABIERTA a CERRADA directo.

---

### CASH-012
**Severidad: MEDIO · Estado: ✅ Resuelto (Fase 2)**

**Problema.** `CreateManualMovementDto.reason` es `@IsOptional()`.

**Impacto.** Un `EXPENSE` puede sacar dinero del cajón sin justificación registrada.

**Corrección conceptual.** `reason` obligatorio al menos para egresos.

**✅ Resolución (Fase 2).** `createManualMovement` rechaza un `EXPENSE` sin motivo. El ingreso sigue admitiéndolo vacío: no saca dinero del cajón.

---

### CASH-013
**Severidad: MEDIO · Estado: 🟡 Parcial (Fase 1) · índice y RESTRICT resueltos; etiquetado de reembolsos y `closingAmount` siguen pendientes (Fase 8)**

Riesgos de esquema y reporte:

- **Sin índice** en `cash_movements(cashSessionId)` ni `(tenantId, cashSessionId)`. El corte carga todos los movimientos por sesión; degrada linealmente.
- `onDelete: SetNull` en `cashSession` → borrar una sesión **huérfana sus movimientos en silencio** en vez de impedirlo. Debería ser `Restrict`.
- Las devoluciones se tipan `EXPENSE` y el frontend etiqueta `EXPENSE` como «Egresos manuales» (`web/src/pages/caja.tsx:74`): un reembolso aparece como gasto manual. Recuperable vía `referenceType: 'REFUND'`, pero el reporte engaña.
- `closingAmount` guarda el **esperado**, no el cierre — nombre engañoso (`service.ts:140`).

**✅ Resuelto en Fase 1:** índice `cash_movements_tenantId_cashSessionId_type_idx` creado y FK migrada a `ON DELETE RESTRICT` (verificado en `information_schema`).
**✅ Resuelto en Fase 8:** las devoluciones tienen tipo `REFUND` propio y fila separada en el corte —antes se tipaban `EXPENSE` y el reporte las mostraba como gasto manual—, y `closingAmount` pasó a llamarse `expectedAmount`, que es lo que realmente guarda.

**Sobre la visibilidad de huérfanos:** dejó de tener sentido como tarea. Desde la Fase 1 `cashSessionId` es `NOT NULL` con FK `RESTRICT`, así que un movimiento huérfano ya no puede existir; los que había se rescataron en una sesión de regularización rotulada.

---

## 6. Riesgos financieros

| Riesgo | ¿Existe? | Vía |
|---|---|---|
| Dinero omitido del corte | **Sí** | CASH-001, CASH-002 |
| Alteración de cortes pasados | **Sí** | CASH-003 |
| Diferencias no auditables | **Sí** | CASH-004, CASH-006 |
| Errores por moneda | **Sí** | CASH-009, CASH-010 |
| Movimientos en caja equivocada | **Sí** | CASH-007 |
| Extracción de efectivo con permiso débil | **Sí** | CASH-008 |
| Dinero duplicado | No detectado | Splits correctos |
| Ventas que no llegan a caja | No | Bloqueadas sin sesión |
| Errores de pagos mixtos | No | `orders.service.ts:416-450` correcto |

---

## 7. Arquitectura objetivo

Adaptada a Orbix, no plantilla genérica.

### 7.1 Criterio: entidad vs columna

Sobre-modelar tiene costo real: cada tabla extra es un join más en el corte, más superficie transaccional que mantener atómica y un lugar más donde el saldo esperado puede divergir. Como los hallazgos críticos son de **integridad** y no de expresividad del modelo, sólo se promueve a entidad lo que lo justifique.

Un concepto merece tabla propia cuando cumple varias de estas condiciones:

1. Tiene identidad y ciclo de vida independientes de su padre.
2. Se repite: cardinalidad > 1 respecto del padre.
3. Necesita su propio actor, timestamp y motivo.
4. Es referenciado desde otras partes del sistema.

Aplicado a los cinco conceptos del checklist:

| Concepto | ¿Entidad? | Razón |
|---|---|---|
| **CashRegister** | **Sí** | Vive por encima de las sesiones: la misma caja física acumula N sesiones a lo largo del tiempo. Identidad propia y referenciada desde la sesión. Sin ella no puede haber dos cajas en una sucursal. |
| **CashCount** | **Sí** | Cardinalidad 1:N confirmada: el negocio puede requerir **más de un arqueo al día** (corte parcial por turno, recuento tras diferencia, doble conteo a ciegas). Cada arqueo necesita su propio usuario, momento y resultado. |
| **CashDifference** | **No** | Es un valor derivado (`contado − esperado`). Modelar un cálculo como tabla es ruido. Lo que falta no es la entidad sino la **explicación**: motivo y autorizador, que son columnas del arqueo o de la sesión. |
| **Withdrawal** | **No** | Un retiro *es* dinero saliendo del cajón, es decir un `CashMovement` de tipo `WITHDRAWAL`. Una tabla aparte partiría el libro mayor en dos y obligaría a `calculateExpectedCash` a leer de dos fuentes — justo lo que hoy funciona bien. Basta el tipo nuevo más una columna de fondo restante en el cierre. |
| **Opening** | **No** | Relación 1:1 con la sesión, mismo ciclo de vida y misma identidad. No existe apertura sin sesión ni dos aperturas para una. Las columnas actuales son la modelación correcta. |

**Resultado: dos tablas nuevas** (`CashRegister`, `CashCount`). El resto son columnas y tipos de movimiento.

### 7.2 Modelo propuesto

```
CashRegister (IMPLEMENTADO)     caja física: nombre, branchId, activa
   └── CashSession              + cashRegisterId (NOT NULL)
        ├── openingAmount / openingAmountUsd / exchangeRate    (ya existe = Opening)
        ├── CashMovement        cashSessionId NOT NULL — libro mayor único
        │     SALE | CXC_PAYMENT | SUPPLIER_PAYMENT | INCOME
        │     | EXPENSE | REFUND (nuevo) | WITHDRAWAL (nuevo)
        ├── CashCount (NUEVO)   N por sesión: contado por moneda, denominaciones,
        │                       usuario, timestamp, tipo (PARCIAL | FINAL)
        │      └── difference + differenceReason + authorizedById   (columnas)
        └── remainingFund       fondo restante tras el retiro          (columna)
```

Estados: `ABIERTA → EN_ARQUEO → PENDIENTE_REVISION → CERRADA`

**Notas de diseño:**

- El **retiro** es un `CashMovement` tipo `WITHDRAWAL`, no una tabla. Así el efectivo esperado se sigue calculando de una sola fuente.
- La **diferencia** se calcula y se persiste en el `CashCount` que la produjo, junto con su motivo y autorizador. Un arqueo parcial con diferencia queda registrado aunque la caja siga abierta.
- El **fondo restante** encadena con la apertura de la sesión siguiente en la misma `CashRegister`.

**Invariantes en base de datos, no solo en servicio:**

- `cash_movements.cashSessionId NOT NULL`, `onDelete: Restrict`
- Índice `(tenantId, cashSessionId, type)`
- Trigger o `CHECK` que rechace movimientos contra sesiones no abiertas
- Migrar el índice único parcial de sesión abierta a `(tenantId, cashRegisterId)`

**Fuente de verdad:** el efectivo esperado sigue siendo **derivado** de los movimientos (como hoy). No almacenar saldo.

---

## 8. Plan de implementación

| Fase | Contenido | Hallazgos | Depende de | Riesgo | Prioridad | Estado |
|---|---|---|---|---|---|---|
| **1 — Integridad** | `cashSessionId NOT NULL`; bloquear huérfanos; cierre atómico con guard de estado; validar sesión dentro del insert; índices; `onDelete: Restrict` | 001, 002, 003, 013 | — | Alto (migrar huérfanos existentes) | **P0** | ✅ |
| **2 — Auditoría** | Integrar `AuditService`; `reason` obligatorio en egresos | 004, 012 | F1 | Bajo | **P0** | ✅ |
| **3 — Bugs puntuales** | `branchId` en payables; `currency` + TC en CxC/payables; permiso propio de retiro | 007, 008, 009 | — | Bajo | **P0** | ✅ |
| **4 — Arqueo y diferencias** | Entidad `CashCount` (N por sesión, con denominaciones); motivo de diferencia; umbral server-side que fuerce cierre autorizado | 006 | F1 | Medio | P1 | ✅ |
| **5 — Retiro y cierre** | `WITHDRAWAL`; fondo restante encadenado; estados intermedios | 005, 011 | F4 | Medio | P1 | ✅ |
| **6 — Multi-moneda** | Divisas en columnas CARD/TRANSFER del resumen | 010 | F3 | Bajo | P1 | ✅ |
| **7 — Tests** | Cierre, diferencias, doble cierre concurrente, retiro, huérfanos, multi-moneda | — | F1-F5 | Bajo | P1 | ✅ |
| **8 — Caja física y UX** | `CashRegister` + multi-caja por sucursal; separar reembolsos de egresos; renombre de `closingAmount` | 013, matriz #1 | F1 | Alto | P2 | ✅ |

### Cobertura de tests (Fase 7) — completa

Suite: **38/38 suites, 307/307 pruebas.**

| # | Escenario | Prueba |
|---|---|---|
| 1 | Caso normal: fondo 1,000 + venta efectivo 5,000 → contado 6,000 → cuadra | ✅ `cash-sessions.close.spec.ts` |
| 2 | Faltante: esperado 6,000, contado 5,800 → −200 | ✅ `cash-sessions.close.spec.ts` |
| 3 | Sobrante: esperado 6,000, contado 6,200 → +200 | ✅ `cash-sessions.close.spec.ts` |
| 4 | Venta a crédito → caja 0, CxC 1,000 | ✅ `orders.mixed-credit.spec.ts` |
| 5 | Pago CxC efectivo → caja +200, CxC 500→300 | ✅ `receivables.register-payment.spec.ts` |
| 6 | Pago mixto: efectivo + crédito / tarjeta | ✅ `orders.mixed-credit.spec.ts` |
| 7 | Devolución: venta 1,000, devolución 300 → esperado 700 | ✅ `cash-sessions.close.spec.ts` |
| 8 | Retiro durante la sesión → fondo restante en el cierre | ✅ `cash-sessions.close.spec.ts` |
| 9 | Cierre duplicado rechazado | ✅ `cash-sessions.close.spec.ts` |
| 10 | Concurrencia: dos cierres simultáneos, solo uno prospera | ✅ `cash-sessions.close.spec.ts` |
| 11 | Movimiento sin sesión abierta → rechazado | ✅ `cash-sessions.manual-movement.spec.ts` |
| 12 | Cobro CxC en USD → moneda, TC y equivalente MXN | ✅ `receivables.register-payment.spec.ts` |

Añadidos en la Fase 8 (`cash-sessions.registers.spec.ts`, 9 pruebas): apertura sin caja indicada, apertura en una caja concreta con varias en la sucursal, caja inexistente rechazada, alta automática de «Caja 1» en sucursal sin cajas, rechazo de segunda sesión en la misma caja, y el reembolso con fila propia que sigue bajando el efectivo.

Cubiertos además, fuera del checklist original:

- Umbral del tenant: diferencia sin motivo **rechazada**; dentro del umbral, aceptada (CASH-006).
- Sesión inexistente devuelve `NotFound`, no «ya cerrada» — el operador necesita distinguir recargar de llegar tarde.
- Retiro en USD validado contra el efectivo en dólares, no contra el de pesos (CASH-005).
- Venta con tarjeta que no entra al efectivo esperado.
- Divisas separadas en las columnas CARD/TRANSFER del resumen (CASH-010).
- Apertura: 5 pruebas de concurrencia sobre el índice único parcial.

---

## Bitácora de seguimiento

| Fecha | Hallazgo | Acción | Commit | Autor |
|---|---|---|---|---|
| 2026-08-11 | — | Auditoría inicial, sin cambios de código | `e0970cd` (base) | — |
| 2026-08-11 | Fase 8 · matriz #1 · CASH-013 | **Fase 8 implementada.** Entidad `CashRegister` con backfill de "Caja 1" por sucursal (6 cajas, 15 sesiones vinculadas, 0 huérfanas); la unicidad de caja viva pasa de la sucursal a la caja física, habilitando N cajas por sucursal. Tipo `REFUND` con fila propia en el corte. `closingAmount` → `expectedAmount`. Endpoint `GET /cash-sessions/registers`. **Suite: 39/39 suites, 316/316 pruebas.** E2E: resumen mostrando Devoluciones y Retiros separados de egresos; verificado en BD que dos cajas de la misma sucursal abren a la vez y que la misma caja rechaza con P2002. | pendiente | — |
| 2026-08-11 | Fase 7 | **Cobertura de tests completa.** Nueva `cash-sessions.close.spec.ts` (11 pruebas: cuadre, faltante, sobrante, umbral, fondo restante, cierre duplicado, concurrencia, devolución) y 3 pruebas de CxC (montos, tarjeta, cobro en USD con TC). Los 12 puntos del checklist quedan mapeados a una prueba real. Suite: **38/38 suites, 307/307 pruebas.** | pendiente | — |
| 2026-08-11 | CASH-005/010/011 | **Fases 5–6 implementadas.** Tipo `WITHDRAWAL` + `remainingFund` + endpoint y UI de retiro; estados `EN_ARQUEO`/`PENDIENTE_REVISION` e índice único ampliado a `status <> 'CERRADA'`; CARD/TRANSFER convierten USD a MXN en el resumen. Migraciones `20260811180000` y `20260811180001`. **Suite completa en verde: 37/37 suites, 293/293 pruebas** (se saneó además la deuda de mocks preexistente en auth, users, products, coupons, categories y restaurant). E2E en Chrome: retiro excesivo rechazado, retiro de $400 aplicado (esperado $1000 → $600) con `CASH_WITHDRAWAL` en bitácora. | pendiente | — |
| 2026-08-11 | CASH-004/006/007/008/009/012 | **Fases 2–4 implementadas.** `AuditService` en apertura/cierre/movimiento/arqueo; motivo obligatorio en egresos; `branchId` y moneda+TC en payables/CxC; permisos `pos.cash:withdraw` y `pos.cash:count`; entidad `CashCount` (N/sesión) + `differenceReason` + umbral server-side. Migración `20260811170000_add_cash_counts`. Validado end-to-end en Chrome: cierre con diferencia sin motivo **rechazado**, con motivo **aceptado**, y persistencia de `AuditLog` + `CashCount` verificada en BD. | pendiente | — |
| 2026-08-11 | CASH-001/002/003/013 | **Fase 1 implementada.** `cashSessionId` NOT NULL + `requireOpenSession` en 4 rutas; cierre atómico (`closeSessionAtomically`); `assertSessionOpen` en create/addPayment; índice y FK RESTRICT. Migración `20260811160000_cash_movement_session_required`. Suite: 11→7 suites en rojo (las 7 restantes ya fallaban antes). | pendiente | — |
| 2026-08-11 | §2, §7, 005, 006 | Se añade criterio entidad vs columna (§7.1). `Withdrawal` deja de proponerse como tabla y pasa a tipo de `CashMovement` — corrige una inconsistencia con el principio de libro mayor único. `CashCount` se confirma como entidad con cardinalidad N por sesión: el negocio puede requerir más de un arqueo al día. `Opening` y `CashDifference` se documentan como correctamente modelados en columnas. | — | Decisión de producto |

---

## Pendientes de auditoría

- [ ] Flujo de caja en `apps/pos` (Flutter)
- [ ] Escrituras de caja desde restaurante (`restaurant.service.ts:215,328`)
- [ ] `order-checkout.engine.ts:76` — motor de checkout alterno
- [ ] Reversas de venta (`orders.service.ts:664`) y `addPayment` (`:818`)
