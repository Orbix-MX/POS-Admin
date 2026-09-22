---
title: Orbix ERP API
type: system
owner: Requiere validación
updated: 2026-08-06
tags: [sistema, orbix-erp, backend]
---

# Orbix ERP API

## Responsabilidad

Backend único de Orbix ERP (carpeta `orbix-admin/`, repo GitHub `Orbix-MX/POS-Admin`). Dueño del modelo de datos multi-tenant y de
todas las reglas de negocio: ventas, inventario, compras, cuentas por cobrar/pagar, caja,
restaurante, servicios/taller, RRHH y administración de tenants. No responde por
presentación: la hacen el Web y las apps.

## Tecnologías

| Área | Elección |
|---|---|
| Plataforma | NestJS 11 |
| Datos | PostgreSQL (Neon) vía Prisma 7 con `@prisma/adapter-pg` |
| Autenticación | JWT en dos pasos (login → tenant → sucursal) + JWT independiente para el panel Platform |
| Multi-tenancy | Columna `tenantId` + `AsyncLocalStorage` (`TenantContextService`) |
| Docs | Swagger en `/api/docs` |

## Repositorio

`orbix-admin/api` dentro del monorepo pnpm + Turbo `orbix-admin/`. Prefijo global `/api`, puerto 3001.

## Estructura

```
api/src/
  modules/
    core/         auth, branches, cash-sessions, customers, dashboard(s), devices, email,
                  employees, license, payables, permissions, printer-configs, receivables,
                  reports, roles, staff, tenants, users
    retail/       categories, checkout, coupons, inventory, measurement-units, orders,
                  products, purchases, service-quotes, services, suppliers, supplies,
                  work-orders
    restaurant/   restaurant, kitchen (KDS), dining-areas, tables, dining-orders
    platform/     platform-auth, platform-tenants, platform-branches, platform-dashboards,
                  platform-licenses — super-admin SaaS, JWT y guard separados
  common/         guards, decorators, context (ALS), helpers, filters, interceptors, dto
prisma/
  schema.prisma   ~90 modelos/enums
  migrations/
```

## Módulos

Ver [[Modulos de Orbix ERP API]].

## Dependencias

- PostgreSQL (Neon).
- Cloudflare R2 (o equivalente) para imágenes de producto — **Requiere validación** el
  proveedor exacto.

## Integraciones

Consumido por [[Orbix ERP Web]] y, en el futuro, por [[Orbix Apps Moviles y Desktop]] — todo
vía REST/JSON con JWT Bearer. Sin mensajería ni comunicación servidor-a-servidor con
ningún sistema externo detectada. Ver [[Integraciones]].

## Riesgos y deuda

- `inventory.engine.ts` tiene 5 TODOs "Phase 2" (producción, transferencias, mermas,
  inventario inicial, conteos físicos).
- Auditoría (`createdById`/`updatedById`) es manual: Prisma 7 quitó el middleware `$use` que
  antes la automatizaba.
- `RolesGuard` y `RequirePlanGuard` existen pero no están registrados globalmente.
- No existe `CLAUDE.md` en la raíz del repo (vacío); las convenciones reales viven en
  `api/CLAUDE.md` y `web/CLAUDE.md`.
