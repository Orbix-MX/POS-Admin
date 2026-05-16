---
name: pos-admin project architecture
description: Stack, directorios, patrones clave y decisiones de arquitectura del proyecto pos-admin
type: project
---

Stack: NestJS 11 + Prisma 7 + PostgreSQL (Neon serverless) en `api/`, React 19 + Vite + TypeScript + Tailwind CSS 4 + Zustand en `web/`. Package manager pnpm en api, npm en web.

**Why:** SPA sin SSR con API REST multi-tenant. Global prefix `/api`. Swagger en `/api/docs`.

**How to apply:** Al agregar endpoints respetar el prefix `/api`. Al agregar modelos en Prisma, siempre incluir `tenantId` y el composite unique `@@unique([tenantId, field])`. En servicios usar `this.tenantContext.requireTenantId()` — nunca confiar en tenantId del request body.

Directorios clave:
- `api/prisma/schema.prisma` — único source of truth del schema
- `api/src/modules/<feature>/` — triplet module/controller/service + dto/
- `api/src/common/` — guards, decorators, ALS context services, PaginationDto/PaginatedResponse
- `web/src/services/*-service.ts` — solo llamadas HTTP
- `web/src/hooks/use-*.ts` — estado local, efectos, lógica CRUD
- `web/src/pages/*.tsx` — solo renderizado

Patrón de paginación del API: devuelve `{ data: T[], meta: { page, limit, total, totalPages } }`.

Estado de la BD: usa Neon PostgreSQL. La BD ya tenía tablas sin historial de migraciones — `prisma migrate dev` detecta drift y requiere reset. Usar `prisma db push` para sincronizar cambios de schema sin destruir datos, seguido de `prisma generate`.

Módulos web implementados: dashboard, ventas, compras, inventario, clientes, proveedores, contabilidad, reportes, configuracion, usuarios, roles. Routing en `web/src/App.tsx` con `PATH_TO_MODULE`. Nav en `web/src/components/shared/sidebar.tsx` bajo grupos "Negocio" y "Administración". Breadcrumbs en `web/src/components/shared/topbar.tsx` via `MODULE_META`. Tipos de módulo en `web/src/types/erp.ts` → `ModuleId` union.

Patrón de tipos en hooks con `useState`: cuando el estado puede tomar valores distintos al literal inicial (ej: role='STAFF' que luego puede ser 'ADMIN'), declarar una interfaz explícita y pasarla como genérico a useState — no confiar en la inferencia del valor inicial.
