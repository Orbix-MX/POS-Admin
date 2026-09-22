---
title: Crear un modulo
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, modulos]
---

# Crear un módulo

## Cuándo usar esta guía

Vas a agregar un módulo de negocio nuevo (no un submódulo técnico transversal) a
Orbix ERP API.

## Requisitos

- Haber leído [[Patrones]] y el módulo existente más parecido al que vas a crear.
- Si el módulo implica una decisión estructural (nuevo patrón, nueva dependencia), escribe
  un ADR primero — ver `Templates/ADR (plantilla).md`.

## Pasos

### Orbix ERP API

1. Identifica el grupo correcto: `core/` (transversal), `retail/`, `restaurant/` o
   `platform/` (super-admin) — ver [[Modulos de Orbix ERP API]].
2. Crea el módulo Nest estándar dentro del grupo correspondiente en `api/src/modules/`.
3. Todo modelo Prisma nuevo que sea tenant-owned lleva columna `tenantId` y
   `@@unique([tenantId, ...])` — ver ADR-0020.
4. Protege los endpoints con `@RequirePermissions('modulo:accion')` y agrega el permiso al
   catálogo canónico en `permissions.constants.ts`.
5. Actualiza [[Modulos de Orbix ERP API]] con el módulo nuevo.

## Verificación

- El módulo compila y sus tests (unit al menos) pasan.
- El módulo aparece enlazado desde su índice de sistema — un documento sin enlaces entrantes
  es invisible.

## Trampas conocidas

- En Orbix ERP, olvidar `tenantId` en un modelo nuevo es una fuga de datos entre tenants —
  no hay filtro automático a nivel de framework, depende del `TenantContextService`.

## Si no funciona

Compara contra el módulo existente más similar antes de improvisar un patrón nuevo.
