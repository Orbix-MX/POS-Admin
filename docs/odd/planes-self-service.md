---
odd: planes-self-service
updated: 2026-10-10
status: doing
via_max: completo
entrega: preguntar
lineas_previstas: 250
---

# Planes y estado de la prueba para la app

**Objetivo.** La app puede mostrar cuántos días de prueba quedan, qué pasa al terminar y una
comparativa real de planes (FREE vs PRO, PLUS, ENTERPRISE), sin precios todavía.

**Por qué.** Tareas S-B, S-D y S-E del alta de empresa (orbix-mobile, `docs/odd/alta-empresa.md`),
que desbloquean M-5 (paso "Tu plan") y M-8 (aviso de prueba y pantalla Planes).

**Alcance.** S-B (`capabilities` con estado de prueba), S-D (`GET /plans`), S-E (solicitud de
mejora en tabla propia, decisión 2026-10-10). La bandeja en el web de Platform queda pendiente. Fuera: cobro (fase 2), precios (decisión
2026-10-10: "Precio a consultar").

**Restricciones.** C-021. Contratos publicados: `GET /auth/me/capabilities` **añade** campos y
toma `plan`/`effectiveModules` de la base en vez del JWT (más fresco, misma forma).

---

## Tareas

### T-001 · S-B — `capabilities` dice si la empresa está en prueba

```
via:     completo
touches: core/auth
status:  doing
ruta:    inline
```

`GET /auth/me/capabilities` añade `status`, `trialEndsAt` (ISO, solo en `TRIAL`) y `trialEndsTo`
(`FREE` si es la prueba del alta —`settings.selfServiceTrial`—, `EXPIRE` si no; null fuera de
prueba). `plan` y `effectiveModules` salen del tenant en la base: con el plan del JWT, un token
emitido antes de terminar la prueba seguía diciendo PRO.

**Done cuando:** con una empresa en prueba del alta, `capabilities` devuelve `TRIAL`, su fin y
`FREE`; fuera de prueba, nulls y el plan real.

**Evidencia.**

- **Test:** `auth.service.capabilities-trial.spec.ts` (4: prueba del alta, prueba de Platform,
  fuera de prueba con plan de la base aunque el token diga PRO, sin tenant).
- **Runtime (2026-10-10, API local):** login de la cuenta del emulador → `select-tenant` →
  `GET /auth/me/capabilities` → 200 `{plan: PRO, status: TRIAL, trialEndsAt:
  2026-10-25T01:39:37.555Z, trialEndsTo: FREE}` ("Cafe Prueba Emulador").
- **Rollback:** el bloque de prueba en `getCapabilities` (`auth.service.ts`) y los tres campos
  de `CapabilitiesResponseDto`; la app los trata como opcionales.
- **Commit:**

### T-002 · S-D — `GET /plans` público

```
via:     completo
touches: core/plans (nuevo), app.module
status:  doing
ruta:    inline
```

Módulo nuevo `core/plans`: `GET /plans` (`@Public`) lista los planes en `PLAN_ORDER` con
módulos (`getModulesForPlan`), usuarios, sucursales y cajas (`PLAN_*_LIMITS` de
`@orbix/types`, las mismas que aplica el servidor) y precio mensual/anual en MXN:
`PLAN_PRICES_MXN`, con FREE en 0 y los de pago en `null` (= a consultar) hasta que haya precios.

**Done cuando:** sin token, `GET /plans` devuelve los 5 planes con módulos y límites reales y
precio `null` en los de pago.

**Evidencia.**

- **Test:** `plans.controller.spec.ts` (2: orden y módulos iguales a `getModulesForPlan`;
  FREE 0 y PRO/PLUS/ENTERPRISE `null`).
- **Runtime (2026-10-10, API local):** `GET /api/plans` sin token → 200 `FREE 11 módulos/1
  usuario/0 · STARTER 12/5/null · PRO 20/10/null · PLUS 22/20/null · ENTERPRISE 22/ilimitado/null`.
- **Rollback:** `api/src/modules/core/plans/` y su línea en `app.module.ts`.
- **Commit:**

### T-003 · S-E — "Mejorar plan" registra una solicitud

```
via:     completo
touches: prisma (migración), core/plans, platform/upgrade-requests (nuevo)
status:  doing
ruta:    inline
```

Decisión del usuario (2026-10-10): **tabla propia**. Modelo `PlanUpgradeRequest` (empresa, plan
actual y pedido, quién, nota, estado `PENDING`/`HANDLED`/`CANCELLED`, quién de Platform y
cuándo la atendió). Migración `20261010200000_plan_upgrade_requests`, escrita a mano y aplicada
con `prisma migrate deploy`: `migrate diff` contra la base traía además **deriva ajena**
(FKs de `dining_orders`/`supplies`, dos índices, `cash_sessions.cashRegisterId` nullable) que
**no** se incluyó — pendiente de revisar aparte.

- App: `GET /plans/upgrade-request` (`tenant:view`) → pendiente o null; `POST
  /plans/upgrade-request` (`tenant:edit`, `{plan, note?}`). No FREE; fuera de prueba solo un plan
  mayor que el actual; en prueba cualquiera de pago (pedir PRO = quedarse en PRO). Con una
  pendiente, la actualiza.
- Platform: `GET /platform/upgrade-requests?status=` (por defecto pendientes, con empresa y
  solicitante) y `PATCH /platform/upgrade-requests/:id {status: HANDLED|CANCELLED}`, solo desde
  pendiente.

**Done cuando:** la app crea/actualiza su solicitud y Platform puede listarlas y resolverlas.

**Evidencia.**

- **Test:** `plan-upgrade-requests.service.spec.ts` (7: en prueba pide PRO, desde FREE pide
  mayor, fuera de prueba no pide igual/menor, no FREE, la pendiente se actualiza, Platform
  resuelve con quién/cuándo, no se resuelve dos veces).
- **Runtime (2026-10-10, API local, "Cafe Prueba Emulador" en prueba PRO):** `GET` → 200 `null`;
  `POST {plan: FREE}` → 400 "Elige un plan de pago."; `POST {plan: PRO, note}` → 201
  `PENDING`; `POST {plan: PLUS}` → 201, misma solicitud (id igual); `GET` → 200 `PLUS
  PENDING`. Endpoints de Platform sin runtime (no hay super-admin de prueba).
- **Concurrencia:** dos `POST` simultáneos de la misma empresa podrían dejar dos pendientes
  (sin índice único parcial). Bajo impacto: Platform atiende ambas. — Pendiente
- **Rollback:** revertir el código y una migración inversa (`DROP TABLE plan_upgrade_requests;
  DROP TYPE "PlanUpgradeRequestStatus"`); la tabla es nueva y nada más depende de ella.
- **Commit:**

---

## Revisión de seguridad (2026-10-10)

Inline sobre el diff de T-001…T-003: tenant siempre de `requireTenantId` (nunca del body);
`tenant:view`/`tenant:edit` en los endpoints de la app; Platform con el mismo guard que licencias
(`@Public` + `PlatformJwtAuthGuard`); DTOs con `class-validator` (enum de plan, nota ≤ 500);
`GET /plans` público solo expone el catálogo, sin datos de tenant. **Sin hallazgos medios o altos.**
Nota menor: dos `POST` simultáneos pueden dejar dos pendientes (ver T-003).

## Vault

`Domain/Administracion Multi-tenant (Orbix).md`: flujo "Mejorar plan" (solicitud → bandeja de
Platform, sin cobro), `GET /plans` y el estado de prueba en `capabilities`.

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done (falta commit) | inline | ~45 + spec | |
| T-002 | completo | done (falta commit) | inline | ~80 + spec | |
| T-003 | completo | done en API (falta commit; bandeja web de Platform pendiente) | inline | ~180 + spec + migración | |

**Entrega:** ~250 previstas · ~305 de código (sin specs ni migración) · umbral ~400 → dentro.

**Siguiente paso:** commit; luego la bandeja de solicitudes en el web de Platform.

---

## Escaladas

| Tarea | De → a | Trigger | Fecha |
|---|---|---|---|
| T-001 | (asignada) completo | Ruta `api/src/modules/core/auth/**` | 2026-10-10 |
| T-002 | (asignada) completo | Símbolo `@Public` | 2026-10-10 |
| T-003 | (asignada) completo | Rutas `api/prisma/schema.prisma`, `api/prisma/migrations/**`, `api/src/modules/platform/**`; símbolos `@RequirePermissions`, `@Public`, `requireTenantId` | 2026-10-10 |
