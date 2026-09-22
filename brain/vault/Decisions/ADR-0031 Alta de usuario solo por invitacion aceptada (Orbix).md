---
title: ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-23
tags: [adr, orbix-erp, seguridad, identidad]
---

# ADR-0031 — Alta de usuario solo por invitación aceptada, nunca por contraseña fijada por un tercero (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · módulos `core/users`, `core/invitations` · **Fecha:** 2026-08-23

## Contexto

`POST /users` daba de alta una cuenta con la contraseña que escribía el administrador que
la creaba. Eso chocaba con dos hechos del modelo de datos: `User.email` es único a nivel de
plataforma (no por tenant), pero `TenantMembership` existe justamente para que una misma
persona trabaje en varias empresas de Orbix (un contador externo, alguien con dos
negocios). El endpoint resolvía el choque rechazando con 409 cualquier alta cuyo correo ya
existiera — imposibilitando ese caso legítimo.

Durante el desarrollo de la solución se llegó a implementar (y revertir en el mismo ciclo)
un atajo: si el correo ya existía, añadir la membresía directo, sin pedir confirmación a
esa persona. El problema de seguridad es directo — un administrador podría escribir el
correo de un desconocido, y si el endpoint aceptara además la contraseña del formulario,
tomaría el control de esa cuenta y, con ella, de todas las demás empresas a las que
perteneciera. Incluso sin tocar la contraseña, añadir a alguien a una empresa sin que lo
sepa es un problema de consentimiento, no solo de seguridad técnica.

## Decisión

Dar de alta a una persona en una empresa pasa siempre por una invitación que ella acepta:

- `POST /users/invitations` crea un `TenantInvitation` (token de un solo uso, TTL 72h,
  guardado solo como SHA-256 — mismo patrón que `RefreshToken`/`OAuthTicket`) y envía un
  correo con el enlace.
- `GET /invitations/:token` (público) muestra el preview sin revelar nada sensible más allá
  de si el correo ya tiene cuenta.
- `POST /invitations/:token/accept` (público) se bifurca:
  - **Correo sin cuenta:** la persona fija su propio nombre y contraseña ahí. La cuenta
    nace sin ningún rol asignado.
  - **Correo con cuenta:** exige sesión iniciada de ESE correo exacto. Sin sesión → 401
    `LOGIN_REQUIRED`. Con sesión de otra cuenta → 401 `WRONG_ACCOUNT`. Tener el enlace
    nunca basta por sí solo.

`POST /users` (alta directa con contraseña) queda `@deprecated`: si el correo ya existe,
devuelve 409 con `code: 'USER_EXISTS_INVITE_REQUIRED'` en vez de crear o vincular nada, para
que el cliente ofrezca invitar.

Los roles de la invitación se validan dos veces —al invitar y al aceptar— porque entre
ambos momentos pueden borrarse, y porque quien invita no puede repartir permisos que él
mismo no posee (misma regla de `assertActorCanGrant` que gobierna la asignación directa de
roles).

## Evidencia

`api/src/modules/core/invitations/` (servicio, controller, DTOs), `api/src/modules/core/users/users.service.ts`
(`create()` marcado `@deprecated`, 409 con `code`), `prisma/schema.prisma` (`TenantInvitation`),
migración `20260823010000_tenant_invitations`, `web/src/pages/invitacion.tsx`.

## Consecuencias

**Positivas**
- Cierra la vía de apropiación de cuenta que el atajo revertido habría abierto.
- Una misma persona puede pertenecer a varias empresas de la plataforma sin fricción ni
  altas duplicadas — el caso que el 409 original bloqueaba sin necesidad.
- Nadie entra a una empresa sin haberlo aceptado explícitamente desde su propio correo.

**Negativas**
- Un paso más que crear la cuenta directo: el alta ya no es instantánea, depende de que el
  correo llegue y de que la persona lo acepte.
- La entrega del correo depende de un proveedor externo (ver
  [[ADR-0032 Envio de invitaciones por Gmail API en lugar de SMTP (Orbix)]]) — sin
  confirmación de entrega, un correo que cae en spam se ve igual, desde el servidor, que uno
  entregado.
- `POST /users` sigue existiendo por compatibilidad con clientes que no hayan migrado; es
  deuda a limpiar cuando ya no se use.

## Notas

`MembershipStatus.INVITED` existía en el schema desde antes sin ningún código que lo
produjera (ver [[Administracion Multi-tenant (Orbix)]]) — sugiere que esta necesidad ya se
había anticipado en el diseño de datos, aunque no hay evidencia de que el flujo actual sea
el que se tenía en mente originalmente. **Requiere validación** si conviene que el estado
de la membresía pase por `INVITED` mientras la invitación está pendiente, en vez de no
existir la membresía hasta la aceptación (que es el comportamiento actual).
