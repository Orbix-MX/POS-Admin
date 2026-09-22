---
title: Autorizacion
type: architecture
owner: Requiere validación
updated: 2026-08-06
tags: [arquitectura, autorizacion, orbix-erp]
---

# Autorización

## Orbix ERP

Autorización en capas globales (orden importa, registradas como `APP_GUARD`):

1. **`JwtAuthGuard`** (Passport `AuthGuard('jwt')`) — bypass con el decorador `@Public()`.
2. **`PermissionsGuard`** — lee `@RequirePermissions('modulo:accion')` del handler.
   `SUPER_ADMIN` bypasea toda verificación. Cachea el set de permisos del usuario 60
   segundos por clave `userId:tenantId`. Catálogo canónico en `permissions.constants.ts`
   (`ALL_PERMISSIONS`, `MODULES_ORDER`).

Existen además, implementados pero **no registrados globalmente**:

- **`RolesGuard`** — verificación por rol en vez de permiso granular.
- **`RequirePlanGuard`** — restringe por plan del tenant
  (`FREE < STARTER < PRO < PLUS < ENTERPRISE`).
- **`LicenseGuard`** / **`RequireModuleGuard`** — verifican licencia activa y que el módulo
  esté habilitado como `TenantFeature` del tenant.

El panel Platform usa su propio guard (`PlatformJwtGuard`), sin relación con
`PermissionsGuard` — un `PlatformUser` no tiene permisos de tenant, solo acceso al plano
administrativo completo.

Detalle: [[Administracion Multi-tenant (Orbix)]], `orbix-admin/api/CLAUDE.md`.
