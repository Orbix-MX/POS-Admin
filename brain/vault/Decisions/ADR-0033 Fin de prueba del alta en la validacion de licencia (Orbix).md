---
title: ADR-0033 Fin de prueba del alta en la validacion de licencia (Orbix)
type: adr
owner: Requiere validación
updated: 2026-10-10
tags: [adr, orbix-erp, licencias, multi-tenant, onboarding]
---

# ADR-0033 — La prueba del alta self-service termina en la validación de la licencia, sin job (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · `common/services/license.service.ts`, `core/tenants`, `core/auth` · **Fecha:** 2026-10-10

## Contexto

El alta self-service de la app (`POST /tenants/onboarding`) pasó de crear la empresa en FREE a
crearla en **prueba PRO de 14 días**. Decisión de producto: al terminar la prueba, la empresa
**baja a FREE y sigue funcionando**, no queda bloqueada.

Dos hechos del código condicionaron el cómo:

- La licencia es la fuente de verdad del acceso (`LicenseService`: "every mutation syncs derived
  fields onto the Tenant"). Su validación ya era perezosa: al encontrar una licencia vencida la
  marcaba `EXPIRED` y sincronizaba el tenant a `EXPIRED`, que el JWT, el `LicenseGuard` y
  `select-tenant` bloquean. Con solo cambiar el alta, a los 14 días el negocio quedaba fuera.
- La API no tiene scheduler (`@nestjs/schedule` no está, no hay ningún `@Cron`). El job diario
  de vencimiento previsto (S-C del plan del alta) no tenía dónde vivir.

## Decisión

- **La bajada ocurre en la propia validación.** Cuando `computeValidation` encuentra vencida una
  licencia `TRIAL` de un tenant marcado como prueba del alta, la deja `EXPIRED` (historial),
  emite una licencia `FREE` `ACTIVE` sin vencimiento, sincroniza el tenant a `FREE`/`ACTIVE` y
  audita `LICENSE_TRIAL_ENDED_TO_FREE`. La validación corre en cada petición con tenant, así que
  la bajada sucede en cuanto el negocio vuelve a usar Orbix. Las pruebas dadas desde Platform no
  cambian: siguen expirando.
- **La marca vive en `Tenant.settings.selfServiceTrial`**, que el alta ya rellenaba; sin migración.
  Es una clave **del servidor**: los endpoints que mezclan el cuerpo de la petición en
  `settings` (`PATCH /tenants/current/settings`, `PATCH /tenants/current/info`) la ignoran.
- **La licencia sigue mandando; `Tenant.trialEndsAt` la refleja.** Toda licencia `TRIAL`, al
  crearse o renovarse, fija `trialEndsAt`. Editar `trialEndsAt` a mano no cambia el acceso.
- **Extender una prueba no la convierte en pagada.** `renewLicense` mantiene `TRIAL` si la
  licencia actual es de prueba; para pasarla a pagada se emite una `ACTIVE`.
- **Concurrencia:** el cierre de la prueba es un `updateMany` condicionado a `status: 'TRIAL'`;
  solo quien lo consigue emite la FREE.
- **Plan fresco:** `LicenseValidation.tenantChanged` avisa de la bajada para que `select-tenant`
  y el refresh relean el tenant y no emitan un token con el plan anterior.

## Consecuencias

- No hay infraestructura nueva (ni scheduler, ni columna, ni migración).
- Un tenant cuya prueba venció pero que nadie usa sigue figurando como `PRO`/`TRIAL` en la base
  hasta su siguiente petición. Para reportes de Platform ("pruebas activas"), contar por
  `License.expiresAt`, no por `Tenant.status`. — Requiere validación (no hay reporte que lo use hoy)
- Un token emitido antes de la bajada conserva el plan anterior en su payload hasta el siguiente
  refresh o `select-tenant`; el acceso real lo aplica el servidor en cada petición.
- Si algún día hay scheduler, puede adelantar la bajada llamando a la misma validación; la regla
  no cambia de sitio.

## Evidencia

`api/src/common/services/license.service.ts` (`SELF_SERVICE_TRIAL_*`, `downgradeSelfServiceTrial`,
`tenantChanged`, `renewLicense`, `syncTenant`), `api/src/modules/core/tenants/tenants.service.ts`
(`onboard`, `withoutServerOwnedSettings`), `api/src/modules/core/auth/auth.service.ts` (relectura
tras la bajada), sus specs `*.self-service-trial.spec.ts` y `auth.service.trial-downgrade.spec.ts`.
Verificación con la API arrancada y desde la app en `docs/odd/prueba-alta-self-service.md`.

## Relacionado

[[Administracion Multi-tenant (Orbix)]] · [[ADR-0021 Autenticacion en dos pasos (Orbix)]] ·
[[ADR]]
