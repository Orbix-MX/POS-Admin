---
title: Migraciones de base de datos
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, base-de-datos, prisma]
---

# Migraciones de base de datos

## Cuándo usar esta guía

Vas a cambiar `api/prisma/schema.prisma` en Orbix ERP API (Prisma sobre PostgreSQL).

## Requisitos

- Entorno local levantado — ver [[Levantar entorno]].
- Acceso a la base de datos de desarrollo (Neon u otra) configurada en `.env`.

## Pasos

1. Edita `prisma/schema.prisma`.
2. `prisma migrate dev --name <descripcion>` en desarrollo — genera y aplica la migración,
   nunca `prisma db push` fuera de prototipado rápido.
3. Revisa el SQL generado en `prisma/migrations/` antes de commitear — Prisma no siempre
   elige la estrategia más segura para cambios destructivos (por ejemplo, un `DROP COLUMN`
   con datos existentes).
4. Sigue las convenciones de nombres: modelos PascalCase singular, tablas
   snake_case plural (`@@map`), columnas snake_case (`@map`), FKs `<entidad>_id`, índices
   `idx_<tabla>_<cols>`, constraints únicos `uq_<tabla>_<cols>`. Toda FK lleva índice
   explícito.
5. En Orbix ERP, todo modelo tenant-owned nuevo lleva `tenantId` +
   `@@unique([tenantId, ...])` — ver ADR-0020.
6. `prisma migrate deploy` en CI/producción, nunca `migrate dev`.

## Verificación

- La migración aplica limpio sobre una base de datos vacía y sobre una con datos de
  desarrollo existentes.
- Los tests de integración pasan.

## Trampas conocidas

| Síntoma | Causa |
|---|---|
| `prisma db push` usado en vez de `migrate dev` | Se pierde el historial de migraciones versionado — evitarlo fuera de prototipado |
| Middleware `$use` de Prisma no dispara (Orbix ERP) | Prisma 7 lo quitó; la auditoría (`createdById`/`updatedById`) hoy es manual en cada servicio |

## Si no funciona

Comparar contra un modelo existente en `api/prisma/schema.prisma`.
