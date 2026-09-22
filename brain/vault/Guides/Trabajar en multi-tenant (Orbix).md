---
title: Trabajar en multi-tenant (Orbix)
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, orbix-erp, multi-tenant]
---

# Trabajar en multi-tenant (Orbix)

## Cuándo usar esta guía

Vas a escribir o revisar código en Orbix ERP API que lee o escribe datos tenant-owned (casi
todo el sistema, salvo `platform/`).

## Requisitos

- Haber leído [[Administracion Multi-tenant (Orbix)]] y ADR-0020.

## Pasos

1. Identifica si el modelo Prisma que tocas es tenant-owned (tiene columna `tenantId`). Si
   es un modelo nuevo y debería serlo, agrega `tenantId` y `@@unique([tenantId, ...])`.
2. En el servicio, obtén el tenant activo siempre vía
   `tenantContext.requireTenantId()` (`TenantContextService`, poblado por
   `AuditContextInterceptor`) — **nunca** confíes en un `tenantId` que venga en el body o en
   query params del cliente.
3. Toda query a ese modelo debe filtrar explícitamente por el `tenantId` del contexto. No
   hay un filtro automático a nivel de Prisma/ORM que lo haga por ti.
4. Si el endpoint requiere un permiso específico, agrégalo con
   `@RequirePermissions('modulo:accion')` y regístralo en `permissions.constants.ts`
   (`ALL_PERMISSIONS`). Recuerda que `SUPER_ADMIN` bypasea toda verificación de permiso —
   pruébalo también con un rol no-admin.
5. Si el endpoint es del panel Platform (super-admin de Orbix sobre todos los tenants), no
   uses `TenantContextService` — ese plano opera fuera del contexto de un tenant, protegido
   por `PlatformJwtGuard` en su lugar.

## Verificación

- Un test crea datos en dos tenants distintos y confirma que un usuario del tenant A nunca
  puede leer datos del tenant B a través del endpoint que tocaste.
- Auditoría (`createdById`/`updatedById`) se está seteando manualmente en el servicio —
  Prisma 7 no lo automatiza (ver [[Roadmap]]).

## Trampas conocidas

| Síntoma | Causa |
|---|---|
| Un usuario ve datos de otro tenant | Query sin filtro de `tenantId`, o `tenantId` tomado del body en vez del contexto |
| Endpoint accesible sin el permiso esperado | Falta `@RequirePermissions` o el permiso no está en `permissions.constants.ts` |
| `RolesGuard`/`RequirePlanGuard` no aplican | Existen pero no están registrados globalmente todavía — ver [[Roadmap]] |

## Si no funciona

Compara contra un módulo ya maduro de `retail/` o `core/` en `api/src/modules/`, y revisa
`api/CLAUDE.md`.
