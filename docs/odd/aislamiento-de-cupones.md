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
status:  todo
ruta:    delegado (regla de 4 archivos: exploración a un subagente)
```

La auditoría solo miró `findUnique/findFirst/update/delete` por `id` sin `tenantId` en los modelos que tienen esa
columna. **No cubrió** `updateMany`/`deleteMany` (67 usos), `id: { in: [...] }` (24), ni modelos hijos sin
`tenantId` alcanzados por un `id` ajeno. Hay que clasificar cada acierto: **seguro** (con el motivo: comprobación
previa en la misma función, `where` con `tenantId`, o hijo cuyo padre ya se verificó) o **agujero**.

**Entregable:** una tabla en este documento, un renglón por acierto, con su veredicto; cada agujero real se corrige
con su test y su comprobación en ejecución, en un commit aparte. Un acierto dudoso cuenta como agujero hasta que
se pruebe lo contrario.

**Done cuando:** los tres patrones tienen veredicto completo y no queda ningún agujero sin corregir o declarado.

**Evidencia prevista.** La tabla; por cada agujero, el escenario de dos empresas (como `coupon-idor.cjs`).
Re-correr un acierto al azar antes de aceptar el informe del subagente (gatekeeper de `agents.md`).
**Rollback:** por commit de corrección. **Commit:**

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done    | inline | ~25 + tests | 8f2233f |
| T-002 | completo | done    | inline | ~60 + tests | 8f2233f |
| T-003 | completo | todo | delegado | desconocido | |

**Entrega:** ~300 previstas · umbral ~400. **T-003 puede superar el umbral:** sus correcciones salen por commits
aparte, uno por agujero, y se decide al ver cuántos hay.

**Orden:** T-001 primero (cierra lo verificado). T-002 es independiente. T-003 después, con el hallazgo 4 ya cerrado.

**Despliegue:** sin migración y sin clientes afectados; se confirma con `grep` en web, POS web y móvil antes de subir.

**Siguiente paso:** T-003 (barrido).

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
