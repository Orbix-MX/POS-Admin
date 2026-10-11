---
odd: carreras-y-deriva
updated: 2026-10-11
status: done
via_max: completo
entrega: preguntar
lineas_previstas: 120
---

# Condiciones de carrera del alta y deriva del esquema

**Objetivo.** Dos pendientes que dejó el trabajo del alta self-service: que dos peticiones
simultáneas no puedan romper las reglas del alta, y que `schema.prisma` coincida con la base.

**Por qué.** Quedaron anotadas como "Pendiente" en `planes-self-service.md` y en el vault:
(1) el máximo de pruebas por dueño se comprobaba antes de la transacción y la
solicitud de "Mejorar plan" no tenía garantía de unicidad; (2) `prisma migrate diff` contra la
base proponía cambios que nadie había pedido.

**Alcance.** Las dos carreras y las cuatro diferencias de esquema. Fuera: la carrera del
`slug` del alta (ver T-001), que da un error y no un estado corrupto.

**Restricciones.** Migraciones y concurrencia: vía `completo` (`force-completo.md`: rutas
`api/prisma/**`, dominio de concurrencia). La base de `api/.env` es externa: ningún cambio de
esquema que modifique datos sin comprobarlo antes.

---

## Tareas

### T-001 · Dos peticiones a la vez no rompen las reglas del alta

```
via:     completo
touches: core/tenants, core/plans, prisma (migración)
status:  done
ruta:    inline
```

- **Dos pruebas por dueño** (`TenantsService.onboard`): la comprobación estaba fuera de la
  transacción, así que dos altas simultáneas la cruzaban las dos y gastaban más pruebas de las
  permitidas. Ahora la decisión "¿lleva prueba?" (`ownerHasTrialLeft`) va **dentro** de la
  transacción, tras bloquear la fila del usuario (`SELECT id FROM users WHERE id = … FOR
  UPDATE`): la segunda alta espera y, al desbloquearse, ya cuenta la prueba de la primera.
  **Regla definitiva (2026-10-11):** n empresas por dueño y solo dos con prueba, contadas de por
  vida por la marca `selfServiceTrial`; con las dos usadas la empresa nace FREE en vez de
  rechazarse. Se quitó el pre-chequeo y el 409 por tope, que ya no existen.
- **Una solicitud de mejora pendiente por empresa** (`PlanUpgradeRequestsService.request`):
  índice único parcial `plan_upgrade_requests_one_pending_per_tenant_key` (`WHERE status =
  'PENDING'`), mismo patrón que `cash_sessions_one_open_per_register_key`. Quien pierde la
  carrera recibe P2002 y actualiza la solicitud que ganó en vez de fallar o duplicar.
  Migración `20261011000000_plan_upgrade_request_one_pending`; sin duplicados previos (0
  empresas con más de una pendiente).

**Evidencia.**

- **Test:** `pnpm run test` → `Test Suites: 102 passed · Tests: 816 passed`. Nuevos: en
  `tenants.service.self-service-trial.spec.ts` (el bloqueo y el conteo van dentro de la
  transacción en ese orden; con el pre-chequeo aprobado pero la otra alta ya confirmada, la
  transacción responde 409 y no crea ni licencia) y en `plan-upgrade-requests.service.spec.ts`
  (P2002 → actualiza la que ganó; otro error se propaga).
- **Runtime (2026-10-11, API local, base de `api/.env`, cuentas `race-*`, `trials-*`):**
  - Con la regla definitiva (`trials-*@orbix.test`): 4 altas seguidas → `201` las cuatro, planes
    `PRO, PRO, FREE, FREE`, `capabilities` `PRO/TRIAL→FREE` y `FREE/ACTIVE`; 4 altas
    **simultáneas** → `201` las cuatro, planes `PRO, PRO, FREE, FREE`; en la base cada dueño
    tiene n empresas y exactamente 2 con la marca. Con las **dos pruebas ya terminadas** (vencidas
    y bajadas a FREE) la tercera alta nació FREE: lo terminado sigue contando.
  - Con la regla intermedia (tope de dos, rechazo 409), ya reemplazada: 3 altas simultáneas, 2
    rondas → `201,201,409`; esto probó el bloqueo de la fila del usuario.
  - 6 solicitudes de mejora simultáneas de la misma empresa, 2 rondas → `201` las seis; en la
    base, 1 pendiente por empresa.
  - Control negativo: un segundo `INSERT … 'PENDING'` a mano para la misma empresa → `23505
    plan_upgrade_requests_one_pending_per_tenant_key` (rolled back): el índice protege aunque el
    código no lo evitara.
- **Pendiente, sin tocar:** el alta calcula el `slug` con un `findUnique` y luego crea; dos altas
  de **distintos** usuarios con el mismo nombre pueden chocar en el único de `slug` y una da un
  error 500. No deja estado corrupto (la transacción se revierte) y es raro.
- **Rollback:** quitar el bloqueo y el conteo de la transacción (`tenants.service.ts`), el manejo
  de P2002 en `plan-upgrade-requests.service.ts` y `DROP INDEX
  "plan_upgrade_requests_one_pending_per_tenant_key"`.
- **Commit:**

### T-002 · `schema.prisma` coincide con la base

```
via:     completo
touches: prisma/schema.prisma
status:  done
ruta:    inline
```

`prisma migrate diff --from-config-datasource --to-schema` proponía cinco cambios. Se investigó
cada uno contra las migraciones y el código antes de decidir de qué lado estaba el error: **en
los cuatro casos el esquema era el desactualizado, no la base**, así que se arregló el esquema y
**no se tocó ningún dato ni la estructura de la base**.

| Diferencia | Qué decía el diff | Realidad | Arreglo en `schema.prisma` |
|---|---|---|---|
| Índices `order_items_variantId_idx`, `inventory_movements_variantId_idx` | borrarlos | los creó a propósito la migración `20260906120000`; el esquema no los declaraba | `@@index([variantId])` en `OrderItem` e `InventoryMovement` |
| `cash_sessions.cashRegisterId` | quitar NOT NULL | NOT NULL a propósito (migración `20260811190000`, tras el backfill) y `CashSessionsService.open` siempre la resuelve | `cashRegisterId String` y relación obligatoria |
| FK `dining_orders_waiterId_fkey` | recrearla con `RESTRICT` | la migración `20260613000000` la creó sin regla de borrado → NO ACTION, equivalente a RESTRICT salvo en constraints diferidas | `onDelete: NoAction` |
| FK `supplies_inventoryUnitId_fkey` | recrearla con `ON UPDATE CASCADE` | la migración `20260601000000` la creó inline: SET NULL al borrar, NO ACTION al actualizar (el id de una unidad no cambia) | `onUpdate: NoAction` |

**Evidencia.**

- **Runtime:** `prisma migrate diff` → **"This is an empty migration"** tras los cambios, y
  también después de aplicar el índice parcial de T-001 (un índice parcial no genera deriva, igual
  que el de las cajas). `prisma validate` y `prisma generate` ✓.
- **Test:** `tsc --noEmit` sin errores (la relación obligatoria no rompió ningún uso) y la suite
  completa (arriba).
- **Rollback:** revertir los cuatro ajustes de `schema.prisma`. Sin cambios en la base.
- **Commit:**

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done (falta commit) | inline | ~60 + specs + migración | |
| T-002 | completo | done (falta commit) | inline | ~10 (esquema) | |

**Entrega:** ~120 previstas · ~70 de código · umbral ~400 → dentro.

**Siguiente paso:** commit.

---

## Escaladas

| Tarea | De → a | Trigger | Fecha |
|---|---|---|---|
| T-001 | (asignada) completo | Concurrencia; rutas `api/prisma/migrations/**` | 2026-10-11 |
| T-002 | (asignada) completo | Ruta `api/prisma/schema.prisma` | 2026-10-11 |
