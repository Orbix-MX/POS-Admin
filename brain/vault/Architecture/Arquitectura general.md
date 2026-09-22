---
title: Arquitectura general
type: architecture
owner: Requiere validación
updated: 2026-08-17
tags: [arquitectura, orbix-erp]
---

# Arquitectura general

Detalle técnico del producto. Resumen ejecutivo en [[Arquitectura]] (Home).

## Orbix ERP

**Patrón**: monolito modular NestJS, organizado por vertical de negocio en vez de por capas
DDD estrictas: `core/` (transversal), `retail/`, `restaurant/`, `platform/`
(super-admin). No hay evidencia de capas domain/application/infrastructure separadas —
la lógica vive directamente en los `*.service.ts` de cada módulo Nest.
**Requiere validación** si existe algún módulo con capas más estrictas no detectado en el
análisis inicial.

**Multi-tenancy**: aislamiento por columna `tenantId` en cada modelo Prisma tenant-owned
(reforzado con `@@unique([tenantId, ...])`), propagado sin pasarlo explícito por cada capa
vía `AsyncLocalStorage` (`TenantContextService`). El filtrado por `tenantId` es **manual en
cada query** (no hay middleware ni RLS): ver [[Administracion Multi-tenant (Orbix)]] y
[[Separacion de datos por vertical (Orbix)]].

**Datos**: una sola base PostgreSQL, un solo `PrismaClient`, 80 modelos en un
`schema.prisma` de ~2 500 líneas sin schemas lógicos. El análisis de partición por vertical
y la alternativa recomendada están en [[Separacion de datos por vertical (Orbix)]]
([[ADR-0029 Schemas de Postgres por dominio en lugar de bases separadas (Orbix)]]).

**Infraestructura**: PostgreSQL (Neon) vía Prisma 7 + `@prisma/adapter-pg`, sin cola de
trabajos ni cache detectados. Swagger en `/api/docs`.

**Monorepo**: pnpm workspaces + Turbo. `api/` (backend), `web/` (React/Vite/Zustand),
`apps/pos` (Flutter, pre-arquitectura), `apps/mobile/orbix-app` (Expo, scaffold),
`apps/desktop` (sin código fuente visible), `packages/orbix_design_system` (Flutter),
`packages/types` (TS compartido). Ver [[Orbix ERP API]] y [[Orbix ERP Web]].
