---
title: Administracion Multi-tenant (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-23
tags: [negocio, orbix-erp, multi-tenant, plataforma]
---

# Administración Multi-tenant (Orbix)

## ¿Qué es?

Tres procesos relacionados pero distintos: (1) cómo un tenant administra sus propios usuarios,
roles y sucursales día a día, (2) cómo Orbix (como proveedor) provisiona y administra tenants
desde el panel "Platform", y (3) cómo un cliente nuevo se da de alta él mismo desde la app
móvil (self-service, plan FREE).

## Objetivo

Que cada tenant esté aislado de los demás (datos, usuarios, permisos) y que Orbix pueda
operar la plataforma completa (altas, licencias, límites por plan) sin mezclar ese rol con
el de un usuario normal de un tenant.

## Flujo

**Dentro de un tenant**
```
Login (2 pasos: credenciales → seleccionar tenant → seleccionar sucursal)
  → usuario actúa con los permisos de su(s) Role(s) (RBAC granular, modulo:accion)
  → SUPER_ADMIN del tenant bypasea todas las verificaciones de permiso
```

**Alta de un usuario en el tenant (por invitación)** — ver
[[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)]]
```
Admin invita por correo (POST /users/invitations, requiere users:create)
  → TenantInvitation con token de un solo uso (72h) + correo enviado
    → persona abre el enlace: GET /invitations/:token (preview público)
      → si su correo NO tiene cuenta: fija nombre + contraseña ahí mismo
      → si SÍ tiene cuenta: debe iniciar sesión con ESE correo exacto
        (tener el enlace nunca basta por sí solo)
    → POST /invitations/:token/accept crea la TenantMembership
```
Reemplaza el alta directa con contraseña (`POST /users`, ahora `@deprecated`), que
respondía 409 sin más si el correo ya existía en la plataforma — bloqueando el caso
legítimo de una persona que trabaja en varias empresas de Orbix. Ese endpoint sigue
existiendo mientras haya clientes sin migrar; si el correo ya existe, devuelve
`code: 'USER_EXISTS_INVITE_REQUIRED'` en vez de crear o vincular nada.

**Desde Platform (Orbix como proveedor)**
```
PlatformUser se autentica con JWT propio (platform-jwt, separado del flujo de tenant)
  → provisiona un Tenant nuevo (plan, vertical, features habilitadas, límites)
  → gestiona Branch, License, Device y dashboards a nivel plataforma
  → PlatformAuditLog registra cada acción
```

**Self-service (app móvil, alta del cliente)** — Requiere validación
```
Usuario se registra (POST /auth/register, sin tenant aún)
  → wizard móvil captura lo esencial: nombre de empresa, teléfono, país,
    moneda, vertical/tipo de negocio
  → POST /tenants/onboarding (cualquier usuario autenticado sin tenant)
  → transacción: Tenant en plan FREE fijo + Branch principal + membership
    OWNER + rol "Owner" con todos los permisos + licencia FREE
  → responde con access token ya scoped al tenant nuevo (evita el
    PATCH /auth/select-tenant/:slug manual)
```
La información complementaria (branding, sucursales extra, roles finos,
upgrade de plan) se sigue completando después desde Platform, igual que en
el flujo de provisioning — el wizard móvil solo cubre el alta mínima.

## Reglas de negocio encontradas

- Todo modelo tenant-owned usa `@@unique([tenantId, ...])` — el aislamiento es a nivel de
  esquema, no solo de código de aplicación.
- El contexto de tenant/sucursal viaja en el JWT (`tenantId`, `tenantRole`, `branchId`,
  `posOnly`), nunca como parámetro explícito confiable — los servicios deben leerlo de
  `TenantContextService`, no del body de la request.
- Permisos con formato `modulo:accion`, cacheados 60 segundos por `userId:tenantId`.
  `SUPER_ADMIN` bypasea toda verificación de permiso.
- El plan del tenant (`FREE < STARTER < PRO < PLUS < ENTERPRISE`) determina qué features
  puede tener activas — el guard que lo aplica (`RequirePlanGuard`) existe pero **no está
  registrado globalmente todavía** (ver [[Roadmap]]).
- El plan FREE incluye el módulo `inventario` (`SystemModule.INVENTARIO`, `getModulesForPlan`
  en `packages/types`) desde 2026-08-09 — antes solo estaba desde STARTER, lo cual bloqueaba
  con 403 crear/ver productos y categorías en cualquier tenant FREE aunque `ventas` (que sí
  era FREE) ya lo requiriera para tener algo que vender. `insumos` (recetas/supplies) se
  queda en STARTER.
- El flujo Platform es completamente independiente: un `PlatformUser` no es un `User` de
  ningún tenant, y su JWT no sirve contra los endpoints normales.
- El alta self-service (`POST /tenants/onboarding`) siempre crea el tenant en plan FREE —
  el cliente no elige plan en el wizard, eso se gestiona después desde Platform. — Requiere
  validación
- Un mismo usuario no puede tener dos tenants propios en plan FREE activos simultáneamente
  (`ownerUserId` + `plan=FREE` + status ACTIVE/TRIAL rechaza con 409); sí puede tener varios
  si alguno fue upgradeado. — Requiere validación (regla inferida del contrato móvil, no
  confirmada por producto)
- No existe todavía un seed de roles por vertical (RETAIL/RESTAURANT/GYM/SERVICES): tanto
  el provisioning desde Platform como el self-service crean un único rol con todos los
  permisos. Confirmado por inspección directa de datos (2026-08-09) que el nombre de ese rol
  **no es consistente**: tenants dados de alta vía `prisma/seed.ts` lo llaman "Super Admin",
  los dados de alta vía `POST /tenants/onboarding` (self-service) lo llaman "Owner" — dos
  rutas de alta distintas, mismo propósito, nombres distintos.
- **Bug de datos corregido (2026-08-09)**: los `RolePermission` de ese rol full-access solo
  se poblaban una vez, al crear el tenant — un tenant dado de alta antes de que existiera un
  permission key (ej. `products:*`, agregado después) nunca lo recibía retroactivamente,
  dejando el 403 aunque el módulo del plan estuviera habilitado. `seed.ts` ya traía su propio
  resync para esto ("Delete and recreate permissions for system roles to keep them in sync")
  pero solo corría en un `prisma db seed` manual. `PermissionsService.onModuleInit` ahora
  también corre `syncOwnerRolePermissions()` en cada boot del API — otorga cualquier permiso
  del catálogo actual que le falte a un rol `isSystem` llamado "Owner" o "Super Admin", sin
  tocar roles curados (Admin/Gerente/Vendedor). Self-healing: no requiere migración de datos
  ni volver a correr el seed manualmente.

## Conceptos importantes

| Concepto | Significado |
|---|---|
| Tenant | Cliente de la plataforma; unidad de aislamiento |
| TenantFeature | Módulo opcional activable por tenant |
| Role / Permission | RBAC granular por acción (`modulo:accion`) |
| PlatformUser | Usuario interno de Orbix, fuera del flujo de cualquier tenant |

## Sistemas que participan

- [[Orbix ERP API]] — módulos `core/tenants` (incluye `POST /tenants/onboarding`,
  self-service), `core/users`, `core/invitations` (alta por invitación, ver
  [[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)]]), `core/roles`,
  `core/permissions`, `core/branches`, `core/license`, y todo `platform/`.
- [[Orbix ERP Web]] — flujo de login/selección de tenant-sucursal, páginas `usuarios`,
  `roles`, `configuracion`, y sección `platform/`.
- [[Orbix Apps Moviles y Desktop]] — wizard de alta de empresa (`apps/mobile/orbix-mobile`,
  grupo de rutas `(wizard)`), único cliente del self-service hoy.

## Relaciones con otros procesos

- ← todos los demás procesos de Orbix ERP dependen de este para saber en qué tenant/sucursal
  operan y con qué permisos.
