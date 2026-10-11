---
odd: prueba-alta-self-service
updated: 2026-10-10
status: done
via_max: completo
entrega: preguntar
lineas_previstas: 350
---

# Prueba PRO de 14 días en el alta self-service

**Objetivo.** Una empresa dada de alta desde la app (`POST /tenants/onboarding`) nace en
prueba PRO de 14 días y, al vencer, **baja a FREE y sigue funcionando**.

**Por qué.** Decisión de producto del alta de empresa (orbix-mobile,
`docs/odd/alta-empresa.md`, tarea S-A): "prueba de plan completo → baja a FREE". Hasta
ahora el alta creaba la empresa directamente en FREE.

**Alcance.** El alta, el fin de la prueba y la regla "una empresa gratuita por dueño". No
entran: exponer `status`/`trialEndsAt` a la app (S-B), `GET /plans` (S-D), solicitudes de
mejora (S-E), proveedor SMS (S-F), exigir teléfono verificado (S-G). S-C (job de
vencimiento) queda absorbida aquí.

**Restricciones.** C-021 (runtime en vía `completo`). Contrato publicado: `POST
/tenants/onboarding` y `select-tenant` cambian de **valor** (`plan: PRO` durante la
prueba), no de forma. Sin migración.

---

## Diseño

- **Alta** (`TenantsService.onboard`): tenant `plan: PRO`, `status: TRIAL`,
  `trialEndsAt = ahora + 14 días`, `settings.selfServiceTrial = true`; licencia `PRO`,
  `TRIAL`, `expiresAt = trialEndsAt` (vencen juntas). Constantes `SELF_SERVICE_TRIAL_DAYS` y
  `SELF_SERVICE_TRIAL_FLAG` en `license.service.ts`.
- **Fin de la prueba sin job** (`LicenseService.computeValidation`): la API no tiene
  scheduler. La validación perezosa ya existía y corre en cada petición con tenant
  (`LicenseGuard` global, `select-tenant`, refresh). Al encontrar vencida una licencia
  `TRIAL` de un tenant con la marca: la licencia pasa a `EXPIRED` (historial), se emite una
  `FREE` `ACTIVE` sin vencimiento, `syncTenant` deja el tenant en `FREE`/`ACTIVE`, y se audita
  `LICENSE_TRIAL_ENDED_TO_FREE`. Sin la marca (pruebas dadas desde Platform), el camino de
  siempre: `EXPIRED`.
- **Concurrencia:** el cierre de la prueba es un `updateMany` condicionado a
  `status: 'TRIAL'` dentro de la transacción; solo quien lo consigue emite la FREE. La
  petición que llega tarde usa la licencia actual.
- **Plan fresco tras la bajada:** `select-tenant` y el refresh cargan la membresía (con el
  tenant) **antes** de validar. `LicenseValidation.tenantChanged` avisa de la bajada y ambos
  releen el tenant; si no, token y respuesta salían con `plan: PRO`.
- **Extender una prueba** (decisión 2026-10-10): `renewLicense` forzaba `ACTIVE`, así que extender
  una prueba la convertía en licencia pagada y, al vencer, la empresa quedaba `EXPIRED` en vez de
  bajar a FREE. Ahora una licencia `TRIAL` sigue en `TRIAL` al renovarla; para pasarla a pagada
  se emite una `ACTIVE` (`createLicense`). Además, `syncTenant` fija `Tenant.trialEndsAt` con el
  vencimiento de toda licencia `TRIAL` (crear o renovar), para que no se desalinee con la
  licencia, que es la que manda. Dar una prueba nueva a una empresa que ya bajó a FREE:
  `createLicense` con `plan: PRO` y `trialDays`.
- **Regla "una gratuita por dueño":** cuenta también `status: TRIAL`; si no, cada cuenta
  encadenaría pruebas. Mensaje del 409: "Ya tienes una empresa en el plan gratuito o en
  prueba."
- **Marca protegida:** `PATCH /tenants/current/settings` (`settings:manage`) y `PATCH
  /tenants/current/info` (`tenant:edit`, cuerpo `Partial<TenantInfo>`: un tipo, no una clase
  DTO, así que el ValidationPipe no filtra claves) mezclaban cualquier clave en `settings`.
  Ambos pasan por `withoutServerOwnedSettings` (`SERVER_OWNED_SETTINGS`): un administrador no
  puede ponerse la marca en una prueba de Platform ni quitársela a la del alta.

## Contrato

| Endpoint | Antes | Ahora |
|---|---|---|
| `POST /tenants/onboarding` | `plan: FREE`, tenant `ACTIVE` | `plan: PRO`, tenant `TRIAL` (forma igual) |
| `POST /tenants/onboarding` 409 | "Ya tienes una empresa registrada en el plan FREE." | "Ya tienes una empresa en el plan gratuito o en prueba." (también con una prueba) |
| `PATCH /tenants/current/settings`, `PATCH /tenants/current/info` | mezclan cualquier clave | ignoran `selfServiceTrial` |
| `POST /platform/tenants/:id/license/renew` | siempre deja `ACTIVE` | una `TRIAL` sigue `TRIAL`; `trialEndsAt` sigue al vencimiento |
| `PATCH /auth/select-tenant/:slug`, refresh | — | tras vencer la prueba del alta: `plan: FREE` en la misma respuesta |

**Orden de despliegue (C-019):** solo API. La app (orbix-mobile) ya trata `plan` como dato
y el 409 por su código, no por el texto. Ningún cliente se rompe con el despliegue.

---

## Tareas

### T-001 · Prueba PRO en el alta y bajada a FREE al vencer

```
via:     completo
touches: core/tenants, common/services/license, core/auth
status:  doing
ruta:    inline
```

**Done cuando:** una empresa nueva del alta nace PRO/TRIAL +14 d, y al vencer la licencia
la primera petición la deja FREE/ACTIVE y responde `plan: FREE`; una prueba de Platform
sigue expirando.

**Evidencia.**

- **Test:** `pnpm run test` → `Test Suites: 99 passed · Tests: 798 passed`. Nuevos:
  `license.service.self-service-trial.spec.ts` (7: bajada, Platform expira, concurrencia,
  vigente, renovar una prueba la mantiene en prueba y mueve `trialEndsAt`, renovar una pagada no
  cambia, crear con `trialDays` fija `trialEndsAt`), `tenants.service.self-service-trial.spec.ts` (7: alta PRO/TRIAL +14 d con licencia
  alineada, regla cuenta pruebas, 409 sin crear nada, `current/settings` y `current/info` no
  dejan poner ni quitar la marca), `auth.service.trial-downgrade.spec.ts` (2: `select-tenant` relee el tenant tras la
  bajada; sin bajada no hay consulta extra). `eslint` sobre los archivos tocados: 0 errores.
- **Runtime (2026-10-10, API local `:3001`, base de `api/.env`, dos cuentas de prueba
  `sa-trial-*@orbix.test`):**
  1. `POST /auth/register` → 201, 0 empresas.
  2. `POST /tenants/onboarding` → 201, `plan: PRO`, `tenant.plan: PRO`, `branchId`.
     En la base: tenant `PRO`/`TRIAL`, `trialEndsAt` = +14 d, `settings.selfServiceTrial =
     true`; licencia `PRO`/`TRIAL` con el mismo vencimiento.
  3. Segundo `POST /tenants/onboarding` → 409 "Ya tienes una empresa en el plan gratuito o
     en prueba."
  4. `PATCH /tenants/current/settings {selfServiceTrial:false, theme:'dark'}` → 200,
     `selfServiceTrial: true`, `theme: dark`.
  5. Licencia de prueba vencida a mano en la base (solo esa empresa) y 65 s de espera por
     la caché de validación → la primera petición deja en la base tenant `FREE`/`ACTIVE`,
     licencia de prueba `EXPIRED`, nueva `FREE`/`ACTIVE` sin vencimiento y auditoría
     `LICENSE_CREATED, LICENSE_TRIAL_ENDED_TO_FREE`.
  6. **Fallo encontrado en runtime y corregido:** con la primera cuenta, `capabilities` y
     `select-tenant` aún respondían `plan: PRO` en la petición que provocó la bajada
     (membresía cargada antes de validar). Tras `tenantChanged`, con la segunda cuenta:
     `select-tenant` → 200 `plan: FREE`, `tenant.plan: FREE`; `capabilities` con ese token →
     `plan: FREE`.
  7. **`/security-review`** (2026-10-10): un hallazgo, Media, confianza 8 — `PATCH
     /tenants/current/info` escribía la marca (cuerpo sin DTO validado). Test primero en rojo
     (2 fallos: la marca se ponía y se quitaba), corregido con el filtro compartido, en verde.
     Runtime: `PATCH current/info {selfServiceTrial:false, email}` → 200 con el email guardado y
     la marca intacta (`true`) en la base.
  8. **De punta a punta desde la app** (2026-10-10, emulador, orbix-mobile en `dev`): cuenta
     nueva `app-trial-*@orbix.test` → Cafetería → "Cafe Prueba Emulador", México, +52, Centro →
     código SMS del log de la API → "Crear mi negocio" → Inicio con **"Plan PRO"**. En la base:
     tenant `PRO`/`TRIAL`, `trialEndsAt` = +14 d, vertical `RESTAURANT`, `selfServiceTrial:
     true`, `businessTypeId: cafe`; licencia `PRO`/`TRIAL` con el mismo vencimiento.
     Pendiente en la app: el paso 4 aún dice "Plan gratuito · Gratis" (texto neutro de M-6).
  9. **Bajada vista desde la app** (2026-10-10): con la licencia de "Cafe Prueba Emulador" vencida
     a mano por el usuario, una petición de la app la bajó (tenant `FREE`/`ACTIVE`, licencias
     `PRO/EXPIRED` + `FREE/ACTIVE`, auditoría `LICENSE_TRIAL_ENDED_TO_FREE`). Con la app abierta,
     Inicio seguía en "Plan PRO" (la app no relee el tenant mientras está abierta); al reabrirla,
     "Plan FREE". Pendiente para M-8: releer el tenant al volver a primer plano y al renovar.
  10. **Desde Platform** (2026-10-10, el usuario, "Cafe Prueba Emulador" ya en FREE): `renew` con
      `plan: PRO` sobre la licencia FREE → `LICENSE_RENEWED {plan: PRO, status: ACTIVE}`: PRO
      **pagada** de 1 día, que al vencer se bloquearía. Es el comportamiento diseñado (solo una
      `TRIAL` se renueva como `TRIAL`), pero la pantalla no lo deja ver → pendiente **S-H** en
      `orbix-mobile/docs/odd/alta-empresa.md`. Después: suspender y **crear** con `trialDays: 1` →
      `LICENSE_CREATED {status: TRIAL}`, el camino correcto. A petición del usuario se dejó luego en
      prueba PRO de 14 días con un script equivalente a `createLicense` (auditado, nota en la
      licencia).
  - Prueba de Platform expirando: cubierta por test, sin runtime (no se provisionó un
    tenant desde Platform).
  - `capabilities` toma el plan del JWT: con un token emitido antes de la bajada sigue
    diciendo PRO hasta el siguiente refresh o `select-tenant`.
- **Rollback:** los cambios de `license.service.ts` (constantes, `tenantChanged`,
  `isSelfServiceTrial`, `downgradeSelfServiceTrial`), `tenants.service.ts` (alta,
  `SERVER_OWNED_SETTINGS`), el relee en `auth.service.ts`, el resumen de Swagger en
  `tenants.controller.ts` y los tres specs. Los tenants creados en prueba quedarían en
  PRO/TRIAL y al vencer expirarían como los de Platform: si se revierte con pruebas vivas,
  hay que pasarlas a FREE a mano.
- **Vault:** regla de negocio nueva y decisión estructural → `Domain/Administracion Multi-tenant
  (Orbix).md` (flujo self-service y reglas: prueba PRO → FREE, pruebas de Platform expiran,
  la licencia manda sobre `trialEndsAt`, la regla "uno por dueño" cuenta pruebas, la carrera
  pendiente) y **ADR-0033** (fin de prueba en la validación de licencia, sin job), enlazado
  desde `Decisions/ADR.md` y desde el documento de dominio.
- **Commit:** `534ea6f` feat(tenants): el alta self-service nace en prueba PRO y al vencer baja a FREE

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done (falta commit) | inline | ~150 + specs | |

**Entrega:** ~350 previstas · 119 de código + ~300 de specs · umbral ~400 → dentro (los
specs no se cuentan como revisión de lógica, pero están anotados).

**Siguiente paso:** commit (solo los archivos de S-A).

---

## Escaladas

| Tarea | De → a | Trigger | Fecha |
|---|---|---|---|
| T-001 (S-A) | simple → completo | **Concurrencia** (la bajada depende de una transacción y cubre validaciones simultáneas sobre la misma licencia). Al corregir el plan tras la bajada también tocó la ruta `api/src/modules/core/auth/**` | 2026-10-08 / 2026-10-10 |
