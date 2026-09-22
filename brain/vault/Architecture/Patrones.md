---
title: Patrones
type: architecture
owner: Requiere validación
updated: 2026-08-06
tags: [arquitectura, patrones, orbix-erp]
---

# Patrones

## Orbix ERP — monolito modular por vertical

Organización por área de negocio, no por capa técnica: `core/` (transversal), `retail/`,
`restaurant/`, `platform/` (super-admin). Dentro de cada módulo Nest, la lógica vive en el
`*.service.ts` directamente — no hay una separación domain/application/infrastructure.
**Requiere validación** si esto es una decisión deliberada documentada en algún lugar o
simplemente el estado actual del código.

Patrón fijo en el frontend web (`web/CLAUDE.md`): **service → hook → page**.
- `services/*-service.ts` — solo llamadas HTTP.
- `hooks/use-*.ts` — estado, CRUD, filtros, paginación.
- `pages/*.tsx` — solo renderizado.

Paginación estandarizada vía `ListResponse<T>` (tipo compartido en `packages/types`), no
cada endpoint inventa su propio formato.

Ver [[Arquitectura general]] y `orbix-admin/api/CLAUDE.md`, `orbix-admin/web/CLAUDE.md`.
