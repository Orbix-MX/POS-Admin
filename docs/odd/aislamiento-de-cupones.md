---
odd: aislamiento-de-cupones
updated: 2026-10-14
status: doing
via_max: completo
entrega: preguntar
lineas_previstas: 300
---

# Que ninguna empresa (ni un usuario de solo lectura) altere los cupones de otra

**Objetivo.** El contador de usos de un cupón solo lo mueve el cobro de una orden de **su** empresa, y nadie
puede quemarlo por HTTP. Después, cerrar el hueco de cobertura que dejó el escaneo de la auditoría.

**Por qué.** Hallazgo 4 de `docs/audits/AUDITORIA-AUTENTICACION-AUTORIZACION-2026-10-12.md`, **verificado en
ejecución con dos empresas**: la empresa B no puede leer el cupón de A (404), pero 3 × `POST
/coupons/:id/increment-usage` dieron 204 y el cupón de A (límite 3) quedó agotado. Viola C-002: `incrementUsage`
hace `coupon.update({ where: { id } })` sin `tenantId`, y el handler solo exige `coupons:view` (lectura).

**Lo que encontré al leer el código** (cambia la solución):
- El endpoint **no tiene ningún cliente**: ni el web, ni el POS web, ni la app móvil lo llaman. Su único uso real
  es interno (`OrdersService.create`, `orders.service.ts`). Se quita la superficie en vez de ponerle un permiso.
- El `couponId` de las órdenes sale de `validateCoupon` por código y con empresa: esa vía **no** está abierta.
  `update`/`remove` de cupones comprueban la empresa con `findOne` antes de actuar: tampoco.
- `incrementUsage` se llama dentro de `$transaction` pero con `this.prisma`, no `tx`: si la orden se revierte,
  el uso del cupón ya se gastó. Y el límite se valida al inicio y se incrementa al final: dos órdenes
  simultáneas pueden pasar ambas y superar `usageLimit`.

**Alcance.** Cupones (T-001, T-002) y el barrido de la cobertura que la auditoría declaró no cubrir (T-003).

**Restricciones.** C-002; C-019 (se retira un endpoint publicado; sin clientes, pero se confirma); C-021 (app
arrancada); vía `completo` por dominio (descuento = dinero) y por concurrencia.

---

## Tareas

### T-001 · Se retira el endpoint y el incremento queda acotado por empresa

```
via:     completo
touches: retail/coupons (coupons.controller.ts, coupons.service.ts)
status:  done
ruta:    inline
```

Se elimina `POST /coupons/:id/increment-usage`. `CouponsService.incrementUsage` pasa a recibir la empresa y a
actualizar con `{ id, tenantId }`; si no hay fila, falla (`NotFound`), no ignora en silencio. Sin cambios en
`validate` (sigue con `coupons:view`: el POS lo usa al cobrar).

**Done cuando:** la ruta ya no existe (404 también para la propia empresa); `incrementUsage` con un cupón de otra
empresa no modifica nada y falla; el cobro de una orden con cupón sigue incrementando su uso.

**Evidencia.**
- **Test:** `coupons.service.spec.ts`: `incrementUsage` actualiza con `{ id, tenantId }` y falla sin fila (el test anterior fijaba el `where: { id }` defectuoso y se reemplazó); `coupons.controller.spec.ts` (nuevo): ninguna ruta `increment-usage`. Suite completa en verde.
- **Runtime (C-021):** `coupon-verify.cjs`, 7/7 con la API arrancada: B ya no incrementa el cupón de A (404 ×3, antes 204 ×3) y el cupón sigue en 0 usos (antes quedaba agotado); la dueña tampoco tiene la ruta (404); **la orden de la dueña con su cupón sí lo incrementa a 1**; la orden de B con el código de A no lo mueve.
- **Rollback:** reponer la ruta y la firma anterior. Sin migración. **Commit:** `8f2233f`

### T-002 · El uso del cupón entra en la transacción de la orden y respeta el límite

```
via:     completo
touches: retail/orders (orders.service.ts), retail/coupons (coupons.service.ts)
status:  done
ruta:    inline
```

El incremento usa el cliente de la transacción (`tx`): si la orden se revierte, el uso no se gasta. Y se hace
**atómico y condicionado al límite** en una sola sentencia SQL (`… SET usage_count = usage_count + 1 WHERE id AND
tenant_id AND (usage_limit IS NULL OR usage_count < usage_limit)`); 0 filas → la orden se rechaza.

**Decisión (usuario, aceptó la propuesta):** si el cupón se agota entre validar y cobrar, la orden se **rechaza** con
409 `COUPON_EXHAUSTED` (antes se cobraba igual y el contador pasaba del límite).

**Done cuando:** una orden que falla después de aplicar el cupón no le consume ningún uso; con `usageLimit = 1`, dos
órdenes simultáneas con el mismo cupón terminan con una sola aceptada.

**Evidencia.**
- **Test:** `coupons.service.spec.ts`: una sola sentencia SQL con `"tenantId" =`, `"usageCount" < "usageLimit"` y `"usageLimit" IS NULL`, con id y empresa como parámetros (no concatenados); con `tx` usa el cliente de la transacción y no el global; sin fila → `NotFound`; sin cupo → 409 `COUPON_EXHAUSTED`. `orders.coupon-usage.spec.ts` (nuevo): la orden pasa su `tx` a `incrementUsage`, propaga el rechazo y sin cupón no toca el contador.
- **Runtime (C-021):** `coupon-verify.cjs` (9/9 con la API arrancada; en 6 carreras de dos órdenes sobre un cupón de un solo uso se cobró siempre exactamente una y la otra recibió 409 `COUPON_EXHAUSTED`) **y `api/test/coupon-usage.e2e-spec.ts` (5 tests contra la base, versionado y repetible)**: otra empresa → 404 sin mover el contador; 5 simultáneos sin límite → 5; límite 1 con 2 simultáneos → uno pasa y el otro 409; límite 3 con 10 simultáneos → exactamente 3; transacción revertida → 0 usos.
- **Orden revertida:** `api/test/coupon-usage.e2e-spec.ts` lo prueba contra la base: dentro de una transacción que falla después de incrementar, el uso **no** se gasta; si confirma, sí.
- **Rollback:** revertir ambos archivos. Sin migración. **Commit:** `8f2233f`

### T-003 · Barrido de aislamiento donde el escaneo de la auditoría no llegó

```
via:     completo
touches: api/src/modules/** (lectura; correcciones en commits propios)
status:  doing (barrido hecho; correcciones pendientes)
ruta:    delegado (2 subagentes de solo lectura; informes en el scratchpad de la sesión)
```

**Resultado del barrido** (sin tocar código; cada fila del informe cita archivo:línea). Se comprobó a mano A-1 y A-3
y el informe de `updateMany`/`deleteMany` (recuento de 67 líneas y dos citas): las tres coinciden con el código.

| Patrón | Revisados | Seguros | Agujeros |
|---|---|---|---|
| `updateMany` / `deleteMany` | 62 (+5 comentarios) | 62 | 0 |
| `id: { in … }` | 24 | 24 | 0 |
| `update` / `delete` por `where: { id }` | 155 | 145 | 10 |
| modelos hijo sin `tenantId` | 37 renglones (~150 accesos) | 31 | 6 |

Los 16 agujeros son **12 causas**, más un hallazgo de paso. Casi todos exigen conocer el UUID de la víctima.

| Id | Dónde | Efecto | Prioridad |
|---|---|---|---|
| **A-1** | `POST /tenants/current/members/:userId` (`users:create`) + `PATCH /users/:id` (`users:edit`) | mete a **cualquier** usuario en tu empresa sin invitación y cambia el email/nombre de su cuenta **global**; con "olvidé mi contraseña" se toma la cuenta y todas sus demás empresas. Contradice ADR-0031 | **P1 crítico** |
| A-3 | `purchases.service.ts` (`supplierId`, `productId` del body) | al recibir una compra suma stock y reescribe costos de un producto **ajeno** y los totales de un proveedor ajeno | **P1** (dinero e inventario) |
| A-4 | `POST /purchases/:id/receive` (`branchId` del body) | escribe inventario y movimientos en una sucursal ajena | **P1** |
| A-2 | `cash-sessions.service.ts` `verifyAuthorizer` | un cajero de A **bloquea la cuenta** de un usuario de B por su correo y puede probar contraseñas, porque cuenta el fallo antes de comprobar la membresía | **P1** |
| A-5 a A-12 y `CashSessions.open/createRegister` | un id del body (usuario, servicio, categoría, producto, `managerId`, línea de comanda, `branchId` de insumos/impresoras/cajas) sin validar contra la empresa | lectura de nombre/correo, costos o sucursal ajenos por UUID | **P2** (un helper común) |

**Puntos de endurecimiento** (hoy no explotables): `resolveBranchId` devuelve un `branchId` explícito sin validarlo;
`dining-orders.service.ts:730` y `plan-upgrade-requests.service.ts:95` actualizan sin `tenantId` aunque el padre ya se verificó.

**Propuesta de ejecución** (un commit por causa, vía `completo`, cada uno con su prueba de dos empresas):
1. **A-1** — decisiones de diseño abajo.
2. **A-3 + A-4** — compras: validar `supplierId`, `productId` y `branchId`; `tenantId` en las escrituras de recepción.
3. **A-2** — comprobar la membresía **antes** de contar el fallo y devolver el mismo error genérico.
4. **A-5 a A-12 y cajas** — validar con `assertBranchBelongs` / `findFirst({ id, tenantId })` (un lote, un helper).

**Decisiones de A-1 (aprobadas por el usuario):**
- Se **retira** `POST /tenants/current/members/:userId`: ningún cliente lo usa (el web solo hace `GET`) y las altas van por invitación aceptada (ADR-0031).
- `PATCH /users/:id` ya **no cambia `email`, `firstName` ni `lastName`** de una cuenta con membresías en más de una empresa (409 con un mensaje claro); el `status` por empresa sigue editable. La cuenta global es de su dueño, no de un administrador de una de sus empresas.

**A-1 — hecho** (servidor `02938e8`, web `c8d51ea`). Evidencia:
- **Código:** se retiran `POST /tenants/current/members/:userId`, `TenantsService.addMember` y `AddMemberDto`;
  `UsersService.update` rechaza con 409 `ACCOUNT_SHARED` el cambio de email, nombre o apellido de una cuenta con
  membresías en otra empresa (cualquier estado, incluida INACTIVE: la baja es reversible), salvo que quien actúa sea la
  propia persona. El actor llega por `@CurrentUser('id')` (no por `AuditContextService`: segunda instancia en
  `DatabaseModule`). El web muestra el motivo dentro del modal de edición.
- **Test:** `users.service.shared-account.spec.ts` (8), `tenants.controller.members.spec.ts` (3),
  `users.controller.wiring.spec.ts` (2) y, contra la base real, **`api/test/shared-account.e2e-spec.ts` (5)**: dos
  empresas y una cuenta en ambas. Playwright `web/e2e/usuarios-cuenta-compartida.spec.ts` (2; falla si se vuelve a
  tragar el error, comprobado por mutación).
- **Runtime (C-021):** `a1-verify.cjs`, 8/8 con la API arrancada: el alta forzada da 404 y la víctima no queda como
  miembro; cambiar su email o nombre da 409 y el email no cambia; el estado por empresa sigue editable (200); la propia
  persona edita su cuenta (200); una cuenta de una sola empresa se edita con normalidad (200).
- **Consecuencia visible:** el administrador ya no puede corregir el correo de una persona que también trabaja en otra
  empresa. Hoy **no existe** una pantalla de perfil propio que lo permita (ver hallazgos fuera de alcance).

**Ledger 4R de A-1**

| id | lente | severidad | estado | evidencia |
|---|---|---|---|---|
| R1 | riesgo | — | sin CRITICAL | ningún otro camino añade usuarios sin invitación ni edita la cuenta global; la regla no se esquiva (mayúsculas, dos peticiones, membresía previa); el 409 no filtra ids |
| R1-001 | riesgo | WARNING | info | `branches.addMember` vincula a un usuario ajeno a una sucursal y devuelve su nombre/correo: es de la familia A-5 |
| R1-002 | riesgo | WARNING | info | el 409 revela que la persona también está en otra empresa (un booleano, sin ids); ADR-0031 ya expone la existencia de cuentas |
| R4-001 | resiliencia | CRITICAL | fixed | el mensaje prometía una pantalla de perfil que no existe. Ahora dice la verdad: "ella misma o el soporte de Orbix" |
| R4-002 | resiliencia | CRITICAL | fixed | el web tragaba el 409 con `console.error`. Ahora se ve en el modal; Playwright lo fija |
| R4-003 | resiliencia | WARNING | wont-fix | el `count` no tiene índice por `userId`; corre solo al cambiar email o nombre |
| R3-001 | fiabilidad | CRITICAL | fixed | la regla solo se probaba con mocks. `api/test/shared-account.e2e-spec.ts` la ejecuta contra la base |
| R3-002 | fiabilidad | WARNING | wont-fix | el email se compara sensible a mayúsculas: falla hacia el lado seguro (bloquea de más) |
| R3-003 | fiabilidad | WARNING | info | el árbol se editó durante la revisión (el mensaje); se fijó y se volvió a verificar |
| R2-001 | legibilidad | WARNING | fixed | fila de `acceso-residual-tras-baja` desfasada por el `addMember` retirado |
| R2-002 | legibilidad | WARNING | fixed | "13 correcciones" no se derivaba de ninguna fila; ahora "A-1 hecha; 12 pendientes" |

**A-3 y A-4 — hecho** (commit `b6f7583`; compras). Evidencia:
- **Código:** `purchases.service.ts` — `create` y `update` (rama con y sin líneas) validan el proveedor y los productos de la empresa
  (404); `receive` valida el `branchId` del body con `assertBranchBelongs` (404), **revalida las variantes guardadas en la orden** y
  lleva `tenantId` en las escrituras (`product.updateMany`, `supplier.updateMany`): una orden ya guardada con un producto, un
  proveedor o una variante ajenos no puede tocarlos y la recepción entera se revierte. La validación de productos es ahora un
  **helper compartido** (`common/helpers/assert-products-belong.ts`), que sustituye las dos copias de restaurante y sucursales
  (mismo 404 y mismo mensaje); compras adopta ese mismo 404 en lugar de un 400 propio.
- **Test unitario (corre en el CI):** `purchases.tenant-isolation.spec.ts` (7).
- **Test contra la base real:** `api/test/purchases-isolation.e2e-spec.ts` (10, dos empresas): proveedor/producto ajeno al crear, editar con
  líneas válidas (camino legítimo), editar con proveedor ajeno solo, con líneas ajenas y con ambos a la vez, sucursal ajena, orden
  envenenada con producto, con proveedor y con variante ajenos, y la recepción parcial + el resto, con sus huellas (recibos, movimientos,
  inventario por sucursal, cuenta por pagar, totales del proveedor). Comprobado por mutación: sin el `tenantId` del proveedor fallan
  2 pruebas; sin el proveedor en la validación de la rama con líneas, 1.
- **Runtime (C-021):** `a3-verify.cjs`, 13/13 con la API arrancada (proveedor y producto ajenos 404, sucursal ajena 404, el flujo propio
  crea, envía y recibe con el stock 10 → 14, y nada de la empresa víctima cambia).
- **Honestidad sobre la evidencia:** (1) los e2e de `api/test` **no corren en el CI** (no tiene base de datos): se ejecutan a mano con
  `jest --config test/jest-e2e.json`; vale también para los de PIN, cupones y cuenta compartida. (2) Los `*-verify.cjs` viven en el
  scratchpad de la sesión y **no están en el repo**; la evidencia repetible son los e2e.

**Ledger 4R de A-3/A-4**

| id | lente | severidad | estado | evidencia |
|---|---|---|---|---|
| R1 | riesgo | — | sin CRITICAL | todos los accesos por id llevan `tenantId`; no hay otro id del body sin validar; ningún otro módulo crea órdenes de compra; los 404 no distinguen "no existe" de "es de otra empresa" |
| R1-001 | riesgo | WARNING | fixed | una orden vieja con variante ajena pasaba la recepción; ahora se revalida y el e2e lo cubre |
| R4 | resiliencia | — | ledger vacío | ningún cliente envía ids ajenos (el web usa selectores de la empresa y no manda `branchId`); el web muestra los errores; ninguna orden legítima falla; la recepción es atómica |
| R3-001 | fiabilidad | CRITICAL | wont-fix | el e2e no corre en el CI (sin base de datos): decisión de infraestructura; se mitiga con el spec unitario y queda declarado arriba |
| R3-002 | fiabilidad | CRITICAL | fixed | sin `tenantId` en el `updateMany` del proveedor no fallaba nada; ahora el e2e de la orden con proveedor ajeno lo detecta (mutación comprobada) |
| R3-003 | fiabilidad | CRITICAL | fixed | editar con líneas y proveedor ajeno a la vez no se probaba; ahora sí (e2e y unitario) |
| R3-004 | fiabilidad | CRITICAL | fixed | los caminos legítimos no tenían test: editar con líneas propias, crear con variante, recepción parcial y el resto |
| R3-005 | fiabilidad | WARNING | fixed | limpieza frágil: ahora `try/finally`, protegida si `beforeAll` falla y con barrido previo de restos por el prefijo `e2e-compras-` |
| R2-001 | legibilidad | CRITICAL | fixed | tercera copia de "productos de la empresa" con otro código de error; unificada en `assertProductsBelong` |
| R2-002 | legibilidad | CRITICAL | fixed | el ODD citaba `a3-verify.cjs` como si estuviera en el repo; se declara que vive en el scratchpad de la sesión |
| R2-003 | legibilidad | WARNING | fixed | el docblock del e2e decía "cae en cascada" y la limpieza era manual |
| R2-004 | legibilidad | WARNING | info | `assertOwnedRefs` usa `this.prisma` fuera de la transacción en un caso y `tx` en otros: sin efecto |

**A-2 — hecho** (commit `f05ee3a`; autorizador de caja). Evidencia:
- **Código (`cash-sessions.service.ts`, `verifyAuthorizer`):** la pertenencia a la empresa (miembro ACTIVO) se comprueba **antes** de contar
  un fallo de contraseña o de revelar nada. Todo lo que no sea un autorizador de esta empresa — cuenta inexistente, de otra empresa,
  membresía inactiva — recibe el mismo mensaje genérico, con la contraseña correcta o no. Antes se bloqueaba (`failedLoginAttempts` y
  `lockedUntil`) la cuenta de CUALQUIER usuario de la plataforma conociendo su correo, y una contraseña correcta ajena respondía con un
  mensaje distinto, un oráculo para comprobar credenciales.
- **Test unitario (corre en el CI):** `cash-sessions.authorizer-isolation.spec.ts` (9): cuenta ajena con contraseña mala o buena, membresía
  inactiva, mensaje idéntico entre "no existe", "ajena" e "inactiva", y que el autorizador legítimo conserva su bloqueo y su mensaje por falta
  de permiso. Comprobado por mutación: sin la comprobación de pertenencia fallan 4.
- **Test contra la base real:** `api/test/cash-authorizer.e2e-spec.ts` (5): 8 contraseñas malas desde otra empresa no mueven los contadores de la
  víctima, la contraseña correcta ajena recibe el mismo mensaje, la membresía inactiva no cuenta fallos, el autorizador de la empresa autoriza
  y 5 fallos propios sí lo bloquean.
- **Runtime (C-021):** `a2-verify.cjs`, 5/5 con la API arrancada: 8 contraseñas malas contra el correo de la dueña de otra empresa → 403
  genéricos; **ella inicia sesión con normalidad** (antes quedaba bloqueada 5 min); su contraseña correcta recibe el mismo mensaje; el dueño de
  la propia empresa se autoriza.
- **Limitación conocida (no se cambia aquí):** el contador de fallos del autorizador es el del *login* de la cuenta. Un cajero de la MISMA empresa
  puede bloquear al administrador escribiendo 5 contraseñas malas contra su correo al autorizar un corte. Es un compromiso de diseño anterior
  (protege la contraseña del administrador); el remedio sería contar el fallo contra quien intenta, como se hizo con los PIN.
- **Ledger 4R de A-2:**

| id | lente | severidad | estado | evidencia |
|---|---|---|---|---|
| R1 | riesgo | — | sin CRITICAL | no hay otro sitio que busque cuentas por correo global y cuente fallos o bloquee; sin oráculo de mensaje ni de código HTTP; los tres llamadores (`verifyCloseAuth`, `closeWithAuth`, `withdrawForSupplies`) heredan el arreglo; ningún flujo legítimo cambia |
| R1-001 | riesgo | WARNING | info | queda un diferencial de timing de una consulta (la de membresía solo corre si el correo existe y está activo); lo ve solo un usuario ya autenticado y antes era mayor |
| R4 | resiliencia | — | ledger vacío | ningún cliente dependía del mensaje retirado; el web muestra el 403 tal cual; sin cambio de DTO ni de rutas; sin orden de despliegue |
| R3-001 | fiabilidad | WARNING | info | en el CI el filtro por empresa de la membresía solo lo prueba una aserción sobre el mock; lo cubre el e2e |
| R3-002 | fiabilidad | WARNING | info | el e2e no corre en el CI (ya declarado) |
| R2-001 | legibilidad | WARNING | fixed | los docblocks de los e2e decían "barre sus restos" sin el límite de 10 min |
| R2-002 | legibilidad | WARNING | fixed | el umbral de 10 min estaba suelto y duplicado; ahora `STALE_MS` en ambos e2e |

**Done cuando:** cada agujero tiene su prueba de dos empresas (antes: efecto; después: 404/409) y su commit; los puntos de
endurecimiento están corregidos o declarados. **Rollback:** por commit. **Commit:**

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done    | inline | ~25 + tests | 8f2233f |
| T-002 | completo | done    | inline | ~60 + tests | 8f2233f |
| T-003 | completo | doing   | delegado | A-1 a A-4 hechas; 9 pendientes | 02938e8, c8d51ea, b6f7583, f05ee3a |

**Entrega:** ~300 previstas · umbral ~400. **T-003 puede superar el umbral:** sus correcciones salen por commits
aparte, uno por agujero, y se decide al ver cuántos hay.

**Orden:** T-001 primero (cierra lo verificado). T-002 es independiente. T-003 después, con el hallazgo 4 ya cerrado.

**Despliegue:** sin migración y sin clientes afectados; se confirma con `grep` en web, POS web y móvil antes de subir.

**Siguiente paso:** el lote A-5 a A-12.

---

## Escaladas

| Tarea | De | A | Trigger |
|---|---|---|---|
| T-001 | (asignada) | completo | Dominio: descuento (`force-completo.md`) y C-002 |
| T-002 | (asignada) | completo | Dominio: descuento y escritura concurrente sobre la misma fila |
| T-003 | (asignada) | completo | Aislamiento multi-tenant; puede tocar cualquier módulo |

## Hallazgos fuera de alcance

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|
| No hay una defensa estructural contra el olvido de `tenantId` (p. ej. una extensión de Prisma que lo exija en los modelos tenant-owned): cada consulta depende de que alguien se acuerde | `database/prisma.service.ts` | Media: es la causa de este tipo de hallazgo |
| No existe edición del **perfil propio** (email y nombre): una persona con cuenta compartida solo puede cambiarlos si tiene `users:edit` o con el soporte de Orbix. Falta un `PATCH /auth/me` con verificación del nuevo correo | `auth.controller.ts` | Media (la regla de A-1 la deja sin salida propia) |
| El email se compara sensible a mayúsculas en `users.update` y `users.create` (`Bob@x.com` frente a `bob@x.com` crearía otra cuenta); solo el login con Google normaliza | `users.service.ts` | Baja |
| `receive` valida la cantidad pendiente fuera de la transacción: dos recepciones simultáneas de la misma orden podrían pasarse | `purchases.service.ts` | Media (ya era así) |
| Los e2e de `api/test` (PIN, cupones, cuenta compartida, compras) no corren en el CI porque no hay base de datos de pruebas | `.github/workflows/api-ci.yml` | Media (la red de aislamiento es manual) |
| Un cajero de la MISMA empresa puede bloquear la cuenta del administrador (5 contraseñas malas al autorizar un corte), porque el contador de fallos del autorizador es el del login de esa cuenta | `cash-sessions.service.ts` | Media (decisión de diseño) |
| El `DatabaseModule` declara una segunda instancia de `AuditContextService` (C-003) | `database/database.module.ts` | Media (ver `bloqueo-por-intentos-de-pin`) |
| En `validateCoupon` y `getAutoApplicableCoupons` el cliente ya se busca con `tenantId`; solo `order.count({ customerId, couponId })` (L132-133) no lo lleva, y es seguro porque el `couponId` viene de un cupón ya acotado por empresa | `coupons.service.ts` | Baja (lo revisará T-003) |
| Cancelar o reembolsar una orden no devuelve el uso del cupón | `orders.service.ts` | Media (el cupón se agota antes de lo debido) |
| El límite por cliente (`usageLimitPerCustomer`) se valida sin atomicidad: dos órdenes simultáneas del mismo cliente pueden pasar | `coupons.service.ts` L131-135 | Media |

## Revisión

**Candidato:** commit `8f2233f` (revisado sobre el árbol sin commitear, idéntico). Suite API: 114 suites / 932 tests; e2e contra la base: 5/5 (cupones); runtime HTTP 9/9.

**Ledger 4R** (T-001 y T-002; T-003 no implementada)

| id | lente | ubicación | severidad | estado | evidencia |
|---|---|---|---|---|---|
| R1 | riesgo | — | — | ledger vacío | SQL parametrizado, columnas verificadas contra la migración, un solo llamador, sin otro camino que mueva `usageCount` |
| R4 | resiliencia | — | — | ledger vacío | ningún cliente usa el endpoint retirado; el 409 revierte orden, stock, pagos y caja (todo va en `tx`); sin migración |
| R3-001 | fiabilidad | `coupons.service.ts` (SQL crudo) | CRITICAL | fixed | solo se probaba con mocks. `api/test/coupon-usage.e2e-spec.ts` lo ejecuta contra la base |
| R3-002 | fiabilidad | T-002 (carrera) | CRITICAL | fixed | la carrera solo la probaba un script externo. Ahora hay e2e repetible (límite 1 y límite 3 con 10 simultáneos) |
| R3-003 | fiabilidad | `orders.coupon-usage.spec.ts` | WARNING | wont-fix | monta `OrdersService` con 7 argumentos posicionales: frágil si cambia el constructor; no es un defecto |
| R3-004 | fiabilidad | orden revertida | WARNING | fixed | antes sin prueba; el e2e provoca el fallo tras incrementar |
| R2-001 | legibilidad | este documento | WARNING | fixed | citaba `orders.service.ts:499` (ahora 501); se quitó el número de línea |
| R2-002 | legibilidad | este documento | WARNING | fixed | la fila sobre `validateCoupon` describía un hueco que no existe; corregida |
| R2-003 | legibilidad | `coupons.controller.spec.ts` | WARNING | fixed | el título prometía más de lo que comprobaba |
| R2-004 | legibilidad | `coupons.service.spec.ts` | SUGGESTION | fixed | ruido en un fixture |

**T-001 y T-002 cerradas** con el commit `8f2233f`. **Pendiente:** T-003 (barrido de `updateMany`, `deleteMany` e `id: { in }`); el ODD se cierra con ella.
